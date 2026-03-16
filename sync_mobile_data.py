from __future__ import annotations

import shutil
from pathlib import Path


SRC = Path("48laws_frequency_ru.json")
DST = Path("mobile_app/48laws_frequency_ru.json")


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Source JSON not found: {SRC}")

    DST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SRC, DST)
    print(f"Synced: {SRC} -> {DST}")


if __name__ == "__main__":
    main()

