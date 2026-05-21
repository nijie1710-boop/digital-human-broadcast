import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DigitalHumanProvider, estimateDuration } from './provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const projectDir = path.join(rootDir, 'public/uploads/projects');

export class HeyGenProvider extends DigitalHumanProvider {
  constructor() {
    super();
    this.apiBase = String(process.env.HEYGEN_API_BASE || 'https://api.heygen.com').replace(/\/+$/, '');
  }

  async composeVideo({ job }) {
    if (!job.providerTaskId) {
      const created = await this.createVideo(job);
      return {
        providerTaskId: created.videoId,
        providerStatus: created.status || 'processing',
        providerPayload: created.payload,
      };
    }

    const polled = await this.pollVideo(job.providerTaskId);
    if (isFailedStatus(polled.status)) {
      throw new Error(heygenErrorMessage(polled.payload, polled.status));
    }

    if (!isCompletedStatus(polled.status)) {
      return {
        providerTaskId: job.providerTaskId,
        providerStatus: polled.status || 'processing',
        providerPayload: polled.payload,
      };
    }

    if (!polled.videoUrl) {
      throw new Error(`HeyGen 视频已完成，但响应中没有 video_url：${safeStringify(polled.payload).slice(0, 260)}`);
    }

    const localVideoUrl = await this.downloadVideo(polled.videoUrl, job.id);
    return {
      providerTaskId: job.providerTaskId,
      providerStatus: polled.status || 'completed',
      providerPayload: polled.payload,
      videoUrl: localVideoUrl,
      coverUrl: polled.thumbnailUrl || job.avatar?.previewImage || '',
      duration: durationToText(polled.duration) || job.duration || estimateDuration(job.script),
    };
  }

  async createVideo(job) {
    const avatarId = job.avatar?.providerAvatarId || process.env.HEYGEN_DEFAULT_AVATAR_ID;
    const voiceId = job.voice?.providerVoiceId || process.env.HEYGEN_DEFAULT_VOICE_ID;
    if (!avatarId) {
      throw new Error('HeyGen 生成需要 providerAvatarId，或配置 HEYGEN_DEFAULT_AVATAR_ID');
    }
    if (!voiceId) {
      throw new Error('HeyGen 生成需要 providerVoiceId，或配置 HEYGEN_DEFAULT_VOICE_ID');
    }

    const payload = {
      type: 'avatar',
      avatar_id: avatarId,
      title: job.title || '数字人口播视频',
      aspect_ratio: process.env.HEYGEN_DEFAULT_ASPECT_RATIO || '9:16',
      resolution: process.env.HEYGEN_DEFAULT_RESOLUTION || '1080p',
      output_format: 'mp4',
      script: job.script,
      voice_id: voiceId,
    };

    const response = await this.request('/v3/videos', {
      method: 'POST',
      json: payload,
    });
    const videoId = findValue(response, ['video_id', 'videoId', 'id']);
    if (!videoId) {
      throw new Error(`HeyGen 创建视频失败：响应缺少 video_id：${safeStringify(response).slice(0, 260)}`);
    }

    return {
      videoId,
      status: normalizeStatus(findValue(response, ['status', 'video_status']) || 'processing'),
      payload: response,
    };
  }

  async pollVideo(videoId) {
    const response = await this.request(`/v3/videos/${encodeURIComponent(videoId)}`);
    const payload = response.data || response;
    return {
      status: normalizeStatus(findValue(payload, ['status', 'video_status', 'state'])),
      videoUrl: findValue(payload, ['video_url', 'videoUrl', 'url', 'download_url']),
      thumbnailUrl: findValue(payload, ['thumbnail_url', 'thumbnailUrl', 'cover_url', 'coverUrl']),
      duration: findValue(payload, ['duration', 'duration_seconds', 'durationSeconds']),
      payload: response,
    };
  }

  async downloadVideo(videoUrl, jobId) {
    await fsp.mkdir(projectDir, { recursive: true });
    const outputPath = path.join(projectDir, `${jobId}.mp4`);
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`下载 HeyGen 视频失败：HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      throw new Error('下载 HeyGen 视频失败：返回内容为空');
    }
    await fsp.writeFile(outputPath, buffer);
    return `/uploads/projects/${jobId}.mp4`;
  }

  async request(endpoint, { method = 'GET', json } = {}) {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      throw new Error('请先配置 HEYGEN_API_KEY。');
    }

    const headers = {
      'x-api-key': apiKey,
    };
    const options = { method, headers };
    if (json) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(json);
    }

    const response = await fetch(`${this.apiBase}${endpoint}`, options);
    const text = await response.text();
    const data = text ? parseJson(text) : {};
    if (!response.ok) {
      throw new Error(`HeyGen 接口错误：${extractError(data) || text || `HTTP ${response.status}`}`);
    }
    return data;
  }
}

function findValue(value, keys) {
  const queue = [value];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    for (const key of keys) {
      if (current[key] !== undefined && current[key] !== null && current[key] !== '') {
        return current[key];
      }
    }
    for (const next of Object.values(current)) {
      if (next && typeof next === 'object') queue.push(next);
    }
  }
  return '';
}

function normalizeStatus(status) {
  const value = String(status || 'processing').toLowerCase();
  if (['success', 'succeeded', 'done'].includes(value)) return 'completed';
  if (['queued', 'waiting', 'pending', 'rendering', 'in_progress'].includes(value)) return 'processing';
  return value;
}

function isCompletedStatus(status) {
  return ['completed', 'complete', 'success', 'succeeded', 'done'].includes(String(status || '').toLowerCase());
}

function isFailedStatus(status) {
  return ['failed', 'error', 'rejected', 'cancelled', 'canceled'].includes(String(status || '').toLowerCase());
}

function heygenErrorMessage(payload, status) {
  return `HeyGen 生成失败：${extractError(payload) || status || '未知错误'}`;
}

function extractError(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  return findValue(payload, ['message', 'error', 'error_msg', 'errorMessage', 'detail', 'description']);
}

function durationToText(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) return value;
  const seconds = Number.parseFloat(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const rounded = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
