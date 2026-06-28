
修改 schema.prisma 的 model
终端执行迁移同步数据库
npx prisma migrate dev --name xxx_modify


手动刷新生成客户端代码
npx prisma generate


Ctrl+C 关闭旧 studio，无痕浏览器重新打开 studio
npx prisma studio


先看我项目package.json依赖，以此为唯一标准，所有代码适配下面版本，不准使用低于该大版本的API：
{
  "name": "my-express-prisma-api",
  "version": "1.0.0",
  "description": "",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test": "echo \"Error: no test specified\" && exit 1",
    "lint-fix": "eslint src/**/*.ts --fix"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@antv/x6": "^3.1.7",
    "@antv/x6-vue-shape": "^3.0.2",
    "@prisma/adapter-better-sqlite3": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "file-saver": "^2.0.5",
    "jspdf": "^4.2.1",
    "xlsx": "^0.18.5",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/express": "^5.0.6",
    "@types/node": "^26.0.1",
    "@typescript-eslint/eslint-plugin": "^8.62.0",
    "@typescript-eslint/parser": "^8.62.0",
    "eslint": "^10.5.0",
    "prisma": "^7.8.0",
    "tsx": "^4.22.4",
    "typescript": "^6.0.3"
  }
}

规则：任何代码不能使用对应包低大版本废弃、移除的API。