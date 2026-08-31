#!/usr/bin/env python3

import json
import os
import sys


def fail(category: str) -> "NoReturn":
    sys.stderr.write(category + "\n")
    raise SystemExit(1)


def load_sdk():
    try:
        from tigeropen.quote.quote_client import QuoteClient
        from tigeropen.tiger_open_config import TigerOpenClientConfig
    except Exception:
        fail("SDK_UNAVAILABLE")
    return QuoteClient, TigerOpenClientConfig


def read_request():
    raw = sys.stdin.readline()
    if not raw:
        fail("INVALID_REQUEST")

    try:
        request = json.loads(raw)
    except Exception:
        fail("INVALID_REQUEST")

    if not isinstance(request, dict):
        fail("INVALID_REQUEST")

    symbol = request.get("symbol")
    period = request.get("period")
    begin_time = request.get("beginTime")
    end_time = request.get("endTime")

    if (
        not isinstance(symbol, str)
        or not isinstance(period, str)
        or period not in {"day", "60min"}
        or not isinstance(begin_time, str)
        or not isinstance(end_time, str)
    ):
        fail("INVALID_REQUEST")

    return {
        "symbol": symbol,
        "period": period,
        "beginTime": begin_time,
        "endTime": end_time,
    }


def build_client():
    config_path = os.environ.get("TIGER_OPENAPI_CONFIG", "").strip()
    if not config_path:
        fail("CONFIG_UNAVAILABLE")

    QuoteClient, TigerOpenClientConfig = load_sdk()

    try:
        client_config = TigerOpenClientConfig(props_path=config_path)
        quote_client = QuoteClient(client_config)
    except Exception:
        fail("CONFIG_UNAVAILABLE")

    return quote_client


def to_number(value, integer=False):
    try:
        number = int(value) if integer else float(value)
    except Exception:
        fail("INVALID_RESPONSE")

    if number != number:
        fail("INVALID_RESPONSE")
    return number


def normalize_bars(frame):
    if frame is None:
        return []

    try:
        if frame.empty:
            return []
        records = frame.to_dict("records")
    except Exception:
        fail("INVALID_RESPONSE")

    bars = []
    for record in records:
        if not isinstance(record, dict):
            fail("INVALID_RESPONSE")
        try:
            symbol = record["symbol"]
            time_value = record["time"]
            open_value = record["open"]
            high_value = record["high"]
            low_value = record["low"]
            close_value = record["close"]
            volume_value = record["volume"]
        except Exception:
            fail("INVALID_RESPONSE")

        if not isinstance(symbol, str):
            fail("INVALID_RESPONSE")

        bars.append(
            {
                "symbol": symbol,
                "time": to_number(time_value, integer=True),
                "open": to_number(open_value),
                "high": to_number(high_value),
                "low": to_number(low_value),
                "close": to_number(close_value),
                "volume": to_number(volume_value),
            }
        )

    return bars


def main():
    request = read_request()
    quote_client = build_client()

    try:
        bars = quote_client.get_bars(
            [request["symbol"]],
            period=request["period"],
            begin_time=request["beginTime"],
            end_time=request["endTime"],
            right="nr",
            limit=1200,
        )
    except Exception:
        fail("SOURCE_UNAVAILABLE")

    payload = {"bars": normalize_bars(bars)}
    sys.stdout.write(json.dumps(payload, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
