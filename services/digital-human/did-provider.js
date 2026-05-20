import { execFile as execFileCallback } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Blob } from 'node:buffer';

import { DigitalHumanProvider, estimateDuration } from './provider.js';

const execFile = promisify(execFileCallback);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const publicDir = path.join(rootDir, 'public');
const cacheDir = path.join(publicDir, 'uploads/cache');
const projectDir = path.join(publicDir, 'uploads/projects');
const apiBase = process.env.D_ID_API_BASE_URL || 'https://api.d-id.com';

const DEFAULT_VOICES = {
  女性: 'zh-CN-XiaoxiaoNeural',
  男性: 'zh-CN-YunxiNeural',
  中性: 'zh-CN-XiaoxiaoNeural',
};

export class DIDProvider extends DigitalHumanProvider {
  async synthesizeSpeech({ job }) {
    return {
      audioUrl: 'did://managed-tts',
      duration: estimateDuration(job.script),
    };
  }

  async animateAvatar({ job }) {
    return {
      animationUrl: `did://talk/${job.id}`,
    };
  }

  async transcribeSubtitle({ job }) {
    return {
      subtitleUrl: `did://subtitle/${job.id}`,
    };
  }

  async composeVideo({ job }) {
    const sourceUrl = await this.resolveSourceUrl(job);
    const talk = await this.createTalk(job, sourceUrl);
    const done = await this.waitForTalk(talk.id);

    if (!done.result_url) {
      throw new Error('D-ID 生成完成但没有返回 result_url');
    }

    await ensureDir(projectDir);
    const rawPath = path.join(projectDir, `${job.id}-did-raw.mp4`);
    const outputPath = path.join(projectDir, `${job.id}.mp4`);
    await downloadToFile(done.result_url, rawPath);
    await normalizeVerticalVideo(rawPath, outputPath);
    await safeUnlink(rawPath);

    const durationSeconds = await readMediaSeconds(outputPath);
    return {
      videoUrl: `/uploads/projects/${job.id}.mp4`,
      coverUrl: job.avatar?.previewImage || job.coverUrl || '',
      duration: secondsToDuration(durationSeconds) || job.duration || estimateDuration(job.script),
      providerJobId: talk.id,
    };
  }

  async resolveSourceUrl(job) {
    const imageUrl = job.avatar?.sourceImage || job.avatar?.previewImage || job.coverUrl;
    if (!imageUrl) throw new Error('D-ID 生成需要数字人形象图');

    if (/^https?:\/\//i.test(imageUrl)) {
      return imageUrl;
    }

    const imagePath = resolvePublicPath(imageUrl);
    if (!imagePath || !fs.existsSync(imagePath)) {
      throw new Error('D-ID 生成找不到本地数字人形象图');
    }

    const uploadPath = await ensureDidSupportedImage(imagePath);
    const uploaded = await this.uploadImage(uploadPath);
    const sourceUrl = uploaded.url || uploaded.source_url || uploaded.image_url || uploaded.result_url;
    if (!sourceUrl) {
      throw new Error(`D-ID 图片上传成功但响应缺少 URL：${JSON.stringify(uploaded).slice(0, 180)}`);
    }
    return sourceUrl;
  }

  async uploadImage(filePath) {
    const buffer = await fsp.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    const form = new FormData();
    const filename = `${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}${ext === '.png' ? '.png' : '.jpg'}`;
    form.append('image', new Blob([buffer], { type: mimeType }), filename);
    return this.request('/images', { method: 'POST', body: form });
  }

  async createTalk(job, sourceUrl) {
    const body = {
      source_url: sourceUrl,
      script: buildTextScript(job),
      name: job.title || `job-${job.id}`,
      user_data: job.id,
      config: {
        result_format: 'mp4',
        stitch: true,
      },
    };
    const created = await this.request('/talks', { method: 'POST', json: body });
    if (!created.id) {
      throw new Error(`D-ID 创建视频失败：响应缺少 talk id`);
    }
    return created;
  }

  async waitForTalk(id) {
    const timeoutMs = Number(process.env.D_ID_TIMEOUT_MS || 180000);
    const intervalMs = Number(process.env.D_ID_POLL_INTERVAL_MS || 5000);
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      await sleep(intervalMs);
      const talk = await this.request(`/talks/${encodeURIComponent(id)}`);
      if (talk.status === 'done') return talk;
      if (['error', 'rejected'].includes(talk.status)) {
        throw new Error(`D-ID 生成失败：${talk.error?.description || talk.error?.message || talk.status}`);
      }
    }

    throw new Error('D-ID 生成超时，请稍后重试或检查 D-ID 控制台');
  }

  async request(endpoint, { method = 'GET', json, body } = {}) {
    const headers = {
      Authorization: authHeader(),
    };
    const options = { method, headers };
    if (json) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(json);
    } else if (body) {
      options.body = body;
    }

    const response = await fetch(`${apiBase}${endpoint}`, options);
    const text = await response.text();
    const data = text ? parseJson(text) : {};
    if (!response.ok) {
      const message = data.description || data.message || data.error || text || `HTTP ${response.status}`;
      throw new Error(`D-ID 接口错误：${message}`);
    }
    return data;
  }
}

function authHeader() {
  const key = process.env.D_ID_API_KEY || process.env.DID_API_KEY;
  if (!key) {
    throw new Error('真实数字人口播需要配置 D_ID_API_KEY，并设置 DIGITAL_HUMAN_PROVIDER=did');
  }
  return key.toLowerCase().startsWith('basic ') ? key : `Basic ${key}`;
}

function buildTextScript(job) {
  const script = {
    type: 'text',
    input: String(job.script || '').trim(),
  };
  const voiceId = process.env.D_ID_VOICE_ID || DEFAULT_VOICES[job.voice?.gender] || DEFAULT_VOICES[job.voice?.gender?.trim()];
  if (voiceId && process.env.D_ID_DISABLE_VOICE_PROVIDER !== 'true') {
    script.provider = {
      type: process.env.D_ID_VOICE_PROVIDER || 'microsoft',
      voice_id: voiceId,
    };
  }
  return script;
}

function resolvePublicPath(url) {
  if (!url?.startsWith('/')) return '';
  const localPath = path.resolve(publicDir, url.replace(/^\/+/, ''));
  return localPath.startsWith(publicDir) ? localPath : '';
}

async function ensureDidSupportedImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.jpg', '.jpeg', '.png'].includes(ext)) return filePath;

  await ensureDir(cacheDir);
  const outputPath = path.join(cacheDir, `${crypto.createHash('sha1').update(filePath).digest('hex')}.png`);
  if (fs.existsSync(outputPath)) return outputPath;
  await execFile('ffmpeg', ['-y', '-i', filePath, outputPath], { timeout: 60000 });
  return outputPath;
}

async function normalizeVerticalVideo(inputPath, outputPath) {
  try {
    await execFile('ffmpeg', [
      '-y',
      '-i', inputPath,
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ], { timeout: 180000 });
  } catch {
    await fsp.copyFile(inputPath, outputPath);
  }
}

async function downloadToFile(url, filePath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`下载 D-ID 视频失败：HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.writeFile(filePath, buffer);
}

async function readMediaSeconds(filePath) {
  try {
    const { stdout } = await execFile('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const seconds = Number.parseFloat(stdout);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  } catch {
    return 0;
  }
  return 0;
}

function secondsToDuration(seconds) {
  if (!seconds) return '';
  const rounded = Math.max(1, Math.round(Number(seconds) || 1));
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function safeUnlink(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
