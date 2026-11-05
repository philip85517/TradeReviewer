#!/usr/bin/env python3
"""Rebuild the browsable SW01–SW08 sample boards from shared primitives."""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

ROOT = Path(__file__).parents[2] / "baselines/2026-10-24-strategy-workbench-v1.2/source"
spec = spec_from_file_location("shared", ROOT / "shared-primitives.py")
shared = module_from_spec(spec); spec.loader.exec_module(shared)
OUT = Path(__file__).parent
BG, PANEL, RAISED, LINE = shared.BG, shared.PANEL, shared.RAISED, shared.BORDER
PRESSED = shared.PRESSED
TEXT, MUTED, WEAK, ACTION, FOCUS = shared.TEXT, shared.MUTED, shared.WEAK, shared.ACTION, shared.FOCUS
DISABLED = shared.DISABLED
RED, GREEN, WARN = "#FF8592", "#53D7A0", "#FFC66D"

def text(x, y, s, size=14, fill=TEXT, weight=500, anchor="start"):
    size=14 if size==13 else size
    esc = str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" style="font: {weight} {size}px -apple-system,BlinkMacSystemFont,\'PingFang SC\',sans-serif;fill:{fill}">{esc}</text>'
def rect(x,y,w,h,fill=PANEL,stroke=LINE,r=8,sw=1): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
def line(x1,y1,x2,y2,stroke=LINE): return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}"/>'
def check(x,y,checked=False,disabled=False):
    fill = shared.DISABLED_BORDER if disabled else (ACTION if checked else "none")
    stroke = shared.DISABLED if disabled else (ACTION if checked else MUTED)
    mark = f'<path d="M3 8l3 3 6-7" transform="translate({x} {y})" stroke="#0B1019" fill="none" stroke-width="1.6"/>' if checked else ''
    return f'<rect x="{x}" y="{y}" width="16" height="16" rx="3" fill="{fill}" stroke="{stroke}"/>{mark}'
def shell(title, width=920, height=560):
    return [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}"><rect width="{width}" height="{height}" fill="{BG}"/>', text(28,34,title,20,TEXT,600)]
def finish(parts): return ''.join(parts) + '</svg>'

def sw01():
    p=shell("",920,500)
    p += [shared.nav_rail(420), '<g transform="translate(80 0)">',shared.nav_rail(420,True),'</g>']
    p += [text(320,36,"SW01 · 同源导航与策略台布局",20,TEXT,600),text(320,80,"折叠 54 / 展开 200 / 顶栏 48",14,MUTED)]
    for i,(label,fill,stroke,sw) in enumerate([("默认",PANEL,LINE,1),("悬停",shared.HOVER,LINE,1),("当前",RAISED,ACTION,1),("键盘焦点",PANEL,FOCUS,2)]):
        x=320+i*138;p += [text(x,140,label,12,MUTED),rect(x,160,108,36,fill,stroke,6,sw),shared.icon(x+12,170,"strategy",16,ACTION if i==2 else TEXT),text(x+38,183,"策略台",14)]
    p += [text(320,248,"五个全局入口沿用首页图标，",14),text(320,276,"选中项通过背景、边框与名称共同识别。",14),text(320,320,"底部固定设置和展开 / 收起入口。",14,MUTED),text(28,470,"策略台保留紧凑布局；全局入口、基础色与交互状态不另设一套。",14,MUTED)]
    return finish(p)


def sw02():
    p=shell("SW02 · 日期、时区与只读截止",920,560)
    p += [text(28,82,"起点日期 · 焦点 / 日历展开",12,MUTED),shared.select_control(28,98,"2024-06-14",260,"calendar"),rect(25,95,266,42,"none",FOCUS,8,2),rect(28,144,300,324,RAISED),text(48,176,"2024 年 6 月",16,TEXT,600),shared.icon(260,160,"chevron-left"),shared.icon(290,160,"chevron-right")]
    for i,d in enumerate(["一","二","三","四","五","六","日"]):p.append(text(52+i*40,208,d,12,MUTED))
    for row in range(5):
        for col in range(7):
            day=row*7+col-4
            if day<1 or day>30:continue
            x=52+col*40;y=246+row*40
            if day==14:p.append(rect(x-9,y-23,32,32,ACTION,ACTION,6))
            p.append(text(x+7,y,day,14,BG if day==14 else (DISABLED if day>14 else TEXT),500,"middle"))
    p += [text(368,82,"起点时间",12,MUTED),shared.select_control(368,98,"15:00 · 收盘后",220),text(620,82,"业务时区",12,MUTED),shared.select_control(620,98,"Asia/Shanghai",260),text(368,184,"系统计算 · 无选择入口",12,MUTED)]
    for i,(lab,val) in enumerate([("名义结束","2024-09-14"),("最后完整交易日","2024-09-13")]):
        y=216+i*48;p += [text(368,y,lab,14,MUTED),text(880,y,val,14,TEXT,600,"end")]
    p += [text(368,330,"覆盖不足 · 错误保留输入",12,RED),rect(368,346,300,36,PANEL,RED,6),text(380,369,"2017-12-31 15:00",14),text(368,408,"可用数据从 2018-01-01 开始，请重新选择起点。",14,RED),text(28,520,"正常日历示例选择 2024-06-14；错误示例单独保留更早输入，边界与 2018-01-01 一致。",14,MUTED)]
    return finish(p)


def sw03():
    p=shell("SW03 · 四步向导与提交状态",920,570)
    for i,(label,state) in enumerate([("设置起点","已完成"),("选择策略","已完成"),("预览组合","当前"),("确认创建","未到达")]):
        x=28+i*222;p += [rect(x,82,204,72,RAISED if i==2 else PANEL,ACTION if i==2 else LINE),text(x+16,111,str(i+1)+"  "+label,14,TEXT if i<3 else DISABLED,600),text(x+16,136,state,12,ACTION if i==2 else MUTED)]
    p += [shared.button(28,182,"上一步",100),shared.button(146,182,"下一步：确认",140,True),text(28,254,"第 4 步独立提交状态",16,TEXT,600),shared.button(28,274,"确认创建",128,True),shared.button(180,274,"创建中…",128,False,True),text(28,340,"只有第 4 步提交；创建期间禁止重复提交。",14,MUTED),text(28,380,"已完成步骤可返回。",14,MUTED),text(28,408,"尚未到达步骤不开放跳转。",14,MUTED)]
    p += [rect(520,182,364,280,RAISED,ACTION),text(544,216,"离开未保存草稿",18,TEXT,600),text(544,250,"当前输入尚未保存，要怎样处理？",14,TEXT),text(544,280,"策略包：EMA20 买入 · 起点：2024-06-14",12,MUTED),shared.button(544,318,"保留草稿并离开",148,True),shared.button(544,366,"放弃草稿",120),shared.button(672,366,"继续编辑",120),text(544,430,"默认焦点：继续编辑；取消离开不提交。",12,MUTED)]
    return finish(p)


def sw04():
    p=shell("SW04 · 选择策略包、精确版本与参数",920,672)
    for i,(title,value,state) in enumerate([("标的筛选","选择策略包","空槽"),("买入信号","EMA20 买入","已选择 · 可编辑草稿"),("止盈止损","移动止盈","实验版本已锁定")]):
        x=28+i*292
        p += [rect(x,72,280,392),text(x+16,104,title,16,TEXT,600),text(x+16,130,state,12,MUTED),shared.select_control(x+16,148,value,248,disabled=i==2),text(x+16,208,"精确版本",12,MUTED),shared.select_control(x+16,220,"v1.3" if i==1 else ("v1.1" if i==2 else "选择后可用"),248,disabled=i!=1),text(x+16,286,"周期参数",12,MUTED)]
        if i==2:
            p += [text(x+16,322,"14 日 · 锁定参数",14,TEXT),text(x+16,362,"只读；修改需派生新实验。",12,MUTED)]
        else:
            p += [rect(x+16,298,112,36,PANEL,LINE if i else shared.DISABLED_BORDER,6),text(x+28,322,"20" if i else "—",14,TEXT if i else DISABLED),shared.select_control(x+140,298,"日",124,disabled=i==0),check(x+16,352,i==1,i==0),text(x+40,365,"覆盖预设",14,TEXT if i else DISABLED),shared.button(x+152,342,"恢复预设",112,False,i==0)]
        p += [shared.button(x+16,404,"查看详情",112,False,i==0),shared.button(x+144,404,"更换包" if i else "选择包",112,False,i==2)]
    p += [rect(28,488,864,146,PANEL,RED),text(48,520,"不兼容：当前市场无法满足所选包的数据要求",16,RED,600),text(48,552,"草稿保留包与版本，更换后重新校验；运行中的锁定版本保持不变。",14,MUTED),shared.button(48,574,"更换包",112),shared.button(176,574,"查看数据要求",140)]
    return finish(p)


def sw05():
    p=shell("SW05 · 两行多选、详情与排序",920,470)
    p += [text(28,68,"两行业务密度例外；选择、详情、排序动作各自独立。",12,MUTED),rect(28,84,560,250,PANEL)]
    for i,(name,meta,checked,disabled,removable) in enumerate([("EMA20 v1.4","候选 14 · 2024 Q3",True,False,True),("低波动质量 v2.1","数据覆盖不足 · 禁用",False,True,False),("趋势突破 v0.9","候选 8 · 可选",False,False,False)]):
        y=100+i*72; p += [line(44,y+72,570,y+72),check(46,y+12,checked,disabled),text(76,y+27,name,14,TEXT if not disabled else WEAK,600),text(76,y+50,meta,12,MUTED if not disabled else DISABLED),shared.button(390,y+18,"详情",64),shared.button(462,y+18,"移除",64,False,not removable)]
    p += [rect(616,84,256,326,PANEL),text(636,114,"排序草稿",16,TEXT,600),shared.button(636,132,"上移",80),shared.button(724,132,"下移",80),shared.select_control(636,184,"位置 2 / 3",168,"select"),text(636,240,"同组位置 2 / 3 · 上下均可",12,MUTED),text(636,272,"保存失败 · 草稿保留",12,RED),shared.button(636,290,"重试保存",100,True),text(636,336,"未选行的移除入口不可用。",12,MUTED),text(636,360,"先勾选，再移除。",12,MUTED)]
    return finish(p)
def sw06():
    p=shell("SW06 · 连续摘要、包详情与观察检查栏",920,490)
    p += [rect(28,66,864,88)]
    for i,(label,value,col) in enumerate([("净资产","¥10.25万",TEXT),("累计收益","+2.54%",GREEN),("最大回撤","-3.20%",RED),("仓位","90.0%",TEXT)]):
        x=28+i*216;p += [text(x+16,94,label,14,MUTED),text(x+200,134,value,28,col,600,"end")]
    p += [rect(28,186,480,252),text(48,216,"包详情",18,TEXT,600),text(488,216,"480px",12,MUTED,500,"end"),text(48,250,"EMA20 买入 · v1.3",14),text(48,280,"用途：趋势买入；输入：收盘价，输出：买入信号。",14,MUTED),text(48,316,"参数 / 单位",14,MUTED),text(488,316,"周期 20 日",14,TEXT,600,"end"),text(48,350,"预热要求",14,MUTED),text(488,350,"至少 20 个交易日",14,TEXT,600,"end"),shared.button(48,378,"关闭",88)]
    p += [rect(532,186,320,252),text(552,216,"观察检查栏",18,TEXT,600),text(832,216,"320px",12,MUTED,500,"end")]
    for i,(label,value) in enumerate([("查看日","2024-09-13"),("未知数据","—"),("费用","¥128.40")]):
        y=260+i*48;p += [text(552,y,label,14,MUTED),text(832,y,value,14,TEXT,600,"end")]
    p += [text(28,474,"88px 摘要表达当日状态；详情与检查栏分别承接规则阅读和运行证据。",14,MUTED)]
    return finish(p)


def sw07():
    p=shell("SW07 · 回放状态与动作",920,510)
    states=[("暂停 · 可继续",[('播放',True,False),('下一交易日',False,False)],"下一步揭示新 K 线与成交。"),("播放中",[('暂停',True,False),('下一交易日',False,True)],"自动推进期间不重复发起单步。"),("回看历史",[('返回最新',True,False),('播放',False,True)],"当前 6/14 · 已看后续至 6/28。"),("运行完成",[('播放',False,True),('下一交易日',False,True)],"可选择历史日期；结果截止不变。")]
    for i,(title,buttons,note) in enumerate(states):
        x=28+i%2*444;y=72+i//2*198;p += [rect(x,y,420,174),text(x+18,y+32,title,16,TEXT,600)]
        for j,(label,pri,dis) in enumerate(buttons):p.append(shared.button(x+18+j*154,y+54,label,140,pri,dis))
        p.append(text(x+18,y+130,note,14,MUTED))
    return finish(p)


def sw08():
    p=shell("SW08 · 局部查询与恢复 / loading + empty + error + conflict",920,520)
    p += [text(28,58,"当前查询",12,MUTED),rect(28,68,620,36,PANEL,FOCUS,6,1),text(42,92,"EMA20 / 沪深300 / 2024 Q3",14),shared.button(662,68,"清除当前筛选",150)]
    cards=[("初始加载","加载中 · 保留滚动位置",ACTION),("无匹配","清除当前筛选",WARN),("请求失败","局部重试",RED),("版本冲突","另存副本",WARN)]
    for i,(title,action,color) in enumerate(cards):
        x=28+(i%2)*430;y=122+(i//2)*160;p += [rect(x,y,400,132,PANEL,color),text(x+18,y+28,title,16,TEXT,600),text(x+18,y+54,"原查询：EMA20 / 沪深300",12,MUTED)]
        if title == "无匹配": p += [text(x+18,y+88,"没有匹配结果；请调整查询或使用上方清除。",12,WARN)]
        elif title == "请求失败": p += [shared.button(x+18,y+88,action,126,True)]
        elif title == "版本冲突": p += [shared.button(x+18,y+88,action,160,True),text(x+190,y+112,"新版本保留本地编辑",12,WARN)]
        else: p += [text(x+18,y+88,"请求进行中…",13,ACTION)]
    return finish(p)

BUILDERS={"sw01-navigation.svg":sw01,"sw02-date-time.svg":sw02,"sw03-steps.svg":sw03,"sw04-package-slots.svg":sw04,"sw05-multi-select.svg":sw05,"sw06-summary-detail.svg":sw06,"sw07-replay.svg":sw07,"sw08-recovery.svg":sw08}
if __name__ == "__main__":
    for filename,builder in BUILDERS.items(): (OUT/filename).write_text(builder(),encoding="utf-8")
    print(f"wrote {len(BUILDERS)} shared samples")
