# 交易库 V2.0 文档验收

日期：2026-10-26。协调者：root。当前状态：已验收（静态设计文档范围）。

本次交付是《交易库设计规范》更名、V1.1 逻辑差异扫描、V2.0 视觉文档及静态图例同步。没有实现交易库产品或修改业务数据。

## 版本与范围

- 逻辑权威：`docs/design-system/trading-library-design-spec.md`，SHA-256 `99c5c0930395e649a500a105e265e169a88636c7932949aa78bf8659ee39a3a3`。旧 `domain-language.md` 保留兼容说明链接。
- 视觉源稿：`docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md`，SHA-256 `dd25c5dab416ff1c24b1abd02fdd8212b79ae90eb5456846a7c3e59f751aca43`。
- 新身份 `TRADING-LIBRARY-V20 / 2.0`，十章、322 个正文块、41 张 SVG、4 张历史 E JPG，44 个文档图像引用。
- 旧 E 原型/JPG 仅作几何、密度、层级和颜色参考；其历史业务数字不用于当前规则。
- 已批准 E 布局保持；授权调整为业务单位、数字、状态、图注和返回标签同步规范。

## 发现与修复

两名 `gpt-5.6-luna / max` 独立扫描，另一名同模型修订，root 裁决与集成。全部 C01–C10 见[确认问题清单](confirmed-findings.md)。主要修订：按文件计练习、按主动平仓计实盘回合；三种日期分离和导入前校验；等价去重、选择更新和人工成果保护；完整收益含余仓估值且费用一次；胜率与收益率分母分离；缺失练习保留身份和总数；模拟详情/配对回放与实盘回合集/回合复盘分开。

初检失败及 root 中途发现保留在 [A 初检](reviews/luna-a-v20-acceptance.md)、[B 初检](reviews/luna-b-v20-acceptance.md)、[root 复核](root-review.md)，不覆盖或删除旧失败证据。当前判断以最终快照和补验为准。

## 验收结果

|检查|结果|证据|
|---|---|---|
|十章业务规则与全部 SVG 图文语义|PASS|[Luna A 最终报告](reviews/luna-a-v20-final.md)|
|独立数字、单位、版本、缺失状态|PASS（包内回归覆盖存在限制）|[Luna B 最终报告](reviews/luna-b-v20-final.md)、[独立 oracle](reviews/luna-b-v20-oracle.py)|
|最终静态渲染与 E 参考直接比较|PASS|[Luna A 视觉补验](reviews/luna-a-v20-visual-addendum.md)：实际查看 6 张 1440 图、3 张 1280 图并对照 4 张 E 参考图|
|精确反例直接运行生成器|PASS|[Luna B 数字补验](reviews/luna-b-v20-final-addendum.md)、[生成器反例脚本](reviews/luna-b-v20-generator-oracle.py)，root 独立重跑通过；原报告的包内永久回归覆盖限制保留|
|构建与校验|PASS|[root-verification.json](root-verification.json)：41 SVG 重建、8 项统计 + 5 项模板测试、独立 oracle|
|文档引用及版本|PASS|[package-check.json](package-check.json)：130 个阅读引用、源稿/图片指纹、身份/版本；28 个索引链接有效|
|历史保留|PASS|89 个 V1.1 文件及 1 份原评论存储哈希未变|
|真实浏览器阅读|PASS|新鲜 V2 加载、章节跳转、原尺寸图打开/关闭、规范链接及返回；浏览器错误/警告为空|
|产品交互、导入、持久化、真实回放、物理触屏|NOT APPLICABLE|本次仅文档与静态设计资产，产品未交付，见 acceptance-plan.md|

浏览器截图：[V2 阅读页](root-evidence/v20-final-reader.png)、[原尺寸图入口](root-evidence/v20-final-figure.png)、[交易库设计规范](root-evidence/design-spec-final.png)。阅读器的沿用评论写入与播放引擎没有变化，本次没有写入评论。

实际源码、生成器、fixture、reader 的指纹见 root-verification.json。reader 重建包含生成时间，字节指纹可不同；源稿语义指纹和图片指纹均已核对，最终包不再重建。

## 保留边界与启动

真实本金/期末估值来源、主动平仓识别、多账户/多标的呈现、混合方向、内部预览列以及详细冲突界面仍待设计，V2.0 明确保留这些边界。文档通过不代表生产算法、数据迁移或交易库 UI 已实现。

仓库根执行 `./docs/design-system/start-design-preview.sh`；本次服务仍在 `http://127.0.0.1:3090` 运行。

- [V2.0 预览](http://127.0.0.1:3090/design-system/baselines/2026-10-26-trading-library-v2.0/visual-spec.html)
- [交易库设计规范](http://127.0.0.1:3090/design-system/trading-library-design-spec.html)

未提交、推送、合并或发布远端。
