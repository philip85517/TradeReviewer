# 最终文档阅读器验收：PASS

执行者 `/root`，未实现图稿；实际浏览器 IAB tab 3。时间 2026-10-23T18:47:26.078Z 至 2026-10-23T18:54:02.855Z（UTC）。触发为静态设计整页修改及用户要求修复后独立验收。操作前范围见 [登记](../../READER-ACCEPTANCE-PLAN.md)，登记清单与最终DOM逐项对齐。

source `8aca7949a1b05d56d27a7472115d45b9c25a07013fe3961a03883a2dd3bd1c58`；content `7584f36adeab139fc67a50b5894e7bc9afaf894a73aeb1a10716f6a04f198182`。[后验](version-after.json)53/53文件与独立验收冻结包匹配。浏览器内manifest与磁盘manifest完整相等；不是只检查HTML响应状态。

| 范围 | 实际输入与观察 | 结果与证据 |
|---|---|---|
| 33目录 | 每项实际鼠标点击，精确hash、标题及可见位置正确；另检查当前目录态 | PASS：[toc](toc.json)、[current](toc-current.json) |
| 40分镜/8组 | 首帧重播，其余真实下一步；唯一可见帧、进度、caption和源图逐项对manifest | PASS：[frames](frames.json) |
| 8组边界/前后/重播 | 首帧prev禁用、末帧next/play禁用；多帧上一页、重播 | PASS：[controls](controls.json) |
| 6多帧播放/暂停 | 点击播放，跨实际1800ms定时器观察新帧；暂停后再次等待确认保持 | PASS：controls；2单帧组播放和前后均禁用，点击不适用 |
| 8组方向键、1组Escape | 独立键盘输入ArrowRight/Left；Escape停止并等待确认保持 | PASS：controls；不代替触控证据 |
| 40原尺寸图片 | 每张真实打开、自然尺寸与100%外盒比较、关闭恢复原链接焦点 | PASS：frames；8组首帧modal截图 |
| 1长图键盘旅程 | Enter打开、Tab/Shift+Tab循环、End到末尾、Escape关闭与焦点返回 | PASS：[keyboard](keyboard-modal.json)、[末尾截图](long-image-bottom.png) |
| 6原评论 | 每项选中详情并点击定位；2正文共5语义段落、4修订图片均到准确位置 | PASS：[comments](comments.json)、comment-1至6截图 |
| 4原图链接 | 实际点击打开独立标签并读取旧SVG；保存截图后关闭自有标签 | PASS：comments、comment-3至6-original截图 |
| 评论刷新/关闭重开/页面重载 | 均仍为6条原评论，意见、状态、历史字节未改 | PASS：comments与[integrity](integrity.json) |
| 最终预览 | 页面重载后版本与图稿正确，本轮浏览器无新增warn/error，保留服务与交付tab | PASS：[截图](final-preview.png)、[原始动作观察](audit.json) |

实际比较视口1440×1000；页面clientWidth1425，差额为滚动条。40次原尺寸图片宽度均为自然宽度加2px边框。未主动调整浏览器zoom；当前DOM观察接口未暴露DPR，不将它推算成设备倍率。1280×800的两张设计状态由独立审查者实测并保留截图，见第三轮独立报告。验收后恢复临时viewport。

目录末尾三个子标题因文档底部边界不能滚到视口顶部，hash及标题位置正确，scrollspy继续标记视口顶部的第十章；此处记录实际状态，不把当前标记虚报为点击目标。测试中绝对/相对图片URL初次直接比较曾误报，已按页面URL规范化；原观测完整保留，未改产品以迎合测试。tab保留的7条历史控制台记录均早于本轮开始，本轮新增为0，未臆测历史记录原因。

明确排除：SVG中的产品按钮是静态画面；业务交易、数据库持久化、真实行情、评论新建/回复/采纳/解决、未修改的导出/身份/版本比较、触摸及手机断点均不计通过。未写业务数据库、未变更用户评论状态。结论只覆盖本次登记的静态文档阅读器。
