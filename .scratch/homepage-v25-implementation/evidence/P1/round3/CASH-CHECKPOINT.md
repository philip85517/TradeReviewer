# Cash 最小 lint 修复

Root有限授权；P1仍2/3 FAIL，不是第三候选。

原 lint RED: 12-cash-lint-red.log，1 error/10 warnings；HEAD同因历史保留。仅把scope变化时的saving/fact/error清理放到条件式本组件render reset，transientScopeKey更新后下一render条件false，无循环。effect写入序列/读取序列/取消和异步回写不变。API/DB无操作。精确差异cash-only.diff。

11-cash-behavior-before.log：3 PASS；13-cash-behavior-after.log：同3 PASS，均regression护栏，未冒称行为RED。覆盖503保存后读取失败/只读重试PUT仍1、重复读取失败事实保留、A→B→A后旧pending PUT与503不发布。14-cash-lint-green.log exit0：0 errors/10既有warnings；不宣称全量lint PASS。

source SHA256 058e952eb866041836ee0f119a58fc4be32ec8e3a5880f0c97298e772c46c764。后续P3修改同文件需另绑定版本；本次现金边界diff独立保留。实际浏览器持久化/窄屏/触摸未执行，仍NOT VERIFIED。
