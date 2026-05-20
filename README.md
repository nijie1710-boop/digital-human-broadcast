# 数字人口播 Web

React + Tailwind CSS + Express + Prisma SQLite 实现的数字人口播 MVP，包含工作台、视频生成、数字人形象与声音库、任务中心、作品管理和模板中心等页面。

当前阶段使用 mock provider 模拟视频生成流程：提交任务后会按阶段推进进度，完成后自动创建作品记录。

## 本地运行

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

访问 `http://localhost:5173/`。上传文件会保存在 `public/uploads`，SQLite 数据库位于 `prisma/dev.db`。

## 构建

```bash
npm run build
```
