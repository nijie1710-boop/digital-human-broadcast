import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { createDigitalHumanProvider } from '../services/digital-human/provider-factory.js';
import { JobRunner } from './jobs/job-runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 5173);
const isProduction = process.env.NODE_ENV === 'production';
const DEFAULT_USER_ID = 'default-user';
const ALIYUN_SCRIPT_LIMIT = 120;
const MOCK_SCRIPT_LIMIT = 3000;
const ALIYUN_SHORT_SCRIPT_MESSAGE = '阿里真实数字人模式下，首版建议每段文案不超过 120 字。长文案请后续使用分段生成。';
const VIDEORETALK_SHORT_SCRIPT_MESSAGE = 'VideoRetalk 首版建议每段文案不超过 120 字，长文案后续使用分段生成';

loadDotEnv();
ensureLocalFiles();

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
await ensureDefaultUser();

const rawProviderName = String(process.env.DIGITAL_HUMAN_PROVIDER || 'mock').toLowerCase();
const providerName = ['dashscope', 'bailian'].includes(rawProviderName)
  ? 'aliyun'
  : (rawProviderName === 'hey-gen' ? 'heygen' : rawProviderName);
const provider = createDigitalHumanProvider(providerName);
const jobRunner = new JobRunner({ prisma, provider, providerName });
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(rootDir, 'public/uploads')));
app.use('/samples', express.static(path.join(rootDir, 'public/samples')));

const uploadRules = {
  image: {
    folder: 'avatars',
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
    message: '数字人图片只允许上传 jpg/png/webp 文件',
  },
  sourceVideo: {
    folder: 'avatar-videos',
    extensions: ['.mp4', '.webm'],
    mimes: ['video/mp4', 'video/webm'],
    message: '数字人基础视频只允许上传 mp4/webm 文件',
  },
  sample: {
    folder: 'voices',
    extensions: ['.wav', '.mp3', '.m4a'],
    mimes: ['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a'],
    message: '声音样本只允许上传 wav/mp3/m4a 文件',
  },
  video: {
    folder: 'projects',
    extensions: ['.mp4', '.webm'],
    mimes: ['video/mp4', 'video/webm'],
    message: '作品视频只允许上传 mp4/webm 文件',
  },
};

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      const rule = uploadRules[file.fieldname];
      const uploadDir = path.join(rootDir, 'public/uploads', rule.folder);
      fs.mkdirSync(uploadDir, { recursive: true });
      callback(null, uploadDir);
    },
    filename(req, file, callback) {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      callback(null, safeName);
    },
  }),
  fileFilter(req, file, callback) {
    const rule = uploadRules[file.fieldname];
    if (!rule) {
      const error = new Error('不支持的上传字段');
      error.status = 400;
      callback(error);
      return;
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    if (!rule.extensions.includes(ext) || !rule.mimes.includes(mime)) {
      const error = new Error(rule.message);
      error.status = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: 80 * 1024 * 1024 },
});

function loadDotEnv() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^"|"$/g, '');
  }
}

function ensureLocalFiles() {
  for (const dir of ['public/uploads/avatars', 'public/uploads/avatar-videos', 'public/uploads/voices', 'public/uploads/projects', 'public/uploads/cache', 'public/samples', 'prisma']) {
    fs.mkdirSync(path.join(rootDir, dir), { recursive: true });
  }
  const dbPath = path.join(rootDir, 'prisma/dev.db');
  if (!fs.existsSync(dbPath)) fs.closeSync(fs.openSync(dbPath, 'w'));
}

async function ensureDefaultUser() {
  await prisma.user.upsert({
    where: { id: DEFAULT_USER_ID },
    update: {
      email: 'admin@example.com',
      name: '运营小助手',
      role: 'admin',
    },
    create: {
      id: DEFAULT_USER_ID,
      email: 'admin@example.com',
      name: '运营小助手',
      role: 'admin',
    },
  });
}

async function currentUserId(req) {
  const userId = String(req.headers['x-user-id'] || DEFAULT_USER_ID);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const error = new Error('用户不存在或无权访问');
    error.status = 401;
    throw error;
  }
  return user.id;
}

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function fileUrl(file) {
  if (!file) return '';
  const rel = path.relative(path.join(rootDir, 'public'), file.path).split(path.sep).join('/');
  return `/${rel}`;
}

function requireFields(body, fields) {
  const missing = fields.filter((field) => !String(body[field] || '').trim());
  if (missing.length) {
    const error = new Error(`缺少必填字段：${missing.join(', ')}`);
    error.status = 400;
    throw error;
  }
}

function parseBool(value) {
  return value === true || value === 'true' || value === '1';
}

function makeTitle(script) {
  const text = script.replace(/[，。！？\s]/g, '').slice(0, 18);
  return `${text || '新建'}口播视频`;
}

function scriptLimit() {
  return providerName === 'aliyun' ? ALIYUN_SCRIPT_LIMIT : MOCK_SCRIPT_LIMIT;
}

function aliyunVideoMode() {
  return String(process.env.ALIYUN_VIDEO_MODE || 's2v').toLowerCase();
}

function scriptLimitMessage() {
  if (providerName !== 'aliyun') return '文案不能超过 3000 字';
  return aliyunVideoMode() === 'videoretalk' ? VIDEORETALK_SHORT_SCRIPT_MESSAGE : ALIYUN_SHORT_SCRIPT_MESSAGE;
}

function devAllowedHosts() {
  const hosts = ['.trycloudflare.com', 'localhost', '127.0.0.1'];
  if (process.env.PUBLIC_BASE_URL) {
    try {
      hosts.push(new URL(process.env.PUBLIC_BASE_URL).hostname);
    } catch {
      // Invalid PUBLIC_BASE_URL is handled later by provider URL validation.
    }
  }
  return [...new Set(hosts)];
}

async function setDefault(model, id, userId) {
  const delegate = prisma[model];
  const existing = await delegate.findFirst({ where: { id, userId, NOT: { status: 'deleted' } } });
  if (!existing) return null;
  await delegate.updateMany({ where: { userId }, data: { isDefault: false } });
  return delegate.update({ where: { id }, data: { isDefault: true } });
}

function placeholderImage(name) {
  return `https://placehold.co/720x1280/eef2ff/2563eb?text=${encodeURIComponent(String(name || 'HeyGen').slice(0, 16))}`;
}

function numberEnv(key, fallback) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
}

function buildCostConfig() {
  const videoMode = aliyunVideoMode();
  const videoResolution = process.env.ALIYUN_VIDEO_RESOLUTION || '480P';
  const defaultVideoPrice = videoResolution.toUpperCase() === '720P' ? 0.9 : 0.5;

  if (providerName === 'heygen') {
    const usdToCny = numberEnv('USD_TO_CNY_RATE', 7.2);
    const usdPerSecond = numberEnv('HEYGEN_PRICE_USD_PER_SECOND', 0.05);
    return {
      enabled: true,
      currency: 'CNY',
      originalCurrency: 'USD',
      videoModel: 'HeyGen Avatar API',
      videoResolution: `${process.env.HEYGEN_DEFAULT_RESOLUTION || '1080p'} ${process.env.HEYGEN_DEFAULT_ASPECT_RATIO || '9:16'}`,
      videoUnitPricePerSecond: Number((usdPerSecond * usdToCny).toFixed(4)),
      detectUnitPricePerImage: 0,
      ttsModel: 'HeyGen Voice',
      ttsUnitPricePer10kCharacters: 0,
      note: `HeyGen 费用为生成前预估，按 ${usdPerSecond} USD/s、汇率 ${usdToCny} 估算；实际以 HeyGen 后台扣费为准。`,
    };
  }

  if (providerName === 'aliyun') {
    return {
      enabled: true,
      currency: 'CNY',
      videoModel: videoMode === 'videoretalk' ? (process.env.ALIYUN_VIDEORETALK_MODEL || 'videoretalk') : (process.env.ALIYUN_VIDEO_MODEL || 'wan2.2-s2v'),
      videoResolution,
      videoUnitPricePerSecond: Number(videoMode === 'videoretalk'
        ? (process.env.ALIYUN_VIDEORETALK_PRICE_CNY_PER_SECOND || 0.08)
        : (process.env.ALIYUN_VIDEO_PRICE_CNY_PER_SECOND || defaultVideoPrice)),
      detectUnitPricePerImage: Number(videoMode === 'videoretalk' ? 0 : (process.env.ALIYUN_DETECT_PRICE_CNY_PER_IMAGE || 0.004)),
      ttsModel: process.env.ALIYUN_TTS_MODEL || 'qwen3-tts-flash',
      ttsUnitPricePer10kCharacters: Number(process.env.ALIYUN_TTS_PRICE_CNY_PER_10K_CHARS || 0.8),
      note: '仅为生成前预估，实际费用以阿里云账单和最终视频时长为准，未扣除免费额度。',
    };
  }

  return {
    enabled: false,
    currency: 'CNY',
    videoModel: providerName,
    videoResolution: '',
    videoUnitPricePerSecond: 0,
    detectUnitPricePerImage: 0,
    ttsModel: providerName,
    ttsUnitPricePer10kCharacters: 0,
    note: '当前模式不会调用付费生成接口。',
  };
}

app.get('/api/health', (req, res) => {
  const videoMode = aliyunVideoMode();
  res.json({
    ok: true,
    provider: providerName,
    scriptLimit: scriptLimit(),
    scriptLimitMessage: scriptLimitMessage(),
    aliyun: {
      configured: Boolean(process.env.ALIYUN_DASHSCOPE_API_KEY || process.env.DASHSCOPE_API_KEY),
      publicBaseUrlConfigured: Boolean(process.env.PUBLIC_BASE_URL),
      region: process.env.ALIYUN_MODEL_REGION || 'beijing',
      videoMode,
    },
    heygen: {
      configured: Boolean(process.env.HEYGEN_API_KEY),
      apiBase: process.env.HEYGEN_API_BASE || 'https://api.heygen.com',
      defaultAvatarConfigured: Boolean(process.env.HEYGEN_DEFAULT_AVATAR_ID),
      defaultVoiceConfigured: Boolean(process.env.HEYGEN_DEFAULT_VOICE_ID),
      resolution: process.env.HEYGEN_DEFAULT_RESOLUTION || '1080p',
      aspectRatio: process.env.HEYGEN_DEFAULT_ASPECT_RATIO || '9:16',
    },
    cost: buildCostConfig(),
  });
});

app.get('/api/avatars', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  const avatars = await prisma.avatar.findMany({
    where: { userId, NOT: { status: 'deleted' } },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(avatars);
}));

app.post('/api/avatars', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'sourceVideo', maxCount: 1 }]), asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  requireFields(req.body, ['name', 'gender', 'style']);
  const imageUrl = fileUrl(req.files?.image?.[0]) || req.body.previewImage || req.body.sourceImage;
  const sourceVideo = fileUrl(req.files?.sourceVideo?.[0]) || req.body.sourceVideo || '';
  if (!imageUrl) return res.status(400).json({ error: '请上传数字人形象图' });
  if (parseBool(req.body.isDefault)) await prisma.avatar.updateMany({ where: { userId }, data: { isDefault: false } });

  const avatar = await prisma.avatar.create({
    data: {
      userId,
      name: req.body.name.trim(),
      gender: req.body.gender,
      style: req.body.style.trim(),
      previewImage: imageUrl,
      sourceImage: imageUrl,
      sourceVideo,
      provider: req.body.provider || (req.body.providerAvatarId ? 'heygen' : 'mock'),
      providerAvatarId: req.body.providerAvatarId?.trim() || null,
      status: req.body.status || 'active',
      isDefault: parseBool(req.body.isDefault),
    },
  });
  res.status(201).json(avatar);
}));

app.put('/api/avatars/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'sourceVideo', maxCount: 1 }]), asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  const existing = await prisma.avatar.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) return res.status(404).json({ error: '数字人不存在' });
  if (parseBool(req.body.isDefault)) await prisma.avatar.updateMany({ where: { userId }, data: { isDefault: false } });

  const imageUrl = fileUrl(req.files?.image?.[0]);
  const sourceVideo = fileUrl(req.files?.sourceVideo?.[0]);
  const avatar = await prisma.avatar.update({
    where: { id: req.params.id },
    data: {
      name: req.body.name?.trim() || existing.name,
      gender: req.body.gender || existing.gender,
      style: req.body.style?.trim() || existing.style,
      previewImage: imageUrl || existing.previewImage,
      sourceImage: imageUrl || existing.sourceImage,
      sourceVideo: sourceVideo || existing.sourceVideo,
      provider: req.body.provider || existing.provider,
      providerAvatarId: req.body.providerAvatarId !== undefined ? (req.body.providerAvatarId.trim() || null) : existing.providerAvatarId,
      status: req.body.status || existing.status,
      isDefault: parseBool(req.body.isDefault) || (existing.isDefault && req.body.isDefault === undefined),
    },
  });
  res.json(avatar);
}));

app.delete('/api/avatars/:id', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  const existing = await prisma.avatar.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) return res.status(404).json({ error: '数字人不存在' });
  const related = await prisma.generationJob.count({ where: { avatarId: req.params.id, userId } });
  const projectRelated = await prisma.project.count({ where: { avatarId: req.params.id, userId } });
  if (related || projectRelated) {
    await prisma.avatar.update({ where: { id: req.params.id }, data: { status: 'deleted', isDefault: false } });
  } else {
    await prisma.avatar.delete({ where: { id: req.params.id } });
  }
  res.json({ ok: true });
}));

app.post('/api/avatars/:id/default', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  const avatar = await setDefault('avatar', req.params.id, userId);
  if (!avatar) return res.status(404).json({ error: '数字人不存在' });
  res.json(avatar);
}));

app.get('/api/voices', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  const voices = await prisma.voice.findMany({
    where: { userId, NOT: { status: 'deleted' } },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(voices);
}));

app.post('/api/voices', upload.single('sample'), asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  requireFields(req.body, ['name', 'gender', 'language', 'style']);
  const providerVoiceId = req.body.providerVoiceId?.trim() || '';
  const sampleUrl = fileUrl(req.file) || req.body.sampleUrl || '';
  if (!sampleUrl && !providerVoiceId) return res.status(400).json({ error: '请上传声音样本文件或填写 providerVoiceId' });
  const shouldClone = parseBool(req.body.clone);
  if (shouldClone && req.file?.size > 10 * 1024 * 1024) {
    return res.status(400).json({ error: '声音克隆样本建议不超过 10MB，请上传 10-30 秒干净人声' });
  }
  if (parseBool(req.body.isDefault) && (providerVoiceId || !shouldClone)) {
    await prisma.voice.updateMany({ where: { userId }, data: { isDefault: false } });
  }

  let voice = await prisma.voice.create({
    data: {
      userId,
      name: req.body.name.trim(),
      gender: req.body.gender,
      language: req.body.language.trim(),
      style: req.body.style.trim(),
      sampleUrl,
      duration: req.body.duration || '00:15',
      provider: req.body.provider || (providerVoiceId ? providerName : (shouldClone ? providerName : 'mock')),
      providerVoiceId: providerVoiceId || null,
      status: providerVoiceId ? 'ready' : (shouldClone ? 'pending' : 'ready'),
      isDefault: (providerVoiceId || !shouldClone) && parseBool(req.body.isDefault),
    },
  });

  if (shouldClone && !providerVoiceId && providerName === 'aliyun') {
    try {
      const result = await provider.cloneVoice({ voice });
      const updates = {
        provider: result.provider || providerName,
        providerVoiceId: result.providerVoiceId,
        providerModel: result.providerModel,
        providerStatus: result.providerStatus,
        providerPayload: JSON.stringify(result.providerPayload || {}),
        providerError: null,
        status: 'ready',
      };
      if (parseBool(req.body.isDefault)) {
        await prisma.voice.updateMany({ where: { userId }, data: { isDefault: false } });
        updates.isDefault = true;
      }
      voice = await prisma.voice.update({
        where: { id: voice.id },
        data: updates,
      });
    } catch (error) {
      voice = await prisma.voice.update({
        where: { id: voice.id },
        data: {
          status: 'failed',
          provider: providerName,
          providerStatus: 'FAILED',
          providerError: error.message,
        },
      });
      return res.status(502).json({ error: `声音克隆失败：${error.message}`, voice });
    }
  }

  res.status(201).json(voice);
}));

app.put('/api/voices/:id', upload.single('sample'), asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  const existing = await prisma.voice.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) return res.status(404).json({ error: '声音不存在' });
  const providerVoiceId = req.body.providerVoiceId !== undefined ? (req.body.providerVoiceId.trim() || null) : existing.providerVoiceId;
  const sampleUrl = fileUrl(req.file) || req.body.sampleUrl || existing.sampleUrl;
  if (parseBool(req.body.isDefault)) await prisma.voice.updateMany({ where: { userId }, data: { isDefault: false } });

  const voice = await prisma.voice.update({
    where: { id: req.params.id },
    data: {
      name: req.body.name?.trim() || existing.name,
      gender: req.body.gender || existing.gender,
      language: req.body.language?.trim() || existing.language,
      style: req.body.style?.trim() || existing.style,
      sampleUrl,
      duration: req.body.duration || existing.duration,
      provider: req.body.provider || existing.provider,
      providerVoiceId,
      status: req.body.status || (providerVoiceId ? 'ready' : existing.status),
      isDefault: parseBool(req.body.isDefault) || (existing.isDefault && req.body.isDefault === undefined),
    },
  });
  res.json(voice);
}));

app.delete('/api/voices/:id', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  const existing = await prisma.voice.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) return res.status(404).json({ error: '声音不存在' });
  const related = await prisma.generationJob.count({ where: { voiceId: req.params.id, userId } });
  const projectRelated = await prisma.project.count({ where: { voiceId: req.params.id, userId } });
  if (related || projectRelated) {
    await prisma.voice.update({ where: { id: req.params.id }, data: { status: 'deleted', isDefault: false } });
  } else {
    await prisma.voice.delete({ where: { id: req.params.id } });
  }
  res.json({ ok: true });
}));

app.post('/api/voices/:id/default', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  const voice = await setDefault('voice', req.params.id, userId);
  if (!voice) return res.status(404).json({ error: '声音不存在' });
  res.json(voice);
}));

app.post('/api/heygen/sync', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  if (!process.env.HEYGEN_API_KEY) {
    return res.status(400).json({ error: '请先配置 HEYGEN_API_KEY。' });
  }
  if (typeof provider.listResources !== 'function') {
    return res.status(400).json({ error: '当前 provider 不是 HeyGen，请先设置 DIGITAL_HUMAN_PROVIDER=heygen 后重启服务。' });
  }

  const resources = await provider.listResources();
  let avatarsImported = 0;
  let voicesImported = 0;

  const hasDefaultAvatar = await prisma.avatar.count({ where: { userId, isDefault: true, NOT: { status: 'deleted' } } });
  const hasDefaultVoice = await prisma.voice.count({ where: { userId, isDefault: true, NOT: { status: 'deleted' } } });
  let assignedDefaultAvatar = Boolean(hasDefaultAvatar);
  let assignedDefaultVoice = Boolean(hasDefaultVoice);

  for (const resource of resources.avatars || []) {
    if (!resource.providerAvatarId) continue;
    const previewImage = resource.previewImage || placeholderImage(resource.name);
    const data = {
      name: resource.name || 'HeyGen Avatar',
      gender: resource.gender || '中性',
      style: resource.style || 'HeyGen 数字人',
      previewImage,
      sourceImage: resource.sourceImage || previewImage,
      provider: 'heygen',
      providerAvatarId: resource.providerAvatarId,
      status: resource.status === 'failed' ? 'failed' : 'active',
    };
    const existing = await prisma.avatar.findFirst({
      where: { userId, provider: 'heygen', providerAvatarId: resource.providerAvatarId },
    });
    if (existing) {
      await prisma.avatar.update({ where: { id: existing.id }, data });
    } else {
      await prisma.avatar.create({
        data: {
          userId,
          ...data,
          isDefault: !assignedDefaultAvatar,
        },
      });
      assignedDefaultAvatar = true;
    }
    avatarsImported += 1;
  }

  for (const resource of resources.voices || []) {
    if (!resource.providerVoiceId) continue;
    const data = {
      name: resource.name || 'HeyGen Voice',
      gender: resource.gender || '中性',
      language: resource.language || 'Unknown',
      style: resource.style || 'HeyGen 声音',
      sampleUrl: resource.sampleUrl || '',
      duration: resource.duration || '00:15',
      provider: 'heygen',
      providerVoiceId: resource.providerVoiceId,
      providerStatus: resource.status || 'ready',
      providerPayload: JSON.stringify(resource.raw || {}),
      providerError: null,
      status: resource.status === 'failed' ? 'failed' : 'ready',
    };
    const existing = await prisma.voice.findFirst({
      where: { userId, provider: 'heygen', providerVoiceId: resource.providerVoiceId },
    });
    if (existing) {
      await prisma.voice.update({ where: { id: existing.id }, data });
    } else {
      await prisma.voice.create({
        data: {
          userId,
          ...data,
          isDefault: !assignedDefaultVoice,
        },
      });
      assignedDefaultVoice = true;
    }
    voicesImported += 1;
  }

  const [avatars, voices] = await Promise.all([
    prisma.avatar.findMany({ where: { userId, provider: 'heygen', NOT: { status: 'deleted' } }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }),
    prisma.voice.findMany({ where: { userId, provider: 'heygen', NOT: { status: 'deleted' } }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }),
  ]);

  res.json({ avatarsImported, voicesImported, avatars, voices });
}));

app.get('/api/templates', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  const where = { userId };
  if (req.query.category) where.category = String(req.query.category);
  const templates = await prisma.template.findMany({ where, orderBy: { createdAt: 'asc' } });
  res.json(templates);
}));

app.post('/api/templates', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  requireFields(req.body, ['name', 'category', 'scriptPrompt', 'subtitleStyle', 'backgroundConfig', 'introOutroConfig']);
  const template = await prisma.template.create({
    data: {
      userId,
      name: req.body.name.trim(),
      category: req.body.category,
      coverUrl: req.body.coverUrl || '',
      scriptPrompt: req.body.scriptPrompt,
      subtitleStyle: req.body.subtitleStyle,
      backgroundConfig: req.body.backgroundConfig,
      introOutroConfig: req.body.introOutroConfig,
    },
  });
  res.status(201).json(template);
}));

app.get('/api/jobs', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  const jobs = await prisma.generationJob.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { avatar: true, voice: true, project: true, logs: { orderBy: { createdAt: 'asc' } } },
  });
  res.json(jobs);
}));

app.post('/api/jobs', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  requireFields(req.body, ['script', 'avatarId', 'voiceId']);
  const script = req.body.script.trim();
  if (script.length > scriptLimit()) {
    return res.status(400).json({
      error: scriptLimitMessage(),
    });
  }
  if (providerName === 'aliyun' && !(process.env.ALIYUN_DASHSCOPE_API_KEY || process.env.DASHSCOPE_API_KEY)) {
    return res.status(400).json({ error: '未配置阿里 API Key，请设置 ALIYUN_DASHSCOPE_API_KEY' });
  }
  if (providerName === 'heygen' && !process.env.HEYGEN_API_KEY) {
    return res.status(400).json({ error: '请先配置 HEYGEN_API_KEY。' });
  }

  const [avatar, voice] = await Promise.all([
    prisma.avatar.findFirst({ where: { id: req.body.avatarId, userId, NOT: { status: 'deleted' } } }),
    prisma.voice.findFirst({ where: { id: req.body.voiceId, userId, NOT: { status: 'deleted' } } }),
  ]);
  if (!avatar) return res.status(400).json({ error: '请选择有效数字人' });
  if (!voice) return res.status(400).json({ error: '请选择有效声音' });
  if (voice.status !== 'ready') return res.status(400).json({ error: '当前声音还在克隆处理中，请稍后再试' });
  if (providerName === 'aliyun' && aliyunVideoMode() === 'videoretalk' && !avatar.sourceVideo) {
    return res.status(400).json({ error: 'VideoRetalk 模式需要先给数字人上传基础视频' });
  }
  if (providerName === 'heygen' && !avatar.providerAvatarId && !process.env.HEYGEN_DEFAULT_AVATAR_ID) {
    return res.status(400).json({ error: 'HeyGen 生成需要给数字人填写 providerAvatarId，或配置 HEYGEN_DEFAULT_AVATAR_ID' });
  }
  if (providerName === 'heygen' && !voice.providerVoiceId && !process.env.HEYGEN_DEFAULT_VOICE_ID) {
    return res.status(400).json({ error: 'HeyGen 生成需要给声音填写 providerVoiceId，或配置 HEYGEN_DEFAULT_VOICE_ID' });
  }

  const job = await jobRunner.enqueueJob({
    userId,
    provider: providerName,
    title: req.body.title?.trim() || makeTitle(script),
    script,
    avatarId: avatar.id,
    voiceId: voice.id,
    subtitleStyle: req.body.subtitleStyle || '关键词高亮',
    backgroundConfig: req.body.backgroundConfig || '简约直播间',
    introOutroConfig: req.body.introOutroConfig || '无片头片尾',
  });
  res.status(201).json(job);
}));

app.get('/api/jobs/:id', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  const job = await prisma.generationJob.findFirst({
    where: { id: req.params.id, userId },
    include: { avatar: true, voice: true, project: true, logs: { orderBy: { createdAt: 'asc' } } },
  });
  if (!job) return res.status(404).json({ error: '任务不存在' });
  res.json(job);
}));

app.post('/api/jobs/:id/cancel', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  const job = await jobRunner.cancelJob({ id: req.params.id, userId });
  if (!job) return res.status(404).json({ error: '任务不存在' });
  res.json(job);
}));

app.post('/api/jobs/:id/retry', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  const job = await jobRunner.retryJob({ id: req.params.id, userId });
  if (!job) return res.status(404).json({ error: '任务不存在' });
  res.json(job);
}));

app.get('/api/projects', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { avatar: true, voice: true, job: { include: { logs: { orderBy: { createdAt: 'asc' } } } } },
  });
  res.json(projects);
}));

app.post('/api/projects/upload', upload.single('video'), asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  requireFields(req.body, ['title', 'script', 'avatarId', 'voiceId']);
  const videoUrl = fileUrl(req.file);
  if (!videoUrl) return res.status(400).json({ error: '请上传视频文件' });
  const [avatar, voice] = await Promise.all([
    prisma.avatar.findFirst({ where: { id: req.body.avatarId, userId, NOT: { status: 'deleted' } } }),
    prisma.voice.findFirst({ where: { id: req.body.voiceId, userId, NOT: { status: 'deleted' } } }),
  ]);
  if (!avatar) return res.status(400).json({ error: '请选择有效数字人' });
  if (!voice) return res.status(400).json({ error: '请选择有效声音' });
  const project = await prisma.project.create({
    data: {
      userId,
      title: req.body.title.trim(),
      script: req.body.script,
      avatarId: req.body.avatarId,
      voiceId: req.body.voiceId,
      videoUrl,
      coverUrl: avatar.previewImage,
      duration: req.body.duration || '00:30',
      status: 'ready',
    },
    include: { avatar: true, voice: true },
  });
  res.status(201).json(project);
}));

app.get('/api/projects/:id', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  const project = await prisma.project.findFirst({
    where: { id: req.params.id, userId },
    include: { avatar: true, voice: true, job: { include: { logs: { orderBy: { createdAt: 'asc' } } } } },
  });
  if (!project) return res.status(404).json({ error: '作品不存在' });
  res.json(project);
}));

app.delete('/api/projects/:id', asyncHandler(async (req, res) => {
  const userId = await currentUserId(req);
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId } });
  if (!project) return res.status(404).json({ error: '作品不存在' });
  await prisma.project.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

app.post('/api/ai/rewrite', asyncHandler(async (req, res) => {
  await currentUserId(req);
  const script = String(req.body.script || '').trim();
  if (!script) return res.status(400).json({ error: '请输入需要改写的文案' });
  const rewritten = `大家好，欢迎来到直播间。今天给大家重点介绍：${script.slice(0, 180)}。我们会从核心卖点、适用场景和限时权益三个方面快速讲清楚，帮助你在短时间内做出选择。现在了解并下单，还可享受专属福利。`;
  res.json({ script: rewritten.slice(0, scriptLimit()) });
}));

if (isProduction) {
  app.use(express.static(path.join(rootDir, 'dist')));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(rootDir, 'dist/index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    root: rootDir,
    server: { middlewareMode: true, host: '0.0.0.0', allowedHosts: devAllowedHosts() },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.use((error, req, res, next) => {
  if ((error.status || 500) >= 500) {
    console.error(error);
  }
  const message = error.code === 'LIMIT_FILE_SIZE' ? '上传文件不能超过 80MB' : error.message || '服务器错误';
  res.status(error.status || 500).json({ error: message });
});

jobRunner.start();

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Digital human app listening on http://localhost:${port}`);
});

process.on('SIGTERM', async () => shutdown());
process.on('SIGINT', async () => shutdown());

async function shutdown() {
  jobRunner.stop();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
