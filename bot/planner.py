from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from .storage import BotStorage


@dataclass(frozen=True)
class PlannedBatch:
    word_keys: list[str]
    batch_key: str
    batch_type: str


class BatchPlanner:
    def __init__(self, storage: BotStorage, words_per_day: int) -> None:
        self.storage = storage
        self.words_per_day = words_per_day

    def _pick_keys(self, today: date, count: int) -> list[str]:
        review_target = max(1, int(round(count * 0.4)))
        review_rows = self.storage.get_due_words(today=today, limit=review_target)
        picked = [r["word_key"] for r in review_rows]
        picked_set = set(picked)

        missing = count - len(picked)
        if missing > 0:
            new_rows = self.storage.get_new_words(limit=missing * 2)
            for row in new_rows:
                key = row["word_key"]
                if key in picked_set:
                    continue
                picked.append(key)
                picked_set.add(key)
                if len(picked) >= count:
                    break

        missing = count - len(picked)
        if missing > 0:
            fallback_rows = self.storage.get_least_recent(limit=missing * 3)
            for row in fallback_rows:
                key = row["word_key"]
                if key in picked_set:
                    continue
                picked.append(key)
                picked_set.add(key)
                if len(picked) >= count:
                    break

        return picked[:count]

    def get_or_create_daily_batch(self, today: date, now_dt: datetime) -> PlannedBatch:
        batch_key = f"daily:{today.isoformat()}"
        cached = self.storage.get_batch_words(batch_key)
        if cached:
            return PlannedBatch(word_keys=cached, batch_key=batch_key, batch_type="daily")

        keys = self._pick_keys(today=today, count=self.words_per_day)
        self.storage.mark_sent(keys, now_dt=now_dt, today=today)
        self.storage.save_batch(batch_key, batch_date=today, batch_type="daily", words=keys, now_dt=now_dt)
        return PlannedBatch(word_keys=keys, batch_key=batch_key, batch_type="daily")

    def create_manual_next_batch(self, today: date, now_dt: datetime) -> PlannedBatch:
        batch_key = f"manual:{now_dt.isoformat(timespec='seconds')}"
        keys = self._pick_keys(today=today, count=self.words_per_day)
        self.storage.mark_sent(keys, now_dt=now_dt, today=today)
        self.storage.save_batch(batch_key, batch_date=today, batch_type="manual", words=keys, now_dt=now_dt)
        return PlannedBatch(word_keys=keys, batch_key=batch_key, batch_type="manual")

    def create_review_batch(self, today: date, now_dt: datetime) -> PlannedBatch:
        batch_key = f"review:{today.isoformat()}"
        keys = [r["word_key"] for r in self.storage.get_due_words(today=today, limit=self.words_per_day)]
        self.storage.mark_sent(keys, now_dt=now_dt, today=today)
        self.storage.save_batch(batch_key, batch_date=today, batch_type="review", words=keys, now_dt=now_dt)
        return PlannedBatch(word_keys=keys, batch_key=batch_key, batch_type="review")

