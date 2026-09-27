#!/usr/bin/env python3
"""Generate two isolated, synthetic Futu monthly statements for UI acceptance.

The files deliberately use the verified F4 layout from app/lib/import/__fixtures__.
They contain no original account or execution data. v1 is a closed synthetic
long round; v2 changes the closing fill from 100 to 80 shares.
"""
from pathlib import Path
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfgen import canvas

OUT = Path(__file__).resolve().parent
W = H = 842
FONT = "STSong-Light"
SIZE = 8

pdfmetrics.registerFont(UnicodeCIDFont(FONT))

HEADER = [
    (54, "買賣方向"),
    (129, "代碼名稱"),
    (204, "交易所/市場"),
    (278, "貨幣種類"),
    (353, "日期/時間"),
    (427, "交收日期"),
    (548, "數量"),
    (631, "價格"),
    (697, "成交金額"),
    (772, "變動金額"),
]


def row_y(row: int) -> float:
    # Keep rows in the same top-origin spacing as futu-pdf-layouts.ts.
    return H - (30 + row * 18) - SIZE


def draw_row(pdf: canvas.Canvas, row: int, items: list[tuple[float, str, bool]]) -> None:
    y = row_y(row)
    pdf.setFont(FONT, SIZE)
    for x, text, right_aligned in items:
        if right_aligned:
            x -= pdfmetrics.stringWidth(text, FONT, SIZE)
        pdf.drawString(x, y, text)


def right_edge(text: str, x: float) -> float:
    return x + pdfmetrics.stringWidth(text, FONT, SIZE)


HEADER_ENDS = {label: right_edge(label, x) for x, label in HEADER}


def numeric(text: str, label: str) -> tuple[float, str, bool]:
    return (HEADER_ENDS[label], text, True)


def trade_row(
    direction: str,
    quantity: str,
    gross: str,
    cash: str,
) -> list[tuple[float, str, bool]]:
    return [
        (54, direction, False),
        (129, "FB(合成股票)", False),
        (278, "HKD", False),
        numeric(quantity, "數量"),
        numeric("10", "價格"),
        numeric(gross, "成交金額"),
        numeric(cash, "變動金額"),
    ]


def fill_row(quantity: str, gross: str, cash: str) -> list[tuple[float, str, bool]]:
    return [
        (204, "NASDAQ", False),
        (278, "HKD", False),
        (353, "2020/01/27", False),
        (427, "2020/01/30", False),
        numeric(quantity, "數量"),
        numeric("10", "價格"),
        numeric(gross, "成交金額"),
        numeric(cash, "變動金額"),
    ]


def make_pdf(path: Path, *, version: int) -> None:
    if version == 1:
        close_qty, close_gross, close_cash = "100", "1000", "999"
    elif version == 2:
        # Corrected synthetic source: same account/month/security, changed close fill.
        close_qty, close_gross, close_cash = "80", "800", "799"
    else:
        raise ValueError(version)

    pdf = canvas.Canvas(str(path), pagesize=(W, H), pageCompression=1)
    pdf.setTitle(f"TradeReview synthetic Futu monthly statement v{version}")
    pdf.setAuthor("TradeReview fault acceptance fixture")

    # Opening buy. It is kept on page 1 with its own F4 subtotal.
    draw_row(pdf, 0, [(20, "富途 美股賬戶月結單 2020/01", False)])
    draw_row(pdf, 1, [(20, "賬戶號碼：900001", False)])
    draw_row(pdf, 2, [(20, "交易-股票和股票期權", False)])
    draw_row(pdf, 3, [(x, label, False) for x, label in HEADER])
    draw_row(pdf, 4, trade_row("買入開倉", "100", "1000", "-1001"))
    draw_row(pdf, 5, fill_row("100", "1000", "-1001"))
    draw_row(pdf, 6, [(353, "09:30:00", False)])
    draw_row(pdf, 7, [(56, "佣金: 1.00", False), (744, "小計: 1.00", False)])
    pdf.showPage()

    # Closing sell. The second version changes only this fill's quantity/cash.
    draw_row(pdf, 0, [(20, "綜合賬戶月結單", False)])
    draw_row(pdf, 1, [(x, label, False) for x, label in HEADER])
    draw_row(pdf, 2, trade_row("賣出平倉", close_qty, close_gross, close_cash))
    draw_row(pdf, 3, fill_row(close_qty, close_gross, close_cash))
    draw_row(pdf, 4, [(353, "10:00:00", False)])
    draw_row(pdf, 5, [(56, "佣金: 1.00", False), (744, "小計: 1.00", False)])
    draw_row(pdf, 6, [(20, "期末概覽", False)])
    draw_row(pdf, 7, [(20, "本結單所展示的時間按照當地證券市場時間顯示", False)])
    pdf.save()


if __name__ == "__main__":
    make_pdf(OUT / "futu-synthetic-monthly-v1.pdf", version=1)
    make_pdf(OUT / "futu-synthetic-monthly-v2-corrected.pdf", version=2)
    print("generated", OUT / "futu-synthetic-monthly-v1.pdf")
    print("generated", OUT / "futu-synthetic-monthly-v2-corrected.pdf")
