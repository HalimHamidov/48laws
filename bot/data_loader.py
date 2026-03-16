from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class WordItem:
    key: str
    rank: int
    count: int | None
    word: str
    translation_ru: str | None
    translation_en: str | None
    meaning: str | None
    example: str | None
    example_page: int | None


class DataFormatError(ValueError):
    pass


def _pick(row: dict[str, Any], keys: list[str]) -> Any:
    for key in keys:
        if key in row and row[key] not in (None, ""):
            return row[key]
    return None


def load_words(json_path: Path) -> list[WordItem]:
    if not json_path.exists():
        raise DataFormatError(f"JSON file not found: {json_path}")

    try:
        payload = json.loads(json_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise DataFormatError(f"Malformed JSON in {json_path}: {exc}") from exc

    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        if "words" in payload and isinstance(payload["words"], list):
            rows = payload["words"]
        else:
            raise DataFormatError("JSON object must contain a 'words' array.")
    else:
        raise DataFormatError("Top-level JSON must be an object or array.")

    result: list[WordItem] = []
    for idx, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            continue

        word = _pick(row, ["word", "term", "target_word", "lemma"])
        if not word:
            continue

        rank_raw = _pick(row, ["rank", "order", "order_number"]) or idx
        try:
            rank = int(rank_raw)
        except Exception:
            rank = idx

        count_raw = _pick(row, ["count", "frequency", "freq"])
        count = None
        if count_raw is not None:
            try:
                count = int(count_raw)
            except Exception:
                count = None

        translation_ru = _pick(row, ["translation_ru", "ru", "translation"])
        translation_en = _pick(row, ["translation_en", "en"])
        meaning = _pick(row, ["meaning", "definition", "explanation"])
        example = _pick(row, ["example_from_book", "example", "context"])
        example_page_raw = _pick(row, ["example_page", "page"])
        example_page = None
        if example_page_raw is not None:
            try:
                example_page = int(example_page_raw)
            except Exception:
                example_page = None

        key = str(word).strip().lower()
        result.append(
            WordItem(
                key=key,
                rank=rank,
                count=count,
                word=str(word).strip(),
                translation_ru=str(translation_ru).strip() if translation_ru else None,
                translation_en=str(translation_en).strip() if translation_en else None,
                meaning=str(meaning).strip() if meaning else None,
                example=str(example).strip() if example else None,
                example_page=example_page,
            )
        )

    if not result:
        raise DataFormatError("No valid words found in JSON.")

    result.sort(key=lambda x: (x.rank, x.word))
    return result

