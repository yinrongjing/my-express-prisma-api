FROM node:22-alpine

# 装编译工具（better-sqlite3 需要 C++ 编译）
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 先拷依赖清单，装依赖（利用 Docker 缓存层，代码改动不重装）
COPY package.json package-lock.json ./
RUN npm ci

# 再拷代码
COPY . .

# 生成 Prisma 客户端类型
RUN npx prisma generate

# 声明端口
EXPOSE 3000

# 先迁移再启动
CMD sh -c "npx prisma migrate deploy && npm start"
