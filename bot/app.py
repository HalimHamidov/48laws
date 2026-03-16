from __future__ import annotations

import logging
from datetime import datetime, time

from telegram import Update
from telegram.constants import ParseMode
from telegram.error import TelegramError
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
)

from .config import Settings
from .formatting import build_intro, format_word_card, split_messages
from .planner import BatchPlanner
from .storage import BotStorage

logger = logging.getLogger(__name__)


class VocabularyBot:
    def __init__(self, settings: Settings, storage: BotStorage, planner: BatchPlanner) -> None:
        self.settings = settings
        self.storage = storage
        self.planner = planner
        self.app: Application = ApplicationBuilder().token(settings.telegram_bot_token).build()

        self.app.add_handler(CommandHandler("start", self.start_cmd))
        self.app.add_handler(CommandHandler("help", self.help_cmd))
        self.app.add_handler(CommandHandler("today", self.today_cmd))
        self.app.add_handler(CommandHandler("next", self.next_cmd))
        self.app.add_handler(CommandHandler("review", self.review_cmd))
        self.app.add_handler(CommandHandler("stats", self.stats_cmd))
        self.app.add_error_handler(self.error_handler)

    def _is_allowed_chat(self, update: Update) -> bool:
        chat = update.effective_chat
        return bool(chat and int(chat.id) == self.settings.telegram_chat_id)

    async def _send_text(self, context: ContextTypes.DEFAULT_TYPE, text: str) -> None:
        await context.bot.send_message(
            chat_id=self.settings.telegram_chat_id,
            text=text,
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )

    def _rows_for_keys(self, keys: list[str]) -> list[dict]:
        rows = self.storage.fetch_words_by_keys(keys)
        result = []
        for row in rows:
            result.append(
                {
                    "word": row["word"],
                    "translation_ru": row["translation_ru"],
                    "translation_en": row["translation_en"],
                    "meaning": row["meaning"],
                    "example": row["example"],
                    "example_page": row["example_page"],
                }
            )
        return result

    async def _send_batch(self, context: ContextTypes.DEFAULT_TYPE, batch_type: str, keys: list[str]) -> None:
        rows = self._rows_for_keys(keys)
        if not rows:
            await self._send_text(context, "No words available for this batch.")
            return

        today = datetime.now(self.settings.timezone).date()
        lines = [build_intro(batch_type=batch_type, study_date=today, count=len(rows))]
        for idx, row in enumerate(rows, start=1):
            lines.append(format_word_card(idx, row))

        for chunk in split_messages(lines):
            await self._send_text(context, chunk)

    async def _create_and_send_daily(self, context: ContextTypes.DEFAULT_TYPE) -> None:
        now = datetime.now(self.settings.timezone)
        planned = self.planner.get_or_create_daily_batch(today=now.date(), now_dt=now)
        await self._send_batch(context=context, batch_type=planned.batch_type, keys=planned.word_keys)

    async def daily_job(self, context: ContextTypes.DEFAULT_TYPE) -> None:
        try:
            await self._create_and_send_daily(context)
        except TelegramError:
            logger.exception("Telegram API error in daily job")
        except Exception:
            logger.exception("Unexpected error in daily job")

    async def start_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self._is_allowed_chat(update):
            return
        await update.message.reply_text(
            "Vocabulary bot is active.\nUse /today, /next, /review, /stats, /help.",
            parse_mode=ParseMode.HTML,
        )

    async def help_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self._is_allowed_chat(update):
            return
        await update.message.reply_text(
            "/today - send today's 15 words\n"
            "/next - send next 15 words now\n"
            "/review - send due review words\n"
            "/stats - show learning progress\n"
            "/help - show this message",
            parse_mode=ParseMode.HTML,
        )

    async def today_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self._is_allowed_chat(update):
            return
        await self._create_and_send_daily(context)

    async def next_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self._is_allowed_chat(update):
            return
        now = datetime.now(self.settings.timezone)
        planned = self.planner.create_manual_next_batch(today=now.date(), now_dt=now)
        await self._send_batch(context=context, batch_type=planned.batch_type, keys=planned.word_keys)

    async def review_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self._is_allowed_chat(update):
            return
        now = datetime.now(self.settings.timezone)
        planned = self.planner.create_review_batch(today=now.date(), now_dt=now)
        await self._send_batch(context=context, batch_type=planned.batch_type, keys=planned.word_keys)

    async def stats_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self._is_allowed_chat(update):
            return
        today = datetime.now(self.settings.timezone).date()
        stats = self.storage.stats(today=today)
        await update.message.reply_text(
            "Progress stats:\n"
            f"Total words: {stats['total']}\n"
            f"Seen: {stats['seen']}\n"
            f"Unseen: {stats['unseen']}\n"
            f"Due today: {stats['due_today']}",
            parse_mode=ParseMode.HTML,
        )

    async def error_handler(self, update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
        logger.exception("Unhandled bot error", exc_info=context.error)

    def schedule_jobs(self) -> None:
        self.app.job_queue.run_daily(
            self.daily_job,
            time=time(
                hour=self.settings.send_hour,
                minute=self.settings.send_minute,
                second=0,
                tzinfo=self.settings.timezone,
            ),
            name="daily_words_job",
        )

    def run(self) -> None:
        self.schedule_jobs()
        self.app.run_polling(drop_pending_updates=False)
