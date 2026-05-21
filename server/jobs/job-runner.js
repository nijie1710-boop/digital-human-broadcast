import { estimateDuration } from '../../services/digital-human/provider.js';

const MOCK_STAGES = [
  { afterSeconds: 0, progress: 0, status: 'pending', step: '创建任务' },
  { afterSeconds: 2, progress: 20, status: 'running', step: 'TTS 生成', action: 'synthesizeSpeech' },
  { afterSeconds: 5, progress: 45, status: 'running', step: '数字人驱动', action: 'animateAvatar' },
  { afterSeconds: 8, progress: 70, status: 'running', step: '字幕生成', action: 'transcribeSubtitle' },
  { afterSeconds: 11, progress: 90, status: 'running', step: '视频合成' },
  { afterSeconds: 14, progress: 100, status: 'success', step: '完成', action: 'composeVideo' },
];

const ALIYUN_STAGES = [
  { afterSeconds: 0, progress: 0, status: 'pending', step: '创建任务' },
  { afterSeconds: 1, progress: 15, status: 'running', step: '准备文案' },
  { afterSeconds: 2, progress: 30, status: 'running', step: 'TTS 语音生成中', action: 'synthesizeSpeech' },
  { afterSeconds: 4, progress: 45, status: 'running', step: '数字人图片检测', action: 'validateAvatarImage' },
  { afterSeconds: 6, progress: 60, status: 'running', step: '提交 wan2.2-s2v 任务', action: 'animateAvatar' },
  { afterSeconds: 8, progress: 80, status: 'running', step: '等待视频生成', action: 'composeVideo', repeatUntilVideo: true },
];

const ALIYUN_VIDEORETALK_STAGES = [
  { afterSeconds: 0, progress: 0, status: 'pending', step: '创建任务' },
  { afterSeconds: 1, progress: 15, status: 'running', step: '准备文案' },
  { afterSeconds: 2, progress: 30, status: 'running', step: 'TTS 语音生成中', action: 'synthesizeSpeech' },
  { afterSeconds: 5, progress: 60, status: 'running', step: '提交 VideoRetalk 任务', action: 'animateAvatar' },
  { afterSeconds: 8, progress: 80, status: 'running', step: '等待口型替换', action: 'composeVideo', repeatUntilVideo: true },
];

const HEYGEN_STAGES = [
  { afterSeconds: 0, progress: 0, status: 'pending', step: '创建任务' },
  { afterSeconds: 1, progress: 20, status: 'running', step: '提交 HeyGen 视频生成', action: 'composeVideo' },
  { afterSeconds: 10, progress: 50, status: 'running', step: '等待 HeyGen 渲染', action: 'composeVideo' },
  { afterSeconds: 20, progress: 80, status: 'running', step: '下载生成视频', action: 'composeVideo', repeatUntilVideo: true, completedStep: '完成' },
];

function resolveStage(job) {
  const stages = stagesForProvider(job.provider);
  const baseTime = job.startedAt || job.createdAt;
  const elapsedSeconds = Math.floor((Date.now() - new Date(baseTime).getTime()) / 1000);
  const nextSequentialStage = stages.find((stage) => elapsedSeconds >= stage.afterSeconds && stage.progress > job.progress);
  if (nextSequentialStage) return nextSequentialStage;
  return stages.find((stage) => stage.progress === job.progress) || stages[0];
}

function stagesForProvider(provider) {
  if (provider === 'heygen' || provider === 'hey-gen') return HEYGEN_STAGES;
  if (provider !== 'aliyun') return MOCK_STAGES;
  return String(process.env.ALIYUN_VIDEO_MODE || 's2v').toLowerCase() === 'videoretalk'
    ? ALIYUN_VIDEORETALK_STAGES
    : ALIYUN_STAGES;
}

function providerResultToJobData(result) {
  if (!result) return {};
  const data = {};
  if (result.providerTaskId) data.providerTaskId = result.providerTaskId;
  if (result.providerStatus) data.providerStatus = result.providerStatus;
  if (result.audioUrl) data.audioUrl = result.audioUrl;
  if (result.videoUrl) data.videoUrl = result.videoUrl;
  if (result.providerPayload) data.providerPayload = stringifyPayload(result.providerPayload);
  return data;
}

function stringifyPayload(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export class JobRunner {
  constructor({ prisma, provider, providerName = 'mock', intervalMs }) {
    this.prisma = prisma;
    this.provider = provider;
    this.providerName = providerName;
    this.intervalMs = intervalMs || (['aliyun', 'heygen', 'hey-gen'].includes(providerName) ? 15000 : 1500);
    this.timer = null;
    this.running = false;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((error) => console.error('[job-runner]', error));
    }, this.intervalMs);
    this.tick().catch((error) => console.error('[job-runner]', error));
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async enqueueJob(payload) {
    const job = await this.prisma.generationJob.create({
      data: {
        ...payload,
        provider: payload.provider || this.providerName,
        status: 'pending',
        progress: 0,
        stage: '创建任务',
        duration: estimateDuration(payload.script),
        startedAt: new Date(),
      },
      include: { avatar: true, voice: true, logs: true },
    });

    await this.createLog(job, {
      step: '创建任务',
      status: 'success',
      progress: 0,
      message: '任务已进入队列',
    });

    return job;
  }

  async cancelJob({ id, userId }) {
    const job = await this.prisma.generationJob.findFirst({ where: { id, userId } });
    if (!job) return null;
    if (!['pending', 'running'].includes(job.status)) return job;

    const cancelled = await this.prisma.generationJob.update({
      where: { id },
      data: {
        status: 'cancelled',
        stage: '已取消',
        finishedAt: new Date(),
      },
      include: { avatar: true, voice: true, logs: true },
    });
    await this.createLog(cancelled, {
      step: '已取消',
      status: 'cancelled',
      progress: cancelled.progress,
      message: '用户取消任务',
    });
    return cancelled;
  }

  async retryJob({ id, userId }) {
    const job = await this.prisma.generationJob.findFirst({ where: { id, userId } });
    if (!job) return null;

    const retried = await this.prisma.generationJob.update({
      where: { id },
      data: {
        status: 'pending',
        progress: 0,
        stage: '创建任务',
        errorMessage: null,
        resultVideoUrl: null,
        coverUrl: null,
        providerTaskId: null,
        providerStatus: null,
        providerPayload: null,
        audioUrl: null,
        videoUrl: null,
        startedAt: new Date(),
        finishedAt: null,
      },
      include: { avatar: true, voice: true, logs: true },
    });
    await this.createLog(retried, {
      step: '创建任务',
      status: 'success',
      progress: 0,
      message: '任务已重试并重新入队',
    });
    return retried;
  }

  async tick() {
    if (this.running) return;
    this.running = true;

    try {
      await this.advanceActiveJobs();
      await this.advanceVoiceClones();
    } finally {
      this.running = false;
    }
  }

  async advanceActiveJobs() {
    const activeJobs = await this.prisma.generationJob.findMany({
      where: { status: { in: ['pending', 'running'] } },
      include: { avatar: true, voice: true, project: true, logs: true },
    });

    for (const job of activeJobs) {
      await this.advanceJob(job);
    }
  }

  async advanceJob(job) {
    const next = resolveStage(job);
    const shouldRepeatStage = next.repeatUntilVideo && job.status === 'running' && job.progress === next.progress && !job.resultVideoUrl;
    if (!shouldRepeatStage && next.progress <= job.progress && next.status === job.status && next.step === job.stage) {
      return;
    }

    try {
      const preActionStatus = next.action && next.status === 'success' ? 'running' : next.status;
      const preActionProgress = next.action && next.status === 'success' ? Math.max(job.progress, next.progress - 1) : next.progress;
      const activeJob = await this.prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: preActionStatus,
          progress: preActionProgress,
          stage: next.step,
          startedAt: job.startedAt || new Date(),
        },
        include: { avatar: true, voice: true, project: true, logs: true },
      });

      const providerResult = await this.runProviderAction(activeJob, next);
      const providerData = providerResultToJobData(providerResult);
      const shouldComplete = next.status === 'success' || (next.action === 'composeVideo' && providerResult?.videoUrl);
      const data = {
        ...providerData,
        status: next.status,
        progress: next.progress,
        stage: next.step,
        startedAt: activeJob.startedAt || new Date(),
      };

      if (shouldComplete) {
        data.status = 'success';
        data.progress = 100;
        data.stage = next.completedStep || (job.provider === 'aliyun' ? '生成完成' : next.step);
        data.finishedAt = new Date();
        data.resultVideoUrl = providerResult?.videoUrl || activeJob.resultVideoUrl;
        data.videoUrl = providerResult?.videoUrl || providerData.videoUrl || activeJob.videoUrl;
        data.coverUrl = providerResult?.coverUrl || activeJob.coverUrl || activeJob.avatar.previewImage;
        data.duration = providerResult?.duration || activeJob.duration || estimateDuration(activeJob.script);
      }

      const updatedJob = await this.prisma.generationJob.update({
        where: { id: activeJob.id },
        data,
        include: { avatar: true, voice: true, project: true, logs: true },
      });

      await this.createLogIfChanged(updatedJob, {
        step: updatedJob.stage,
        status: shouldComplete ? 'success' : 'running',
        progress: updatedJob.progress,
        message: `${next.step}完成`,
      });

      if (updatedJob.status === 'success') {
        await this.ensureProject(updatedJob);
      }
    } catch (error) {
      const failed = await this.prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          stage: '失败',
          errorMessage: error.message,
          finishedAt: new Date(),
        },
        include: { avatar: true, voice: true, logs: true },
      });
      await this.createLog(failed, {
        step: '失败',
        status: 'failed',
        progress: failed.progress,
        message: error.message,
      });
    }
  }

  async runProviderAction(job, stage) {
    if (!stage.action) return null;
    if (typeof this.provider[stage.action] !== 'function') {
      throw new Error(`当前 provider 不支持 ${stage.action}`);
    }
    return this.provider[stage.action]({ job });
  }

  async createLog(job, { step, status, progress, message }) {
    return this.prisma.jobLog.create({
      data: {
        jobId: job.id,
        userId: job.userId,
        step,
        status,
        progress,
        message,
      },
    });
  }

  async createLogIfChanged(job, log) {
    const latest = await this.prisma.jobLog.findFirst({
      where: { jobId: job.id },
      orderBy: { createdAt: 'desc' },
    });
    if (
      latest
      && latest.step === log.step
      && latest.status === log.status
      && latest.progress === log.progress
      && latest.message === log.message
    ) {
      return latest;
    }
    return this.createLog(job, log);
  }

  async ensureProject(job) {
    const existing = await this.prisma.project.findUnique({ where: { jobId: job.id } });
    const data = {
      userId: job.userId,
      title: job.title,
      script: job.script,
      avatarId: job.avatarId,
      voiceId: job.voiceId,
      jobId: job.id,
      videoUrl: job.resultVideoUrl || job.videoUrl,
      coverUrl: job.coverUrl || job.avatar.previewImage,
      duration: job.duration || estimateDuration(job.script),
      status: 'ready',
    };

    if (existing) {
      return this.prisma.project.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.prisma.project.create({
      data,
    });
  }

  async advanceVoiceClones() {
    await this.prisma.voice.updateMany({
      where: {
        status: 'pending',
        createdAt: { lt: new Date(Date.now() - 8000) },
      },
      data: { status: 'ready' },
    });
  }
}
