# V1.2 独立视觉复核

三个审查者均未参与被审图稿实现。协调者用真实浏览器逐图截图，审查者直接查看这些像素，并对照首页V2.5参考及公共契约；没有以worker完成报告替代比图。

| 独立审查者 | 覆盖 | 最终报告 |
| --- | --- | --- |
| audit_visual | 策略库、包管理、组装、实验、四步创建、异常、控件，共10图 | [library](evidence/reviews/strategy-v12-library-final-review.md) |
| audit_components | SW01–SW08及06观察/局部，共10图 | [shared](evidence/reviews/strategy-v12-shared-final-review.md) |
| audit_shared | 时间5图、结果、比较、响应式3图，共10图 | [time](evidence/reviews/strategy-v12-time-final-review.md) |

30/30张最终静态图稿通过。原始审计见evidence/audit，第二轮FAIL报告见evidence/reviews中的非final报告，失败截图见evidence/round2。旧V1.0的接受结论因公共风格问题重开，未回写为通过。

浏览器明确设置1440×1000 CSS视口；1280稿设置1280×1000、390稿设置390×1000，SVG自然尺寸fullPage截图。DPR与浏览器缩放未单独测量，不据此推断物理尺寸。工具输出截图可能为JPEG编码而以.png保存，解码尺寸以evidence/final-manifest.json为准；原始审查清单的PNG头推断尺寸不作为证据。

[首页参考截图](evidence/reference-home-1440.png)用于公共风格比较；不将首页72px侧栏、64px顶栏或固定八行当作策略硬性规格。策略保留54/200/48、88摘要、480详情和320检查区的设计契约。对应范围、元素、旅程与责任见[DESIGN-COVERAGE](DESIGN-COVERAGE.md)。

最终接受版本由evidence/final-manifest.json记录源码、SVG和截图SHA-256。静态图稿通过不代表真实产品控件、键盘、回测、数据库或物理触摸通过。
