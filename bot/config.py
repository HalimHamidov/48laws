from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv


class ConfigError(ValueError):
    pass


def _get_env(*keys: str, default: str | None = None) -> str | None:
    for key in keys:
        value = os.getenv(key)
        if value is not None and value.strip() != "":
            return value.strip()
    return default


def _parse_int(value: str | None, field_name: str, fallback: int | None = None) -> int:
    if value is None:
        if fallback is None:
            raise ConfigError(f"Missing required integer env: {field_name}")
        return fallback
    try:
        return int(value)
    except ValueError as exc:
        raise ConfigError(f"Invalid integer for {field_name}: {value}") from exc


@dataclass(frozen=True)
class Settings:
    telegram_bot_token: str
    telegram_chat_id: int
    send_hour: int
    send_minute: int
    timezone_name: str
    words_per_day: int
    json_path: Path
    db_path: Path

    @property
    def timezone(self) -> ZoneInfo:
        try:
            return ZoneInfo(self.timezone_name)
        except Exception as exc:  # pragma: no cover
            raise ConfigError(f"Invalid TIMEZONE value: {self.timezone_name}") from exc


def load_settings() -> Settings:
    load_dotenv()

    # Backward-compatible aliases support current local .env variants.
    token = _get_env("TELEGRAM_BOT_TOKEN", "api token")
    if not token:
        raise ConfigError("TELEGRAM_BOT_TOKEN is required.")

    chat_id = _parse_int(_get_env("TELEGRAM_CHAT_ID", "telegram chat id"), "TELEGRAM_CHAT_ID")
    send_hour = _parse_int(_get_env("SEND_HOUR"), "SEND_HOUR", fallback=9)
    send_minute = _parse_int(_get_env("SEND_MINUTE"), "SEND_MINUTE", fallback=0)
    words_per_day = _parse_int(_get_env("WORDS_PER_DAY"), "WORDS_PER_DAY", fallback=15)
    timezone_name = _get_env("TIMEZONE", default="Europe/Moscow")

    if not (0 <= send_hour <= 23):
        raise ConfigError("SEND_HOUR must be in range 0..23.")
    if not (0 <= send_minute <= 59):
        raise ConfigError("SEND_MINUTE must be in range 0..59.")
    if words_per_day <= 0:
        raise ConfigError("WORDS_PER_DAY must be > 0.")

    return Settings(
        telegram_bot_token=token,
        telegram_chat_id=chat_id,
        send_hour=send_hour,
        send_minute=send_minute,
        timezone_name=timezone_name or "Europe/Moscow",
        words_per_day=words_per_day,
        json_path=Path("48laws_frequency_ru.json"),
        db_path=Path("bot_state.sqlite3"),
    )

