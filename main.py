from __future__ import annotations

import logging
import sys
from datetime import datetime
from time import time as epoch_time

from bot.app import VocabularyBot
from bot.config import ConfigError, load_settings
from bot.data_loader import DataFormatError, load_words
from bot.planner import BatchPlanner
from bot.storage import BotStorage


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def main() -> None:
    setup_logging()

    try:
        settings = load_settings()
        words = load_words(settings.json_path)
    except (ConfigError, DataFormatError) as exc:
        logging.error("%s", exc)
        raise SystemExit(1) from exc

    storage = BotStorage(settings.db_path)
    try:
        storage.upsert_words(words, today=datetime.now(settings.timezone).date())
        planner = BatchPlanner(storage=storage, words_per_day=settings.words_per_day)
        bot = VocabularyBot(settings=settings, storage=storage, planner=planner)
        logging.info("Bot started at epoch=%s, words loaded=%s", int(epoch_time()), len(words))
        bot.run()
    finally:
        storage.close()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)

