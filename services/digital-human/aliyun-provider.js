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

const DEFAULT_VOICE_CLONE_MODEL = 'voice-enrollment';
const DEFAULT_COSYVOICE_CLONE_TARGET_MODEL = 'cosyvoice-v3.5-flash';
const DEFAULT_QWEN_CLONE_TARGET_MODEL = 'qwen3-tts-vc-realtime-2026-01-15';

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

  async cloneVoice({ voice }) {
    const sampleUrl = toPublicUrl(voice.sampleUrl);
    const cloneModel = process.env.ALIYUN_VOICE_CLONE_MODEL || DEFAULT_VOICE_CLONE_MODEL;
    const targetModel = process.env.ALIYUN_VOICE_CLONE_TARGET_MODEL || defaultCloneTargetModel(cloneModel);
    const payload = buildVoiceClonePayload({ voice, sampleUrl, cloneModel, targetModel });
    const response = await this.request('/services/audio/tts/customization', {
      method: 'POST',
      json: payload,
    });
    const providerVoiceId = findProviderVoiceId(response);
    if (!providerVoiceId) {
      throw new Error(`阿里声音复刻已返回，但没有找到 voice_id：${safeStringify(response).slice(0, 260)}`);
    }

    return {
      provider: 'aliyun',
      providerVoiceId,
      providerModel: targetModel,
      providerStatus: response.output?.status || response.output?.finish_reason || response.output?.task_status || 'VOICE_READY',
      providerPayload: response,
      status: 'ready',
    };
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

    const result = await this.fetchVideoStatus(taskId);
    const status = result.output?.task_status || result.task_status || result.status;
    if (!['SUCCEEDED', 'SUCCESS', 'succeeded'].includes(status)) {
      if (['FAILED', 'CANCELED', 'UNKNOWN', 'failed', 'canceled'].includes(status)) {
        throw new Error(aliyunErrorMessage(result, `阿里视频任务失败：${status}`));
      }
      const pendingArtifact = {
        providerTaskId: taskId,
        providerStatus: status || 'RUNNING',
        providerPayload: result,
      };
      this.mergeArtifact(job.id, pendingArtifact);
      return pendingArtifact;
    }

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

  async fetchVideoStatus(taskId) {
    return this.request(`/tasks/${encodeURIComponent(taskId)}`);
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
  const clonedVoiceId = job.voice?.providerVoiceId;
  const model = clonedVoiceId
    ? (job.voice.providerModel || process.env.ALIYUN_VOICE_CLONE_TARGET_MODEL || defaultCloneTargetModel(process.env.ALIYUN_VOICE_CLONE_MODEL || DEFAULT_VOICE_CLONE_MODEL))
    : (process.env.ALIYUN_TTS_MODEL || 'qwen3-tts-flash');
  const voice = clonedVoiceId || process.env.ALIYUN_TTS_VOICE || selectVoice(job.voice, model);
  const input = {
    text: String(job.script || '').trim(),
    voice,
  };

  if (model.startsWith('cosyvoice')) {
    input.format = process.env.ALIYUN_TTS_FORMAT || 'mp3';
    input.sample_rate = Number(process.env.ALIYUN_TTS_SAMPLE_RATE || 24000);
  } else if (!clonedVoiceId) {
    input.language_type = process.env.ALIYUN_TTS_LANGUAGE || 'Chinese';
  }

  return {
    model,
    input,
  };
}

function buildVoiceClonePayload({ voice, sampleUrl, cloneModel, targetModel }) {
  if (cloneModel === 'voice-enrollment') {
    return {
      model: cloneModel,
      input: {
        action: 'create_voice',
        target_model: targetModel,
        prefix: makeCosyVoicePrefix(voice.name || voice.id),
        url: sampleUrl,
        language_hints: [languageCode(voice.language)],
        enable_preprocess: process.env.ALIYUN_VOICE_CLONE_PREPROCESS === 'true',
        max_prompt_audio_length: Number(process.env.ALIYUN_VOICE_CLONE_MAX_SECONDS || 20),
      },
    };
  }

  return {
    model: cloneModel,
    input: {
      action: 'create',
      target_model: targetModel,
      preferred_name: makePreferredVoiceName(voice.name || voice.id),
      audio: {
        data: sampleUrl,
      },
      language: languageCode(voice.language),
    },
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

function makePreferredVoiceName(value) {
  const ascii = String(value || 'voice')
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 18);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${ascii || 'voice'}_${suffix}`.slice(0, 16);
}

function makeCosyVoicePrefix(value) {
  const ascii = String(value || 'voice')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/gi, '')
    .slice(0, 4);
  const suffix = Math.random().toString(36).replace(/[^a-z0-9]+/gi, '').slice(2, 8);
  return `${ascii || 'v'}${suffix}`.slice(0, 10);
}

function languageCode(value) {
  const language = String(value || '').toLowerCase();
  if (language.includes('en') || language.includes('英')) return 'en';
  if (language.includes('ja') || language.includes('日')) return 'ja';
  if (language.includes('ko') || language.includes('韩')) return 'ko';
  if (language.includes('fr') || language.includes('法')) return 'fr';
  if (language.includes('de') || language.includes('德')) return 'de';
  if (language.includes('ru') || language.includes('俄')) return 'ru';
  return 'zh';
}

function defaultCloneTargetModel(cloneModel) {
  return cloneModel === 'qwen-voice-enrollment'
    ? DEFAULT_QWEN_CLONE_TARGET_MODEL
    : DEFAULT_COSYVOICE_CLONE_TARGET_MODEL;
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

function findProviderVoiceId(response) {
  return response.output?.voice
    || response.output?.voice_id
    || response.output?.voiceId
    || response.voice
    || response.voice_id
    || findStringByKey(response, ['voice', 'voice_id', 'voiceId']);
}

function findStringByKey(value, keys) {
  const stack = [value];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    for (const [key, nested] of Object.entries(current)) {
      if (keys.includes(key) && typeof nested === 'string') return nested;
      if (nested && typeof nested === 'object') stack.push(nested);
    }
  }
  return '';
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
