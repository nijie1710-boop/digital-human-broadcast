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
      voice_settings: buildVoiceSettings(job.voice),
    };
    const caption = buildCaptionSetting(job.subtitleStyle);
    if (caption) basePayload.caption = caption;

    const background = buildBackgroundSetting(job.backgroundConfig, job.backgroundImageUrl);
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

  async cloneVoice({ voice }) {
    const audioUrl = toPublicUrl(voice.sampleUrl);
    const payload = {
      audio: {
        type: 'url',
        url: audioUrl,
      },
      voice_name: voice.name || '我的克隆声音',
      remove_background_noise: process.env.HEYGEN_REMOVE_BACKGROUND_NOISE === 'false' ? false : true,
    };
    const language = heygenLanguageHint(voice.language);
    if (language) payload.language = language;

    const response = await this.request('/v3/voices/clone', {
      method: 'POST',
      json: payload,
    });
    const voiceCloneId = findValue(response, ['voice_clone_id', 'voiceCloneId', 'voice_id', 'voiceId', 'id']);
    if (!voiceCloneId) {
      throw new Error(`HeyGen 声音克隆提交失败：响应缺少 voice_clone_id：${safeStringify(response).slice(0, 260)}`);
    }

    return {
      provider: 'heygen',
      providerVoiceId: String(voiceCloneId),
      providerStatus: normalizeStatus(findValue(response, ['status', 'state']) || 'processing'),
      providerPayload: response,
      status: 'pending',
    };
  }

  async pollVoiceClone({ voice }) {
    const voiceId = voice.providerVoiceId;
    if (!voiceId) {
      throw new Error('HeyGen 声音克隆缺少 providerVoiceId，无法查询状态。');
    }

    const response = await this.request(`/v3/voices/${encodeURIComponent(voiceId)}`);
    const payload = response.data || response;
    const rawStatus = findValue(payload, ['status', 'state']) || 'processing';
    const status = normalizeResourceStatus(rawStatus);
    const normalized = normalizeVoiceResource({
      ...payload,
      voice_id: findValue(payload, ['voice_id', 'voiceId', 'id']) || voiceId,
    });

    return {
      provider: 'heygen',
      providerVoiceId: normalized.providerVoiceId || voiceId,
      providerStatus: String(rawStatus),
      providerPayload: response,
      providerError: status === 'failed' ? (extractError(payload) || findValue(payload, ['failure_message', 'failureMessage'])) : null,
      sampleUrl: normalized.sampleUrl || voice.sampleUrl,
      duration: normalized.duration || voice.duration,
      language: normalized.language && normalized.language !== 'Unknown' ? normalized.language : voice.language,
      gender: normalized.gender || voice.gender,
      status,
    };
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

function buildBackgroundSetting(backgroundConfig, backgroundImageUrl = '') {
  if (backgroundImageUrl) return { type: 'image', url: toPublicUrl(backgroundImageUrl) };
  const value = String(backgroundConfig || '').trim();
  const imageUrl = backgroundImageUrl(value);
  if (imageUrl) return { type: 'image', url: toPublicUrl(imageUrl) };

  const color = {
    简约直播间: '#f2eadc',
    书房背景: '#eadfce',
    企业展厅: '#eef2f7',
    课堂背景: '#e8f2ff',
    新闻演播厅: '#dbeafe',
    纯色背景: '#f8fafc',
  }[value];

  return color ? { type: 'color', value: color } : null;
}

function backgroundImageUrl(value) {
  const key = {
    简约直播间: 'HEYGEN_BACKGROUND_LIVEROOM_URL',
    书房背景: 'HEYGEN_BACKGROUND_STUDY_URL',
    企业展厅: 'HEYGEN_BACKGROUND_SHOWROOM_URL',
    课堂背景: 'HEYGEN_BACKGROUND_CLASSROOM_URL',
    新闻演播厅: 'HEYGEN_BACKGROUND_NEWSROOM_URL',
    纯色背景: 'HEYGEN_BACKGROUND_SOLID_URL',
  }[value];
  const configured = key ? process.env[key] : '';
  if (configured) return configured;
  if (process.env.HEYGEN_BACKGROUND_IMAGE_URL) return process.env.HEYGEN_BACKGROUND_IMAGE_URL;

  return {
    简约直播间: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1080&h=1920&q=85',
    书房背景: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1080&h=1920&q=85',
    企业展厅: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1080&h=1920&q=85',
    课堂背景: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1080&h=1920&q=85',
    新闻演播厅: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1080&h=1920&q=85',
  }[value] || '';
}

function buildCaptionSetting(subtitleStyle) {
  if (process.env.HEYGEN_ENABLE_CAPTIONS !== 'true') return null;
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

function heygenLanguageHint(language) {
  const value = String(language || '').toLowerCase();
  if (!value) return '';
  if (value.includes('普通话') || value.includes('中文') || value.includes('chinese') || value.includes('zh')) return 'zh';
  if (value.includes('english') || value.includes('英语') || value.includes('en')) return 'en';
  if (value.includes('japanese') || value.includes('日语') || value.includes('ja')) return 'ja';
  if (value.includes('korean') || value.includes('韩语') || value.includes('ko')) return 'ko';
  return '';
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
  if (['active', 'ready', 'success', 'completed', 'complete', 'available'].includes(status)) return 'ready';
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
  return findValue(payload, ['message', 'error', 'error_msg', 'errorMessage', 'detail', 'description', 'failure_message', 'failureMessage']);
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
