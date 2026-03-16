from __future__ import annotations

import html
from datetime import date


def _safe(text: str | None) -> str:
    if not text:
        return "—"
    return html.escape(text.strip())


def build_intro(batch_type: str, study_date: date, count: int) -> str:
    title = {
        "daily": "Daily Vocabulary",
        "manual": "Next Vocabulary Batch",
        "review": "Review Words Due Today",
    }.get(batch_type, "Vocabulary Batch")

    return (
        f"<b>{html.escape(title)}</b>\n"
        f"Date: {study_date.isoformat()} | Words: {count}\n\n"
        "Recall first, then open translation. Keep each word active:\n"
        "1) pause 2-3 sec\n"
        "2) predict meaning\n"
        "3) use in your own sentence"
    )


def format_word_card(index: int, row: dict) -> str:
    word = _safe(row.get("word"))
    translation = _safe(row.get("translation_ru") or row.get("translation_en"))
    meaning = _safe(row.get("meaning"))
    example = _safe(row.get("example"))
    page = row.get("example_page")
    page_text = f" (p.{page})" if page else ""

    return (
        f"<b>{index}. {word}</b>\n"
        f"RU: <tg-spoiler>{translation}</tg-spoiler>\n"
        f"Meaning: {meaning}\n"
        f"Example{page_text}: {example}\n"
        "Prompt: Make your own sentence."
    )


def split_messages(lines: list[str], max_chars: int = 3500) -> list[str]:
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for line in lines:
        extra = len(line) + 2
        if current and current_len + extra > max_chars:
            chunks.append("\n\n".join(current))
            current = [line]
            current_len = len(line)
        else:
            current.append(line)
            current_len += extra

    if current:
        chunks.append("\n\n".join(current))
    return chunks

