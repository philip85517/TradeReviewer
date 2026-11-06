from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from copy import deepcopy
import hashlib
import json
from lxml import etree as E

ROOT = Path(__file__).resolve().parent
REF = Path('/Users/zhoulin/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-design-report/assets/reference.docx')
OUT = ROOT / '策略工作台设计评审.docx'
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}
def q(n): return '{'+W+'}'+n

with ZipFile(REF) as z:
    parts = {n:z.read(n) for n in z.namelist()}
doc = E.fromstring(parts['word/document.xml'])
body = doc.find('w:body',NS)
slots = list(body)

def cjk_font(para):
    for r in para.xpath('.//w:r',namespaces=NS):
        if not r.xpath('./w:t',namespaces=NS): continue
        rp = r.find('w:rPr',NS)
        if rp is None:
            rp=E.Element(q('rPr')); r.insert(0,rp)
        fonts=rp.find('w:rFonts',NS)
        if fonts is None:
            fonts=E.Element(q('rFonts'));rp.insert(0,fonts)
        fonts.set(q('eastAsia'),'Heiti SC')

def set_text(para, text):
    ts=para.xpath('.//w:t',namespaces=NS)
    assert ts
    ts[0].text=text
    for t in ts[1:]: t.text=''
    cjk_font(para)

def set_pair(para, lead, body_text):
    runs=[r for r in para.findall('w:r',NS) if r.find('w:t',NS) is not None]
    assert len(runs)==2
    for r,txt in zip(runs,[lead,body_text]):
        ts=r.findall('w:t',NS);ts[0].text=txt
        for t in ts[1:]:t.text=''
    cjk_font(para)

texts={
2:'策略工作台设计评审',
5:'目录',
10:'评审摘要',
11:'建议保留当前深色主题、四步创建和固定主图加右侧详情的设计方向，优先改善动作可见性与时间状态层级。当前画面已经把策略定义、实验创建和运行观察分开；进一步迭代应让用户更快判断“我正在看什么、当前能做什么、这是否已经成交”。',
12:'本次审阅覆盖策略库、我的实验、四步创建与 A 版图表工作台。浏览器抽查采用 1440×900 和 1280×800 桌面视口，并直接比对批准规格、参考图及当前截图。以下影响判断属于设计推断，未经过用户研究量化。',
15:'优先处理',
16:'P1 让下一步动作始终可发现，清晰区分查看日、运行进度与结果截止。',
17:'P1 将预览、合成示例与实际预检结果分层，明确只读模式和事件返回语义。',
18:'P2 去除卡片重复信息，补强多组合身份、完整名称和详情滚动提示。',
21:'范围与设计约束',
22:'策略库保留 200px 导航、48px 身份区、40px 业务页签、深蓝单列卡片、三类包和四步创建。A 工作台保留固定主图、320px 右侧详情、44px 回放条，以及观察、结果、对比三种模式。未发现需要整体更换主题或几何布局的证据。',
23:'F18 的回撤策略样例与 A 工作台的动量样例是两套独立原型。本次同时评估视觉衔接，但不将跨页面跳转、保存、刷新重开或真实执行视为已实现。卡片重排、删除必需字段、调整固定尺寸和改变阶段行为应另行确认设计。',
26:'主要发现',
27:'主要阅读成本来自相近的文字层级和分散的状态提示。颜色和间距可以局部优化，但应先明确每个字段与动作的语义。',
28:'已确认的优势',
29:'策略库默认展示完整策略，三类包与版本能够追溯。四步创建明确“详情不自动选择”“信号不等于成交”“确认后待开始”。A 版主图和右栏边界稳定，结果与对比仍保留回放控件槽位。这些结构值得保留。',
30:'需要改善的阅读顺序',
31:'F15 在 1440×900 首屏中，研究期限仍位于下方，“下一步”需要继续滚动。F14 的状态徽标与下方状态字段重复，部分卡片同时列出研究起点和包含同一起点的区间。F17 的候选、信号与目标分配虽已说明边界，“尚未成交”仍埋在右侧表格中。',
37:'状态层级的影响',
38:'工作台把查看日、已运行至和结果截止分散在上下多处，日期采用相近的灰色短语。结果与对比的禁用原因位于回放条底部，事件详情的关闭与返回来源位于面板两端。用户可能需要反复扫读才能判断图表范围和下一步动作；这是阅读风险推断，不代表已经观察到误操作。',
42:'修改建议',
43:'先处理 P1，再复核 P2 压力状态。以下列出位置和验收目标；真实业务验证使用隔离数据库。',
49:'迭代顺序',
50:'先验证完整旅程：我的实验 → 四步创建 → 待开始 → 推进一日 → 结果 → 事件 → 关闭并停在事件日 → 返回来源。沿途保持同一实验、策略与包版本、范围和本金；确认不会自动推进。',
51:'随后处理密度与次级元数据。功能、状态安全、同状态同视口视觉比对须分别通过。导航与样式融合按批准规格推进，两套不同样例的跳转不能代替完整衔接。',
54:'附录',
57:'证据与验证边界',
58:'2026 年 10 月 6 日在当前任务分支做只读评审。协调者在 3062 浏览器直接查看 F14–F18，并保存五张 1440×900 与三张 1280×800 证据；其中小视口 F15 为返回后的滚动位置。委派审阅另在 3051 抽查 T0 推进、结果与对比，CSS 视口为上述两档，DPR 1、缩放 1。',
59:'3051 单步推进后可见净值新点是代表状态的抽查证据。报告引用的 workbench-evidence 图像是 style-04-evidence 的历史匹配状态副本。当前 resume06 使用 final-visual-comparison 组；未将 before 或 failed 图片视为最终视觉证据。真实保存、锁定、防重复提交、刷新重开及完整事件返回仍未验证。',
62:'依据与证据位置',
63:'批准依据：docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md，以及 strategy-library-wireframes/STYLE-06-CONTRACT.md、strategy-library-model-review.md 和 workbench-design/README.md 所链接的 SW、WB、WD 规格。',
64:'视觉参考：references/2026-09-30-round2-workbench-feedback.png 与 round1 TradingView 参考；当前 resume06/screenshots 的 F01、F10、F12、F14–F18 最终图；workbench-design/style-04-evidence 的对应状态图。',
65:'本次材料位于 .scratch/strategy-portfolio-backtesting/design-report-2026-10-06/，含 ui-evidence、flow-review.md、workbench-review.md 和 workbench-evidence。docs/specs 从仓库根目录解析；其余依据路径从 .scratch/strategy-portfolio-backtesting/ 解析。',
66:'检查范围：桌面 1440×900 与 1280×800；只读视觉和代表模式抽查。未做用户研究、移动端、物理触控、IME 或生产执行验收；这些事项不据此判定通过。',
}
for i,t in texts.items(): set_text(slots[i],t)

# Keep the original table's blank center spacer and cell layout.
cover_cells=slots[3].xpath('./w:tr/w:tc',namespaces=NS)
set_text(cover_cells[0].find('w:p',NS),'策略库与实验工作台\n视觉层级和操作路径建议')
cover_ps=cover_cells[2].findall('w:p',NS)
set_text(cover_ps[0],'评审人 Codex')
set_text(cover_ps[1],'2026年10月6日')
# Use w:br for the subtitle, retaining its existing run and paragraph formatting.
st=cover_cells[0].xpath('.//w:t',namespaces=NS)[0]
a,b=st.text.split('\n');st.text=a
run=st.getparent();E.SubElement(run,q('br'));E.SubElement(run,q('t')).text=b

set_pair(slots[33],'预检状态需要分层。','F18 同时显示“检查通过（示例）”和“交易日历未校验”。建议分列真实必检项、合成说明和待接入能力；示例通过不能给出真实运行已可确认的印象。')
set_pair(slots[68],'本次交付范围。','这是设计咨询报告，未修改原型、原始交易数据或任务验收状态，也未提交、推送或合并。建议中的验证条件用于后续实施验收，不是本次通过记录。')

table_rows=[
['主题','观察','建议方向'],
['动作可见性','下一步在首屏之外；只读原因偏远','靠近当前任务展示主动作与原因'],
['时间与交易语义','日期层级接近；目标与成交同栏','稳定标签分组，强调尚未成交'],
['信息密度','状态和区间重复；长名与明细需发现','去重并保留完整信息的访问入口'],
]
for row,vals in zip(slots[39].findall('w:tr',NS),table_rows):
    for cell,val in zip(row.findall('w:tc',NS),vals):set_text(cell.find('w:p',NS),val)

recs=[
('R01  P1 突出时间状态。','用固定标签区分“当前查看日”“已运行至”“结果截止”，适度强调查看日。对应 WD04 / IF08。回看、结果、事件态三者可独立辨认，固定行高不变。'),
('R02  P1 保持主动作可见。','F15–F18 在固定区或摘要内提供同一主动作，避免遮挡字段。保留按钮尺寸和四步结构。两档桌面及长文案下可发现、键盘可达，返回保留草稿。'),
('R03  P1 分开预览与预检。','F17 提升“尚未成交”状态，按候选、信号、成交检查组织标题；F18 分列必检项、示例与未校验项。对应 LIB09。验收数据不足或版本变化时保留输入并说明阻断原因。'),
('R04  P1 靠近控件说明只读。','禁用控件旁显示“只读，返回观察后推进”，保留回放槽位及 44px 高度。对应 WD03 / WD04。结果、对比态无需悬停可读原因，键盘可访问说明。'),
('R05  P1 区分事件的两个返回动作。','保留“关闭详情，停在事件日”和“返回阶段结果／组合对比”，按实际来源命名并解释恢复范围。对应 WD04 / WD06。验收关闭后仍停事件日，返回来源才恢复来源上下文。'),
('R06  P2 精简实验卡片。','F14 保留状态徽标，合并重复的状态、起点与区间信息；每种状态突出一个主动作，失败原因保留。先做局部文案去重；压缩卡片高度或重排布局需另行确认。'),
('R07  P2 强化组合身份。','F16 在计数旁说明“每选一个完整策略，生成一个独立组合”，区分策略定义和组合预设。对应 LIB09 / IF02。验收两策略选择与取消、详情返回及 F17–F18 的版本身份一致。'),
('R08  P2 保留完整信息入口。','长实验名支持悬停与焦点查看全名，右栏补充滚动连续性提示；F10/F12 先强调包版本、状态和统计口径。对应 WD02 / WB06 / LIB07。验收压力状态完整可读，主图边界不变。'),
]
for i,(lead,txt) in enumerate(recs[:3]):set_pair(slots[44+i],lead,txt)
anchor=slots[46]
for lead,txt in recs[3:]:
    item=deepcopy(slots[44]);set_pair(item,lead,txt);anchor.addnext(item);anchor=item

# Retain cached TOC navigation and field structure; update only display text/tab position.
titles=['评审摘要','优先处理','范围与设计约束','主要发现','已确认的优势','需要改善的阅读顺序','状态层级的影响','修改建议','迭代顺序','附录','证据与验证边界','依据与证据位置']
page_nums=['2']*3+['3']*4+['4']*2+['5']*3
for p,title,num in zip(slots[7].xpath('.//w:p',namespaces=NS),titles,page_nums):
    ts=p.xpath('.//w:t',namespaces=NS);assert len(ts)==2
    ts[0].text=title;ts[1].text=num;cjk_font(p)
    for tab in p.xpath('./w:pPr/w:tabs/w:tab',namespaces=NS):tab.set(q('pos'),'9360')

header=E.fromstring(parts['word/header1.xml'])
hts=header.xpath('.//w:t',namespaces=NS)
hts[0].text='策略工作台设计评审';hts[1].text='2026年10月6日'
for p in header.xpath('.//w:p',namespaces=NS):cjk_font(p)
settings=E.fromstring(parts['word/settings.xml'])
uf=settings.find('w:updateFields',NS)
if uf is None:uf=E.SubElement(settings,q('updateFields'))
uf.set(q('val'),'true')
def xml(x):return E.tostring(x,xml_declaration=True,encoding='UTF-8',standalone=True)
parts['word/document.xml']=xml(doc)
parts['word/header1.xml']=xml(header)
parts['word/settings.xml']=xml(settings)
with ZipFile(OUT,'w',ZIP_DEFLATED) as z:
    for n,data in parts.items():z.writestr(n,data)
with ZipFile(REF) as a, ZipFile(OUT) as b:
    changed=[n for n in a.namelist() if a.read(n)!=b.read(n)]
    assert set(changed)=={'word/document.xml','word/header1.xml','word/settings.xml'},changed
    assert a.namelist()==b.namelist()
(ROOT/'package-audit.json').write_text(json.dumps({'reference_sha256':hashlib.sha256(REF.read_bytes()).hexdigest(),'output_sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'changed_parts':changed,'preserved_parts':[n for n in parts if n not in changed]},indent=2),encoding='utf-8')
print(OUT)
