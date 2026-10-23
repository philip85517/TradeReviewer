> Final candidate3 status: the preliminary CB-M04-only review below is preserved as history. Root subsequently authorized CB-M05 before motion implementation. CB-M04 and CB-M05 are now implemented; see the later authorization section, REPORT.md and MOTION-TDD.md. Root formal round3 remains pending; actual browser gates remain NV.

# Remaining original state/motion review — candidate 3, before product edits

This source review was reported to root through collaboration before any candidate3 production edit. It does not authorize a broader fix. Formal history stays root FAIL1/3 and FAIL2/3; candidate3 is final bounded color correction.

## Source discrepancy reported, no repair

Original global rules explicitly apply to submodules (visual-design.candidate.md469). Lines507–509 require160ms ease-out overlay opacity/4px movement,120ms hover color change,150ms data replacement fade; line514 requires reduced-motion immediate final state. The original manual IconButton hover and DataTable hover repeat120ms. Current leaf CSS contains hover background declarations but no transition, animation, keyframes or prefers-reduced-motion. TSX renders the detail with `open && createPortal(...)`, and closes by setting selection null, with no local closing phase.

Thus the leaf supplies no local normal-motion implementation for those requirements. This is a static source discrepancy, not an actual measured timing/hover or rendered reduced-motion finding. Generic host CSS was not operated or accepted here; root must decide exact applicability (including ChartTooltip display-only behavior at512) and independently assess the live host. Absence of a reduced-motion rule by itself is not a reduced-motion failure because this leaf currently has no normal animation to suppress. No new finding ID/severity or approval is self-issued, and no motion behavior is added in the CB-M04-only candidate.

## Other scoped states reviewed

Existing read paths retain committed rows/total during pending/error, reserve eight slots on first rows=null loading, explain empty/initial error without invented zero or retry, use supplied unavailable/currency reasons, isolate history closedResult, preserve original source precision/FX/coverage and exact activation identity. Existing28 tests and independent lifecycle case cover these synthetic paths and are rerun for candidate3. This source review establishes no additional data/API defect. Actual paint, initial/retained/empty visual comparison, long content, overflow, hover, focus/input variants and full host data chain stay NOT VERIFIED.

## Exact source excerpts

469: 状态语义、请求一致性、动效与减弱动效规则适用于全站。本章图稿和表内“四指标、八行槽、全局修复”采用首页实例：子模块按自身布局保留占位，不新增首页已有布局之外的区域；交易库的恢复动作见其 V1.0 异常章节。

471: 正常状态保持简洁，不展示“估值完整”等常驻徽章。异常才出现简短原因，颜色辅助识别：加载为灰蓝，更新为蓝，数据过期为黄，失败为红。所有状态都提供文字或可访问名称。

475: |首次加载|标题、四指标、图表、表头和八行槽按最终尺寸占位|等待数据，不被布局跳动打断|

476: |已有数据、后台更新|保留上一组完整有效数据|继续阅读，辨认更新状态|

507: |浮层打开 / 关闭|160ms缓出，透明度变化并移动4px|不能推动触发器、标题或表格底边|

508: |鼠标悬停|120ms颜色变化|不能改变控件大小|

509: |数据替换|150ms淡入|金额不滚动跳数，不出现半组新数据|

512: |图表提示|显示和关闭，不缩放|不遮住主要曲线或超出边界|

514: 用户启用减弱动效时，移除位移、计数和淡入，直接显示最终状态。

Current CSS matches:

79: .hp-contribution-bars .hp-contribution-bars__action:hover,

80: .hp-contribution-bars .hp-contribution-bars__detail-trigger:hover,

81: .hp-contribution-bars__detail button:hover { background: rgb(160 180 205 / 7%); }

86: .hp-contribution-bars .hp-contribution-bars__status { margin: 0 0 12px; color: #a7b3c4; overflow-wrap: anywhere; }

87: .hp-contribution-bars .hp-contribution-bars__status.hp-contribution-bars__status--error { color: #FF8592; }

Current TSX direct readout mount:

204:     {open && createPortal(<div id={`${id}-detail`} ref={dialog} role="dialog" aria-modal="false" aria-labelledby={`${id}-detail-title`} tabIndex={-1}

## Subsequent parent decision (before motion implementation)

Root confirmed original507–514/manual120ms apply to this existing leaf and authorized CB-M05 with CB-M04 in the still-unfrozen final candidate3. The earlier source-gap report is preserved. Motion is now authorized only within the same three product files; required safe enter/exit lifecycle, data150ms, hover120ms and reduced-motion immediate terminal state will receive RED evidence before production changes. Actual browser motion/visual gates stay NV, and final root acceptance remains pending3/3.

## Final source resolution, still awaiting root acceptance

CB-M05 now supplies local120ms hover background color,160ms ease-out opacity/4px detail enter AND exit,150ms atomic committed-data fade, and CSS/JavaScript reduced-motion immediate terminal behavior. STATUS-MOTION-SOURCE.log inventories the parsed source; MOTION-RED.log and GREEN.log cover the safe lifecycle. No additional proven leaf source discrepancy remains identified by this worker review. This is not actual paint/timing/visual acceptance: all corresponding real browser gates remain NV. The earlier gap report was valid for the pre-motion version and remains preserved.
