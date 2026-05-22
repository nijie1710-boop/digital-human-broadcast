# 数字人口播 Web

React + Tailwind CSS + Express + Prisma SQLite 实现的数字人口播 MVP，包含工作台、视频生成、数字人形象与声音库、任务中心、作品管理和模板中心。

当前支持四类生成链路：

- `mock`：本地离线流程，适合开发和 UI 验收，不消耗模型费用。
- `aliyun + s2v`：阿里百炼 Qwen-TTS/CosyVoice + `wan2.2-s2v`，单图驱动。
- `aliyun + videoretalk`：阿里百炼 TTS + VideoRetalk，使用基础视频做口型替换，通常比单图驱动更自然。
- `heygen`：HeyGen 官方 API，直接生成高质量数字人口播视频。

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

## HeyGen 真实模式

`.env` 示例：

```bash
DATABASE_URL="file:./dev.db"
PORT=5173
DIGITAL_HUMAN_PROVIDER="heygen"
HEYGEN_API_KEY="your-heygen-api-key"
HEYGEN_API_BASE="https://api.heygen.com"
HEYGEN_DEFAULT_AVATAR_ID="your-avatar-id"
HEYGEN_DEFAULT_VOICE_ID="your-voice-id"
HEYGEN_DEFAULT_RESOLUTION="1080p"
HEYGEN_DEFAULT_ASPECT_RATIO="9:16"
HEYGEN_PRICE_USD_PER_SECOND="0.05"
USD_TO_CNY_RATE="7.2"
HEYGEN_AVATAR_FIT="contain"
HEYGEN_EXPRESSIVENESS="medium"
HEYGEN_REMOVE_BACKGROUND="true"
HEYGEN_ENABLE_CAPTIONS="false"
HEYGEN_ENABLE_MOTION_PROMPT="false"
HEYGEN_MOTION_PROMPT=""
HEYGEN_BACKGROUND_IMAGE_URL=""
HEYGEN_BACKGROUND_LIVEROOM_URL=""
HEYGEN_BACKGROUND_STUDY_URL=""
HEYGEN_BACKGROUND_SHOWROOM_URL=""
HEYGEN_BACKGROUND_CLASSROOM_URL=""
HEYGEN_BACKGROUND_NEWSROOM_URL=""
HEYGEN_BACKGROUND_SOLID_URL=""
HEYGEN_REMOVE_BACKGROUND_NOISE="true"
```

真实 key 只放本地 `.env`，不要提交到 GitHub。

获取可用 `avatar_id` 和 `voice_id`：

```bash
npm run check:heygen
```

脚本会请求 HeyGen 的 avatars / voices 列表并打印可复制的 ID，不会打印 API Key。拿到 ID 后可以填到 `.env` 的 `HEYGEN_DEFAULT_AVATAR_ID` / `HEYGEN_DEFAULT_VOICE_ID`，也可以在「数字人形象」和「声音库」里分别填写 `providerAvatarId` / `providerVoiceId`。

也可以在页面的「数字人形象与声音库」点击「同步 HeyGen 资源」，系统会把 HeyGen 账号里的 Avatar 和 Voice 同步到本地 SQLite，后续可直接在工作台选择。

### HeyGen 克隆自己的声音

声音库点击「上传/克隆声音」，上传 `wav/mp3/m4a` 干净人声样本并勾选「进入声音克隆流程」。

建议样本：

- 30-120 秒
- 单人说话，无背景音乐
- 环境噪声低，嘴不要离麦克风太远
- 普通话样本的语言填「普通话」或「中文」

提交后系统会调用 `POST /v3/voices/clone` 创建 HeyGen 声音克隆任务，保存返回的 `voice_clone_id`，再由后台轮询 `GET /v3/voices/{voice_id}`。状态变成「可用」后，工作台选择这个声音生成视频时会使用你的克隆音色。克隆失败时，声音库会显示 HeyGen 返回的失败原因。

如果声音样本保存在本地 `/uploads/...`，必须配置公网可访问的 `PUBLIC_BASE_URL`，例如 ngrok 或 Cloudflare Tunnel 地址；HeyGen 无法访问 `localhost` 文件。

数字人生成规则：

- 选择带 `providerAvatarId` 的 HeyGen 数字人时，系统会调用 HeyGen 官方 Avatar。
- 选择没有 `providerAvatarId` 的本地上传数字人时，系统会走 HeyGen `image-to-video`，用上传的形象图生成口播。此时图片必须通过 `PUBLIC_BASE_URL` 公网可访问。
- 工作台里的「背景设置」会传给 HeyGen。选择「保留原图背景」时不传背景、不启用抠图；选择其他背景时会开启 `remove_background` 并传入场景背景图，如果账号或 Avatar 不支持抠像，HeyGen 会返回失败原因。
- 工作台支持上传自定义背景图，支持 `jpg/png/webp`，建议使用 1080x1920 竖图。上传后系统会把 `/uploads/backgrounds/...` 转成 `PUBLIC_BASE_URL` 公网 URL 并优先传给 HeyGen。
- HeyGen 结果如果出现固定轻微口型偏移，可以在工作台「口型同步校准」选择音频延后/提前。系统会在下载成片后用 FFmpeg 做本地音画校准，默认推荐音频延后 200ms。
- 可以用 `HEYGEN_BACKGROUND_LIVEROOM_URL`、`HEYGEN_BACKGROUND_STUDY_URL` 等变量覆盖每个背景选项。只配置 `HEYGEN_BACKGROUND_IMAGE_URL` 时，所有背景选项都会使用同一张公网背景图。
- HeyGen 模式下「字幕样式」和「片头片尾」当前不合成到最终视频里。页面会禁用这两项，任务保存为“暂未启用/无片头片尾”。后续要做成品级字幕和片头片尾，建议在 HeyGen 输出后增加本地 FFmpeg 后处理。

生成前页面会弹出 HeyGen 确认框，显示预计时长、预计费用、当前 Avatar/Voice、分辨率和画幅。费用只是按 `.env` 中的 `HEYGEN_PRICE_USD_PER_SECOND` 与 `USD_TO_CNY_RATE` 做的生成前估算，实际扣费以 HeyGen 后台为准。

生成链路：

```text
文案 -> HeyGen 创建视频任务 -> 等待渲染 -> 下载结果 -> 保存 /uploads/projects/*.mp4 -> 作品管理
```

测试文案：

```text
大家好，我是你的 AI 数字人助手。今天给大家演示一下，如何用这个系统一键生成数字人口播视频。
```

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
- mp4/webm
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
- HeyGen Key 未配置：检查 `HEYGEN_API_KEY`。
- HeyGen 缺 ID：检查 `HEYGEN_DEFAULT_AVATAR_ID` / `HEYGEN_DEFAULT_VOICE_ID`，或在库里填写 `providerAvatarId` / `providerVoiceId`。

## 构建与预览

```bash
npm run build
npm run preview
```
