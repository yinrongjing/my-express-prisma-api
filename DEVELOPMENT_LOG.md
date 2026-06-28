# 开发日志

## 2026-06-25（第1天）

### 项目搭建
- 创建 Express 5 + Prisma 7 + SQLite 项目
- 初始化 Prisma：`prisma/schema.prisma`（Todo + User 模型）
- 执行 `npx prisma migrate dev --name init`

### 遇到的问题

**Q: 执行了 migrate 命令但没有生成 `prisma/migrations` 目录，也没有 todo 表？**

A: `schema.prisma` 里只写了 `generator` 和 `datasource`，一个 Model 都没定义。Prisma 认为没有需要迁移的内容。

修复：
1. 在 schema 里加了 `model Todo { id Int @id ... }`
2. 删除空的 `dev.db`，重新 `npx prisma migrate dev --name init`
3. 确认 `prisma/migrations/` 生成，SQLite 数据库里 Todo 表存在

**Q: 为什么 Prisma CLI 找不到 schema 文件？**

A: 命令不在项目目录执行。需要 `cd` 到项目根目录再跑 Prisma 命令。

### API 开发
- 创建 Express 5 服务入口 `src/index.ts`
- Todo CRUD 路由 `src/routes/todo.ts`（GET/POST/PUT/DELETE）
- Prisma 客户端适配器 `src/lib/prisma.ts`（better-sqlite3）

---

## 2026-06-26（第2天）

### 数据库模型演进
- Todo 模型字段调整：
  - `title` → 删除，改用 `taskName` + `desp`
  - 新增 `state` 字段（后删除）
  - `completed`：`Boolean` → `String`（值：pending / running / done）
- 新增 User 模型（name / email 唯一 / age 可选）

### Prisma 7 适配器问题

**Q: 导入 `PrismaClient` 报错？**

A: Prisma 7 必须通过 adapter 连接数据库。使用方式：
```ts
import { PrismaClient } from '../generated/prisma/client.js'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: './dev.db' }) })
```

**Q: 直接 `import { PrismaClient } from '@prisma/client'` 为什么不行？**

A: 项目是 ESM（`"type": "module"`），`@prisma/client` 是 CJS 格式，ESM 不能直接用 named import。解决方案是改成从生成的客户端路径导入（`../generated/prisma/client.js`）。

---

## 2026-06-27（第3天）

### Zod 版本踩坑

**错误：** 写了 `parsed.error.errors[0].message`，IDE 飘红。

**原因：** 项目安装的是 Zod 4.4.3，但代码用的是 Zod 3 的 API。Zod 4 把 `.errors` 改成了 `.issues`。

**教训：** 写代码前必须检查 `package.json` 里依赖的实际版本，不能凭记忆用老版本 API。

**修复措施：**
1. 全文替换 `.errors` → `.issues`
2. 禁止使用 `!` 非空断言，用可选链 `?.` 兜底
3. 封装 `firstZodMessage()` 工具函数统一处理校验错误
4. 建立规则：以后写代码前先 `cat node_modules/<pkg>/package.json | grep version`

### TypeScript 飘红修复

**问题：** IDE 里 `src/lib/prisma.ts` 和 `src/routes/todo.ts` 飘红。

**原因有三个：**

| 飘红 | 原因 | 修复 |
|------|------|------|
| PrismaClient 导入 | 生成目录在 `src/` 外面，IDE 解析不到 | schema.prisma 里改 `output = "../src/generated/prisma"` |
| `parsed.error.errors` | Zod 4 没有 `.errors` | 改为 `.issues` |
| `req.params.id` 类型 | Express 5 的 params 是 `string \| string[]` | 用 `String()` 归一化 |

**关键认知：** 飘红不影响 `tsx` 运行（tsx 只做语法转换不做类型检查），但修复后开发体验更好。预防措施：加 `"check": "tsc --noEmit"` 脚本随时自查。

### 数据库字段冲突

**错误：** API 返回 500：`Expected a boolean in column 'completed', got string: runing`

**原因：** 数据库里 `completed` 列存了字符串 `"runing"` 和 `"done"`，但 Prisma schema 定义是 `Boolean`。SQLite 不校验类型所以能写入，但 Prisma 读取时校验失败。

**修复流程：**
1. 确认需求：`completed` 应该是字符串
2. 改 schema：`completed String @default("pending")`
3. 执行 `sqlite3 dev.db "UPDATE Todo SET completed = 'running' WHERE id = 2"`
4. 执行 `npx prisma generate`
5. 前后端类型同步更新（`boolean` → `string`）

---

## 2026-06-28（第4天）

### GitHub 部署

**Q: 代码传到 GitHub，用 SSH 还是 HTTPS？**

A: 公司网络 22 端口被拦截，SSH 直连不通。解决方案：
1. SSH 走 443 端口（`ssh.github.com`）
2. 创建 `~/.ssh/config`，把 `github.com` 指向 `ssh.github.com:443`
3. 添加公钥到 GitHub Settings → SSH Keys

**Q: 为什么 `gh repo create` 生成的远程地址是 SSH，推不上去？**

A: `gh` CLI 默认用 SSH 协议。如果还没配好 SSH key，需要临时切到 HTTPS + Token。配好 SSH 后再切回来。

### CI/CD

- 创建 `.github/workflows/ci.yml`（两个项目各一份）
- 每次 push 到 main 自动触发
- 做的事：装依赖 → 类型检查 → 构建验证
- 前端多一步：上传构建产物 artifact

---

## 项目技术栈

| 层 | 选型 | 版本 |
|------|------|------|
| 运行时 | Node.js | 22 |
| Web 框架 | Express | 5.2 |
| ORM | Prisma | 7.8 |
| 数据库 | SQLite（better-sqlite3） | - |
| 校验 | Zod | 4.4 |
| 语言 | TypeScript | 6.0 |
| 开发运行 | tsx | 4.22 |
