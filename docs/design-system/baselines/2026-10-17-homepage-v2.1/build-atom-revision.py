"""Build the V2.1 atom boards and their machine-readable state contract.

This is documentation tooling.  It deliberately draws the component's internal
shape (rows, fields, menu options, tooltip content, and CTA) instead of reusing
the old 150x36 state placeholder.
"""
from pathlib import Path
from html import escape
import json

ROOT = Path(__file__).parent
OUT = ROOT / "images"
OUT.mkdir(parents=True, exist_ok=True)

BG, SURFACE, RAISED, LINE = "#0B1019", "#111A26", "#162233", "#283448"
TEXT, MUTED, SUBTLE = "#E6EDF7", "#A8B6CB", "#71829B"
BLUE, GREEN, RED, AMBER, FOCUS = "#6CA8FF", "#53D7A0", "#FF8592", "#FFC66D", "#A9C8FF"
FONT = "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
STATES = ["default", "hover", "focus", "pressed", "disabled", "loading", "empty", "error"]
NAMES = ["IconButton", "SegmentedTabs", "Select", "Popover", "Token", "Metric", "StatusBadge", "DataTable", "ChartTooltip", "EmptyState", "RetryAction"]
NA = {
    ("IconButton", "empty"): "图标动作始终有明确动作名；没有空 payload 状态",
    ("SegmentedTabs", "empty"): "分段组始终至少包含一个分段",
    ("RetryAction", "empty"): "重试只在错误上下文中渲染",
    ("Token", "disabled"): "已提交 token 可移除；权限应禁用父级表单",
    ("Metric", "disabled"): "指标是只读信息，使用不可用/错误文案，不使用 disabled",
    ("StatusBadge", "disabled"): "状态是只读指示器，不使用 disabled",
    ("ChartTooltip", "disabled"): "图表不可用时不显示 tooltip",
    ("EmptyState", "disabled"): "CTA 有独立禁用原因；empty state 本身不禁用",
    ("Metric", "pressed"): "指标有详情动作，但没有持久 pressed 状态",
    ("EmptyState", "loading"): "loading 使用父级区块骨架；不与 empty state 同时显示",
}
STATE_ZH = {"default": "默认", "hover": "悬停", "focus": "聚焦", "pressed": "按下", "disabled": "禁用", "loading": "加载", "empty": "空", "error": "错误"}

def esc(v): return escape(str(v))
def tx(x, y, text, size=12, fill=TEXT, weight=400, anchor="start"):
    return f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}px" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}">{esc(text)}</text>'
def rect(x, y, w, h, fill=SURFACE, stroke=LINE, r=6, sw=1):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
def line(x1, y1, x2, y2, stroke=LINE, sw=1, dash=""):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}"{d}/>'
def svg(w, h, body, label):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{esc(label)}"><rect width="{w}" height="{h}" fill="{BG}"/>{body}</svg>\n'
def icon(kind, x, y, color=BLUE):
    if kind == "search": return f'<circle cx="{x+8}" cy="{y+8}" r="5" fill="none" stroke="{color}" stroke-width="1.7"/><path d="M{x+12},{y+12}l5,5" stroke="{color}" stroke-width="1.7" stroke-linecap="round"/>'
    if kind == "refresh": return f'<path d="M{x+17},{y+8}a7,7 0 1 0 0,5M{x+17},{y+3}v5h-5" fill="none" stroke="{color}" stroke-width="1.7" stroke-linecap="round"/>'
    if kind == "eye": return f'<path d="M{x+2},{y+9}q8,-8 16,0q-8,8-16,0z" fill="none" stroke="{color}" stroke-width="1.5"/><circle cx="{x+10}" cy="{y+9}" r="2.5" fill="none" stroke="{color}"/>'
    if kind == "close": return f'<path d="M{x+5},{y+5}l10,10m0,-10L{x+5},{y+15}" stroke="{color}" stroke-width="1.7" stroke-linecap="round"/>'
    return f'<circle cx="{x+10}" cy="{y+10}" r="7" fill="none" stroke="{color}" stroke-width="1.5"/>'

def visual_size(name):
    return {
        "IconButton": (36, 36), "SegmentedTabs": (244, 36), "Select": (180, 36),
        "Popover": (360, 132), "Token": (104, 24), "Metric": (276, 88),
        "StatusBadge": (124, 24), "DataTable": (620, 520), "ChartTooltip": (264, 112),
        "EmptyState": (300, 120), "RetryAction": (110, 32),
    }[name]
def hit_size(name):
    return {
        "IconButton": (36, 36), "SegmentedTabs": (244, 36), "Select": (180, 36),
        "Popover": (360, 132), "Token": (104, 36), "Metric": (276, 88),
        "StatusBadge": (124, 36), "DataTable": (620, 520), "ChartTooltip": (264, 112),
        "EmptyState": (300, 120), "RetryAction": (110, 36),
    }[name]

def frame(name, state, x, y):
    vw, vh = visual_size(name); hw, hh = hit_size(name)
    card_w, card_h = (760, 700) if name == "DataTable" else (520, 188)
    focus = state == "focus"
    fill = "#1C2B42" if state == "hover" else "#243B5C" if state == "pressed" else SURFACE
    # The card is an evidence frame; focus belongs to the rendered control
    # inside it, so the card border never impersonates a hit target.
    stroke = LINE
    body = rect(x, y, card_w, card_h, RAISED, stroke, 8, 2 if focus else 1)
    body += tx(x+16, y+24, f"{STATE_ZH[state]} · {state.upper()}", 12, BLUE if (name, state) not in NA else MUTED, 600)
    body += tx(x+150, y+24, f"visible {vw}×{vh} · hit {hw}×{hh}", 11, MUTED)
    cx, cy = x+24, y+46
    if (name, state) in NA:
        body += tx(cx, cy+44, "N/A", 16, MUTED, 600)
        body += tx(cx, cy+68, NA[(name, state)], 11, SUBTLE)
        return body
    if name == "IconButton":
        edge = FOCUS if focus else LINE
        body += rect(cx, cy, 36, 36, fill, edge, 6, 2 if focus else 1) + icon("refresh" if state == "loading" else "eye", cx+8, cy+8, MUTED if state == "disabled" else BLUE)
        body += tx(cx+52, cy+20, {"default":"查看持仓详情","hover":"悬停 300ms → tooltip","focus":"焦点环 2px 外偏 2px","pressed":"已触发查看","disabled":"不可用 · 权限不足","loading":"更新中 · 状态环","error":"错误 · 查看原因","empty":""}.get(state, ""), 12, MUTED if state == "disabled" else TEXT)
    elif name == "SegmentedTabs":
        for i, label in enumerate(["全部", "A股", "美股"]):
            selected = (i == 0)
            target = 1 if state == "hover" else 2 if state == "pressed" else None
            segment_fill = "#243B5C" if selected or i == target else SURFACE
            segment_stroke = FOCUS if focus and i == 0 else BLUE if i == target else LINE
            body += rect(cx+i*78, cy, 72, 36, segment_fill, segment_stroke, 6, 2 if focus and i == 0 else 1) + tx(cx+i*78+36, cy+23, label, 13, TEXT, 500, "middle")
        if state == "loading": body += tx(cx, cy+56, "保留旧选中“全部” · 请求中", 11, MUTED)
        if state == "error": body += tx(cx, cy+56, "失败 · 回滚到“全部”", 11, AMBER)
    elif name == "Select":
        body += rect(cx, cy, 180, 36, fill, FOCUS if focus else LINE, 6, 2 if focus else 1) + tx(cx+12, cy+23, "暂无可选账户" if state == "empty" else "全部账户", 13, MUTED if state in ["disabled", "empty"] else TEXT) + tx(cx+160, cy+23, "⌄", 14, MUTED)
        if state == "pressed": body += rect(cx, cy+42, 180, 64, RAISED, BLUE, 6) + tx(cx+12, cy+66, "全部账户", 12) + tx(cx+12, cy+90, "主账户", 12, MUTED)
        if state == "loading": body += tx(cx, cy+56, "加载账户中 · 保留全部账户", 11, BLUE) + icon("refresh", cx+158, cy+48, BLUE)
        if state == "empty": body += rect(cx, cy+44, 180, 32, SURFACE, BLUE, 6) + tx(cx+90, cy+65, "导入账户 →", 11, BLUE, 500, "middle")
        if state == "error": body += tx(cx, cy+56, "加载失败 · 保留全部账户", 11, AMBER)
        if state == "error": body += rect(cx, cy+68, 92, 28, SURFACE, BLUE, 5) + tx(cx+46, cy+87, "重试", 11, BLUE, 500, "middle")
    elif name == "Popover":
        body += rect(cx, cy, 360, 132, RAISED, BLUE if focus else LINE, 8, 2 if focus else 1) + tx(cx+14, cy+22, "搜索标的名称 / 代码", 12, MUTED)
        body += rect(cx+12, cy+34, 336, 36, SURFACE, FOCUS if focus else LINE, 6, 2 if focus else 1) + icon("search", cx+22, cy+42, BLUE) + tx(cx+52, cy+57, "600519", 13)
        if state == "empty": body += tx(cx+14, cy+94, "没有匹配结果 · 清除搜索", 12, MUTED)
        elif state == "loading": body += tx(cx+14, cy+94, "查询中 · 保留当前草稿", 12, BLUE) + icon("refresh", cx+310, cy+82, BLUE)
        elif state == "error": body += tx(cx+14, cy+94, "校验失败 · 草稿仍保留", 12, AMBER) + rect(cx+260, cy+78, 72, 24, SURFACE, BLUE, 5) + tx(cx+296, cy+95, "重试", 11, BLUE, 500, "middle")
        else: body += tx(cx+14, cy+94, "结果 8 条 · Esc 返回触发器", 11, MUTED)
    elif name == "Token":
        if state == "empty":
            body += tx(cx, cy+44, "N/A", 16, MUTED, 600) + tx(cx, cy+68, "集合为空；焦点返回筛选入口，不渲染空 token", 11, SUBTLE)
        else:
            body += rect(cx, cy+6, 104, 24, fill, FOCUS if focus else LINE, 6, 2 if focus else 1) + tx(cx+10, cy+23, "ETF", 12, TEXT) + rect(cx+72, cy+6, 36, 36, "none", "none", 0) + icon("close", cx+82, cy+10, RED if state in ["hover", "pressed"] else MUTED)
            if state == "loading": body += tx(cx, cy+60, "移除中 · 请稍候", 11, BLUE) + icon("refresh", cx+86, cy+46, BLUE)
            if state == "error": body += tx(cx, cy+60, "移除失败 · 已恢复 ETF", 11, AMBER)
    elif name == "Metric":
        body += tx(cx, cy+18, "期间净盈亏 · CNY", 13, MUTED) + tx(cx, cy+55, "—" if state == "empty" else "+18,420", 28, MUTED if state == "empty" else GREEN, 600)
        if state == "loading": body += rect(cx, cy+32, 152, 28, LINE, "none", 4)
        elif state == "error": body += tx(cx+174, cy+54, "! 原因", 12, AMBER)
        elif state == "focus": body += tx(cx+174, cy+54, "ⓘ 口径详情", 12, BLUE)
    elif name == "StatusBadge":
        body += rect(cx, cy+6, 124, 24, "#1C2B42" if state == "hover" else fill, FOCUS if focus else LINE, 12, 2 if focus else 1) + tx(cx+12, cy+23, {"default":"已更新 16:32","hover":"悬停 · 更新时间","focus":"焦点 · 查看原因","pressed":"详情已打开","disabled":"","loading":"更新中","empty":"暂无状态","error":"过期 · 原因"}[state], 11, AMBER if state in ["loading", "error"] else TEXT)
    elif name == "DataTable":
        # 48 title + 40 header + 8*48 rows + 48 pagination = 520px.
        body += rect(cx, cy, 620, 520, SURFACE, LINE, 6) + tx(cx+16, cy+30, "持仓 · 8 个固定槽位", 14, TEXT, 600)
        body += rect(cx+8, cy+48, 604, 40, RAISED, "none", 0) + tx(cx+16, cy+74, "标的", 12, MUTED) + tx(cx+286, cy+74, "市值", 12, MUTED) + tx(cx+510, cy+74, "查看", 12, MUTED)
        for i in range(8):
            yy = cy+88+i*48
            if state == "loading": body += rect(cx+12, yy+14, 580, 18, LINE, "none", 3)
            elif state == "empty": body += tx(cx+16, yy+29, "当前范围没有持仓" if i == 2 else "", 12, MUTED)
            else:
                if state == "hover" and i == 1: body += rect(cx+8, yy, 604, 48, "#1C2B42", "none", 0)
                body += tx(cx+16, yy+30, ["贵州茅台", "TSLA", "MSFT", "中芯国际", "ETF", "CBRS", "腾讯", "现金"][i], 12, TEXT)
                body += tx(cx+286, yy+30, ["82,640", "24,120", "18,420", "12,000", "9,880", "7,260", "6,100", "3,000"][i], 12, GREEN if i % 2 == 0 else TEXT)
                body += icon("eye", cx+514, yy+14, MUTED if state == "disabled" else BLUE)
        # Empty has no page to navigate; loading keeps the slot but disables it
        # while the request is pending. Disabled retains its permission reason.
        if state == "empty":
            page_label, page_nav, page_color = "0 项 · 无可用分页", "", MUTED
        elif state == "loading":
            page_label, page_nav, page_color = "分页暂不可用 · 请求中", "—  —  —  —", MUTED
        else:
            page_label = "查看/分页不可用 · 权限不足" if state == "disabled" else "第 1 页"
            page_nav, page_color = "1  2  3  →", MUTED if state == "disabled" else BLUE
        body += rect(cx+8, cy+472, 604, 40, RAISED, "none", 0) + tx(cx+16, cy+498, page_label, 12, MUTED) + (tx(cx+554, cy+498, page_nav, 12, page_color) if page_nav else "")
        if state == "error": body += rect(cx+8, cy+424, 604, 36, "#2A1E27", "none", 4) + tx(cx+18, cy+447, "保留旧表 · 加载失败 · 重试", 11, AMBER)
    elif name == "ChartTooltip":
        body += rect(cx, cy, 264, 112, RAISED, BLUE if focus else LINE, 7, 2 if focus else 1) + tx(cx+14, cy+24, "2026-10-15 · CNY", 12, TEXT, 600)
        if state == "empty": body += tx(cx+14, cy+56, "该日缺行情 · 不插值", 12, AMBER)
        elif state == "loading": body += tx(cx+14, cy+56, "行情加载中 · 保留日期", 12, BLUE) + icon("refresh", cx+220, cy+42, BLUE)
        elif state == "error": body += tx(cx+14, cy+56, "暂不可用 · 查看缺口原因", 12, AMBER)
        else: body += tx(cx+14, cy+56, "净盈亏 +18,420", 12, GREEN) + tx(cx+14, cy+82, "该日浮盈 +6,180", 12, TEXT)
        if state == "pressed": body += tx(cx+190, cy+94, "已固定", 11, BLUE)
    elif name == "EmptyState":
        body += rect(cx, cy, 300, 120, SURFACE, LINE, 8) + icon("search", cx+20, cy+20, MUTED) + tx(cx+52, cy+32, {"default":"当前范围没有持仓","hover":"没有匹配的持仓","focus":"暂无可归因数据","pressed":"下一步已触发","error":"数据暂不可用","empty":"无结果"}.get(state, "当前范围没有持仓"), 14, TEXT, 600) + tx(cx+52, cy+60, "切换市场或导入交易", 12, MUTED)
        body += rect(cx+52, cy+76, 116, 32, "#243B5C" if state == "pressed" else SURFACE, FOCUS if focus else BLUE, 6, 2 if focus else 1) + tx(cx+110, cy+97, "切换市场 →", 12, BLUE, 500, "middle")
    elif name == "RetryAction":
        body += rect(cx, cy+2, 110, 32, fill, FOCUS if focus else LINE, 6, 2 if focus else 1) + icon("refresh", cx+8, cy+8, MUTED if state == "disabled" else BLUE) + tx(cx+34, cy+23, "重试中…" if state == "loading" else "异步重试", 12, MUTED if state == "disabled" else TEXT)
        body += tx(cx, cy+58, "禁止重复提交" if state == "loading" else "仅异常上下文出现", 11, MUTED)
    return body

def board(name):
    # DataTable cards are 700px tall and arranged in four rows; keep all eight
    # states inside the SVG viewBox (the previous 1500px canvas clipped rows 3–4).
    width, height = (1580, 3000) if name == "DataTable" else (1100, 860)
    body = tx(32, 38, f"V2.1 原子板 · {name}", 24, TEXT, 600)
    body += tx(32, 66, "每格为真实结构状态；visible 是视觉包络，hit 是可操作命中区。桌面 36px，Token/Retry/StatusBadge 例外按合同。", 12, MUTED)
    for i, state in enumerate(STATES):
        if name == "DataTable":
            body += frame(name, state, 32 + (i % 2) * 780, 88 + (i // 2) * 720)
        else:
            body += frame(name, state, 32 + (i % 2) * 540, 88 + (i // 2) * 190)
    return svg(width, height, body, f"{name} 八态真实几何板")

def contract_entry(name, state):
    vw, vh = visual_size(name); hw, hh = hit_size(name)
    applicable = (name, state) not in NA
    dims = f"{vw}x{vh} visible; {hw}x{hh} hit"
    if not applicable:
        return {"id": f"{name}.{state}", "component": name, "state": state, "state_label_zh": STATE_ZH[state], "applicable": False, "na_reason": NA[(name, state)], "visible_geometry": {"width": None, "height": None}, "hit_geometry": {"width": None, "height": None}, "dimensions": "N/A", "trigger": "不渲染", "feedback": "不渲染", "exit": "不渲染", "keyboard": "不适用", "failure_recovery": "不适用", "evidence": f"images/atom-{name.lower()}.svg#{state}"}
    base = {
        "IconButton": ("点击、Enter 或 Space", "图标动作和 tooltip 出现；loading 显示 1.2 秒状态环", "动作完成后返回调用表面", "Tab 到达；Esc 关闭 tooltip/浮层", "错误显示原因 tooltip；重试保留焦点"),
        "SegmentedTabs": ("点击分段或方向键/Home/End", "选中分段并显示请求中标记", "提交选择或恢复上一分段", "方向键/Home/End 移动；Enter 提交", "generation 丢弃迟到响应并恢复旧 tab"),
        "Select": ("点击、Enter 或 Space", "菜单打开且当前值持续可见", "选择选项或 Esc 返回触发器", "方向键移动；Esc 返回触发器", "无选项明确提示；失败保留旧值"),
        "Popover": ("点击触发器或搜索图标", "锚定的 320/360 浮层打开并聚焦首字段", "应用提交；Esc/取消返回触发器；外点关闭", "Tab 循环；Shift+Tab 回到触发器；Esc 关闭", "校验失败保留草稿；失败不改已提交范围"),
        "Token": ("点击删除命中区", "删除动作高亮", "删除提交或恢复 token", "Tab 到 36px 删除区；Enter/Space 删除", "删除失败恢复原 token 和焦点"),
        "Metric": ("聚焦或激活详情动作", "88px 指标显示单位和口径", "Esc 关闭详情并返回焦点", "Tab 进入详情；Esc 关闭", "未知显示破折号；错误显示原因且绝不显示 0"),
        "StatusBadge": ("悬停或聚焦 badge", "显示更新时间或原因", "离开 badge 或关闭详情", "Tab 到达；Enter 打开原因", "stale/partial/error 保持明确文案，不伪造成功"),
        "DataTable": ("悬停行；激活表头排序、查看或分页", "8 个固定槽展示行 hover 或排序 pressed", "排序/查看/分页提交并保持表格几何", "Tab 顺序：搜索、表头、行操作、分页", "loading 保留 8 行骨架；error 保留旧表并提供重试"),
        "ChartTooltip": ("悬停数据点或聚焦图表", "264px tooltip 显示日期、币种、当日值和口径", "方向键切换点；Esc 移除 tooltip", "方向键移动点；Esc 关闭", "缺口说明缺失原因；不显示过期 tooltip"),
        "EmptyState": ("到达 CTA 并激活", "120px 最小高度内可读原因和下一步", "CTA 跳转导入、清空搜索或覆盖详情", "Tab 到 CTA；Enter 执行", "0 行/无搜索/无归因各有文案；失败保留上下文"),
        "RetryAction": ("错误上下文中点击、Enter 或 Space", "按钮进入 loading 并阻止重复请求", "成功移除动作；失败恢复错误入口", "Tab 到达；Enter/Space 重试", "generation 忽略迟到响应；错误保持可操作"),
    }[name]
    trigger, feedback, exit_, keyboard, recovery = base
    state_notes = {
        "default": ("进入页面或恢复默认值", "显示稳定默认内容与可操作边界", "激活、悬停或聚焦进入下一状态", "Tab 到达；Enter/Space 激活", "数据缺失显示明确占位并保留上下文"),
        "hover": ("指针进入视觉包络并停留 300ms", "高亮边界并显示可用提示，不改变提交值", "指针离开包络或触发下一动作", "键盘不依赖 hover；Tab 可进入同一动作", "提示加载失败时保留控件并显示原因"),
        "focus": ("Tab 或 Shift+Tab 将焦点移入", "显示 2px 焦点环与当前值，焦点可见", "Tab 离开、Enter/Space 激活或 Esc 取消", "Tab/Shift+Tab 移动；Esc 取消", "焦点环不遮挡内容；失败后焦点留在原控件"),
        "pressed": ("指针按下并完成 click，或按 Enter/Space", "显示 pressed 反馈并提交一次动作", "动作完成、取消或返回稳定状态", "Enter/Space 只提交一次；Esc 取消未提交动作", "重复提交被锁住；失败恢复默认并保留错误原因"),
        "disabled": ("权限、不可用数据或父级表单明确设置禁用", "降低对比度且不响应指针/键盘激活", "权限恢复或父级表单重新启用", "Tab 跳过；Enter/Space 不产生动作", "禁用原因必须由相邻文案说明，不伪造成功"),
        "loading": ("动作已提交且请求处于 pending", "显示骨架、旋转环或 loading 文案；保留必要旧值", "请求成功、失败或取消后回到稳定状态", "Tab 保持顺序；Enter/Space 在 pending 期间不重复提交", "超时/失败保留旧数据并提供可达的重试路径"),
        "empty": ("查询范围无结果、无数据或输入为空", "显示空原因与下一步 CTA，不把空误报为成功", "切换范围、清除筛选、导入数据或返回触发器", "Tab 到 CTA；Enter/Space 执行下一步；Esc 返回", "保留查询上下文；若清除失败仍显示原空原因"),
        "error": ("请求、校验或数据读取失败", "显示可读原因、旧值/旧表和重试入口", "重试成功、关闭原因或返回上一稳定状态", "Tab 到错误说明与重试；Enter/Space 重试；Esc 关闭说明", "generation 丢弃迟到响应；失败不伪造 0、空表或成功状态"),
    }
    trigger, feedback, exit_, keyboard, recovery = state_notes[state]
    action = {
        "IconButton": "查看详情图标动作",
        "SegmentedTabs": "分段选择（方向键切换）",
        "Select": "账户选择菜单",
        "Popover": "标的搜索浮层",
        "Token": "ETF 删除命中区",
        "Metric": "净盈亏口径详情",
        "StatusBadge": "更新时间状态徽标",
        "DataTable": "持仓行、表头排序与分页",
        "ChartTooltip": "图表数据点提示",
        "EmptyState": "空结果下一步 CTA",
        "RetryAction": "异常上下文重试按钮",
    }[name]
    trigger = f"{action}：{trigger}"
    feedback = f"{action}：{feedback}"
    exit_ = f"{action}：{exit_}"
    recovery = f"{action}：{recovery}"
    keyboard_overrides = {
        "SegmentedTabs": {"default":"Tab 到达；方向键/Home/End 选择；Enter/Space 提交", "hover":"键盘不依赖 hover；Tab 到达后方向键切换", "focus":"方向键/Home/End 移动；Enter/Space 提交；Esc 取消", "pressed":"Enter/Space 只提交当前分段；Esc 取消", "disabled":"Tab 跳过；方向键与 Enter 不产生选择", "loading":"方向键可读当前分段；Enter/Space 在 pending 期间不重复提交", "empty":"无空态；Tab 离开分段组", "error":"Tab 到错误文案；方向键恢复旧分段；Enter 重试"},
        "Select": {"default":"Tab 到达；Enter/Space 打开菜单；方向键选项", "hover":"键盘不依赖 hover；Tab 后 Enter 打开菜单", "focus":"方向键移动菜单选项；Enter 选择；Esc 返回触发器", "pressed":"方向键移动；Enter 选择账户；Esc 关闭菜单", "disabled":"Tab 跳过；Enter/Space 不打开菜单", "loading":"Tab 保持选择顺序；Enter/Space 在加载期间不重复打开", "empty":"Tab 到导入账户 CTA；Enter 执行导入；Esc 返回", "error":"Tab 到重试；Enter/Space 重试；Esc 返回旧值"},
        "Popover": {"default":"Tab 到触发器；Enter 打开并聚焦搜索字段", "hover":"键盘不依赖 hover；Tab 到触发器后 Enter 打开", "focus":"Tab 循环搜索与结果；Shift+Tab 回触发器；Esc 关闭", "pressed":"Enter 提交搜索；Esc 关闭浮层", "disabled":"Tab 跳过不可用触发器；Enter 不打开", "loading":"Tab 保持搜索字段；Enter 在 pending 期间不重复查询", "empty":"Tab 到清除搜索；Enter 清除；Esc 返回触发器", "error":"Tab 到重试；Enter/Space 重试；Esc 关闭错误"},
        "Metric": {"default":"Tab 到详情动作；Enter 打开口径", "hover":"键盘不依赖 hover；Tab 到详情动作", "focus":"Tab 进入口径详情；Esc 关闭并返回指标", "pressed":"Enter 打开口径；Esc 关闭详情", "disabled":"Tab 跳过只读指标；Enter 不产生动作", "loading":"Tab 保持指标顺序；Enter 不重复请求", "empty":"Tab 到替代说明；Esc 返回", "error":"Tab 到原因；Enter 打开原因详情；Esc 返回"},
        "ChartTooltip": {"default":"Tab 聚焦图表；方向键移动数据点", "hover":"指针进入数据点；键盘用方向键选择点", "focus":"方向键切换数据点；Esc 移除 tooltip", "pressed":"Enter 固定当前点；Esc 解除固定", "disabled":"Tab 跳过不可用图表；方向键无效", "loading":"Tab 保持图表顺序；方向键不读取未就绪点", "empty":"Tab 到缺口说明；Esc 移除 tooltip", "error":"Tab 到缺口原因；Esc 移除过期 tooltip"},
        "Token": {"default":"Tab 到 36px 删除命中区；Enter/Space 删除", "hover":"指针进入删除命中区；键盘仍由 Tab 到达", "focus":"Tab 到删除区；Enter/Space 删除；Esc 取消", "pressed":"Enter/Space 只删除一次；Esc 取消", "disabled":"Tab 跳过删除区；Enter/Space 不删除", "loading":"Tab 保持顺序；Enter/Space 在删除 pending 期间不重复提交", "empty":"集合为空；焦点返回筛选入口；无 token 命中区", "error":"Tab 到删除区；Enter/Space 重试删除；Esc 保留 token"},
        "DataTable": {"default":"Tab 顺序：搜索、表头、8 行查看、分页", "hover":"指针进入行；键盘 Tab 仍按搜索→表头→行→分页", "focus":"Tab 进入表头/行操作；Enter 排序或查看；Esc 取消", "pressed":"Enter 激活排序/查看/分页；Esc 取消未提交动作", "disabled":"Tab 跳过禁用操作；Enter 不排序或查看", "loading":"Tab 保留搜索、表头和分页顺序；Enter 不重复请求", "empty":"Tab 到空原因与下一步；Enter 切换范围或导入", "error":"Tab 到旧表和重试；Enter/Space 重试；Esc 关闭原因"},
        "EmptyState": {"default":"Tab 到切换市场 CTA；Enter/Space 执行", "hover":"指针进入 CTA；键盘仍由 Tab 到 CTA", "focus":"Tab 聚焦 CTA；Enter/Space 执行；Esc 返回", "pressed":"Enter/Space 只提交 CTA 一次；Esc 取消", "disabled":"Tab 跳过 CTA；Enter/Space 不跳转", "loading":"Tab 保持父级顺序；Enter 不重复触发导入", "empty":"Tab 到切换市场 CTA；Enter/Space 执行下一步", "error":"Tab 到 CTA 与错误原因；Enter/Space 重试或切换市场"},
        "RetryAction": {"default":"错误上下文 Tab 到重试；Enter/Space 执行", "hover":"指针进入重试按钮；键盘仍由 Tab 到达", "focus":"Tab 聚焦重试；Enter/Space 执行；Esc 取消", "pressed":"Enter/Space 只重试一次；Esc 取消", "disabled":"Tab 跳过重试；Enter/Space 不提交", "loading":"Tab 保持顺序；Enter/Space 在 pending 期间不重复提交", "empty":"无空态；Tab 离开错误上下文", "error":"Tab 到重试；Enter/Space 重试；Esc 关闭原因"},
        "StatusBadge": {"default":"Tab 到达；Enter 打开详情", "hover":"键盘不依赖 hover；Tab 到达 badge", "focus":"Tab 到达；Enter 打开原因；Esc 关闭详情", "pressed":"Enter 打开详情；Esc 关闭详情", "disabled":"Tab 跳过只读 badge；Enter 不产生动作", "loading":"Tab 到达；Enter 不重复刷新", "empty":"Tab 到达只读暂无状态；Enter 打开说明", "error":"Tab 到达；Enter 打开过期原因；Esc 关闭详情"},
    }
    keyboard = keyboard_overrides.get(name, {}).get(state, keyboard)
    exact = {
        "IconButton": {
            "hover": ("指针进入按钮；立即 120ms 高亮，tooltip 仅延迟 300ms", "按钮立即变亮；300ms 后显示 tooltip", "指针离开按钮或 tooltip 关闭", "错误 tooltip 显示原因；保持动作可重试"),
            "loading": ("点击查看动作后请求 pending", "显示旋转环与更新中；锁定重复点击", "请求完成或错误 tooltip 出现", "超时保留按钮；错误 tooltip 提供重新查看入口"),
            "empty": ("无此状态：图标动作必须有语义", "不渲染空 payload", "不适用", "不适用"),
            "error": ("查看动作返回错误", "显示错误图标与原因 tooltip", "关闭 tooltip 或再次激活查看", "错误原因保留；再次激活重新请求"),
        },
        "SegmentedTabs": {
            "hover": ("指针进入单一分段；立即 120ms 高亮目标段", "仅目标段 hover 边框/底色变化，选中段保持选中", "指针离开目标段", "不提交、不改变选中段；离开后恢复"),
            "loading": ("点击分段后请求 pending", "保留旧选中段并显示请求中标记", "请求成功切换，或失败回滚旧段", "迟到响应按 generation 丢弃；失败显示回滚原因"),
            "empty": ("无此状态：分段组至少有一个分段", "不渲染空分段组", "不适用", "不适用"),
            "error": ("分段请求失败", "保留旧选中段并显示失败文案", "按方向键重新选段或再次 Enter 提交", "迟到响应丢弃；失败回滚到旧段"),
        },
        "Select": {
            "hover": ("指针进入选择框；立即 120ms 高亮", "选择框底色变化，不打开菜单", "指针离开选择框或点击打开", "值保持不变"),
            "loading": ("账户列表请求 pending", "显示加载账户中与旋转 cue，保留当前值", "请求完成打开可选项，或显示错误重试", "失败保留旧值并保持重试按钮可达"),
            "empty": ("账户列表为空", "显示暂无可选账户与导入账户 CTA", "点击/Enter 导入账户，或 Esc 返回", "导入失败保留空原因与 CTA"),
            "error": ("账户列表读取失败", "保留当前值、错误文案和重试按钮", "点击/Enter 重试，或 Esc 返回", "重试失败保持旧值与重试入口"),
        },
        "Popover": {
            "hover": ("指针进入触发器；立即 120ms 高亮，浮层不因 hover 自动打开", "触发器高亮；点击后才打开 360px 浮层", "指针离开或点击外部", "外部点击关闭且不改草稿"),
            "loading": ("搜索提交后请求 pending", "搜索字段保留草稿并显示查询中 cue", "请求完成更新结果，或显示错误重试", "失败保留草稿与重试按钮"),
            "empty": ("搜索无匹配结果", "显示没有匹配结果与清除搜索动作", "清除搜索、改写查询或点击外部关闭", "清除失败保留原查询和空原因"),
            "error": ("搜索校验失败", "保留草稿、错误原因和重试按钮", "重试、Esc 关闭或点击外部关闭；非模态可退出", "失败不改变已提交范围；外部点击可关闭"),
        },
        "Token": {
            "hover": ("指针进入删除命中区；立即 120ms 高亮", "仅删除图标变红/高亮，token 文本保持", "指针离开命中区", "不提交删除"),
            "loading": ("点击删除后删除请求 pending", "保留 ETF token 并显示 pending 反馈", "删除成功移除，或失败恢复 token", "锁定重复删除；失败恢复原 token 与焦点"),
            "empty": ("token 集合为空", "不渲染 token；焦点返回筛选入口", "返回筛选入口或添加 token", "空集合不创建删除焦点；筛选入口保持可达"),
            "error": ("删除请求失败", "保留 ETF 并显示移除失败原因", "再次激活删除或离开错误状态", "失败恢复原 token、删除命中区与焦点"),
        },
        "Metric": {
            "hover": ("指针进入指标详情 affordance；立即 120ms 提示", "指标值不变，仅详情入口高亮", "指针离开详情入口", "不发起请求、不改变指标值"),
            "loading": ("指标数据请求 pending", "保留旧值并显示骨架/加载反馈", "请求完成更新值，或显示原因", "超时保留旧值；不将 pending 显示为 0"),
            "empty": ("当前范围没有可计算指标", "显示破折号与口径说明，不显示 CTA", "切换范围或返回上一筛选", "范围切换失败保留破折号与上下文"),
            "error": ("指标计算失败", "保留指标区域并提供“查看原因”入口", "点击原因入口或返回上一范围", "不显示 0；原因入口保留失败上下文"),
        },
        "StatusBadge": {
            "pressed": ("Enter/Space 激活状态徽标详情", "打开更新时间或过期原因详情", "Esc 关闭详情并返回 badge", "详情失败保持 badge 原文案"),
            "hover": ("指针进入 badge；立即 120ms 高亮，详情提示延迟 300ms", "badge 高亮并在延迟后显示更新时间", "指针离开 badge", "提示失败保持 badge 文案"),
            "loading": ("状态刷新请求 pending", "显示更新中 badge，不伪造更新时间", "刷新成功显示时间，或显示过期原因", "失败保留更新中/过期原因，不显示成功"),
            "empty": ("没有可显示的更新时间或状态", "显示暂无状态 badge", "数据出现或离开上下文", "缺失继续显示暂无状态"),
            "error": ("状态刷新失败", "显示过期·原因 badge", "聚焦打开原因或离开 badge", "保留过期原因，不提供不存在的重试按钮"),
        },
        "DataTable": {
            "hover": ("指针进入单一表格行；立即 120ms 高亮目标行", "仅目标行高亮，表头/其他行不变", "指针离开该行", "不改变排序、分页或行数据"),
            "loading": ("排序、分页或查询请求 pending", "保留 8 行槽位；分页槽位置灰且不可用", "成功替换 8 行并恢复分页，或保留旧表显示错误", "迟到响应丢弃；错误保留旧表并提供重试"),
            "empty": ("当前范围无持仓行", "行区显示空原因，分页槽位显示 0 项且不提供分页按钮", "切换范围、导入或清除筛选", "下一步失败保留查询范围与空原因；不创建虚假的第 1 页"),
            "error": ("表格请求失败", "保留旧表、错误条和重试动作", "点击/Enter 重试或离开错误条", "迟到响应丢弃；失败继续保留旧表"),
        },
        "ChartTooltip": {
            "hover": ("指针进入数据点；立即 120ms 显示点反馈", "数据点高亮，tooltip 内容按 300ms 延迟显示", "指针离开数据点", "无数据点时不插值，移除旧 tooltip"),
            "loading": ("图表行情请求 pending", "保留日期并显示行情加载中与旋转 cue", "行情完成显示值，或显示缺口原因", "不显示旧 tooltip 数值冒充新值"),
            "empty": ("该日期缺少行情", "显示缺行情原因，不插值", "切换数据点或 Esc 移除 tooltip", "缺口继续明确显示，不伪造数值"),
            "error": ("该数据点读取失败", "显示缺口原因入口，不提供重试按钮", "聚焦/点击原因入口或 Esc 移除 tooltip", "保留缺口原因；不显示过期或成功数值"),
        },
        "EmptyState": {
            "hover": ("指针进入切换市场 CTA；立即 120ms 高亮", "仅 CTA 高亮，空原因不变", "指针离开 CTA", "不触发导航"),
            "loading": ("父级区块正在加载", "使用父级骨架，不渲染 EmptyState", "父级加载完成后显示数据或空态", "加载失败转为错误上下文，不叠加空态"),
            "empty": ("查询范围无结果", "显示空原因与切换市场 CTA", "点击/Enter 切换市场或导入交易", "下一步失败保留查询上下文与空原因"),
            "error": ("空态数据读取失败", "显示数据暂不可用与切换市场 CTA", "点击 CTA 切换范围或返回", "失败保留错误上下文，不伪造无结果"),
        },
        "RetryAction": {
            "hover": ("指针进入重试按钮；立即 120ms 高亮", "按钮高亮但不提交请求", "指针离开按钮", "不改变错误上下文"),
            "loading": ("点击/Enter 重试后请求 pending", "显示重试中并阻止重复提交", "成功移除错误入口，或失败恢复重试按钮", "迟到响应丢弃；失败恢复按钮与错误原因"),
            "empty": ("无错误上下文不渲染重试", "不显示按钮", "不适用", "不适用"),
            "error": ("错误上下文已建立且重试可用", "显示异步重试按钮", "点击/Enter 进入 loading，或 Esc 离开", "失败恢复按钮；保留具体错误原因"),
        },
    }
    if state in exact.get(name, {}):
        trigger, feedback, exit_, recovery = exact[name][state]
    return {"id": f"{name}.{state}", "component": name, "state": state, "state_label_zh": STATE_ZH[state], "applicable": True, "visible_geometry": {"width": vw, "height": vh}, "hit_geometry": {"width": hw, "height": hh}, "dimensions": dims, "trigger": trigger, "feedback": feedback, "exit": exit_, "keyboard": keyboard, "failure_recovery": recovery, "evidence": f"images/atom-{name.lower()}.svg#{state}"}

def main():
    entries = [contract_entry(n, s) for n in NAMES for s in STATES]
    for name in NAMES:
        (OUT / f"atom-{name.lower()}.svg").write_text(board(name), encoding="utf-8")
    contract = {"version": "HOME-DOC-V21", "contract": "atom-revision", "font": {"selected": "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", "theoretical_alternative": "Web Sans without supplied font files; concept only and excluded from glyph evidence"}, "states": STATES, "components": NAMES, "na_count": sum(not e["applicable"] for e in entries), "applicable_count": sum(e["applicable"] for e in entries), "entries": entries}
    (ROOT / "atom-contract.json").write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# V2.1 原子控件合同", "", "本包修复文档基线中的 F01/F07/F11。每张画板都绘制真实结构，不再使用状态矩阵占位框。", "", "## 几何与字体", "", "- 正式字体：`ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif`；中文使用平台回退，数字使用 `font-variant-numeric: tabular-nums`。", "- Web Sans 只是理论候选。仓库没有字体文件，因此不纳入字形比较证据。", "- 间距 token：4、8、12、16、24、32px。圆角：小控件 6px、面板/浮层 8px。焦点环 2px，外偏移 2px。", "- `visible_geometry` 是视觉绘制包络，`hit_geometry` 是键盘/指针命中区。Token 视觉高 24px、命中高 36px；RetryAction 视觉高 32px、命中高 36px；StatusBadge 视觉高 24px、命中高 36px。三者都是明确例外。", "", "## 状态覆盖", "", f"合同共有 {len(entries)} 格：{contract['applicable_count']} 格适用，{contract['na_count']} 格明确 N/A。N/A 原因同时保存在 JSON 与对应画板。", "", "| 控件 | 画板 | 默认几何 |", "|---|---|---|"]
    for n in NAMES:
        vw, vh = visual_size(n); hw, hh = hit_size(n)
        lines.append(f"| {n} | [atom-{n.lower()}.svg](images/atom-{n.lower()}.svg) | 视觉 {vw}×{vh}；命中 {hw}×{hh} |")
    lines += ["", "## 逐态合同明细", "", "下表覆盖 88 格；N/A 也保留原因。每个适用状态都写出该状态自己的触发、反馈、退出、键盘路径和失败/恢复行为。", "", "| 控件 / 状态 | 适用 | 尺寸 | 触发 | 反馈 | 退出 | 键盘 | 失败 / 恢复 |", "|---|---:|---|---|---|---|---|---|"]
    for e in entries:
        label = f"{e['component']} · {e['state_label_zh']} ({e['state']})"
        vals = [label, '是' if e['applicable'] else 'N/A', e['dimensions'], e['trigger'], e['feedback'], e['exit'], e['keyboard'], e['failure_recovery'] if e['applicable'] else e['na_reason']]
        lines.append("| " + " | ".join(str(v).replace('|', '/') for v in vals) + " |")
    lines += ["", "这是静态设计合同；浏览器/产品执行仍是独立验收门槛。", "", "机器可读源文件：[atom-contract.json](atom-contract.json)。几何参考：[geometry-tokens.svg](images/geometry-tokens.svg)。"]
    (ROOT / "atom-contract.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (OUT / "geometry-tokens.svg").write_text(geometry_svg(), encoding="utf-8")

def geometry_svg():
    b = tx(32, 40, "V2.1 几何 tokens · visible / hit / focus", 24, TEXT, 600)
    b += tx(32, 68, "同一套 4px 基准与真实字体选型；命中区不被视觉包络混淆。", 12, MUTED)
    b += tx(32, 116, "间距刻度", 16, TEXT, 600)
    for i, v in enumerate([4, 8, 12, 16, 24, 32]):
        x = 32 + i * 110; b += line(x, 150, x+v*2, 150, BLUE, 4) + tx(x, 178, f"{v}px", 12, MUTED)
    b += tx(32, 224, "可见框与命中框", 16, TEXT, 600)
    b += rect(32, 250, 36, 36, "#243B5C", FOCUS, 6, 2) + tx(84, 273, "IconButton · visible = hit 36×36", 12)
    b += rect(32, 314, 104, 24, RAISED, LINE, 6) + rect(32, 308, 104, 36, "none", BLUE, 6, 1) + tx(154, 328, "Token · visible 104×24 / hit 104×36", 12)
    b += rect(32, 430, 124, 24, RAISED, LINE, 12) + rect(32, 424, 124, 36, "none", BLUE, 12, 1) + tx(174, 448, "StatusBadge · visible 124×24 / hit 124×36", 12)
    b += rect(32, 370, 110, 32, RAISED, LINE, 6) + rect(32, 368, 110, 36, "none", BLUE, 6, 1) + tx(154, 391, "RetryAction · visible 110×32 / hit 110×36", 12)
    b += tx(32, 500, "复杂控件最小尺寸", 16, TEXT, 600)
    for i, (label, w, h) in enumerate([("Metric", 276, 88), ("Popover", 360, 132), ("ChartTooltip", 264, 112), ("EmptyState", 300, 120)]):
        x = 32 + (i%2)*500; y = 528 + (i//2)*150; b += rect(x, y, w, h, RAISED, LINE, 8) + tx(x+12, y+24, f"{label} {w}×{h}", 13, BLUE, 600) + tx(x+12, y+h-16, "真实结构板见对应 atom 文件", 11, MUTED)
    b += tx(32, 848, "字体：系统无衬线为正式选型；Web Sans 无文件，仅概念候选，不作为字形证据。", 12, AMBER)
    return svg(1050, 850, b, "V2.1 几何 tokens 与命中区标尺")

if __name__ == "__main__":
    main()
