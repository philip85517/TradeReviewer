"""Small, dependency-free SVG primitives shared by the strategy workbench boards.

The functions intentionally return fragments rather than writing files.  Board
builders can compose them with their own layout while keeping the public visual
contract in one place.
"""

BG = "#0B1019"
PANEL = "#111A26"
RAISED = "#162233"
BORDER = "#283448"
DISABLED_BORDER = "#202B3A"
TEXT = "#E6EDF7"
MUTED = "#A8B6CB"
WEAK = "#71829B"
ACTION = "#6CA8FF"
FOCUS = "#A9C8FF"
HOVER = "#1C2B42"
PRESSED = "#243B5C"
DISABLED = "#53647B"
FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif"


def _esc(value):
    return (str(value).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def _text(x, y, value, size=14, color=TEXT, weight=500, anchor="middle"):
    style = f"font-family:{FONT};font-size:{size}px;font-weight:{weight};fill:{color}"
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" style="{style}">{_esc(value)}</text>'


def _rect(x, y, width, height, fill=PANEL, stroke=BORDER, radius=6, stroke_width=1):
    return (f'<rect x="{x}" y="{y}" width="{width}" height="{height}" '
            f'rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="{stroke_width}"/>')


# Shared navigation paths are copied from the approved home board 24px grid.
_ICON_PATHS = {
    "home": '<path d="M3 10L12 3l9 7M5 9v12h5v-7h4v7h5V9"/>',
    "library": '<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>',
    "analytics": '<path d="M3 3v18h18M6 16l5-6 4 3 6-8"/>',
    "data": '<path d="M3 6c0-4 18-4 18 0v12c0 4-18 4-18 0zM3 6c0 4 18 4 18 0M3 12c0 4 18 4 18 0"/>',
    "strategy": '<path d="M6 3v18M6 7h8a4 4 0 0 1 4 4v6M15 14l3 3 3-3"/>',
    "calendar": '<path d="M5 4h14v16H5zM8 2v4M16 2v4M5 9h14"/>',
    "search": '<path d="M17 17l4 4M19 11a8 8 0 1 1-16 0a8 8 0 0 1 16 0"/>',
    "chevron-down": '<path d="M5 9l7 7 7-7"/>',
    "chevron-right": '<path d="M9 5l7 7-7 7"/>',
    "more": '<circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    "play": '<path d="M8 5l10 7-10 7z" fill="currentColor" stroke="none"/>',
    "pause": '<path d="M8 5v14M16 5v14"/>',
    "chevron-left": '<path d="M15 5l-7 7 7 7"/>',
    "close": '<path d="M6 6l12 12M18 6L6 18"/>',
    "settings": '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="5"/>',
}


def icon(x, y, name, size=16, color=TEXT):
    """Return an accessible, stroke based SVG icon with no text glyph fallback."""
    path = _ICON_PATHS.get(name)
    if path is None:
        raise ValueError(f"Unknown shared icon: {name}")
    return (f'<svg x="{x}" y="{y}" width="{size}" height="{size}" viewBox="0 0 24 24" '
            f'fill="none" color="{color}" stroke="{color}" stroke-width="1.5" stroke-linecap="round" '
            f'stroke-linejoin="round" aria-label="{_esc(name)}">{path}</svg>')


def nav_rail(height, expanded=False):
    """Return the strategy rail: 54px collapsed, 200px expanded, 48px top bar."""
    width = 200 if expanded else 54
    out = _rect(0, 0, width, height, "#0E1622", "none", 0)
    out += f'<line x1="{width}" y1="48" x2="{width}" y2="{height}" stroke="{BORDER}"/>'
    out += f'<line x1="0" y1="48" x2="{width}" y2="48" stroke="{BORDER}"/>'
    out += _text(27, 31, "TR", 14, ACTION, 700)
    if expanded:
        out += _text(48, 30, "策略台", 14, TEXT, 600, "start")
        items = [(68, "home", "首页"), (116, "library", "交易库"), (164, "analytics", "分析"), (212, "data", "数据"), (260, "strategy", "策略台")]
        for yy, name, label in items:
            selected = name == "strategy"
            if selected:
                out += _rect(10, yy - 18, 180, 36, RAISED, ACTION, 6)
            out += icon(19, yy - 8, name, 16, ACTION if selected else MUTED)
            out += _text(48, yy + 4, label, 14, TEXT if selected else MUTED, 600 if selected else 500, "start")
        out += icon(19, height - 72, "settings", 16, MUTED)
        out += _text(48, height - 60, "设置", 14, MUTED, 500, "start")
        out += icon(19, height - 28, "chevron-left", 16, MUTED) + _text(48, height - 16, "收起导航", 14, MUTED, 500, "start")
    else:
        for yy, name in [(68, "home"), (116, "library"), (164, "analytics"), (212, "data"), (260, "strategy")]:
            if name == "strategy":
                out += _rect(5, yy - 18, 44, 36, RAISED, ACTION, 6)
            out += icon(19, yy - 8, name, 16, ACTION if name == "strategy" else MUTED)
        out += icon(19, height - 72, "settings", 16, MUTED) + icon(19, height - 28, "chevron-right", 16, MUTED)
    return out


def button(x, y, label, w, primary=False, disabled=False):
    fill = ACTION if primary else PANEL
    stroke = ACTION if primary else BORDER
    color = "#0B1019" if primary else TEXT
    if disabled:
        fill, stroke, color = "#151E2B", DISABLED_BORDER, DISABLED
    return (_rect(x, y, w, 36, fill, stroke, 6) +
            _text(x + w / 2, y + 23, label, 14, color, 600))


def segmented(x, y, label, w, selected=False):
    fill, stroke, color = (RAISED, ACTION, TEXT) if selected else (PANEL, BORDER, MUTED)
    return (_rect(x, y, w, 36, fill, stroke, 6) +
            _text(x + w / 2, y + 23, label, 14, color, 600))


def select_control(x, y, value, w, kind="select", disabled=False):
    fill = "#151E2B" if disabled else PANEL
    stroke = DISABLED_BORDER if disabled else BORDER
    color = DISABLED if disabled else TEXT
    out = _rect(x, y, w, 36, fill, stroke, 6)
    out += _text(x + 12, y + 23, value, 14, color, 500, "start")
    icon_name = {"calendar": "calendar", "search": "search", "select": "chevron-down"}.get(kind, "chevron-down")
    out += icon(x + w - 22, y + 10, icon_name, 16, DISABLED if disabled else MUTED)
    return out


__all__ = ["icon", "nav_rail", "button", "segmented", "select_control"]
