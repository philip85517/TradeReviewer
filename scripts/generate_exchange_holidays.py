"""Generate TradeReview's bundled weekday exchange-closure table.

Development-only dependency:
    exchange-calendars==4.11.2

The 2026 mainland schedule is appended from 国办发明电〔2025〕7号 because
exchange-calendars currently records XSHG holidays only through 2025.
"""

from __future__ import annotations

import argparse
import json
from datetime import date, timedelta
from pathlib import Path

import exchange_calendars


def weekdays(start: date, end: date):
    current = start
    while current <= end:
        if current.weekday() < 5:
            yield current.isoformat()
        current += timedelta(days=1)


def closures(calendar_name: str, start: str, end: str):
    calendar = exchange_calendars.get_calendar(
        calendar_name,
        start=start,
        end=end,
    )
    sessions = {
        timestamp.strftime("%Y-%m-%d")
        for timestamp in calendar.sessions
    }
    return sorted(
        set(weekdays(date.fromisoformat(start), date.fromisoformat(end)))
        - sessions
    )


def date_range(start: str, end: str):
    return list(
        weekdays(date.fromisoformat(start), date.fromisoformat(end))
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    mainland = closures("XSHG", "2010-01-01", "2025-12-31")
    mainland_2026 = [
        *date_range("2026-01-01", "2026-01-03"),
        *date_range("2026-02-15", "2026-02-23"),
        *date_range("2026-04-04", "2026-04-06"),
        *date_range("2026-05-01", "2026-05-05"),
        *date_range("2026-06-19", "2026-06-21"),
        *date_range("2026-09-25", "2026-09-27"),
        *date_range("2026-10-01", "2026-10-07"),
    ]
    payload = {
        "version": "exchange-calendars-4.11.2+official-cn-2026",
        "ranges": {
            "US": ["2010-01-01", "2030-12-31"],
            "HK": ["2010-01-01", "2030-12-31"],
            "CN-SH": ["2010-01-01", "2026-12-31"],
            "CN-SZ": ["2010-01-01", "2026-12-31"],
        },
        "holidays": {
            "US": closures("XNYS", "2010-01-01", "2030-12-31"),
            "HK": closures("XHKG", "2010-01-01", "2030-12-31"),
            "CN-SH": sorted(set(mainland + mainland_2026)),
            "CN-SZ": sorted(set(mainland + mainland_2026)),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
