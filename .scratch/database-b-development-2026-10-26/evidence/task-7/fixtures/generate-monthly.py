"""Pure synthetic Futu F1 input; never opens a database or contacts a service."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import json
root = Path(__file__).resolve().parent
pdfmetrics.registerFont(TTFont("QA-Unicode", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"))
variants = [
    ("monthly-01-complete", "BASE: 2 synthetic fills", [("買入", "90001", "2026/01/27 11:30:42", "2", "10", "20", "-20.5"), ("賣出", "90002", "2026/01/28 11:30:42", "1", "11", "11", "10.5")]),
    ("monthly-02-missing", "NEW VERSION: second fill absent", [("買入", "90001", "2026/01/27 11:30:42", "2", "10", "20", "-20.5")]),
    ("monthly-03-restore", "NEW VERSION: second fill returns", [("買入", "90001", "2026/01/27 11:30:42", "2", "10", "20", "-20.5"), ("賣出", "90002", "2026/01/28 11:30:42", "1", "11", "11", "10.5")]),
    ("monthly-04-conflict", "NEW VERSION: first fill price corrected", [("買入", "90001", "2026/01/27 11:30:42", "2", "12", "24", "-24.5"), ("賣出", "90002", "2026/01/28 11:30:42", "1", "11", "11", "10.5")]),
]
for name, label, rows in variants:
    c = canvas.Canvas(str(root / (name + ".pdf")), pagesize=(595, 320), invariant=1, pageCompression=0)
    c.setTitle("SYNTHETIC QA ONLY - " + name)
    c.setAuthor("TradeReview synthetic acceptance fixture")
    def text(x, top, value, size=6):
        c.setFont("QA-Unicode", size)
        c.drawString(x, 320-top, value)
    def right(x, top, value):
        c.setFont("QA-Unicode", 6)
        c.drawRightString(x, 320-top, value)
    text(20, 22, "富途 美股賬戶月結單 2026年01月", 11)
    text(20, 40, "賬戶號碼: 99991007", 8)
    text(20, 58, "SYNTHETIC QA ONLY - " + label, 8)
    text(20, 80, "交易明細", 8)
    for x, v in [(23,"方向"),(83,"單號"),(139,"股票"),(300,"成交日期/時間"),(404,"數量"),(451,"價格"),(494,"成交金額"),(556,"變動金額")]: text(x, 102, v)
    for index, (side, order, when, qty, price, gross, cash) in enumerate(rows):
        top = 124 + index * 60
        text(139, top, "AAPL(Apple Inc.)")
        text(23, top+18, side)
        text(83, top+18, order)
        text(290, top+18, when)
        for end, v in [(416,qty),(463,price),(518,gross),(580,cash)]: right(end, top+18, v)
        text(23, top+36, "佣金: 0.50")
        text(530, top+36, "小計: 0.50")
    text(20, 266, "期末總覽", 8)
    text(20, 285, "All accounts, fills and document versions are synthetic. No real user information.", 7)
    c.showPage()
    c.save()
(root / "monthly-inputs.json").write_text(json.dumps({"purpose":"pure synthetic UI acceptance inputs", "accountId":"futu:99991007", "month":"2026-01", "variants":[{"name":n,"label":l,"rows":r} for n,l,r in variants]}, ensure_ascii=False, indent=2))
