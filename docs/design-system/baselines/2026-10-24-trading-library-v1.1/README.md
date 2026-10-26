# 交易库视觉设计方案 V1.1

[完整可评论文档](visual-spec.html) · [冻结 E 原型](navigation-e-prototype.html) · 评论身份：`TRADING-LIBRARY-V11`

V1.1 将 2026-10-24 已确认的 E 方案定型为交易库正式设计基线。正文负责页面结构、颜色、控件、业务口径、返回上下文和异常状态；[V2.5 公共规范](../2026-10-22-homepage-v2.5/visual-spec.html)继续负责全站导航、控件基础和入口合同。V1.1 的正式原型是[冻结 E 原型](navigation-e-prototype.html)，与正文中的四张 approved E 截图共同构成视觉定型参考。

## 职责与边界

V1.1 负责 64px“交易库”顶栏、72px 五项全局侧栏、58px 模式与列表/统计二级栏、实盘与模拟盘页面、列表/统计、交易详情、回合下钻和逐层返回规则。首页日期入口、来源上下文和全站共享控件继续引用 V2.5。

原型中的固定样例数据、底部“视觉样例”预览工具、固定 loading/empty 样例和刷新重置行为只用于预览，不是产品规则。`source/images/` 当前包含 41 张生成 SVG 与 4 张 approved E JPG，共 45 个本版本样例资源；完整业务状态仍以正文引用的生成分镜和业务规则为准。

## 启动与构建

从仓库根目录启动阅读器：

```sh
./docs/design-system/baselines/2026-10-24-trading-library-v1.1/start-preview.sh
```

地址为 `http://127.0.0.1:3090/design-system/baselines/2026-10-24-trading-library-v1.1/visual-spec.html`；`PORT` 可覆盖默认端口。服务只提供设计文档和静态原型，不连接业务数据库。

Markdown 正文位于 `source/visual-design.candidate.md`。在本版本目录中重建阅读器：

```sh
python3 build-visual-spec.py --source source/visual-design.candidate.md --version 1.1 --output-dir .
```

生成分镜沿用既有生成器和相对路径；本次定型不改变图文件路径。原型入口见 `navigation-e-prototype.html`。

## 历史评论与独立评论

V1.0 的正文、原评论入口和旧轮次继续保留在 [交易库 V1.0](../2026-10-22-trading-library-v1.0/visual-spec.html)；旧评论拆分记录见 [V1.0 拆分评论记录](../2026-10-22-trading-library-v1.0/review-records/split-comments.html)。V1.1 使用独立评论身份 `TRADING-LIBRARY-V11`，从空记录开始，不把 V1.0 的定位或状态迁移到新正文。

## 样例边界

四张 `approved-e-{live,sim}-{list,stats}-1440.jpg` 是 E 的四个冻结主状态参考：实盘/模拟盘各覆盖列表和统计。其余生成分镜覆盖日期、搜索、列表、练习、回合、复盘、返回、趋势、分布和异常等完整业务状态。截图和分镜用于比较与追溯，不单独证明产品实现、数据库保存或真实行情回放已经完成。

2026-10-24 设计定型验收通过，见[集成验收记录](review-records/FINAL-ACCEPTANCE.md)和[独立验收记录](review-records/INDEPENDENT-ACCEPTANCE.md)。验收覆盖正文、图稿结构、代表状态视觉比对、原型归档和阅读入口；产品实现与响应式验证不在此次结论内。
