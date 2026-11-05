#!/usr/bin/env python3
"""Library, composition, experiment creation, error and shared-control boards.

This is an override layer for ``build-artboards.py``.  It intentionally owns
only the boards assigned to the library/forms pass; the base generator and
the other board owners remain untouched.  The SVGs are static design evidence
and use fictional data.
"""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

ROOT = Path(__file__).parent
BASE_PATH = ROOT / "build-artboards.py"
spec = spec_from_file_location("strategy_artboard_base", BASE_PATH)
base = module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(base)

OUT = ROOT / "images"
OUT.mkdir(parents=True, exist_ok=True)

BG, PANEL, RAISED, LINE = base.BG, base.PANEL, base.RAISED, base.LINE
TEXT, MUTED, WEAK = base.TEXT, base.MUTED, base.WEAK
BLUE, FOCUS, GREEN = base.BLUE, base.FOCUS, base.GREEN
RED, WARN, PURPLE = base.RED, base.WARN, base.PURPLE
CYAN, ORANGE, FONT, NUM = base.CYAN, base.ORANGE, base.FONT, base.NUM

esc, rect, line, path, pill = base.esc, base.rect, base.line, base.path, base.pill
t, button, chrome, end = base.t, base.button, base.chrome, base.end


def input36(x, y, w, label, value, trailing=""):
    """A 36px input with a separate 12px label (not a 56px fake input)."""
    s = t(x, y, label, 12, MUTED)
    s += rect(x, y + 8, w, 36, PANEL, LINE, 6)
    s += t(x + 12, y + 32, value, 14, TEXT, 500)
    if trailing:
        s += t(x + w - 12, y + 32, trailing, 12, WEAK, 400, "end")
    return s


def section(x, y, w, h, title, subtitle="", fill=PANEL):
    s = rect(x, y, w, h, fill, LINE, 8)
    s += t(x + 20, y + 28, title, 18, TEXT, 600)
    if subtitle:
        s += t(x + 20, y + 51, subtitle, 12, MUTED)
    return s


def footer(s, W=1440, H=1000):
    # ``chrome`` already owns the watermark for full-size boards.  Keep this
    # helper as the single close-out path so the badge is not drawn twice.
    return s + end()


def make_library():
    s = chrome("策略库", "管理可复用的方法；完整策略与三类包分开看，版本和引用关系始终可追溯")
    x, w = 100, 1240
    s += pill(x, 132, "策略库", BLUE, 72) + pill(x + 80, 132, "我的实验", MUTED, 84, "#151F2E")
    s += button(x + w - 100, 128, "新建策略", 100, True)
    s += input36(x, 182, 386, "搜索策略、说明、标签或标识", "EMA20、质量、移动止盈", "⌕")
    s += button(x + 402, 190, "全部类型⌄", 116) + button(x + 526, 190, "未归档⌄", 116)
    s += button(x + 650, 190, "最近版本↓", 128) + pill(x + 790, 196, "置顶优先", BLUE, 88)
    s += t(x, 270, "完整策略", 18, TEXT, 600) + t(x + 108, 270, "3 个结果 · 查询各自保存", 12, MUTED)
    s += rect(x, 288, 806, 40, RAISED, LINE, 6)
    for label, xx in [("名称", x), ("版本", x + 388), ("三包组成", x + 484), ("引用", x + 670)]:
        s += t(xx + 12, 313, label, 12, MUTED, 500)
    rows = [
        ("EMA20 趋势质量", "v1.4", "筛选 v2.0 · 买入 v1.3 · 止盈 v1.1", "2 个实验", BLUE),
        ("低波动质量", "v2.1", "筛选 v1.8 · 买入 v1.6 · 止盈 v1.2", "1 个实验", PURPLE),
        ("价值回归实验版", "v0.9", "筛选 v1.1 · 买入 v0.8 · 止盈 v0.9", "—", WARN),
    ]
    yy = 328
    for name, ver, packages, refs, col in rows:
        s += rect(x, yy, 806, 70, PANEL, LINE, 0)
        s += t(x + 16, yy + 28, name, 14, TEXT, 600) + t(x + 16, yy + 50, "完整策略 · 可加入新实验", 12, MUTED)
        s += t(x + 400, yy + 35, ver, 14, col, 600) + t(x + 496, yy + 35, packages, 12, MUTED)
        s += t(x + 682, yy + 35, refs, 12, TEXT, 500)
        s += t(x + 774, yy + 35, "•••", 17, MUTED, 600, "end")
        yy += 70
    s += section(x + 830, 288, 410, 250, "策略包目录", "三类职责独立管理 · 计数为已保存引用")
    packs = [
        ("标的筛选策略包", "8 个包", "12 个策略引用", CYAN),
        ("买入信号包", "6 个包", "9 个策略引用", BLUE),
        ("止盈止损策略包", "5 个包", "7 个策略引用", ORANGE),
    ]
    for i, (name, count, refs, col) in enumerate(packs):
        yy = 366 + i * 52
        s += line(x + 850, yy - 10, x + 1218, yy - 10, LINE)
        s += rect(x + 850, yy, 6, 28, col, "none", 3)
        s += t(x + 866, yy + 14, name, 13, TEXT, 600)
        s += t(x + 1218, yy + 12, count, 12, col, 600, "end")
        s += t(x + 1218, yy + 29, refs, 11, MUTED, 400, "end")
    s += section(x, 554, w, 260, "管理偏好", "展示偏好不会改变执行顺序或历史运行", RAISED)
    s += t(x + 20, 610, "当前列表", 12, MUTED) + t(x + 20, 636, "未归档 · 置顶优先 · 最近规则版本发布↓", 14, TEXT, 500)
    s += t(x + 20, 686, "个人整理", 12, MUTED) + t(x + 20, 712, "置顶与手动顺序按三类目录分别保存，跨会话仍保留", 14, TEXT, 500)
    s += pill(x + 676, 592, "置顶 2", BLUE, 72) + pill(x + 756, 592, "普通 17", WEAK, 82, "#151F2E")
    s += button(x + 676, 650, "进入整理顺序", 132) + button(x + 818, 650, "显示已归档", 132)
    s += t(x + 676, 716, "归档只隐藏新增选择；已有完整策略和实验引用仍可继续执行检查。", 12, MUTED)
    s += t(x, 864, "目录入口只用于管理与查看；创建实验从“我的实验”开始。", 13, WEAK)
    return footer(s)


def make_package_management():
    """A readable 920px crop: package identity, counts, manual order and archive."""
    W, H = 920, 470
    s = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
    s += f'<rect width="{W}" height="{H}" fill="{BG}"/>'
    s += t(24, 30, "策略包目录 · 置顶与归档确认", 20, TEXT, 600)
    s += t(24, 53, "局部放大 · 包身份及全部版本受同一整理动作影响", 13, MUTED)
    s += section(24, 78, 490, 340, "止盈止损策略包", "5 个包 · 7 个完整策略引用 · 2 个锁定实验")
    headers = [("包身份", 44), ("当前版本", 260), ("引用数", 368), ("整理", 446)]
    for label, xx in headers:
        s += t(xx, 162, label, 12, MUTED, 500)
    rows = [
        ("移动止盈", "v1.1", "4", "置顶", BLUE),
        ("固定止损", "v1.0", "2", "普通", WEAK),
        ("价值退出", "v0.9", "1", "普通", WEAK),
    ]
    for i, (name, ver, refs, order, col) in enumerate(rows):
        yy = 177 + i * 55
        s += line(44, yy - 12, 486, yy - 12, LINE)
        s += t(44, yy + 12, name, 14, TEXT, 600) + t(260, yy + 12, ver, 14, col, 600)
        s += t(368, yy + 12, refs, 14, TEXT, 500, "end") + pill(390, yy - 4, order, col, 72, "#172536")
    s += t(44, 350, "手动顺序草稿：置顶组内可上下移动，跨页位置也可指定。", 12, MUTED)
    s += rect(44, 376, 238, 28, "#151F2E", "none", 6) + t(163, 395, "个人偏好 · 跨会话保存", 11, WEAK, 500, "middle")
    s += section(538, 78, 358, 340, "归档确认", "整理包身份及其全部版本", RAISED)
    s += pill(560, 136, "将被归档", WARN, 90, "#332918")
    s += t(560, 188, "移动止盈 · v1.1", 15, TEXT, 600)
    s += t(560, 221, "影响范围", 12, MUTED)
    s += t(560, 244, "默认目录：隐藏新增选择", 13, TEXT, 500)
    s += t(560, 268, "已有引用：2 个锁定实验仍可继续执行检查", 13, BLUE, 500)
    s += t(560, 292, "版本身份与来源保留，可在已归档筛选中恢复", 12, MUTED)
    s += button(560, 338, "取消", 76) + button(646, 338, "确认归档", 112, True)
    s += rect(W - 204, H - 28, 180, 20, "#171E2A", "#303B4D", 10)
    s += t(W - 114, H - 14, "虚构数据 · 视觉方案", 10, WEAK, 500, "middle")
    return s + end()


def make_compose():
    s = chrome("组装完整策略", "编辑已有策略保存新版本；复制历史版本创建新身份，两个动作分开呈现")
    x, w = 100, 1240
    s += pill(x, 132, "编辑已有策略", MUTED, 112, "#151F2E") + pill(x + 122, 132, "复制历史版本", BLUE, 112)
    s += t(x, 188, "动作语义", 12, MUTED)
    s += rect(x, 198, 560, 92, RAISED, LINE, 8) + t(x + 18, 226, "保存新版本", 16, TEXT, 600)
    s += t(x + 18, 253, "同一策略身份 · 新版本号 · 历史实验不改写", 13, MUTED)
    s += rect(x + 580, 198, 660, 92, RAISED, LINE, 8) + t(x + 598, 226, "创建副本", 16, TEXT, 600)
    s += t(x + 598, 253, "新策略 ID · 来源版本保留 · 可独立修改", 13, MUTED)
    s += input36(x, 326, 380, "策略名称", "EMA20 副本")
    s += input36(x + 402, 326, 320, "来源完整策略", "EMA20 趋势质量 · v1.3", "锁定")
    s += t(x + 744, 326, "副本新 ID", 12, MUTED) + t(x + 744, 362, "STRAT-NEW-204", 14, FOCUS, 600)
    s += button(x + 1060, 336, "创建副本", 132, True)
    s += t(x, 430, "三包版本（锁定引用）", 18, TEXT, 600) + t(x + 196, 430, "复制完整定义，三包身份与来源一起保留", 12, MUTED)
    items = [
        ("01", "标的筛选策略包", "大盘质量 + 趋势强度", "筛选 v2.0 · 包 ID PK-SCAN-08", CYAN),
        ("02", "买入信号包", "突破后回踩确认", "买入 v1.3 · 包 ID PK-ENTRY-13", BLUE),
        ("03", "止盈止损策略包", "移动止盈 8% · 固定止损 5%", "止盈 v1.1 · 包 ID PK-EXIT-11", ORANGE),
    ]
    yy = 456
    for no, title, desc, ver, col in items:
        # Keep the three source rows in a 740px left rail so the open 480px
        # detail surface remains independently readable on the right.
        s += rect(x, yy, 740, 104, PANEL, LINE, 8) + pill(x + 18, yy + 20, no, col, 42, "#172536")
        s += t(x + 82, yy + 38, title, 16, TEXT, 600) + t(x + 82, yy + 65, desc, 14, MUTED)
        s += t(x + 82, yy + 87, ver, 12, col, 500)
        s += pill(x + 550, yy + 24, "锁定版本", BLUE, 92, "#172536") + button(x + 644, yy + 24, "查看详情", 88)
        yy += 118
    # The real package-detail affordance is a 480px overlay, distinct from
    # the 320px run-check area used by the workbench. It is shown open here
    # so the three locked versions remain reviewable beside its detail copy.
    s += rect(x + 760, 462, 480, 282, "#1A293A", FOCUS, 8, 2)
    s += t(x + 784, 492, "包详情 · 480px 覆盖层", 16, TEXT, 600)
    s += pill(x + 1070, 480, "只读", BLUE, 58, "#172536")
    s += t(x + 784, 528, "标的筛选策略包", 14, TEXT, 600)
    s += t(x + 784, 552, "当前版本  v2.0  ·  PK-SCAN-08", 12, CYAN, 500)
    s += t(x + 784, 582, "用途：大盘质量 + 趋势强度", 13, MUTED)
    s += t(x + 784, 608, "输入：市值、成交额、EMA20", 13, MUTED)
    s += line(x + 784, 626, x + 1216, 626, LINE)
    s += t(x + 784, 654, "锁定引用", 12, MUTED)
    s += t(x + 1216, 654, "完整策略 v1.3（来源版本）", 13, TEXT, 500, "end")
    s += t(x + 784, 680, "返回来源：策略组装 · 未选择升级", 12, WEAK)
    s += button(x + 784, 700, "关闭详情", 96)
    s += rect(x, 824, w, 86, RAISED, LINE, 8)
    s += t(x + 20, 854, "版本结果", 14, TEXT, 600) + t(x + 120, 854, "创建副本后：新策略 STRAT-NEW-204 · v1.0；来源 EMA20 · v1.3 保持不变。", 13, MUTED)
    s += t(x + 20, 881, "历史实验继续锁定原完整策略及三包版本，不复制成交、持仓或收益。", 12, BLUE)
    return footer(s)


def make_experiments():
    s = chrome("我的实验", "每条运行记录有清晰下一步；新建实验和选择策略都从这里开始", breadcrumb=("策略", "我的实验", "实验列表"))
    x, w = 100, 1240
    s += pill(x, 132, "策略库", MUTED, 72, "#151F2E") + pill(x + 80, 132, "我的实验", BLUE, 84)
    s += button(x + w - 100, 128, "新建实验", 100, True)
    s += input36(x, 182, 390, "搜索实验", "EMA20、暂停、2024 Q3", "⌕")
    s += button(x + 406, 190, "全部状态⌄", 116) + button(x + 530, 190, "最近更新↓", 128)
    s += t(x, 270, "实验列表", 18, TEXT, 600) + t(x + 106, 270, "4 条记录 · 状态决定下一步", 12, MUTED)
    s += rect(x, 288, w, 40, RAISED, LINE, 6)
    for label, xx in [("名称", x), ("状态", x + 420), ("起点与期限", x + 570), ("策略版本", x + 800), ("下一步", x + 1070)]:
        s += t(xx + 12, 313, label, 12, MUTED, 500)
    rows = [
        ("EMA20 · 2024 Q3", "已完成", "2024-06-14 · 3个月", "EMA20 v1.4", "查看结果", BLUE),
        ("低波动质量 · 试跑", "暂停", "2024-09-02 · 1个月", "低波动 v2.1", "继续观察", WARN),
        ("价值回归 · 预览", "草稿", "2024-10-01 · 6个月", "未确认", "继续编辑", BLUE),
        ("趋势 + 质量 · 失败", "失败", "2024-01-02 · 1年", "数据覆盖不足", "查看原因", RED),
    ]
    yy = 328
    for name, state, period, strategy, action, col in rows:
        s += rect(x, yy, w, 76, PANEL, LINE, 0) + t(x + 16, yy + 31, name, 15, TEXT, 600)
        s += pill(x + 420, yy + 20, state, col, 64, "#172536") + t(x + 582, yy + 32, period, 13, MUTED)
        s += t(x + 812, yy + 32, strategy, 13, TEXT, 500) + button(x + 1058, yy + 20, action, 104)
        yy += 76
    s += section(x, 672, w, 126, "入口规则", "")
    s += t(x + 20, 729, "库内查看、编辑、复制只管理方法；切换到“我的实验”后点击“新建实验”才会建立草稿。", 13, MUTED)
    s += t(x + 20, 760, "离开或重开运行默认暂停，保持原实验、组合、版本和查看位置。", 13, MUTED)
    return footer(s)


def wizard_bar(s, active=1):
    x = 100
    labels = ["设置起点", "选择策略", "预览组合", "确认创建"]
    for i, label in enumerate(labels, 1):
        col = BLUE if i <= active else MUTED
        fill = "#172536" if i <= active else "#151F2E"
        s += pill(x + (i - 1) * 310, 132, f"{i}  {label}", col, 138, fill)
        if i < 4:
            s += line(x + (i - 1) * 310 + 146, 146, x + (i - 1) * 310 + 292, 146, LINE, 2)
    return s


def make_create():
    s = chrome("我的实验 · 新建实验", "四步流程：设置起点 → 选择策略 → 预览组合 → 确认创建", breadcrumb=("策略", "我的实验", "新建实验"))
    x, w = 100, 1240
    s += wizard_bar("", 1)
    s += rect(x, 194, w, 600, PANEL, LINE, 8)
    s += t(x + 24, 228, "第 1 步 · 设置起点", 18, TEXT, 600)
    s += t(x + 24, 255, "使用完整结束的历史数据；起点时间和业务时区写在实验身份中。", 13, MUTED)
    s += input36(x + 24, 286, 280, "起点日期", "2024-06-14")
    s += input36(x + 322, 286, 280, "起点时间", "15:00")
    s += input36(x + 620, 286, 280, "业务时区", "Asia/Shanghai")
    s += input36(x + 918, 286, 280, "运行期限", "3 个月")
    s += section(x + 24, 380, 560, 250, "区间口径", "名义结束和最后完整交易日分开显示", RAISED)
    s += t(x + 48, 472, "名义结束", 12, MUTED) + t(x + 554, 472, "2024-09-14", 15, TEXT, 600, "end")
    s += t(x + 48, 512, "实际结束（最后完整交易日）", 12, MUTED) + t(x + 554, 512, "2024-09-13", 15, BLUE, 600, "end")
    s += t(x + 48, 562, "起点按收盘后 15:00 记录；未完成日线不会提前进入信号。", 12, MUTED)
    s += section(x + 608, 380, 590, 250, "资金预览", "每个所选完整策略各自建立一组独立本金", RAISED)
    s += t(x + 632, 472, "策略 A 本金", 12, MUTED) + t(x + 1174, 472, "¥100,000.00", 15, TEXT, 600, "end")
    s += t(x + 632, 512, "策略 B 本金", 12, MUTED) + t(x + 1174, 512, "¥100,000.00", 15, TEXT, 600, "end")
    s += t(x + 632, 558, "资金关系", 12, MUTED) + t(x + 1174, 558, "两组独立 · 不共享总额", 14, BLUE, 600, "end")
    s += t(x + 632, 602, "策略选择在下一步完成；此处不把 ¥200,000 当作共享资金池。", 12, MUTED)
    s += button(x + 24, 696, "取消", 80) + button(x + 1030, 696, "下一步：选择策略 →", 168, True)
    s += t(x, 840, "顶部业务归属：我的实验 · 新建实验；策略库没有“用于新实验”主动作。", 13, WEAK)
    return footer(s)


def make_select():
    """Second wizard step: choose complete strategies without starting a run."""
    s = chrome("我的实验 · 选择策略", "选择完整策略并保留草稿选择；新策略入口内联在此，运行仍从确认流程开始", breadcrumb=("策略", "我的实验", "新建实验"))
    x, w = 100, 1240
    s += wizard_bar("", 2)
    s += rect(x, 194, w, 650, PANEL, LINE, 8)
    s += t(x + 24, 228, "第 2 步 · 选择完整策略", 18, TEXT, 600)
    s += t(x + 24, 255, "搜索的是完整策略身份；选中的三包版本会随实验锁定，尚未开始运行。", 13, MUTED)
    s += input36(x + 24, 274, 420, "搜索完整策略", "EMA20、低波动、趋势质量", "⌕")
    s += button(x + 460, 282, "所有版本⌄", 116) + button(x + 584, 282, "仅未归档⌄", 116)
    s += button(x + 1032, 282, "＋ 新建策略", 132)

    left_x, left_w = x + 24, 700
    s += section(left_x, 342, left_w, 456, "完整策略列表", "完整策略及其版本 · 三包摘要可核对", RAISED)
    table_x, table_w = left_x + 24, left_w - 48
    s += rect(table_x, 414, table_w, 40, RAISED, LINE, 6)
    for label, xx in [("完整策略", table_x + 16), ("版本", table_x + 204), ("三包版本摘要", table_x + 282), ("选择", table_x + 566)]:
        s += t(xx, 439, label, 12, MUTED, 500)
    choices = [
        ("A · EMA20 趋势质量", "v1.4", "筛选 v2.0 · 买入 v1.3 · 止盈 v1.1", "已选 A", BLUE, True),
        ("B · 低波动质量", "v2.1", "筛选 v1.8 · 买入 v1.6 · 止盈 v1.2", "已选 B", PURPLE, True),
        ("价值回归实验版", "v0.9", "筛选 v1.1 · 买入 v0.8 · 止盈 v0.9", "未选择", WEAK, False),
    ]
    yy = 454
    for name, ver, packages, state, col, selected in choices:
        fill = "#172536" if selected else PANEL
        stroke = BLUE if selected else LINE
        s += rect(table_x, yy, table_w, 70, fill, stroke, 6)
        s += t(table_x + 16, yy + 27, name, 14, TEXT, 600)
        s += t(table_x + 204, yy + 27, ver, 14, col, 600)
        s += t(table_x + 16, yy + 52, packages, 12, MUTED)
        s += pill(table_x + 552, yy + 21, state, col, 76 if selected else 76, "#172536")
        yy += 78
    s += t(table_x + 16, 732, "找不到合适的完整策略？", 12, MUTED)
    s += button(table_x + 190, 710, "内联新建策略", 128)
    s += t(table_x + 16, 770, "新建完成后返回本步，A/B 已选项与本金不丢失。", 12, WEAK)

    right_x, right_w = x + 748, 468
    s += section(right_x, 342, right_w, 456, "本次选择", "A/B 各自建立独立运行组；选择区间来自第 1 步", RAISED)
    s += t(right_x + 24, 430, "选择区间 / T0", 12, MUTED)
    s += t(right_x + 24, 454, "2024-06-14 15:00 · Asia/Shanghai", 14, TEXT, 600)
    s += t(right_x + 24, 490, "已选完整策略", 12, MUTED)
    s += pill(right_x + 24, 504, "A · EMA20 v1.4", BLUE, 126)
    s += pill(right_x + 160, 504, "B · 低波动 v2.1", PURPLE, 136)
    s += t(right_x + 24, 554, "三包锁定摘要", 12, MUTED)
    s += t(right_x + 24, 578, "A：筛选 v2.0 · 买入 v1.3 · 止盈 v1.1", 12, TEXT, 500)
    s += t(right_x + 24, 602, "B：筛选 v1.8 · 买入 v1.6 · 止盈 v1.2", 12, TEXT, 500)
    s += t(right_x + 24, 640, "独立本金", 12, MUTED)
    s += t(right_x + 24, 664, "策略 A", 13, TEXT, 500) + t(right_x + 420, 664, "¥100,000.00", 14, TEXT, 600, "end")
    s += t(right_x + 24, 690, "策略 B", 13, TEXT, 500) + t(right_x + 420, 690, "¥100,000.00", 14, TEXT, 600, "end")
    s += t(right_x + 24, 724, "两组独立 · 不共享总额", 12, BLUE, 500)
    s += t(right_x + 24, 758, "返回或保存草稿不会丢失本步选择。", 12, MUTED)

    s += button(x + 24, 862, "上一步：设置起点", 160)
    s += button(x + 1040, 862, "下一步：预览组合 →", 180, True)
    s += t(x, 914, "策略库只负责管理方法；不可从策略库直接启实验，需回到“我的实验”完成确认。", 13, WEAK)
    return footer(s)


def make_confirm():
    s = chrome("我的实验 · 预览组合与确认", "第 3 步核对候选与目标；第 4 步锁定完整策略版本、时间、资金与执行假设", breadcrumb=("策略", "我的实验", "新建实验"))
    x, w = 100, 1240
    s += wizard_bar("", 3)
    s += rect(x, 194, w, 280, PANEL, LINE, 8)
    s += t(x + 24, 228, "第 3 步 · 预览组合", 18, TEXT, 600)
    s += t(x + 24, 255, "数据截止 2024-06-14 15:00 Asia/Shanghai · 候选只表示当时可知的计划", 13, MUTED)
    for label, xx in [("候选标的 / 原因", x + 24), ("目标仓位", x + 430), ("实际持仓（T0）", x + 620), ("数据截止", x + 818)]:
        s += t(xx, 295, label, 12, MUTED)
    candidates = [
        ("合成股票 A", "市值与 EMA20 条件同时满足", "45.0%", "0.0%", "2024-06-14"),
        ("合成股票 B", "成交额与突破回踩条件满足", "45.0%", "0.0%", "2024-06-14"),
        ("现金", "起点无成交，保留现金", "10.0%", "100.0%", "T0"),
    ]
    for i, (name, reason, target, actual, cutoff) in enumerate(candidates):
        yy = 326 + i * 40
        s += rect(x + 16, yy - 20, w - 32, 36, "#13202E", "none", 4)
        s += t(x + 30, yy + 2, name, 13, TEXT, 500) + t(x + 138, yy + 2, reason, 12, MUTED)
        s += t(x + 430, yy + 2, target, 13, CYAN if i < 2 else TEXT, 600, "start", "num")
        s += t(x + 620, yy + 2, actual, 13, TEXT, 600, "start", "num")
        s += t(x + 818, yy + 2, cutoff, 13, MUTED, 500)
    s += pill(x + 1020, 406, "实际：0 持仓 · 100% 现金", WARN, 196, "#332918")
    s += t(x, 520, "第 4 步 · 确认创建", 18, TEXT, 600)
    s += section(x, 548, 590, 350, "完整策略与锁定版本", "确认后生成不可变运行快照 · 两组各自锁定三包", RAISED)
    s += t(x + 24, 636, "A · EMA20 趋势质量 · v1.4", 14, TEXT, 600)
    a_versions = [("筛选", "v2.0", CYAN), ("买入", "v1.3", BLUE), ("止盈止损", "v1.1", ORANGE)]
    for i, (label, value, col) in enumerate(a_versions):
        yy = 662 + i * 26
        s += t(x + 40, yy, label, 12, MUTED) + t(x + 554, yy, value, 13, col, 600, "end")
    s += t(x + 24, 758, "B · 低波动质量 · v2.1", 14, TEXT, 600)
    b_versions = [("筛选", "v1.8", CYAN), ("买入", "v1.6", BLUE), ("止盈止损", "v1.2", ORANGE)]
    for i, (label, value, col) in enumerate(b_versions):
        yy = 784 + i * 26
        s += t(x + 40, yy, label, 12, MUTED) + t(x + 554, yy, value, 13, col, 600, "end")
    s += section(x + 610, 548, 630, 350, "时间、资金与执行假设", "以下均为虚构设计假设，需在确认前可查", RAISED)
    facts = [
        ("起点 / 时区", "2024-06-14 15:00 · Asia/Shanghai"),
        ("期限 / 实际", "3个月 · 名义 9/14 · 实际 9/13"),
        ("独立资金", "策略 A ¥100,000 · 策略 B ¥100,000"),
        ("费率假设", "买入/卖出 0.03% · 最低费用 ¥5"),
        ("滑点假设", "每次成交 0.10% · 非现实建议"),
    ]
    for i, (label, value) in enumerate(facts):
        yy = 630 + i * 39
        s += t(x + 634, yy, label, 12, MUTED) + t(x + 1214, yy, value, 13, TEXT, 500, "end")
    s += button(x + 1064, 836, "确认创建", 148, True)
    s += t(x, 930, "确认失败时回到第 4 步并保留全部输入；成功后进入待开始工作台，不自动推进行情。", 13, MUTED)
    return footer(s)


def make_states():
    s = chrome("异常与恢复", "业务异常保留上下文，显示具体原因和可理解的下一步；未知数据不会写成 0")
    x, w = 100, 1240
    states = [
        ("加载中", "正在准备起点数据…", "保留原页面位置", BLUE),
        ("无匹配", "筛选条件没有找到包", "清除筛选", WARN),
        ("无候选", "本日没有满足条件的标的", "查看筛选原因", WARN),
        ("覆盖不足", "缺少 2024-06—09 行情", "返回修改起点", WARN),
        ("运行失败", "执行在 2024-07-19 停止", "查看失败原因", RED),
        ("数据落后", "行情更新至 2024-09-12", "等待更新", WARN),
        ("版本冲突", "来源版本已有新草稿", "重新载入", PURPLE),
        ("确认失败", "实验未创建，输入仍保留", "再次确认", RED),
    ]
    for i, (title, desc, action, col) in enumerate(states):
        xx, yy = x + (i % 4) * 310, 154 + (i // 4) * 250
        s += rect(xx, yy, 286, 206, PANEL, LINE, 8) + pill(xx + 18, yy + 18, title, col, 82, "#172536")
        s += t(xx + 18, yy + 72, desc, 14, TEXT, 500) + t(xx + 18, yy + 103, "保留已输入字段；给出恢复方向。", 12, MUTED)
        s += line(xx + 18, yy + 124, xx + 268, yy + 124, LINE)
        s += t(xx + 18, yy + 158, "下一步", 12, WEAK) + button(xx + 18, yy + 166, action, 126, title in ("加载中", "版本冲突"))
    return footer(s)


def control_box(x, y, label, note, state, fill=PANEL, stroke=LINE, text_color=TEXT):
    s = rect(x, y, 188, 98, fill, stroke, 8)
    s += t(x + 14, y + 21, label, 12, MUTED) + t(x + 14, y + 49, state, 14, text_color, 600)
    s += t(x + 14, y + 78, note, 11, WEAK)
    return s


def make_components():
    s = chrome("组件契约", "真实共享控件八态：默认、悬停、聚焦、按下、禁用、加载中，以及容器空/错误", 1440, 1000)
    x, w = 100, 1240
    s += t(x, 154, "共享控件状态", 18, TEXT, 600) + t(x + 160, 154, "按钮/输入使用同一 token；空态属于容器，不伪造为按钮状态", 12, MUTED)
    s += t(x, 188, "按钮 · 36px 高 · 6px 圆角 · 14px 正文", 13, MUTED)
    states = [
        ("默认", "保存新版本", "RAISED", RAISED, LINE, TEXT),
        ("悬停", "保存新版本", "hover", "#34445A", FOCUS, TEXT),
        ("聚焦", "保存新版本", "外框 2px", RAISED, FOCUS, TEXT),
        ("按下", "保存新版本", "pressed", "#1C2B3D", BLUE, TEXT),
        ("禁用", "保存新版本", "不可用原因可查", "#151E2B", "#202B3A", WEAK),
        ("加载中", "保存中…", "防重复提交", BLUE, FOCUS, "#0B1019"),
    ]
    for i, (label, value, note, fill, stroke, col) in enumerate(states):
        xx = x + (i % 3) * 214
        yy = 210 + (i // 3) * 112
        s += rect(xx, yy, 188, 98, PANEL, LINE, 8) + t(xx + 14, yy + 21, label, 12, MUTED)
        s += rect(xx + 14, yy + 38, 160, 36, fill, stroke, 6, 2 if label == "聚焦" else 1)
        s += t(xx + 94, yy + 62, value, 14, col, 600, "middle") + t(xx + 14, yy + 88, note, 11, WEAK)
    s += t(x + 650, 188, "输入 · 36px 高 · 外部 label · 2px focus ring", 13, MUTED)
    s += t(x + 650, 210, "默认", 12, MUTED) + rect(x + 650, 220, 260, 36, PANEL, LINE, 6) + t(x + 662, 244, "EMA20、质量", 14, TEXT)
    s += t(x + 650, 280, "聚焦", 12, MUTED) + rect(x + 650, 290, 260, 36, PANEL, FOCUS, 6, 2) + t(x + 662, 314, "2024-06-14", 14, TEXT)
    s += t(x + 650, 350, "错误", 12, RED) + rect(x + 650, 360, 260, 36, PANEL, RED, 6) + t(x + 662, 384, "起点早于数据覆盖", 14, TEXT)
    s += t(x + 650, 410, "label 与输入分行；输入为实际 36px，不把复合框高度误称输入高度。", 11, WEAK)
    s += t(x, 466, "容器态 · 按钮没有 empty 状态", 18, TEXT, 600)
    s += control_box(x, 492, "空容器", "暂无策略包", "清除筛选或新建策略", PANEL, LINE, MUTED)
    s += control_box(x + 214, 492, "错误容器", "读取失败", "保留查询 · 重试", PANEL, RED, TEXT)
    s += control_box(x + 428, 492, "成功容器", "已保存", "版本 v1.4", PANEL, BLUE, TEXT)
    s += rect(x + 650, 492, 590, 98, RAISED, LINE, 8) + t(x + 668, 516, "状态语义", 12, MUTED)
    s += t(x + 668, 546, "业务异常（无候选、覆盖不足、确认失败）见 10-states.svg。", 13, TEXT, 500)
    s += t(x + 668, 572, "这里展示的是共享控件/容器视觉契约，不把业务异常冒充八态。", 12, MUTED)
    s += t(x, 646, "通用尺寸 token", 18, TEXT, 600)
    metrics = [("标题", "24px"), ("区块", "18px"), ("正文", "14px"), ("辅助", "12px"), ("指标", "28px"), ("按钮", "36px"), ("chip", "24px / r6"), ("命中区", "36px（触屏另按规格）")]
    for i, (name, value) in enumerate(metrics):
        xx = x + (i % 4) * 300
        yy = 688 + (i // 4) * 66
        s += t(xx, yy, name, 12, MUTED) + t(xx + 272, yy, value, 14, TEXT, 600, "end") + line(xx, yy + 14, xx + 272, yy + 14, LINE)
    return footer(s)


OVERRIDES = {
    "01-library.svg": make_library,
    "01b-package-management.svg": make_package_management,
    "02-compose.svg": make_compose,
    "03-experiments.svg": make_experiments,
    "04-create.svg": make_create,
    "04b-select-strategies.svg": make_select,
    "05-confirm.svg": make_confirm,
    "10-states.svg": make_states,
    "12-components.svg": make_components,
}


def build_all():
    for filename, builder in OVERRIDES.items():
        (OUT / filename).write_text(builder(), encoding="utf-8")
    return list(OVERRIDES)


if __name__ == "__main__":
    names = build_all()
    print(f"wrote {len(names)} library/form SVG boards to {OUT}")
