from pathlib import Path
import json

d = Path(__file__).resolve().parent
r = d.parents[1]
e = d / 'evidence/revision-10-final-decisions'
p = json.loads((e / 'review-package.json').read_text())
assert '当前静态设计交付：PASS' in (e / 'INDEPENDENT-ACCEPTANCE.md').read_text()
current = f'''## 当前：用户决策已落地，独立验收 PASS

用户确认采用 B 紧凑布局和“最差练习回撤”。正文、共享图稿及原型已同步；06/07/08 任务关闭。每个练习独立计算权益最大回撤后取最大值，全部有效才显示数值，部分覆盖、无练习及真零分别定义；当前样例缺权益路径，继续明确显示“—”，不虚构百分比。

final_design_impl 与 final_prototype_impl 实施，root 完成集成及真实浏览器操作，未参与实现的 revision10_acceptance 独立逐图复核和测试。37/37 变动图视觉通过，指标5项和首页5项测试通过，58/58文件哈希匹配；147资源链接、10原评论及历史图保真通过。所有失败与修复过程保留。

[最终独立报告](evidence/revision-10-final-decisions/INDEPENDENT-ACCEPTANCE.md) · [root验收](evidence/revision-10-final-decisions/ROOT-ACCEPTANCE.md) · [最终版本](evidence/revision-10-final-decisions/review-package.json)

source `{p['source_fingerprint']}`；content `{p['content_fingerprint']}`。

[设计预览](http://127.0.0.1:3090/design-system/baselines/2026-10-22-trading-library-v1.0/visual-spec.html) · [B布局原型](http://127.0.0.1:3090/design-system/baselines/2026-10-22-trading-library-v1.0/navigation-options.html)。服务3090运行；重启命令：`./docs/design-system/baselines/2026-10-22-trading-library-v1.0/start-preview.sh`。

本次交付为静态设计及演示原型；生产权益计算和业务持久化不在范围，触控未验证。原评论内容、状态和历史未改；未提交、推送或合并。旧采集tab日志来源未确诊，新原型/阅读器tab日志为空，详见验收限制。

## 历史：revision 10 候选阶段

'''
for name in ['README.md', 'FINAL-ACCEPTANCE.md']:
    path = d / name
    s = path.read_text()
    title, rest = s.split('\n', 1)
    rest = rest[rest.index('**当前状态（评论 revision 10）'):]
    rest = rest.replace('**当前状态（评论 revision 10）', '**候选阶段状态（评论 revision 10）', 1)
    rest = rest.replace('当前source `40d4', '候选source `40d4', 1)
    path.write_text(title + '\n\n' + current + rest)

for name in ['06-navigation-hierarchy.md','07-simulation-metrics.md','08-distribution-chart.md']:
    path = d / 'issues' / name
    s = path.read_text().replace('State: open', 'State: closed').replace('Status: in-progress', 'Status: accepted')
    s = s.replace('Assignee: navigation_impl', 'Assignee: final_prototype_impl / final_design_impl').replace('Assignee: design_impl', 'Assignee: final_design_impl')
    s = s.replace('当前候选范围修复与独立验收已通过；最终用户决策及同步仍未完成。', '用户已确认 B 与最差练习回撤，正式同步与独立验收通过。')
    s = s.replace('- [ ]', '- [x]')
    s = s.replace('None；布局选择/指标语义决策在本票内记录，不能把建议当作批准。', 'None；2026-10-24 用户直接确认两项决定。')
    s = s.replace('08最终布局依赖[06导航方案](06-navigation-hierarchy.md)选定；分布口径分析可先行。', 'None；06 已采用 B 并通过最终验收。')
    start=s.index('## 证据与门槛'); end=s.index('## 派发说明')
    s=s[:start]+'''## 证据与门槛
最终PASS：[独立报告](../evidence/revision-10-final-decisions/INDEPENDENT-ACCEPTANCE.md)、[root验收](../evidence/revision-10-final-decisions/ROOT-ACCEPTANCE.md)。用户批准 B 和最差练习回撤；37变动帧、原型及阅读器受影响路径通过。无业务数据库写入，原评论状态保留。此前候选阶段与FAIL记录仍保存。

'''+s[end:]
    path.write_text(s)

base=r/'docs/design-system/baselines/2026-10-22-trading-library-v1.0/README.md'
s=base.read_text();start=s.index('## 当前：revision 10');end=s.index('## 历史：revision 6',start)
old=s[start:end].replace('## 当前：revision 10', '## 历史：revision 10',1)
new='''## 当前：B 布局与最差练习回撤已采用

用户已确认 B 紧凑排列及最差练习回撤。正式正文、共享图稿和原型已同步，独立Agent验收PASS：37张变动图逐帧视觉通过，10项测试通过；原10条评论及历史保持。06/07/08任务关闭。

回撤按每个练习完整权益路径独立计算后取最大值。缺数据继续显示“—”，部分覆盖和空练习分别说明。本轮为静态设计与演示原型，不表示生产业务计算或数据库流程已实现。

[原型](navigation-options.html) · [最终验收](../../../../.scratch/trading-library-v10-comment-diagnosis/FINAL-ACCEPTANCE.md) · [独立报告](../../../../.scratch/trading-library-v10-comment-diagnosis/evidence/revision-10-final-decisions/INDEPENDENT-ACCEPTANCE.md)

'''
base.write_text(s[:start]+new+old+s[end:])

scope=e/'ACCEPTANCE-SCOPE.md'
s=scope.read_text().replace('状态：IMPLEMENTATION IN PROGRESS；功能、视觉、语义和独立验收待完成。','状态：PASS；最终版本、逐元素覆盖及独立证据见 INDEPENDENT-ACCEPTANCE.md 和 ROOT-ACCEPTANCE.md。37张变动验收图（含额外1280返回图），58文件版本包，原40阅读器引用图不变。')
scope.write_text(s)

with (d/'DESIGN-COVERAGE.md').open('a') as f:
    f.write('''\n## 用户决策最终闭环（2026-10-24）

版本与逐帧元素清单：[冻结包](evidence/revision-10-final-decisions/review-package.json)、[独立37帧表](evidence/revision-10-final-decisions/INDEPENDENT-ACCEPTANCE.md)。本节覆盖此前Tasks5/6映射，历史状态不覆盖最终结果。

| 需求 | Owner | 最终结果与证据 |
|---|---|---|
| C07 所有共享模式/标题/条件/tabs | final_design_impl；root整页一致性 | PASS，37帧真实浏览器截图；1440/1280自然字宽，B紧凑布局 |
| C08 风险标签/定义/覆盖及费用 | final_design_impl、final_prototype_impl | PASS，独立公式核算及两宽完整原型；缺失继续— |
| C09 横条/单位/选中/返回 | final_design_impl | PASS，分布帧与金额切换、返回焦点 |
| 原型默认B及受影响控制 | final_prototype_impl | PASS，prototype-operations、keyboard-page-proof |
| 阅读器及评论 | root | PASS，BT02两表、C07/C08/C09整图定位、历史入口；原评论保真 |
| fixture/4首页/BT01 | root、revision10_acceptance | PASS，version-after与独立字节比较 |

业务持久化N/A；触控NOT VERIFIED。功能与视觉证据分开；root操作，独立reviewer直接看图审查。历史FAIL保留。
''')
with (r/'.superpowers/sdd/REVISION-10-PLAN/progress.md').open('a') as f:
    f.write('\nTasks5/6 final accepted: user-approved B and worst-exercise drawdown adopted. Independent revision10_acceptance PASS; root integration PASS. 37 changed frames inspected, 58 hashes match, 10 tests pass. Issues06/07/08 closed. F01–F05 and package omission repaired, historical FAIL evidence preserved. Root performed browser operations; independent reviewer directly inspected screenshots. No production engine/DB work, no comment status mutation, commit/push/merge. Evidence: revision-10-final-decisions/INDEPENDENT-ACCEPTANCE.md.\n')
