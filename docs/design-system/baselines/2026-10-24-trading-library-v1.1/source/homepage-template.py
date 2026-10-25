"""Render the C10 homepage by binding data into the approved SVG template."""

from __future__ import annotations

from copy import deepcopy
from datetime import date
from pathlib import Path
import math
import re
from xml.etree import ElementTree as ET


SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)


def _tag(name: str) -> str:
    return f"{{{SVG_NS}}}{name}"


def _local(node: ET.Element) -> str:
    return node.tag.rsplit("}", 1)[-1]


def _number(value: str | None) -> float | None:
    try:
        return float(value) if value is not None else None
    except ValueError:
        return None


def _same_number(actual: str | None, expected: float) -> bool:
    value = _number(actual)
    return value is not None and math.isclose(value, expected, abs_tol=0.001)


def _children_with_parents(root: ET.Element):
    for parent in root.iter():
        for child in list(parent):
            yield parent, child


def _require(predicate, root: ET.Element, description: str) -> ET.Element:
    matches = [node for node in root.iter() if predicate(node)]
    if len(matches) != 1:
        raise ValueError(f"Homepage reference node missing or ambiguous: {description} (found {len(matches)})")
    return matches[0]


def _text_at(root: ET.Element, x: float, y: float) -> ET.Element:
    return _require(
        lambda node: _local(node) == "text" and _same_number(node.get("x"), x) and _same_number(node.get("y"), y),
        root,
        f"text x={x} y={y}",
    )


def _children(root: ET.Element, name: str) -> list[ET.Element]:
    return [node for node in root if _local(node) == name]


def _title(node: ET.Element, value: str) -> None:
    for child in list(node):
        if _local(child) == "title":
            node.remove(child)
    title = ET.Element(_tag("title"))
    title.text = value
    node.insert(0, title)


def _set_text(node: ET.Element, value: object, title: str | None = None) -> None:
    for child in list(node):
        node.remove(child)
    node.text = str(value)
    if title is not None:
        _title(node, title)


def _format_amount(value: float | int | None, *, signed: bool = False, compact: bool = False, unit_space: bool = True) -> str:
    if value is None:
        return "—"
    amount = float(value)
    sign = "+" if signed and amount > 0 else "−" if signed and amount < 0 else ""
    absolute = abs(amount)
    if compact and absolute >= 100000000:
        return f"{sign}{absolute / 100000000:.2f}{' ' if unit_space else ''}亿"
    if compact and absolute >= 10000:
        return f"{sign}{absolute / 10000:.2f}{' ' if unit_space else ''}万"
    return f"{sign}{absolute:,.2f}"


def _full_amount(value: float | int | None) -> str:
    return "—" if value is None else f"{float(value):,.2f} CNY"


def _as_of_time(valuation: dict, fixture: dict | None = None) -> str:
    value = str(valuation.get("as_of", ""))
    if not value and fixture is not None:
        value = str(fixture.get("valuation", {}).get("as_of", ""))
    match = re.search(r"\b(\d{2}:\d{2})", value)
    if not match:
        raise ValueError("Homepage valuation.as_of must include an HH:MM time")
    return match.group(1)


def _period(fixture: dict) -> tuple[str, str]:
    try:
        home = fixture["navigation"]["home"]
        return str(home["start"]), str(home["end"])
    except (KeyError, TypeError) as exc:
        raise ValueError("Homepage fixture must provide navigation.home.start/end") from exc


def _date_label(value: str) -> str:
    return value[5:] if len(value) >= 10 else value


def _axis_ticks(values: list[float], minimum_step: float = 250.0) -> list[float]:
    if not values:
        raise ValueError("Homepage chart requires at least one data point")
    low = min(0.0, min(values))
    high = max(0.0, max(values))
    span = max(high - low, minimum_step)
    padding = span * 0.1
    low = math.floor((low - padding) / minimum_step) * minimum_step
    high = math.ceil((high + padding) / minimum_step) * minimum_step
    if math.isclose(low, high):
        high = low + minimum_step * 4
    step = (high - low) / 4
    return [high - step * i for i in range(5)]


def _axis_label(value: float) -> str:
    if math.isclose(value, round(value)):
        return f"{int(round(value)):,}"
    return f"{value:,.2f}"


def _remove_old_badge(root: ET.Element) -> None:
    rect = _require(lambda n: _local(n) == "rect" and _same_number(n.get("x"), 48) and _same_number(n.get("y"), 134), root, "superseded pending badge background")
    label = _require(lambda n: _local(n) == "text" and _same_number(n.get("x"), 60) and _same_number(n.get("y"), 151), root, "superseded pending badge label")
    for parent, child in list(_children_with_parents(root)):
        if child is rect or child is label:
            parent.remove(child)


def _set_period_controls(root: ET.Element, period: str) -> None:
    year_rect = _require(lambda n: _local(n) == "rect" and _same_number(n.get("x"), 246) and _same_number(n.get("y"), 80), root, "year period control")
    month_rect = _require(lambda n: _local(n) == "rect" and _same_number(n.get("x"), 322) and _same_number(n.get("y"), 80), root, "month period control")
    year_text = _text_at(root, 280, 103)
    month_text = _text_at(root, 356, 103)
    year_active = period == "本年"
    active, inactive = (year_rect, month_rect) if year_active else (month_rect, year_rect)
    active.set("fill", "#162233")
    active.set("stroke", "#6CA8FF")
    inactive.set("fill", "#111A26")
    inactive.set("stroke", "#283448")
    year_text.set("fill", "#E6EDF7" if year_active else "#A8B6CB")
    month_text.set("fill", "#E6EDF7" if not year_active else "#A8B6CB")


def _bind_top(root: ET.Element, fixture: dict, valuation: dict) -> None:
    start, end = _period(fixture)
    _require(
        lambda node: _local(node) == "text" and (node.text or "").strip() == "当前表现",
        root,
        "current performance heading",
    )
    _set_period_controls(root, str(fixture.get("navigation", {}).get("home", {}).get("period", "本月")))
    _set_text(_text_at(root, 1416, 39), f"{_as_of_time(valuation, fixture)} 更新")
    _set_text(_text_at(root, 1220, 103), f"{start} — {_date_label(end)}")
    metrics = [
        (112, 188, valuation["total"], True, False),
        (445, 188, valuation["realized"], True, False),
        (778, 188, valuation["floating"], True, False),
        (1111, 188, valuation["market_value"], False, True),
    ]
    for x, y, value, signed, market_value in metrics:
        node = _text_at(root, x, y)
        display = _format_amount(value, signed=signed, compact=market_value)
        _set_text(node, display, _full_amount(value))


def _parent_of(root: ET.Element, target: ET.Element) -> ET.Element:
    for parent, child in _children_with_parents(root):
        if child is target:
            return parent
    raise ValueError("Homepage reference parent missing")


def _bind_trend(root: ET.Element, valuation: dict) -> None:
    points = list(valuation.get("points", []))
    if not points:
        raise ValueError("Homepage valuation.points must contain at least one point")
    values = [float(point["cumulative"]) for point in points]
    ticks = _axis_ticks(values)
    y_positions = [276.0, 331.0, 386.0, 441.0, 496.0]
    horizontal = [
        node for node in root.iter() if _local(node) == "path" and node.get("d", "").startswith("M172 ") and " L1380 " in node.get("d", "")
    ]
    if len(horizontal) != 5:
        raise ValueError(f"Homepage trend grid requires 5 canonical horizontal paths (found {len(horizontal)})")
    for y, tick in zip(y_positions, ticks):
        _set_text(_text_at(root, 160, y + 4), _axis_label(tick))
    top, bottom = y_positions[0], y_positions[-1]
    high, low = ticks[0], ticks[-1]
    span = max(high - low, 1.0)
    scale = lambda value: bottom - (float(value) - low) / span * (bottom - top)
    zero_y = scale(0.0)
    for index, path in enumerate(horizontal):
        if path.get("stroke") == "#A8B6CB":
            path.set("d", f"M172 {zero_y:g} L1380 {zero_y:g}")
    try:
        dates = [date.fromisoformat(str(point["date"])) for point in points]
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Homepage trend points must provide ISO dates") from exc
    elapsed = max((dates[-1] - dates[0]).days, 1)
    x_for_date = lambda value: 172 + (1380 - 172) * ((value - dates[0]).days / elapsed)
    selected_indices = [round(i * (len(points) - 1) / 5) for i in range(6)]
    selected = [(index, points[index], dates[index]) for index in selected_indices]
    vertical_labels = [_text_at(root, x, 519) for x in (172.0, 413.6, 655.2, 896.8, 1138.4, 1380.0)]
    vertical_lines = [
        node for node in root.iter()
        if _local(node) == "path" and re.fullmatch(r"M[-+0-9.e]+ 276(?:\.0)? L[-+0-9.e]+ 496", node.get("d", ""))
    ]
    if len(vertical_lines) != 6:
        raise ValueError(f"Homepage trend grid requires 6 canonical vertical paths (found {len(vertical_lines)})")
    for label, line, (_, point, point_date) in zip(vertical_labels, vertical_lines, selected):
        x = x_for_date(point_date)
        label.set("x", f"{x:g}")
        _set_text(label, _date_label(str(point["date"])))
        line.set("d", f"M{x:g} 276 L{x:g} 496")
    polyline = next((node for node in root.iter() if _local(node) == "polyline" and node.get("points", "").startswith("172.0")), None)
    if polyline is None:
        polyline = _require(lambda n: _local(n) == "polyline", root, "homepage trend line")
    polyline.set("points", " ".join(f"{x_for_date(point_date):.2f},{scale(value):.2f}" for point_date, value in zip(dates, values)))
    parent = _parent_of(root, polyline)
    circles = [node for node in list(parent) if _local(node) == "circle"]
    if not circles:
        raise ValueError("Homepage trend requires canonical point circles")
    template = deepcopy(circles[0])
    for node in circles:
        parent.remove(node)
    for i, (point, value) in enumerate(zip(points, values)):
        circle = deepcopy(template)
        circle.set("cx", f"{x_for_date(dates[i]):.2f}")
        circle.set("cy", f"{scale(value):.2f}")
        _title(circle, f"{point['date']} · {value:,.2f} CNY")
        parent.append(circle)


def _market_code(code: str) -> str:
    return code


def _bind_holdings(root: ET.Element, fixture: dict, valuation: dict) -> None:
    positions = list(valuation.get("positions", []))
    if not positions:
        raise ValueError("Homepage valuation.positions must contain the current open positions")
    end = _period(fixture)[1]
    summary_value = _text_at(root, 761, 610)
    summary_float = _text_at(root, 950, 610)
    _set_text(summary_value, _format_amount(valuation["market_value"], compact=True), _full_amount(valuation["market_value"]))
    _set_text(summary_float, _format_amount(valuation["floating"], signed=True, compact=True), _full_amount(valuation["floating"]))
    row_ys = [691 + 48 * i for i in range(8)]
    for index, y in enumerate(row_ys):
        cells = [
            _text_at(root, 128, y + 15),
            _text_at(root, 128, y),
            _text_at(root, 521.04, y),
            _text_at(root, 649.84, y),
            _text_at(root, 791.52, y),
            _text_at(root, 933.2, y),
            _text_at(root, 1126.4, y),
            _text_at(root, 1306.72, y),
        ]
        if index < len(positions):
            position = positions[index]
            days = (date.fromisoformat(end) - date.fromisoformat(str(position["date"]))).days
            cost = float(position["price"]) + float(position.get("fee", 0.0)) / float(position["quantity"])
            _set_text(cells[0], _market_code(str(position["code"])))
            _set_text(cells[1], str(position["symbol"]))
            _set_text(cells[2], f"{days} 天")
            _set_text(cells[3], str(position["quantity"]))
            _set_text(cells[4], f"{cost:,.2f}")
            _set_text(cells[5], f"{float(position['quote']):,.2f}")
            _set_text(cells[6], _format_amount(position["market_value"], compact=True), _full_amount(position["market_value"]))
            cells[6].set("fill", "#E6EDF7")
            floating = float(position["floating"])
            _set_text(cells[7], _format_amount(floating, signed=True), _full_amount(floating)) if len(cells) > 7 else None
        else:
            if index == len(positions):
                _set_text(cells[0], f"当前样例共{len(positions)}个持仓")
                cells[0].set("fill", "#71829B")
            else:
                _set_text(cells[0], "")
            for cell in cells[1:]:
                _set_text(cell, "")
            # Preserve the row dividers and host geometry while making empty
            # rows visibly empty rather than implying a loading skeleton.
            row_y = 680 + index * 48
            for parent, child in _children_with_parents(root):
                if child.get("y") is not None and _same_number(child.get("y"), row_y):
                    child.set("opacity", "0")
            # The host row includes a document icon and its hit area for every
            # sample row. Empty rows must not expose a view action or an
            # apparent accessible entry; keep the row divider and fixed table
            # geometry while removing only this unused action pair.
            action_rect_y = 680 + index * 48
            action_icon_y = 682 + index * 48
            for parent, child in list(_children_with_parents(root)):
                if _local(child) == "rect" and _same_number(child.get("x"), 1343.36) and _same_number(child.get("y"), action_rect_y):
                    parent.remove(child)
                elif _local(child) == "svg" and _same_number(child.get("x"), 1353.36) and _same_number(child.get("y"), action_icon_y):
                    parent.remove(child)
    # The floating cell is at y=691 etc and was intentionally not included in
    # the first seven-cell list so its source fill can be switched by value.
    for index, position in enumerate(positions):
        y = 691 + 48 * index
        cell = _text_at(root, 1306.72, y)
        floating = float(position["floating"])
        cell.set("fill", "#53D7A0" if floating >= 0 else "#FF8592")
        _set_text(cell, _format_amount(floating, signed=True), _full_amount(floating))
    as_of = _as_of_time(valuation, fixture)
    summary = _text_at(root, 112, 1089)
    _set_text(summary, f"1–{len(positions)} / {len(positions)} 项 · 估值 {end} {as_of} · 覆盖 {len(positions)}/{len(positions)} 持仓")


def _month_axis(history: ET.Element, stats: dict) -> None:
    rounds = list(stats.get("rounds", []))
    monthly: dict[int, float] = {}
    for row in rounds:
        month = int(str(row["date"])[5:7])
        monthly[month] = monthly.get(month, 0.0) + float(row["net"])
    values = list(monthly.values()) or [0.0]
    ticks = _axis_ticks(values)
    y_positions = [290.0, 340.0, 390.0, 440.0, 490.0]
    grid = [node for node in history.iter() if _local(node) == "line" and node.get("x1") == "106" and node.get("x2") == "1296" and node.get("data-state") != "zero-line"]
    if len(grid) != 5:
        raise ValueError(f"Homepage history chart requires 5 canonical horizontal grid lines (found {len(grid)})")
    for y, tick in zip(y_positions, ticks):
        _set_text(next(node for node in history.iter() if _local(node) == "text" and _same_number(node.get("x"), 94) and _same_number(node.get("y"), y + 4)), _axis_label(tick))
    zero_line = _require(lambda node: _local(node) == "line" and node.get("data-state") == "zero-line", history, "history zero-line")
    low, high = ticks[-1], ticks[0]
    zero_y = y_positions[-1] - (0.0 - low) / max(high - low, 1.0) * (y_positions[-1] - y_positions[0])
    zero_line.set("y1", f"{zero_y:g}")
    zero_line.set("y2", f"{zero_y:g}")
    plot_group = next((node for node in history.iter() if _local(node) == "g" and any(_local(child) == "polyline" for child in node)), None)
    if plot_group is None:
        raise ValueError("Homepage history chart requires canonical plot group")
    polyline = next(child for child in plot_group if _local(child) == "polyline")
    template_circles = [child for child in list(plot_group) if _local(child) == "circle"]
    if not template_circles:
        raise ValueError("Homepage history chart requires canonical point circles")
    template = deepcopy(template_circles[0])
    for circle in template_circles:
        plot_group.remove(circle)
    points = sorted((int(str(row["date"])[5:7]), float(row["net"])) for row in rounds)
    cumulative = 0.0
    month_points = []
    for month, _ in points:
        cumulative += monthly[month] if not month_points or month != month_points[-1][0] else 0.0
        if not month_points or month != month_points[-1][0]:
            month_points.append((month, cumulative))
    scale = lambda value: y_positions[-1] - (value - low) / max(high - low, 1.0) * (y_positions[-1] - y_positions[0])
    polyline.set("points", " ".join(f"{(106 + (month - 1) * (1190 / 11)) - 106:.2f},{scale(value) - 280:.2f}" for month, value in month_points))
    for month, value in month_points:
        circle = deepcopy(template)
        absolute_x = 106 + (month - 1) * (1190 / 11)
        circle.set("cx", f"{absolute_x - 106:.2f}")
        circle.set("cy", f"{scale(value) - 280:.2f}")
        _title(circle, f"2026-{month:02d} · {value:,.2f} CNY")
        plot_group.append(circle)
    empty = [node for node in history.iter() if node.get("data-state") == "empty"]
    if not empty:
        raise ValueError("Homepage history chart requires canonical empty-period zones")
    source_empty = deepcopy(empty[0])
    while len(empty) < 9:
        clone = deepcopy(source_empty)
        history.insert(list(history).index(empty[-1]) + 1, clone)
        empty.append(clone)
    step = 1190 / 11
    for month, zone in enumerate(empty[:9], 1):
        start = 106 if month == 1 else 106 + (month - 1.5) * step
        end = min(1296, 106 + (month - 0.5) * step)
        zone.set("x", f"{start:g}")
        zone.set("width", f"{max(0.0, end - start):g}")
        zone.set("y", "280")
        zone.set("height", "210")
    future = _require(lambda node: node.get("data-state") == "future-zone", history, "history future-period zone")
    future_x = round(min(1296, 106 + 9.5 * step), 6)
    future_width = round(max(0.0, 1296 - future_x), 6)
    future.set("x", f"{future_x:.6f}")
    future.set("width", f"{future_width:.6f}")
    boundary = _require(lambda node: node.get("data-state") == "future-boundary", history, "history future-period boundary")
    boundary.set("x1", f"{future_x:.6f}")
    boundary.set("x2", f"{future_x:.6f}")
    for month, x in enumerate([106 + i * step for i in range(12)], 1):
        label = next(node for node in history.iter() if _local(node) == "text" and _same_number(node.get("x"), x) and _same_number(node.get("y"), 514))
        _set_text(label, f"{month}月")


def _bind_history(root: ET.Element, fixture: dict, stats: dict) -> None:
    history = _require(lambda node: _local(node) == "svg" and _same_number(node.get("x"), 96) and _same_number(node.get("y"), 1130), root, "canonical history panel")
    start, end = _period(fixture)
    desc = _require(lambda node: _local(node) == "desc" and node.get("id") == "history-desc", history, "history accessible description")
    desc.text = f"历史统计，截至 {end}；历史净盈亏 {float(stats['net']):,.2f}，{stats['count']} 回合，胜率 {float(stats['win_rate']):.1f}%，费用 {float(stats['fees']):,.2f}"
    control = _require(lambda node: node.get("data-control") == "history-controls", history, "history controls")
    control.set("aria-label", "范围：2026；展示方式：每月净盈亏")
    control_title = _require(lambda node: _local(node) == "title" and node.text and node.text.startswith("范围："), control, "history controls title")
    control_title.text = "范围：2026；展示方式：每月净盈亏"
    values = [
        (16, 145, _format_amount(stats["net"], signed=True, compact=True, unit_space=False), _full_amount(stats["net"])),
        (349, 145, stats["count"], str(stats["count"])),
        (682, 145, f"{float(stats['win_rate']):.1f}%" if stats.get("win_rate") is not None else "—", f"{float(stats['win_rate']):.1f}%" if stats.get("win_rate") is not None else "—"),
        (971, 145, f"{stats['wins']} / {stats['count']} 盈利回合", f"{stats['wins']} / {stats['count']} 盈利回合"),
        (1015, 145, _format_amount(stats["fees"], compact=True, unit_space=False), _format_amount(stats["fees"])),
    ]
    for x, y, value, title in values:
        _set_text(_text_at(history, x, y), value, title)
    _month_axis(history, stats)


def _bind_contribution(root: ET.Element, fixture: dict, valuation: dict) -> None:
    contribution = _require(lambda node: _local(node) == "svg" and _same_number(node.get("x"), 96) and _same_number(node.get("y"), 1712), root, "canonical contribution panel")
    start, end = _period(fixture)
    total = float(valuation["total"])
    realized = float(valuation["realized"])
    floating = float(valuation["floating"])
    _set_text(_text_at(contribution, 1288, 36), _format_amount(total, signed=True, compact=True, unit_space=False) + " CNY", _full_amount(total))
    _set_text(_text_at(contribution, 32, 58), f"本月 · 当前表现日期 {start} — {end} · 已实现 + 浮盈变化")
    total_texts = [
        (311, total, True),
        (383, 0.0, False),
        (455, 0.0, False),
    ]
    for y, value, signed in total_texts:
        node = _text_at(contribution, 1288, y)
        _set_text(node, _format_amount(value, signed=signed, compact=True, unit_space=False) if value else "0.00", _full_amount(value))
        node.set("fill", "#53D7A0" if value > 0 else "#71829B")
    _set_text(_text_at(contribution, 1288, 548), _format_amount(total, signed=True, compact=True) + " CNY", _full_amount(total))
    _set_text(_text_at(contribution, 32, 574), f"已实现 {_format_amount(realized, signed=True)} · 浮盈变化 {_format_amount(floating, signed=True)}")
    _set_text(_text_at(contribution, 1288, 574), _format_amount(total, compact=True) + " CNY", _full_amount(total))
    bars = [node for node in contribution.iter() if _local(node) == "rect" and node.get("y") in {"293", "294", "365", "366", "437", "438"}]
    if len(bars) != 6:
        raise ValueError(f"Homepage contribution chart requires 6 canonical bars (found {len(bars)})")
    real_width = 396 * realized / total if total else 0.0
    floating_width = max(0.0, 396 - real_width)
    bars[0].set("x", "686")
    bars[0].set("width", f"{max(0.0, real_width):g}")
    _title(bars[0], f"已实现 {realized:,.2f} CNY")
    bars[1].set("x", f"{686 + real_width:g}")
    bars[1].set("width", f"{max(0.0, floating_width - 2):g}")
    _title(bars[1], f"浮盈变化 {floating:,.2f} CNY")
    for bar in bars[2:]:
        bar.set("x", "686")
        bar.set("width", "0")
        for child in list(bar):
            if _local(child) == "title":
                bar.remove(child)


def render_home(reference_path, fixture, valuation, stats, focus: bool = False) -> str:
    """Read and render the complete canonical homepage SVG for one data state."""
    path = Path(reference_path)
    source = path.read_bytes()
    root = ET.fromstring(source)
    if _local(root) != "svg" or root.get("xmlns") is not None:
        # ElementTree strips the default xmlns while parsing; namespace is
        # still required on every parsed element and restored on serialization.
        if _local(root) != "svg":
            raise ValueError("Homepage reference root must be an SVG element")
    if root.get("role") != "img":
        raise ValueError("Homepage reference must preserve role=img")
    _require(lambda n: _local(n) == "title" and n is next(iter(root)), root, "root SVG title")
    _period(fixture)
    for key in ("positions", "market_value", "floating", "realized", "total", "points"):
        if key not in valuation:
            raise ValueError(f"Homepage valuation missing {key}")
    for key in ("rounds", "count", "wins", "net", "fees", "win_rate"):
        if key not in stats:
            raise ValueError(f"Homepage stats missing {key}")
    _remove_old_badge(root)
    if focus:
        home_background = _require(lambda n: _local(n) == "rect" and _same_number(n.get("x"), 8) and _same_number(n.get("y"), 73), root, "home navigation focus")
        parent = _parent_of(root, home_background)
        focus_ring = ET.Element(_tag("rect"), {
            "x": "8", "y": "137", "width": "56", "height": "56", "rx": "8",
            "fill": "none", "stroke": "#6CA8FF", "stroke-width": "2",
        })
        parent.insert(list(parent).index(home_background) + 1, focus_ring)
    _bind_top(root, fixture, valuation)
    _bind_trend(root, valuation)
    _bind_holdings(root, fixture, valuation)
    _bind_history(root, fixture, stats)
    _bind_contribution(root, fixture, valuation)
    return ET.tostring(root, encoding="unicode")
