# 不完整首页归档（2026-11-14）

用户已决定只迭代完整 Mock 首页。此目录保留旧核心页，**不再绑定任何页面路由，也不作为后续页面迭代入口**。

- `homepage-preview.tsx`：原不完整核心 UI，只有当前表现、持仓和简化详情。
- `http-homepage.tsx`：原 `/home` 的 HTTP 接线入口，仅供历史查阅。
- 原核心 UI / HTTP 状态链测试仍在上级目录运行，导入归档组件；通过只代表旧合同仍可回归，不代表正式首页已经接入真实数据。

当前唯一正式首页：`app/home/page.tsx` → `../complete-mock/full-mock-homepage.tsx`。
旧 `/preview/homepage` 永久跳转 `/home` 并保留查询参数。共享组件、`http-source.ts`、接口合同和 `/api/home/*` 后端继续保留，后续按完整页面请求需求单独评审接入。

归档不添加兼容页面，也不恢复第二套活动首页。
