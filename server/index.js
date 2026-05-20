import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { MockDigitalHumanProvider } from '../services/digital-human/mock-provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 5173);
const isProduction = process.env.NODE_ENV === 'production';

loadDotEnv();
ensureLocalFiles();

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const provider = new MockDigitalHumanProvider(prisma);
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(rootDir, 'public/uploads')));
app.use('/samples', express.static(path.join(rootDir, 'public/samples')));

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      const folder = file.fieldname === 'sample' ? 'voices' : file.fieldname === 'video' ? 'projects' : 'avatars';
      const uploadDir = path.join(rootDir, 'public/uploads', folder);
      fs.mkdirSync(uploadDir, { recursive: true });
      callback(null, uploadDir);
    },
    filename(req, file, callback) {
      const ext = path.extname(file.originalname || '');
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      callback(null, safeName);
    },
  }),
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
  for (const dir of ['public/uploads/avatars', 'public/uploads/voices', 'public/uploads/projects', 'public/samples', 'prisma']) {
    fs.mkdirSync(path.join(rootDir, dir), { recursive: true });
  }
  const dbPath = path.join(rootDir, 'prisma/dev.db');
  if (!fs.existsSync(dbPath)) fs.closeSync(fs.openSync(dbPath, 'w'));
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

async function withJobSync() {
  await provider.sync();
}

async function setDefault(model, id) {
  const delegate = prisma[model];
  await delegate.updateMany({ data: { isDefault: false } });
  return delegate.update({ where: { id }, data: { isDefault: true } });
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/avatars', asyncHandler(async (req, res) => {
  const avatars = await prisma.avatar.findMany({
    where: { NOT: { status: 'deleted' } },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(avatars);
}));

app.post('/api/avatars', upload.single('image'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'gender', 'style']);
  const imageUrl = fileUrl(req.file) || req.body.previewImage || req.body.sourceImage;
  if (!imageUrl) {
    return res.status(400).json({ error: '请上传数字人形象图' });
  }
  if (parseBool(req.body.isDefault)) {
    await prisma.avatar.updateMany({ data: { isDefault: false } });
  }
  const avatar = await prisma.avatar.create({
    data: {
      name: req.body.name.trim(),
      gender: req.body.gender,
      style: req.body.style.trim(),
      previewImage: imageUrl,
      sourceImage: imageUrl,
      status: req.body.status || 'active',
      isDefault: parseBool(req.body.isDefault),
    },
  });
  res.status(201).json(avatar);
}));

app.put('/api/avatars/:id', upload.single('image'), asyncHandler(async (req, res) => {
  const existing = await prisma.avatar.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: '数字人不存在' });
  if (parseBool(req.body.isDefault)) {
    await prisma.avatar.updateMany({ data: { isDefault: false } });
  }
  const imageUrl = fileUrl(req.file);
  const avatar = await prisma.avatar.update({
    where: { id: req.params.id },
    data: {
      name: req.body.name?.trim() || existing.name,
      gender: req.body.gender || existing.gender,
      style: req.body.style?.trim() || existing.style,
      previewImage: imageUrl || existing.previewImage,
      sourceImage: imageUrl || existing.sourceImage,
      status: req.body.status || existing.status,
      isDefault: parseBool(req.body.isDefault) || (existing.isDefault && req.body.isDefault === undefined),
    },
  });
  res.json(avatar);
}));

app.delete('/api/avatars/:id', asyncHandler(async (req, res) => {
  const related = await prisma.generationJob.count({ where: { avatarId: req.params.id } });
  const projectRelated = await prisma.project.count({ where: { avatarId: req.params.id } });
  if (related || projectRelated) {
    await prisma.avatar.update({ where: { id: req.params.id }, data: { status: 'deleted', isDefault: false } });
  } else {
    await prisma.avatar.delete({ where: { id: req.params.id } });
  }
  res.json({ ok: true });
}));

app.post('/api/avatars/:id/default', asyncHandler(async (req, res) => {
  const avatar = await setDefault('avatar', req.params.id);
  res.json(avatar);
}));

app.get('/api/voices', asyncHandler(async (req, res) => {
  await withJobSync();
  const voices = await prisma.voice.findMany({
    where: { NOT: { status: 'deleted' } },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(voices);
}));

app.post('/api/voices', upload.single('sample'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'gender', 'language', 'style']);
  const sampleUrl = fileUrl(req.file) || req.body.sampleUrl || 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3';
  if (parseBool(req.body.isDefault)) {
    await prisma.voice.updateMany({ data: { isDefault: false } });
  }
  const voice = await prisma.voice.create({
    data: {
      name: req.body.name.trim(),
      gender: req.body.gender,
      language: req.body.language.trim(),
      style: req.body.style.trim(),
      sampleUrl,
      duration: req.body.duration || '00:15',
      status: parseBool(req.body.clone) ? 'pending' : 'ready',
      isDefault: parseBool(req.body.isDefault),
    },
  });
  res.status(201).json(voice);
}));

app.delete('/api/voices/:id', asyncHandler(async (req, res) => {
  const related = await prisma.generationJob.count({ where: { voiceId: req.params.id } });
  const projectRelated = await prisma.project.count({ where: { voiceId: req.params.id } });
  if (related || projectRelated) {
    await prisma.voice.update({ where: { id: req.params.id }, data: { status: 'deleted', isDefault: false } });
  } else {
    await prisma.voice.delete({ where: { id: req.params.id } });
  }
  res.json({ ok: true });
}));

app.post('/api/voices/:id/default', asyncHandler(async (req, res) => {
  const voice = await setDefault('voice', req.params.id);
  res.json(voice);
}));

app.get('/api/templates', asyncHandler(async (req, res) => {
  const where = req.query.category ? { category: String(req.query.category) } : {};
  const templates = await prisma.template.findMany({ where, orderBy: { createdAt: 'asc' } });
  res.json(templates);
}));

app.post('/api/templates', asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'category', 'scriptPrompt', 'subtitleStyle', 'backgroundConfig', 'introOutroConfig']);
  const template = await prisma.template.create({
    data: {
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
  await withJobSync();
  const jobs = await prisma.generationJob.findMany({
    orderBy: { createdAt: 'desc' },
    include: { avatar: true, voice: true, project: true },
  });
  res.json(jobs);
}));

app.post('/api/jobs', asyncHandler(async (req, res) => {
  requireFields(req.body, ['script', 'avatarId', 'voiceId']);
  const script = req.body.script.trim();
  if (script.length > 3000) {
    return res.status(400).json({ error: '文案不能超过 3000 字' });
  }

  const [avatar, voice] = await Promise.all([
    prisma.avatar.findUnique({ where: { id: req.body.avatarId } }),
    prisma.voice.findUnique({ where: { id: req.body.voiceId } }),
  ]);
  if (!avatar) return res.status(400).json({ error: '请选择有效数字人' });
  if (!voice) return res.status(400).json({ error: '请选择有效声音' });
  if (voice.status !== 'ready') return res.status(400).json({ error: '当前声音还在克隆处理中，请稍后再试' });

  const job = await provider.createJob({
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
  await withJobSync();
  const job = await prisma.generationJob.findUnique({
    where: { id: req.params.id },
    include: { avatar: true, voice: true, project: true },
  });
  if (!job) return res.status(404).json({ error: '任务不存在' });
  res.json(job);
}));

app.post('/api/jobs/:id/cancel', asyncHandler(async (req, res) => {
  const job = await provider.cancelJob(req.params.id);
  if (!job) return res.status(404).json({ error: '任务不存在' });
  res.json(job);
}));

app.post('/api/jobs/:id/retry', asyncHandler(async (req, res) => {
  const job = await provider.retryJob(req.params.id);
  if (!job) return res.status(404).json({ error: '任务不存在' });
  res.json(job);
}));

app.get('/api/projects', asyncHandler(async (req, res) => {
  await withJobSync();
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: { avatar: true, voice: true, job: true },
  });
  res.json(projects);
}));

app.post('/api/projects/upload', upload.single('video'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['title', 'script', 'avatarId', 'voiceId']);
  const videoUrl = fileUrl(req.file);
  if (!videoUrl) return res.status(400).json({ error: '请上传视频文件' });
  const avatar = await prisma.avatar.findUnique({ where: { id: req.body.avatarId } });
  if (!avatar) return res.status(400).json({ error: '请选择有效数字人' });
  const project = await prisma.project.create({
    data: {
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
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: { avatar: true, voice: true, job: true },
  });
  if (!project) return res.status(404).json({ error: '作品不存在' });
  res.json(project);
}));

app.delete('/api/projects/:id', asyncHandler(async (req, res) => {
  await prisma.project.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

app.post('/api/ai/rewrite', asyncHandler(async (req, res) => {
  const script = String(req.body.script || '').trim();
  if (!script) return res.status(400).json({ error: '请输入需要改写的文案' });
  const rewritten = `大家好，欢迎来到直播间。今天给大家重点介绍：${script.slice(0, 180)}。我们会从核心卖点、适用场景和限时权益三个方面快速讲清楚，帮助你在短时间内做出选择。现在了解并下单，还可享受专属福利。`;
  res.json({ script: rewritten.slice(0, 3000) });
}));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || '服务器错误' });
});

if (isProduction) {
  app.use(express.static(path.join(rootDir, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(rootDir, 'dist/index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    root: rootDir,
    server: { middlewareMode: true, host: '0.0.0.0' },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Digital human app listening on http://localhost:${port}`);
});
