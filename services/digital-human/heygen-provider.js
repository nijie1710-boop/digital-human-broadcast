import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DigitalHumanProvider, estimateDuration } from './provider.js';
import { toPublicUrl } from './public-url.js';

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
    const avatarId = job.avatar?.providerAvatarId || '';
    const voiceId = job.voice?.providerVoiceId || process.env.HEYGEN_DEFAULT_VOICE_ID;
    if (!voiceId) {
      throw new Error('HeyGen 生成需要 providerVoiceId，或配置 HEYGEN_DEFAULT_VOICE_ID');
    }

    const basePayload = {
      title: job.title || '数字人口播视频',
      aspect_ratio: process.env.HEYGEN_DEFAULT_ASPECT_RATIO || '9:16',
      resolution: process.env.HEYGEN_DEFAULT_RESOLUTION || '1080p',
      output_format: 'mp4',
      script: job.script,
      voice_id: voiceId,
      fit: process.env.HEYGEN_AVATAR_FIT || 'contain',
      caption: buildCaptionSetting(job.subtitleStyle),
      voice_settings: buildVoiceSettings(job.voice),
    };
    const background = buildBackgroundSetting(job.backgroundConfig);
    if (background) {
      basePayload.background = background;
      basePayload.remove_background = process.env.HEYGEN_REMOVE_BACKGROUND === 'false' ? false : true;
    }

    const imageMode = !avatarId;
    const payload = !imageMode
      ? {
          ...basePayload,
          type: 'avatar',
          avatar_id: avatarId,
        }
      : {
          ...basePayload,
          type: 'image',
          image: {
            type: 'url',
            url: toPublicUrl(job.avatar?.sourceImage || job.avatar?.previewImage || job.coverUrl),
          },
        };
    if (imageMode || process.env.HEYGEN_ENABLE_MOTION_PROMPT === 'true') {
      payload.motion_prompt = buildMotionPrompt(job);
      payload.expressiveness = process.env.HEYGEN_EXPRESSIVENESS || 'medium';
    }

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

  async listAvatars() {
    const response = await this.request('/v3/avatars');
    return extractItems(response, 'avatars')
      .map((item) => normalizeAvatarResource(item))
      .filter((item) => item.providerAvatarId);
  }

  async listVoices() {
    const response = await this.request('/v3/voices');
    return extractItems(response, 'voices')
      .map((item) => normalizeVoiceResource(item))
      .filter((item) => item.providerVoiceId);
  }

  async listResources() {
    const [avatars, voices] = await Promise.all([
      this.listAvatars(),
      this.listVoices(),
    ]);
    return { avatars, voices };
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

function buildBackgroundSetting(backgroundConfig) {
  const value = String(backgroundConfig || '').trim();
  const imageUrl = process.env.HEYGEN_BACKGROUND_IMAGE_URL;
  if (imageUrl && value !== '简约直播间') {
    return { type: 'image', url: toPublicUrl(imageUrl) };
  }

  const color = {
    书房背景: '#eadfce',
    企业展厅: '#eef2f7',
    课堂背景: '#e8f2ff',
    新闻演播厅: '#dbeafe',
    纯色背景: '#f8fafc',
  }[value];

  return color ? { type: 'color', value: color } : null;
}

function buildCaptionSetting(subtitleStyle) {
  const value = String(subtitleStyle || '').trim();
  if (!value || value === '无字幕') return null;
  return {
    file_format: 'srt',
    style: 'default',
  };
}

function buildVoiceSettings(voice) {
  const language = String(voice?.language || '').toLowerCase();
  const locale = language.includes('普通话') || language.includes('zh') || language.includes('中文') ? 'zh-CN' : null;
  return {
    speed: Number(process.env.HEYGEN_VOICE_SPEED || 1),
    pitch: Number(process.env.HEYGEN_VOICE_PITCH || 0),
    volume: Number(process.env.HEYGEN_VOICE_VOLUME || 1),
    ...(locale ? { locale } : {}),
  };
}

function buildMotionPrompt(job) {
  const style = String(job.avatar?.style || '').trim();
  const prompt = process.env.HEYGEN_MOTION_PROMPT || `Natural talking-head presenter gestures, steady eye contact, subtle head movement, confident ${style || 'business'} delivery.`;
  return prompt.slice(0, 500);
}

function extractItems(payload, type) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.[type])) return payload.data[type];
  if (Array.isArray(payload?.[type])) return payload[type];
  return [];
}

function normalizeAvatarResource(item) {
  const providerAvatarId = directValue(item, ['avatar_id', 'avatarId', 'id']);
  const name = directValue(item, ['name', 'avatar_name', 'avatarName']) || `HeyGen Avatar ${String(providerAvatarId).slice(0, 8)}`;
  const previewImage = findUrl(item, [
    'preview_image_url',
    'previewImageUrl',
    'image_url',
    'imageUrl',
    'thumbnail_url',
    'thumbnailUrl',
    'preview_url',
    'previewUrl',
    'photo_url',
    'photoUrl',
  ]);

  return {
    providerAvatarId: String(providerAvatarId || '').trim(),
    name: String(name || 'HeyGen Avatar').trim(),
    gender: normalizeGender(directValue(item, ['gender'])),
    style: directValue(item, ['style', 'type', 'category']) || 'HeyGen 数字人',
    previewImage,
    sourceImage: previewImage,
    status: normalizeResourceStatus(directValue(item, ['status', 'state']) || 'active'),
    raw: item,
  };
}

function normalizeVoiceResource(item) {
  const providerVoiceId = directValue(item, ['voice_id', 'voiceId', 'id']);
  const name = directValue(item, ['name', 'voice_name', 'voiceName']) || `HeyGen Voice ${String(providerVoiceId).slice(0, 8)}`;
  const sampleUrl = findUrl(item, [
    'preview_audio',
    'previewAudio',
    'preview_audio_url',
    'previewAudioUrl',
    'sample_url',
    'sampleUrl',
    'audio_url',
    'audioUrl',
    'url',
  ]);

  return {
    providerVoiceId: String(providerVoiceId || '').trim(),
    name: String(name || 'HeyGen Voice').trim(),
    gender: normalizeGender(directValue(item, ['gender'])),
    language: directValue(item, ['language', 'locale', 'lang']) || 'Unknown',
    style: directValue(item, ['style', 'type', 'category']) || 'HeyGen 声音',
    sampleUrl,
    duration: durationToText(directValue(item, ['duration', 'duration_seconds', 'durationSeconds'])) || '00:15',
    status: normalizeResourceStatus(directValue(item, ['status', 'state']) || 'ready'),
    raw: item,
  };
}

function directValue(item, keys) {
  if (!item || typeof item !== 'object') return '';
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') return item[key];
  }
  return '';
}

function findUrl(value, keys) {
  const direct = findValue(value, keys);
  if (typeof direct === 'string' && isUsableUrl(direct)) return direct;

  const queue = [value];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (typeof current === 'string' && isUsableUrl(current)) return current;
    if (typeof current !== 'object') continue;
    for (const next of Object.values(current)) queue.push(next);
  }
  return '';
}

function isUsableUrl(value) {
  return /^https?:\/\//i.test(value) || String(value || '').startsWith('/uploads/');
}

function normalizeGender(value) {
  const gender = String(value || '').toLowerCase();
  if (['female', 'woman', 'girl', 'f', '女性'].includes(gender)) return '女性';
  if (['male', 'man', 'boy', 'm', '男性'].includes(gender)) return '男性';
  return value ? String(value) : '中性';
}

function normalizeResourceStatus(value) {
  const status = String(value || '').toLowerCase();
  if (['active', 'ready', 'success', 'completed', 'available'].includes(status)) return 'ready';
  if (['failed', 'error', 'disabled'].includes(status)) return 'failed';
  if (['pending', 'processing', 'training'].includes(status)) return 'pending';
  return 'ready';
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
