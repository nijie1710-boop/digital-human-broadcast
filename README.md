# 数字人口播 Web

React + Tailwind CSS + Express + Prisma SQLite 实现的数字人口播 MVP，包含工作台、视频生成、数字人形象与声音库、任务中心、作品管理和模板中心。

当前支持三类生成链路：

- `mock`：本地离线流程，适合开发和 UI 验收，不消耗模型费用。
- `aliyun + s2v`：阿里百炼 Qwen-TTS/CosyVoice + `wan2.2-s2v`，单图驱动。
- `aliyun + videoretalk`：阿里百炼 TTS + VideoRetalk，使用基础视频做口型替换，通常比单图驱动更自然。

生成完成的视频会下载并保存到本地 `public/uploads/projects`，作品管理保存 `/uploads/projects/...mp4` 这类本地持久化地址。阿里结果视频会经过 FFmpeg 标准化为 1080x1920 MP4。

## 安装

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
```

访问地址默认为 `http://localhost:5173/`。SQLite 数据库位于 `prisma/dev.db`，上传文件保存在 `public/uploads`。

## Mock 模式

适合无公网地址、无 API Key、只验证产品流程时使用。

`.env` 示例：

```bash
DATABASE_URL="file:./dev.db"
PORT=5173
DIGITAL_HUMAN_PROVIDER="mock"
PUBLIC_BASE_URL=""
```

启动：

```bash
npm run dev
```

mock 模式允许最多 3000 字文案，会用本地模拟流程生成竖屏视频。

## 阿里真实模式

`.env` 示例：

```bash
DATABASE_URL="file:./dev.db"
PORT=5173
DIGITAL_HUMAN_PROVIDER="aliyun"
ALIYUN_DASHSCOPE_API_KEY="your-dashscope-api-key"
DASHSCOPE_API_KEY=""
ALIYUN_MODEL_REGION="beijing"
ALIYUN_VIDEO_MODE="videoretalk"
ALIYUN_VIDEO_MODEL="wan2.2-s2v"
ALIYUN_VIDEO_RESOLUTION="480P"
PUBLIC_BASE_URL="https://your-public-domain.example"
```

启动：

```bash
npm run dev
```

真实模式首版建议每段文案不超过 120 字。长文案后续应做分段生成，再合并成片。

### PUBLIC_BASE_URL

阿里云必须能访问数字人图片、基础视频和声音样本。`PUBLIC_BASE_URL` 用于把本地 `/uploads/...` 文件转换成公网 URL。

本地调试推荐：

- ngrok
- Cloudflare Tunnel
- 部署到有公网域名的服务器

不要把 `PUBLIC_BASE_URL` 配成 `localhost`、`127.0.0.1` 或内网地址。

### VideoRetalk 流程

VideoRetalk 模式需要数字人上传基础视频。

建议基础视频：

- 10-30 秒
- mp4/webm/mov
- 正脸或接近正脸
- 光线清楚
- 嘴部无遮挡
- 人物动作自然，避免大幅侧脸和频繁遮挡

生成链路：

```text
文案 -> TTS 音频 -> VideoRetalk 口型替换 -> 下载结果 -> FFmpeg 标准化 1080x1920 -> 作品管理
```

### s2v 流程

如果要使用单图驱动，可设置：

```bash
ALIYUN_VIDEO_MODE="s2v"
ALIYUN_VIDEO_MODEL="wan2.2-s2v"
ALIYUN_VIDEO_RESOLUTION="480P"
```

生成链路：

```text
文案 -> TTS 音频 -> 图片检测 -> wan2.2-s2v -> 下载结果 -> FFmpeg 标准化 1080x1920 -> 作品管理
```

## 10-20 秒测试文案

```text
大家好，我是你的 AI 数字人助手。今天给大家演示一下，如何用这个系统一键生成数字人口播视频。
```

## 常见失败原因

- API Key 未配置：检查 `ALIYUN_DASHSCOPE_API_KEY` 或 `DASHSCOPE_API_KEY`。
- 文件不是公网 URL：检查 `PUBLIC_BASE_URL`，并确认 `/uploads/...` 通过公网可访问。
- 文案过长：阿里真实模式首版限制 120 字以内，避免音频超过 20 秒。
- 音频超过 20 秒：缩短文案，或后续使用分段生成。
- 图片检测不通过：换正脸清晰、无遮挡、光线均匀的人像。
- VideoRetalk 缺基础视频：给数字人上传 10-30 秒基础视频。
- FFmpeg 不可用：确认本机或服务器已安装 FFmpeg，标准化输出依赖它。

## 构建与预览

```bash
npm run build
npm run preview
```
