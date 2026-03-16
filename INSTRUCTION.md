# Future Development Instructions (Do Not Implement Now)

This file defines the next phase for the vocabulary bot. Keep current implementation stable; execute items below later.

## Goal

Upgrade the bot from fixed-interval review to adaptive SRS with user feedback and richer learning analytics.

## Planned Scope

1. Add user response quality loop
- Add inline buttons per word: `Again`, `Hard`, `Good`, `Easy`
- Store quality scores per review event
- Move from fixed intervals to SM-2 style scheduling

2. Improve content quality pipeline
- Add optional lemmatization and duplicate form collapsing
- Filter OCR noise tokens before scheduling
- Add optional CEFR-like difficulty tags (heuristic)

3. Message UX improvements
- Add two-phase delivery:
  - phase 1: recall-only prompt cards
  - phase 2: answer reveal cards
- Add weekly mixed review summary with hardest words

4. Multi-user support
- Remove single `TELEGRAM_CHAT_ID` restriction
- Add per-user settings and state in DB
- Add admin commands for export/reset

5. Reliability and operations
- Dockerize app
- Add structured JSON logs
- Add healthcheck endpoint (optional)
- Add backup/restore for SQLite state

6. Testing
- Unit tests for:
  - field mapping
  - scheduling behavior
  - batch generation invariants
- Integration test for command handlers

## Suggested Milestones

1. SRS feedback + schema migration
2. Message UX v2
3. Multi-user mode
4. Ops hardening + tests

## Non-Goals For Next Phase

- No migration to external heavy DB unless scale requires it.
- No NLP-heavy semantic grading.

