from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable

from .data_loader import WordItem


@dataclass(frozen=True)
class ProgressRow:
    word_key: str
    times_seen: int
    due_date: date
    last_sent_at: datetime | None


def _to_iso_day(value: date) -> str:
    return value.isoformat()


def _from_iso_day(value: str) -> date:
    return date.fromisoformat(value)


def _from_iso_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


class BotStorage:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.conn = sqlite3.connect(str(db_path))
        self.conn.row_factory = sqlite3.Row
        self._create_schema()

    def close(self) -> None:
        self.conn.close()

    def _create_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS words (
                word_key TEXT PRIMARY KEY,
                rank_num INTEGER NOT NULL,
                count_num INTEGER,
                word TEXT NOT NULL,
                translation_ru TEXT,
                translation_en TEXT,
                meaning TEXT,
                example TEXT,
                example_page INTEGER
            );

            CREATE TABLE IF NOT EXISTS progress (
                word_key TEXT PRIMARY KEY,
                times_seen INTEGER NOT NULL DEFAULT 0,
                due_date TEXT NOT NULL,
                last_sent_at TEXT,
                FOREIGN KEY(word_key) REFERENCES words(word_key)
            );

            CREATE TABLE IF NOT EXISTS daily_batches (
                batch_key TEXT PRIMARY KEY,
                batch_date TEXT NOT NULL,
                batch_type TEXT NOT NULL,
                words_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
        self.conn.commit()

    def upsert_words(self, words: Iterable[WordItem], today: date) -> None:
        rows = [
            (
                w.key,
                w.rank,
                w.count,
                w.word,
                w.translation_ru,
                w.translation_en,
                w.meaning,
                w.example,
                w.example_page,
            )
            for w in words
        ]
        self.conn.executemany(
            """
            INSERT INTO words (
                word_key, rank_num, count_num, word, translation_ru, translation_en, meaning, example, example_page
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(word_key) DO UPDATE SET
                rank_num=excluded.rank_num,
                count_num=excluded.count_num,
                word=excluded.word,
                translation_ru=excluded.translation_ru,
                translation_en=excluded.translation_en,
                meaning=excluded.meaning,
                example=excluded.example,
                example_page=excluded.example_page;
            """,
            rows,
        )

        self.conn.execute(
            """
            INSERT INTO progress(word_key, times_seen, due_date, last_sent_at)
            SELECT w.word_key, 0, ?, NULL
            FROM words w
            LEFT JOIN progress p ON p.word_key = w.word_key
            WHERE p.word_key IS NULL;
            """,
            (_to_iso_day(today),),
        )
        self.conn.commit()

    def get_due_words(self, today: date, limit: int) -> list[sqlite3.Row]:
        return self.conn.execute(
            """
            SELECT w.*, p.times_seen, p.due_date, p.last_sent_at
            FROM words w
            JOIN progress p ON p.word_key = w.word_key
            WHERE date(p.due_date) <= date(?)
            ORDER BY date(p.due_date) ASC, p.times_seen DESC, w.rank_num ASC
            LIMIT ?;
            """,
            (_to_iso_day(today), limit),
        ).fetchall()

    def get_new_words(self, limit: int) -> list[sqlite3.Row]:
        return self.conn.execute(
            """
            SELECT w.*, p.times_seen, p.due_date, p.last_sent_at
            FROM words w
            JOIN progress p ON p.word_key = w.word_key
            WHERE p.times_seen = 0
            ORDER BY w.rank_num ASC
            LIMIT ?;
            """,
            (limit,),
        ).fetchall()

    def get_least_recent(self, limit: int) -> list[sqlite3.Row]:
        return self.conn.execute(
            """
            SELECT w.*, p.times_seen, p.due_date, p.last_sent_at
            FROM words w
            JOIN progress p ON p.word_key = w.word_key
            ORDER BY COALESCE(p.last_sent_at, '1970-01-01T00:00:00') ASC, w.rank_num ASC
            LIMIT ?;
            """,
            (limit,),
        ).fetchall()

    @staticmethod
    def _interval_days(times_seen: int) -> int:
        if times_seen <= 1:
            return 2
        if times_seen == 2:
            return 4
        if times_seen == 3:
            return 7
        if times_seen == 4:
            return 14
        if times_seen == 5:
            return 30
        return 45

    def mark_sent(self, word_keys: list[str], now_dt: datetime, today: date) -> None:
        for key in word_keys:
            row = self.conn.execute(
                "SELECT times_seen FROM progress WHERE word_key = ?;",
                (key,),
            ).fetchone()
            if row is None:
                continue
            new_times_seen = int(row["times_seen"]) + 1
            interval = self._interval_days(new_times_seen)
            next_due = today + timedelta(days=interval)
            self.conn.execute(
                """
                UPDATE progress
                SET times_seen = ?, due_date = ?, last_sent_at = ?
                WHERE word_key = ?;
                """,
                (new_times_seen, _to_iso_day(next_due), now_dt.isoformat(timespec="seconds"), key),
            )
        self.conn.commit()

    def save_batch(self, batch_key: str, batch_date: date, batch_type: str, words: list[str], now_dt: datetime) -> None:
        self.conn.execute(
            """
            INSERT OR REPLACE INTO daily_batches(batch_key, batch_date, batch_type, words_json, created_at)
            VALUES (?, ?, ?, ?, ?);
            """,
            (batch_key, _to_iso_day(batch_date), batch_type, json.dumps(words, ensure_ascii=False), now_dt.isoformat(timespec="seconds")),
        )
        self.conn.commit()

    def get_batch_words(self, batch_key: str) -> list[str] | None:
        row = self.conn.execute(
            "SELECT words_json FROM daily_batches WHERE batch_key = ?;",
            (batch_key,),
        ).fetchone()
        if row is None:
            return None
        try:
            return json.loads(row["words_json"])
        except Exception:
            return None

    def fetch_words_by_keys(self, keys: list[str]) -> list[sqlite3.Row]:
        if not keys:
            return []
        placeholders = ",".join("?" for _ in keys)
        rows = self.conn.execute(
            f"""
            SELECT w.*, p.times_seen, p.due_date, p.last_sent_at
            FROM words w
            JOIN progress p ON p.word_key = w.word_key
            WHERE w.word_key IN ({placeholders});
            """,
            keys,
        ).fetchall()
        by_key = {row["word_key"]: row for row in rows}
        return [by_key[k] for k in keys if k in by_key]

    def stats(self, today: date) -> dict[str, int]:
        total = self.conn.execute("SELECT COUNT(*) AS c FROM words;").fetchone()["c"]
        seen = self.conn.execute("SELECT COUNT(*) AS c FROM progress WHERE times_seen > 0;").fetchone()["c"]
        due = self.conn.execute(
            "SELECT COUNT(*) AS c FROM progress WHERE date(due_date) <= date(?);",
            (_to_iso_day(today),),
        ).fetchone()["c"]
        unseen = total - seen
        return {"total": total, "seen": seen, "unseen": unseen, "due_today": due}

