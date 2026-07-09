# 踩坑记录

每次犯错都有原因。记录是为了不犯第二次。

---

## 1. Zod 4 API：`.errors` → `.issues`

**现象**：`parsed.error.errors[0].message` 飘红

**原因**：项目装的是 Zod 4.4.3，代码用了 Zod 3 的 API。Zod 4 把 `ZodError.errors` 改名为 `.issues`。

**修法**：全文替换 `.errors` → `.issues`

**教训**：写代码前先查 `package.json` 里装的版本，不能凭记忆。

---

## 2. Express 5：`req.params` 类型是 `string | string[]`

**现象**：`parseInt(req.params.id, 10)` 飘红

**原因**：`@types/express` 5.x 里 params 可能是数组（比如 `/user/:id(\\d+)?` 这种可选路由）

**修法**：`String(req.params.id)` 归一化处理

---

## 3. Prisma：有 schema 但没有 Model

**现象**：执行了 `prisma migrate dev` 但没有生成 `prisma/migrations/`，也没有表

**原因**：`schema.prisma` 里只有 generator 和 datasource，一个 `model` 都没定义。Prisma 认为没有可迁移的。

**修法**：加 `model Todo { id Int @id ... }`，删掉空 `dev.db`，重新 migrate

---

## 4. Prisma 7：不能从 `@prisma/client` 直接 import

**现象**：`import { PrismaClient } from '@prisma/client'` 报错

**原因**：项目是 ESM（`"type": "module"`），`@prisma/client` 是 CJS 格式。ESM 不能直接 named import CJS 模块。

**修法**：从生成的客户端路径导入：`from '../generated/prisma/client.js'`

---

## 5. Prisma 生成目录在 `src/` 外面 → IDE 飘红

**现象**：`import { PrismaClient } from '../../generated/prisma/client.js'` IDE 报找不到

**原因**：生成目录 `generated/` 在项目根目录，但 IDE 的 TS Server 默认只认 `src/` 内的文件

**修法**：在 `schema.prisma` 里把 `output` 改成 `"../src/generated/prisma"`，放到 src 里面

---

## 6. SQLite：Prisma 列类型和数据库实际值不一致

**现象**：API 报 500：`Expected a boolean, got string: runing`

**原因**：`completed` 列在 Prisma schema 定义是 `Boolean`，但 SQLite 存了字符串 `"runing"`。SQLite 不校验类型所以能存，Prisma 读的时候校验失败。

**修法**：改 schema 为 `completed String @default("pending")`，手动 `UPDATE` 数据，`prisma generate`，前后端类型同步

**教训**：SQLite 弱类型，改 schema 字段类型时别忘了改库里的数据。

---

## 7. CORS 中间件写在路由后面

**现象**：加了 `cors()` 还是报 CORS error

**原因**：`app.use(cors(...))` 写在了 `app.use('/api/todos')` 和 `app.listen()` 之后。Express 中间件按注册顺序执行，写后面不生效。

**修法**：`cors()` 挪到 `express.json()` 后面、路由前面

---

## 8. Railway：`prisma migrate deploy` 读不到 `DATABASE_URL`

**现象**：Railway 日志显示 `The datasource.url property is required`

**原因**：`prisma migrate deploy` 是 Prisma CLI 命令，执行 `prisma.config.ts` 时 `process.env["DATABASE_URL"]` 可能为 `undefined`

**修法**：加兜底值 `|| "file:/data/dev.db"`

---

## 9. Railway：数据库路径和迁移路径不一致

**现象**：迁移成功，API 还是 500

**原因**：`prisma.config.ts` 的迁移走 `/data/dev.db`，但 `src/lib/prisma.ts` 的运行时适配器硬编码了 `'./dev.db'`——两个文件，两个路径。

**修法**：`prisma.ts` 改成 `process.env.DATABASE_URL?.replace('file:', '') || './dev.db'`

---

## 10. Git SSH：端口 22 被公司网络拦截

**现象**：`ssh -T git@github.com` → `Connection reset`

**原因**：公司防火墙/网络拦截 22 端口

**修法**：
1. `~/.ssh/config` 把 `github.com` 指向 `ssh.github.com:443`
2. `ssh-keyscan -p 443 ssh.github.com >> ~/.ssh/known_hosts`
3. 添加公钥到 GitHub Settings → SSH Keys

---

## 11. GitHub Actions：`gh repo create` 默认用 SSH 地址

**现象**：`gh repo create --push` 后远程地址是 `git@github.com:...`，推不上去

**原因**：`gh` CLI 默认生成 SSH 远程地址。如果 SSH 还没配好就推不了。

**修法**：临时切 HTTPS：`git remote set-url origin https://...`，配好 SSH 再切回来

---

## 12. Vite proxy 仅限本地开发

**现象**：Vercel 部署后 `/api/todos` 404，本地正常

**原因**：本地 `npm run dev` 时 Vite dev server 转发 `/api` → `localhost:3000`。Vercel 上这个 proxy 不存在。

**修法**：`baseURL` 改成 `import.meta.env.VITE_API_BASE || '/api'`，Vercel 设环境变量

---

## 13. Vercel：SPA 路由刷新 404

**现象**：`my-ai-app.vercel.app/task` 直接访问 404，但从首页点进去正常

**原因**：Vercel 收到 `/task` 路径，在服务器上找 `task.html`，找不到。Vue Router 是前端路由，需要先加载 `index.html` 再用 JS 匹配路径。

**修法**：项目根目录加 `vercel.json`，所有路径 rewrite 到 `index.html`

---

## 14. x6-vue-shape：独立 Vue 应用没有注册 Element Plus

**现象**：云节点在侧边栏显示正常，拖到画布上空白

**原因**：`@antv/x6-vue-shape` 在画布里渲染组件时 `createApp()` 创建了一个独立的 Vue 应用。这个新应用没有 `app.use(ElementPlus)`，所以 `<el-icon>` 渲染失败。

**修法**：不用 `<el-icon>`，直接写 SVG path

---

## 15. DrawingToolbar：`$emit` 和 `defineEmits` 返回值冲突

**现象**：工具栏所有按钮点了没反应

**原因**：模板里用 `$emit('save')`，`<script setup>` 里又写了 `const emit = defineEmits(...)`。`$emit` 在 `<script setup>` 里不总是可用。

**修法**：模板里统一用 `emit('save')`

---

## 16. 侧边栏预览（CSS）和画布（X6 SVG）渲染不一致

**现象**：侧边栏三角形是方框，拖到画布变三角

**原因**：侧边栏用 CSS `<div>` 假装画形状，画布用 X6 真实渲染 SVG。两个渲染引擎，不可能一样。

**修法**：侧边栏和画布统一用 Vue SFC + 内嵌 SVG 组件，同一个组件渲染两次

---

## 17. Dockerfile 部署：没有 `prisma migrate deploy`

**现象**：Railway 部署后 API 500，日志看不出错误

**原因**：Dockerfile 里只有 `prisma generate`（生成类型），没有 `prisma migrate deploy`（建表）。数据库空的，一查就 500。

**修法**：CMD 改成 `prisma migrate deploy && npm start`

---

## 通用教训

1. **写代码前先看版本**：`package.json` 里装的是哪个大版本，就去查那个版本的文档
2. **本地能跑 ≠ 线上能跑**：Vite proxy、dotenv、localhost 这种本地便利都会消失
3. **硬编码路径是最大的坑**：数据库路径、API 地址、端口，用环境变量或兜底值
4. **顺序很重要**：Express 中间件、Dockerfile CMD、代码里 import 先后，顺序错了全白搭
