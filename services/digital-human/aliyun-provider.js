import { DigitalHumanProvider, estimateDuration } from './provider.js';
import { toPublicUrl } from './public-url.js';

const REGION_ENDPOINTS = {
  beijing: 'https://dashscope.aliyuncs.com/api/v1',
  intl: 'https://dashscope-intl.aliyuncs.com/api/v1',
  singapore: 'https://dashscope-intl.aliyuncs.com/api/v1',
};

const DEFAULT_TTS_VOICES = {
  女性: 'Cherry',
  男性: 'Ethan',
  中性: 'Cherry',
};

const DEFAULT_COSYVOICE_VOICES = {
  女性: 'longxiaochun',
  男性: 'longcheng',
  中性: 'longxiaochun',
};

export class AliyunProvider extends DigitalHumanProvider {
  constructor() {
    super();
    this.artifacts = new Map();
    this.endpoint = REGION_ENDPOINTS[String(process.env.ALIYUN_MODEL_REGION || 'beijing').toLowerCase()] || REGION_ENDPOINTS.beijing;
  }

  async synthesizeSpeech({ job }) {
    const payload = buildTtsPayload(job);
    const response = await this.request(ttsEndpoint(payload.model), {
      method: 'POST',
      json: payload,
    });
    const audioUrl = findFirstUrl(response, ['audio', 'url']) || findUrlByExtension(response, ['.mp3', '.wav', '.m4a']);
    if (!audioUrl) {
      throw new Error(`阿里 TTS 已返回，但没有找到 audioUrl：${safeStringify(response).slice(0, 220)}`);
    }

    const artifact = {
      audioUrl,
      providerStatus: response.output?.task_status || response.output?.finish_reason || 'TTS_SUCCEEDED',
      providerPayload: response,
    };
    this.mergeArtifact(job.id, artifact);
    return artifact;
  }

  async validateAvatarImage({ job, imageUrl }) {
    const publicImageUrl = toPublicUrl(imageUrl || job.avatar?.sourceImage || job.avatar?.previewImage || job.coverUrl);
    const payload = {
      model: process.env.ALIYUN_DETECT_MODEL || 'wan2.2-s2v-detect',
      input: {
        image_url: publicImageUrl,
      },
    };
    const response = await this.request('/services/aigc/image2video/face-detect', {
      method: 'POST',
      json: payload,
    });

    if (!isDetectionPassed(response)) {
      throw new Error(detectionErrorMessage(response));
    }

    const artifact = {
      imageUrl: publicImageUrl,
      providerStatus: response.output?.check_pass === true ? 'IMAGE_VALIDATED' : 'IMAGE_DETECTED',
      providerPayload: response,
    };
    this.mergeArtifact(job.id, artifact);
    return artifact;
  }

  async animateAvatar({ job, imageUrl, audioUrl }) {
    const artifact = this.artifacts.get(job.id) || {};
    const publicImageUrl = toPublicUrl(imageUrl || artifact.imageUrl || job.avatar?.sourceImage || job.avatar?.previewImage || job.coverUrl);
    const publicAudioUrl = toPublicUrl(audioUrl || artifact.audioUrl || job.audioUrl);
    const payload = {
      model: process.env.ALIYUN_VIDEO_MODEL || 'wan2.2-s2v',
      input: {
        image_url: publicImageUrl,
        audio_url: publicAudioUrl,
      },
      parameters: {
        resolution: process.env.ALIYUN_VIDEO_RESOLUTION || '480P',
      },
    };

    const response = await this.request('/services/aigc/image2video/video-synthesis', {
      method: 'POST',
      json: payload,
      asyncTask: true,
    });
    const taskId = response.output?.task_id || response.task_id || response.request_id;
    if (!taskId) {
      throw new Error(`阿里 wan2.2-s2v 已返回，但没有找到 taskId：${safeStringify(response).slice(0, 220)}`);
    }

    const nextArtifact = {
      imageUrl: publicImageUrl,
      audioUrl: publicAudioUrl,
      providerTaskId: taskId,
      providerStatus: response.output?.task_status || 'PENDING',
      providerPayload: response,
    };
    this.mergeArtifact(job.id, nextArtifact);
    return nextArtifact;
  }

  async composeVideo({ job }) {
    const artifact = this.artifacts.get(job.id) || {};
    const taskId = job.providerTaskId || artifact.providerTaskId;
    if (!taskId) {
      throw new Error('缺少阿里 wan2.2-s2v taskId，无法获取生成结果');
    }

    const result = await this.waitForVideo(taskId);
    const videoUrl = findVideoUrl(result);
    if (!videoUrl) {
      throw new Error(`阿里视频任务已完成，但没有找到 videoUrl：${safeStringify(result).slice(0, 220)}`);
    }

    const nextArtifact = {
      providerTaskId: taskId,
      providerStatus: result.output?.task_status || result.task_status || 'SUCCEEDED',
      providerPayload: result,
      videoUrl,
      duration: estimateDuration(job.script),
    };
    this.mergeArtifact(job.id, nextArtifact);
    return nextArtifact;
  }

  async waitForVideo(taskId) {
    const timeoutMs = Number(process.env.ALIYUN_TASK_TIMEOUT_MS || 10 * 60 * 1000);
    const intervalMs = Number(process.env.ALIYUN_TASK_POLL_INTERVAL_MS || 8000);
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      await sleep(intervalMs);
      const response = await this.request(`/tasks/${encodeURIComponent(taskId)}`);
      const status = response.output?.task_status || response.task_status || response.status;
      if (['SUCCEEDED', 'SUCCESS', 'succeeded'].includes(status)) {
        return response;
      }
      if (['FAILED', 'CANCELED', 'UNKNOWN', 'failed', 'canceled'].includes(status)) {
        throw new Error(aliyunErrorMessage(response, `阿里视频任务失败：${status}`));
      }
    }

    throw new Error('阿里视频生成超时，请稍后重试或检查百炼控制台任务状态');
  }

  async request(endpoint, { method = 'GET', json, asyncTask = false } = {}) {
    const apiKey = process.env.ALIYUN_DASHSCOPE_API_KEY || process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      throw new Error('未配置阿里 API Key，请设置 ALIYUN_DASHSCOPE_API_KEY');
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
    };
    const options = { method, headers };
    if (asyncTask) headers['X-DashScope-Async'] = 'enable';
    if (json) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(json);
    }

    const response = await fetch(`${this.endpoint}${endpoint}`, options);
    const text = await response.text();
    const data = text ? parseJson(text) : {};
    if (!response.ok) {
      throw new Error(aliyunErrorMessage(data, `阿里接口错误：HTTP ${response.status}`));
    }
    return data;
  }

  mergeArtifact(jobId, value) {
    this.artifacts.set(jobId, {
      ...(this.artifacts.get(jobId) || {}),
      ...value,
    });
  }
}

function buildTtsPayload(job) {
  const model = process.env.ALIYUN_TTS_MODEL || 'qwen3-tts-flash';
  const voice = process.env.ALIYUN_TTS_VOICE || selectVoice(job.voice, model);
  const input = {
    text: String(job.script || '').trim(),
    voice,
  };

  if (model.startsWith('cosyvoice')) {
    input.format = process.env.ALIYUN_TTS_FORMAT || 'mp3';
    input.sample_rate = Number(process.env.ALIYUN_TTS_SAMPLE_RATE || 24000);
  } else {
    input.language_type = process.env.ALIYUN_TTS_LANGUAGE || 'Chinese';
  }

  return {
    model,
    input,
  };
}

function ttsEndpoint(model) {
  if (model.startsWith('cosyvoice')) {
    return '/services/audio/tts/SpeechSynthesizer';
  }
  return '/services/aigc/multimodal-generation/generation';
}

function selectVoice(voice, model) {
  const map = model.startsWith('cosyvoice') ? DEFAULT_COSYVOICE_VOICES : DEFAULT_TTS_VOICES;
  return map[voice?.gender] || map[voice?.gender?.trim()] || map.女性;
}

function isDetectionPassed(response) {
  if (response.output?.check_pass === true) return true;
  if (response.output?.pass === true) return true;
  if (response.output?.face_valid === true) return true;
  const status = response.output?.task_status || response.status;
  return ['SUCCEEDED', 'SUCCESS'].includes(status);
}

function detectionErrorMessage(response) {
  return aliyunErrorMessage(response, '数字人图片未通过 wan2.2-s2v-detect 检测，请换一张正脸清晰的人像图片');
}

function aliyunErrorMessage(response, fallback) {
  return response.message
    || response.code
    || response.output?.message
    || response.output?.error_message
    || response.output?.task_message
    || fallback;
}

function findVideoUrl(response) {
  return findFirstUrl(response, ['video', 'url'])
    || findFirstUrl(response, ['video_url'])
    || findUrlByExtension(response, ['.mp4', '.webm']);
}

function findFirstUrl(value, path) {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== 'object') return '';
    current = current[key];
  }
  return typeof current === 'string' && /^https?:\/\//i.test(current) ? current : '';
}

function findUrlByExtension(value, extensions) {
  const stack = [value];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    if (typeof current === 'string' && /^https?:\/\//i.test(current) && extensions.some((ext) => current.toLowerCase().includes(ext))) {
      return current;
    }
    if (Array.isArray(current)) {
      stack.push(...current);
    } else if (typeof current === 'object') {
      stack.push(...Object.values(current));
    }
  }
  return '';
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
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
