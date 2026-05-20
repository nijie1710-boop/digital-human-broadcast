# 数字人口播 Web

React + Tailwind CSS + Express + Prisma SQLite 实现的数字人口播 MVP，包含工作台、视频生成、数字人形象与声音库、任务中心、作品管理和模板中心等页面。

默认使用 mock provider 做离线兜底：提交任务后会按阶段推进进度，并输出本地合成的竖屏视频。

如果要生成真正有口型驱动的数字人口播视频，可以切换到 D-ID provider。D-ID 会把数字人形象图和文案提交到 Talks API，轮询生成完成后把 MP4 下载回本地作品库。

## 本地运行

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

访问 `http://localhost:5173/`。上传文件会保存在 `public/uploads`，SQLite 数据库位于 `prisma/dev.db`。

## 真实数字人口播

在 `.env` 中配置：

```bash
DIGITAL_HUMAN_PROVIDER="did"
D_ID_API_KEY="your-d-id-basic-api-key"
D_ID_VOICE_PROVIDER="microsoft"
D_ID_VOICE_ID="zh-CN-XiaoxiaoNeural"
```

没有 `D_ID_API_KEY` 时请保持 `DIGITAL_HUMAN_PROVIDER="mock"`。切到 `did` 后，生成任务在“完成”阶段会调用真实 talking-head API，耗时会比 mock 更长。

## 构建

```bash
npm run build
```
