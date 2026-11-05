# 策略台视觉设计方案 V1.2

本版将策略台与V2.5公共视觉对齐，并把策略专属组合登记到公共组件手册。完整正文从背景、目标和取舍开始，再说明流程、布局、各任务分镜与组件。

- [完整设计预览](visual-spec.html)
- [公共扩展 SW01–SW08](../../shared/strategy-workbench-v1.2/manual.html)
- [整体问题列表](issues.md)
- [设计覆盖契约](DESIGN-COVERAGE.md)
- [独立审查与验收](acceptance.md)

## 启动与重建

从仓库根目录运行：

```sh
bash docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/start-preview.sh
```

打开 http://127.0.0.1:3094/design-system/baselines/2026-10-24-strategy-workbench-v1.2/visual-spec.html 。该服务只提供文档及评论，不连接业务数据库。已有3094文档服务时直接打开链接。

修改后运行 `python3 docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/build-design.py`，并运行 `source/verify-document.py` 检查引用与文档身份。静态检查不替代实际渲染比图。

当前状态：V1.2设计包已完成并通过静态视觉与阅读器验收；22张策略图稿与8张公共样例的三批独立复核结果见acceptance.md。原V1.0及其旧接受证据保留，公共视觉门禁已因本轮发现重开。
