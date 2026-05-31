# 正式部署文档

本文档用于将当前项目部署到 VPS，并使用 Nginx 托管前端、PM2 运行后端、Neon PostgreSQL 作为数据库。

## 1. 项目结构

```text
duplicate/
  index.html                  # 前端静态入口
  src/                        # 前端样式和脚本
  runtime-config.example.js   # 前端运行时配置示例
  backend/
    src/server.js             # 后端启动入口
    src/app.js                # Express API
    prisma/schema.prisma      # Prisma schema
    .env.example              # 后端环境变量示例
  docs/
    deployment.md             # 本文档
```

前端是静态文件。后端是 Node.js + Express + Prisma。

## 2. 生产环境变量

后端生产环境至少需要：

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/db?sslmode=require"
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="8h"
PORT=3001
CORS_ORIGIN="https://your-domain.example.com"
```

说明：

- `DATABASE_URL` 使用 Neon PostgreSQL 连接串，保留 `sslmode=require`。
- `JWT_SECRET` 必须使用足够长的随机字符串。
- `PORT` 默认是 `3001`，如无特殊需求可保持一致。
- `CORS_ORIGIN` 必须配置为线上前端域名。
- 不要把真实 `.env` 提交到 Git。

## 3. 后端部署

进入后端目录：

```bash
cd /var/www/roof-calculator/backend
npm install
npx prisma generate
```

确认 Prisma schema：

```bash
npx prisma validate
```

数据库 schema 准备：

- 如果生产数据库已经有表结构，确认 `npx prisma validate` 通过即可。
- 如果需要迁移，请先备份数据库，再按项目实际迁移策略执行 Prisma migrate。
- 不要在生产环境随意执行 reset。

创建后端 `.env`：

```bash
cp .env.example .env
nano .env
```

只写真实服务器环境变量到 `backend/.env`，不要写进源码。

## 4. 初始化管理员账号

首次部署后创建管理员：

```bash
cd /var/www/roof-calculator/backend
npm run admin:create -- --username=admin --password="REPLACE_WITH_STRONG_PASSWORD" --displayName="Administrator"
```

也可以使用环境变量：

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD="REPLACE_WITH_STRONG_PASSWORD" ADMIN_DISPLAYNAME="Administrator" npm run admin:create
```

管理员密码会以 bcrypt 哈希保存。

## 5. PM2 运行后端

安装 PM2 后，在后端目录启动：

```bash
cd /var/www/roof-calculator/backend
pm2 start npm --name roof-calculator-api -- start
pm2 save
pm2 startup
```

查看状态和日志：

```bash
pm2 status
pm2 logs roof-calculator-api
```

后端监听地址默认为：

```text
http://127.0.0.1:3001
```

启动成功后会执行一次数据库预热，日志类型为 `db_warmup`。

## 6. 前端静态部署

前端无需长期 Node 服务。先构建 CSS：

```bash
cd /var/www/roof-calculator
npm install
npm run build:css
```

确保 Nginx 静态目录包含：

```text
index.html
src/
runtime-config.js
```

线上 `runtime-config.js` 示例：

```js
window.ERP_API_BASE_URL = '/api';
window.ERP_ADMIN_USERNAME = 'admin';
```

如果 API 使用独立域名：

```js
window.ERP_API_BASE_URL = 'https://api.your-domain.example.com';
window.ERP_ADMIN_USERNAME = 'admin';
```

## 7. Nginx 示例

以下示例使用同域名托管前端，并把 `/api` 反向代理到后端：

```nginx
server {
    listen 80;
    server_name your-domain.example.com;

    root /var/www/roof-calculator;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

检查并重载 Nginx：

```bash
nginx -t
sudo systemctl reload nginx
```

## 8. HTTPS / Certbot

建议上线后配置 HTTPS：

```bash
sudo certbot --nginx -d your-domain.example.com
```

配置完成后确认：

- 浏览器访问使用 `https://`。
- `CORS_ORIGIN` 使用 HTTPS 域名。
- `runtime-config.js` 的 API 地址不再指向本地地址。

## 9. 部署后验收

检查数据库健康：

```bash
curl https://your-domain.example.com/api/health/db
```

预期成功返回：

```json
{
  "ok": true,
  "dbMs": 12.3,
  "timestamp": "2026-05-31T00:00:00.000Z"
}
```

登录获取 token：

```bash
curl -X POST https://your-domain.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"REPLACE_WITH_ADMIN_PASSWORD"}'
```

使用 token 访问订单：

```bash
curl https://your-domain.example.com/api/orders \
  -H "Authorization: Bearer REPLACE_WITH_TOKEN"
```

浏览器验收：

- 打开 `https://your-domain.example.com`。
- 确认登录页出现账号和密码。
- 登录成功后新增、编辑、删除订单。
- 刷新页面后订单仍存在。

## 10. 常见问题

### DATABASE_UNAVAILABLE / Neon 冷启动

表现：

- `/api/health/db` 返回 `ok=false`。
- 后端日志出现 `DATABASE_UNAVAILABLE`。

排查：

- 检查 `DATABASE_URL` 是否正确。
- 确认 Neon 数据库没有暂停或连接不可达。
- 确认 VPS 可以访问 Neon。
- 查看后端 `db_warmup` 和 `api_perf` 日志中的 DB 耗时。

### CORS_ORIGIN 配置错误

表现：

- 浏览器请求 API 被 CORS 拦截。
- 后端返回 `CORS_ORIGIN_NOT_ALLOWED`。

排查：

- `CORS_ORIGIN` 必须包含线上前端域名。
- 协议、域名、端口必须完全匹配。
- HTTPS 环境不要配置成 HTTP 地址。

### runtime-config.js 指向错误 API

表现：

- 前端仍然请求 `127.0.0.1:3001`。
- 登录失败或订单接口无法访问。

排查：

- 打开浏览器开发者工具查看请求地址。
- 确认线上 `runtime-config.js` 已更新。
- 同域反代时建议使用：

```js
window.ERP_API_BASE_URL = '/api';
```

## 11. 回滚建议

- 后端使用 PM2 时，可先保留旧版本目录或 Git commit。
- 部署前备份数据库。
- 如新版本异常，可切回旧 commit，重新 `npm install`、`npx prisma generate`，再 `pm2 restart roof-calculator-api`。
