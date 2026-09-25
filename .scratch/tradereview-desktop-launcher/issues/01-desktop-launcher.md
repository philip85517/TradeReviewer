# 增加 macOS 桌面 TradeReview 启动器

What to build: 安装可双击的 `~/Desktop/tradeReview.command`；启动正式 3022 服务，健康后开网页，错误端口不杀进程。
Blocked by: none
Status: complete

- [x] 仓库维护启动器源文件并记录安装方式。
- [x] 桌面安装文件名、可执行权限与源文件一致。
- [x] 空闲端口启动正式服务，健康后打开首页。
- [x] 已运行服务时只打开现有页面，不启动重复服务。
- [x] 端口由其他程序占用时安全失败，保留占用进程。
- [x] 首页 HTTP 200，SQLite 状态接口返回 schema 7 和正式成交数量。
