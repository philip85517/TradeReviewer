# 预审护栏缺口：根因与失败证据

本候选尚未冻结，也未读取真实输入。此记录属于 systematic-debugging + TDD 的施工证据，不能作为真实性能或产品缺陷证据。

1. CLI 做冻结/审批校验后才 import runner，但 runner 的公开 `measureApproved()` 自身没有该门禁，且公开 `sample(path, expectedSha)` 把调用者 path 重新当 allowedPath：路径“相等”检查没有建立授权来源。`moduleGraph` 也不需要公开。`red-05.txt` 在复制到 tests/tmp 的合成工具中复现公开函数存在、额外路径请求落到输入文件读取（ENOENT），以及 tsconfig 未绑定。没有把正式或真实 SQLite 路径交给此旧入口。
2. Vite/esbuild 仍读取仓库 tsconfig，即使 configFile:false。旧依赖清单只锁 package/entry/锁文件，遗漏编译配置。已将 tsconfig.json 绑定依赖身份；CLI 与直接导入子进程均在修改后拒绝。
3. 现在 CLI、measureApproved、prepareApprovedInput 共用 gate；真实入口只接受 runId/approvalPath，sample/moduleGraph 私有；真实来源固定 seed，目标固定本实验私有目录。合成入口无路径参数，先检查 tests/tmp 路径无 symlink。`red-06.txt` 首次负例错误地显式传入 undefined 导致 arguments.length=1，属于测试 harness 错误；保留该 FAIL，修正调用后 `red-06-attempt-02.txt` 正确复现缺少 symlink 护栏（ERR_LOAD_URL），随后修复并全套通过。
4. 独立预审确认旧 run-02 source.sqlite 非空 SHM；不删除、不修复、不再选择该副本。改为获批后只以文件句柄读取固定 seed 并 wx 复制至本实验私有只读文件。固定 SHA 引用旧冻结记录，施工期间未重新 hash。合成测试包括空 WAL、非空 SHM、符号链接、SHA 不符、目录/文件宽权限、目标冲突。`red-07.txt` 证明旧复制实现会接受宽权限，修复为源父目录 0700、源文件 0400；目标也 0700/0400。

`green-05-attempt-01.txt` 是五项新增门禁/复制首轮 GREEN；`final-tests-04.txt` 是加入 symlink/权限负例后的 17/17 合成回归。最终冻结前再跑一次全套，保留新日志。测试中的克隆常量只替换为合成种子 SHA，SQLite constructor sentinel 只用于证明拒绝路径没有开库；正常产品入口自测仍使用真正 Node SQLite/Vite。

限制：锁、直接包 manifest 与解析 entry 并不逐字冻结完整传递依赖 chunk；信任已安装运行环境。门禁不是针对有能力编辑代码/审批/manifest 的恶意本地用户的沙箱，也不抵御检查间隙的恶意文件替换。独立接受与真实执行批准仍单独进行。
