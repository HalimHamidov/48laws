# 48 Laws Vocabulary Telegram Bot

Production-ready Python Telegram bot that sends daily vocabulary from `48laws_frequency_ru.json` with spaced-review friendly scheduling.

## JSON Mapping (Actual File)

Detected source structure:

- Top-level object with key `words`
- Each word item includes:
  - `rank`
  - `word`
  - `count`
  - `translation_ru`
  - `example_from_book`
  - `example_page`

Bot field mapping:

- `word` -> target word
- `translation_ru` -> RU translation
- `meaning` -> optional (if present in future JSONs)
- `example_from_book` -> example sentence
- `example_page` -> source page

The loader also supports common fallback field names (`term`, `translation`, `example`, `definition`, etc.) for compatibility.

## Features

- Reads config from `.env`
- Loads words from local `48laws_frequency_ru.json`
- Sends exactly `WORDS_PER_DAY` words daily (default 15)
- Commands:
  - `/start`
  - `/today`
  - `/next`
  - `/stats`
  - `/review`
  - `/help`
- Spaced review behavior with persistent SQLite state (`bot_state.sqlite3`)
- Avoids immediate repetition via due-date scheduling
- Logging + graceful error handling

## Memory Design Principles Used

- Active recall:
  - card prompts ask user to recall before opening translation
  - translation shown in spoiler block
- Spacing:
  - intervals increase by exposures (2, 4, 7, 14, 30, 45 days)
- Low cognitive load:
  - fixed daily batch size, compact mobile cards
- Chunking:
  - message split into small cards with stable structure
- Varied contextual exposure:
  - in-book examples shown when available
- Desirable difficulty:
  - prompt to produce own sentence for each word

## Quick Start

1. Create virtual environment:

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
```

2. Install dependencies:

```powershell
py -m pip install -r requirements.txt
```

3. Configure env:

```powershell
Copy-Item .env.example .env
```

Fill in:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `SEND_HOUR`
- `SEND_MINUTE`
- `TIMEZONE`
- `WORDS_PER_DAY`

4. Run bot:

```powershell
py main.py
```

## Project Structure

```text
.
|-- bot/
|   |-- __init__.py
|   |-- app.py
|   |-- config.py
|   |-- data_loader.py
|   |-- formatting.py
|   |-- planner.py
|   `-- storage.py
|-- 48laws_frequency_ru.json
|-- .env.example
|-- .gitignore
|-- main.py
|-- requirements.txt
`-- INSTRUCTION.md
```

## Notes

- The bot accepts only the configured `TELEGRAM_CHAT_ID`.
- Existing `.env` non-standard keys are partially supported by aliases, but standard keys are recommended.
- If JSON is malformed, the bot exits with a clear error message.

## Android Without Telegram (Local Web App)

If Telegram is unavailable, you can run a local Android-friendly app from this repo:

1. Start local server:

```powershell
py run_mobile_app.py
```

2. On Android (same Wi-Fi), open shown URL:

```text
http://<YOUR_PC_IP>:8000/mobile_app/
```

3. In Chrome, use "Add to Home screen" for app-like launch.

This app uses `48laws_frequency_ru.json`, shows 15 words/day, tracks progress locally, and supports review flow.
