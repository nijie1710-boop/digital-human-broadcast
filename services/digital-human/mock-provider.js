import { execFile as execFileCallback } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { DigitalHumanProvider, estimateDuration } from './provider.js';

const execFile = promisify(execFileCallback);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const publicDir = path.join(rootDir, 'public');
const audioDir = path.join(publicDir, 'uploads/audio');
const projectDir = path.join(publicDir, 'uploads/projects');
const cacheDir = path.join(publicDir, 'uploads/cache');

const SAY_VOICES = {
  女性: 'Tingting',
  男性: 'Reed (中文（中国大陆）)',
  中性: 'Tingting',
};

export class MockDigitalHumanProvider extends DigitalHumanProvider {
  constructor() {
    super();
    this.artifacts = new Map();
  }

  async synthesizeSpeech({ job }) {
    const script = normalizeSpeechText(job.script);
    const audioPath = path.join(audioDir, `${job.id}.m4a`);
    const aiffPath = path.join(audioDir, `${job.id}.aiff`);

    await ensureDir(audioDir);
    await safeUnlink(aiffPath);

    const voiceName = SAY_VOICES[job.voice?.gender] || SAY_VOICES[job.voice?.gender?.trim()] || 'Tingting';
    await execFile('say', ['-v', voiceName, '-r', '178', '-o', aiffPath, script], { timeout: 120000 });
    await execFile('ffmpeg', ['-y', '-i', aiffPath, '-c:a', 'aac', '-b:a', '128k', audioPath], { timeout: 120000 });
    await safeUnlink(aiffPath);

    const seconds = await readMediaSeconds(audioPath);
    const artifact = {
      audioPath,
      audioUrl: `/uploads/audio/${job.id}.m4a`,
      duration: secondsToDuration(seconds),
      durationSeconds: seconds,
    };
    this.artifacts.set(job.id, { ...(this.artifacts.get(job.id) || {}), ...artifact });

    return {
      audioUrl: artifact.audioUrl,
      duration: artifact.duration,
    };
  }

  async animateAvatar({ job }) {
    return {
      animationUrl: `mock://avatar-animation/${job.id}`,
    };
  }

  async transcribeSubtitle({ job }) {
    return {
      subtitleUrl: `mock://subtitle/${job.id}`,
    };
  }

  async composeVideo({ job }) {
    let artifact = this.artifacts.get(job.id);
    if (!artifact?.audioPath || !fs.existsSync(artifact.audioPath)) {
      await this.synthesizeSpeech({ job });
      artifact = this.artifacts.get(job.id);
    }

    await ensureDir(projectDir);
    await ensureDir(cacheDir);

    const imagePath = await resolveImagePath(job.avatar?.previewImage || job.avatar?.sourceImage || job.coverUrl);
    const outputPath = path.join(projectDir, `${job.id}.mp4`);
    const seconds = artifact.durationSeconds || durationToSeconds(job.duration) || durationToSeconds(estimateDuration(job.script));

    if (imagePath) {
      await execFile('ffmpeg', [
        '-y',
        '-loop', '1',
        '-framerate', '30',
        '-t', String(Math.max(3, Math.ceil(seconds))),
        '-i', imagePath,
        '-i', artifact.audioPath,
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p',
        '-shortest',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-tune', 'stillimage',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputPath,
      ], { timeout: 180000 });
    } else {
      await execFile('ffmpeg', [
        '-y',
        '-f', 'lavfi',
        '-i', `color=c=0x111827:s=1080x1920:d=${Math.max(3, Math.ceil(seconds))}`,
        '-i', artifact.audioPath,
        '-shortest',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outputPath,
      ], { timeout: 180000 });
    }

    return {
      videoUrl: `/uploads/projects/${job.id}.mp4`,
      coverUrl: job.avatar?.previewImage || job.coverUrl || '',
      duration: artifact.duration || job.duration || estimateDuration(job.script),
    };
  }
}

function normalizeSpeechText(script) {
  const text = String(script || '').replace(/\s+/g, ' ').trim();
  return text || '大家好，欢迎来到数字人口播系统。';
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
    // Fall through to the estimate used by the MVP when ffprobe is unavailable.
  }
  return 15;
}

function durationToSeconds(duration) {
  const parts = String(duration || '').split(':').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 2 || parts.some((part) => Number.isNaN(part))) return 0;
  return parts[0] * 60 + parts[1];
}

function secondsToDuration(seconds) {
  const rounded = Math.max(1, Math.round(Number(seconds) || 1));
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

async function resolveImagePath(imageUrl) {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('/')) {
    const localPath = path.resolve(publicDir, imageUrl.replace(/^\/+/, ''));
    if (localPath.startsWith(publicDir) && fs.existsSync(localPath)) return localPath;
    return '';
  }

  if (!/^https?:\/\//i.test(imageUrl)) return '';

  const hash = crypto.createHash('sha1').update(imageUrl).digest('hex');
  const ext = extensionFromUrl(imageUrl) || '.jpg';
  const cachedPath = path.join(cacheDir, `${hash}${ext}`);
  if (fs.existsSync(cachedPath)) return cachedPath;

  const response = await fetch(imageUrl);
  if (!response.ok) return '';
  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.writeFile(cachedPath, buffer);
  return cachedPath;
}

function extensionFromUrl(value) {
  try {
    const ext = path.extname(new URL(value).pathname).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '';
  } catch {
    return '';
  }
}
