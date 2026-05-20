# 数字人口播 Web

React + Tailwind CSS + Express + Prisma SQLite 实现的数字人口播 MVP，包含工作台、视频生成、数字人形象与声音库、任务中心、作品管理和模板中心等页面。

默认使用 mock provider 做离线兜底：提交任务后会按阶段推进进度，并输出本地合成的竖屏视频。

如果要生成真正有口型驱动的数字人口播视频，可以切换到阿里云百炼 provider。系统会先调用 Qwen-TTS/CosyVoice 生成音频，再调用 `wan2.2-s2v-detect` 检测数字人图片，最后提交 `wan2.2-s2v` 生成对口型视频。

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

优先使用阿里云百炼，在 `.env` 中配置：

```bash
DIGITAL_HUMAN_PROVIDER="aliyun"
ALIYUN_DASHSCOPE_API_KEY="your-dashscope-api-key"
ALIYUN_MODEL_REGION="beijing"
PUBLIC_BASE_URL="https://your-public-domain.example"
```

`PUBLIC_BASE_URL` 用于把 `/uploads/...` 本地上传文件转成阿里云可以访问的公网地址。本地开发时如果阿里云无法访问 `localhost` 文件，请使用 ngrok、Cloudflare Tunnel，或部署到服务器。

没有 `ALIYUN_DASHSCOPE_API_KEY` 时请保持 `DIGITAL_HUMAN_PROVIDER="mock"`。切到 `aliyun` 后，任务会按“准备文案 -> TTS -> 图片检测 -> 提交 wan2.2-s2v -> 等待视频生成”的真实流程推进，耗时会比 mock 更长。

可选：仍保留 D-ID provider，用 `DIGITAL_HUMAN_PROVIDER="did"` 和 `D_ID_API_KEY` 可以切到 D-ID。

## 构建

```bash
npm run build
```
