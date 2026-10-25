# Revision 10 协调者阅读器验收

2026-10-24；root。范围是静态设计正文、C07–C10受影响图及链接；不重做未变化阅读器的全部33目录/40模态检查，不将其计入本轮通过分母。用户原tab未改动，新tab8用于最终阅读器，tab6为候选。

版本 source `40d4cfc9cb9d443270f41ff96c5a5b6902276e7f628d8c0c242ccbc6f53dbd63`；content `ce8873acaca197ac0cec3eda7f43221ce56c786066e6537fb073508f8e11b35d`；57文件后验一致（root-final-version.json）。5首页与4指标测试所测模块未随最后表格修复变化。

| 检查 | 结果及证据 |
|---|---|
| BT02表格回归 | FAIL保留root-reader-table-before.png；移段后9行含表头、8数据行，零管道段落。PASS：root-reader-table-final.json、final.png、final-lower.png。 |
| 候选链接 | 实际点击“候选布局比较”进入navigation-options.html，A方案/实盘列表可见，再back；PASS。 |
| C07–C10定位 | 4/4逐条打开详情并点击定位原文，当前图可见、原occurrence/新occurrence与历史原图href正确。root-reader-comments.json及4截图。 |
| 原评论 | integrity.json确认revision10共10条字节不变；不是把评论状态自动改成已解决。 |
| 首页1280嵌入 | 实测1280×900、页面宽1265。1440×2346完整源稿以object-fit contain显示于891×450缩略框；可点原尺寸100%查看。root-reader-home-1280.json、root-reader-home-final-1280.png、root-reader-home-original-1280.png。此为文档缩略图，不是产品1280响应式稿。 |
| 首页进入/返回 | state-demo-7第2帧完整首页入口→逐次下一步至第12帧交易库返回首页；src分别journeys-home-entry.svg/library-return.svg；返回焦点图见root-reader-home-return-1280.png。 |
| 分布/下钻/返回 | state-demo-5共3帧实际切换，原选中区间/回合/分母说明正确。root-reader-distribution.json。末帧next禁用；测试原预期4帧，额外点击被拒绝，核对DOM为3帧后停止，不算应用错误。 |
| 最终导航1440 | 根浏览器实测1440×900并逐点A/B/C；见root-final-nav-1440.json和3截图；独立Agent直接视觉复核。 |
| 浏览器日志 | root-browser-logs.json无warn/error。 |

仅鼠标操作与上述阅读器旅程；候选键盘由独立Agent另证。产品写入/数据库不适用于本次范围；实体触控未验证。当前阶段不能关闭布局选定和回撤定义依赖。服务3090保持运行，启动方式见FINAL-ACCEPTANCE.md。
