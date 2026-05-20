import { estimateDuration } from '../../services/digital-human/provider.js';

const STAGES = [
  { afterSeconds: 0, progress: 0, status: 'pending', step: '创建任务' },
  { afterSeconds: 2, progress: 20, status: 'running', step: 'TTS 生成', action: 'synthesizeSpeech' },
  { afterSeconds: 5, progress: 45, status: 'running', step: '数字人驱动', action: 'animateAvatar' },
  { afterSeconds: 8, progress: 70, status: 'running', step: '字幕生成', action: 'transcribeSubtitle' },
  { afterSeconds: 11, progress: 90, status: 'running', step: '视频合成' },
  { afterSeconds: 14, progress: 100, status: 'success', step: '完成', action: 'composeVideo' },
];

function resolveStage(job) {
  const baseTime = job.startedAt || job.createdAt;
  const elapsedSeconds = Math.floor((Date.now() - new Date(baseTime).getTime()) / 1000);
  return STAGES.reduce((current, stage) => (elapsedSeconds >= stage.afterSeconds ? stage : current), STAGES[0]);
}

export class JobRunner {
  constructor({ prisma, provider, intervalMs = 1500 }) {
    this.prisma = prisma;
    this.provider = provider;
    this.intervalMs = intervalMs;
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
    if (next.progress <= job.progress && next.status === job.status && next.step === job.stage) {
      return;
    }

    try {
      const providerResult = await this.runProviderAction(job, next);
      const data = {
        status: next.status,
        progress: next.progress,
        stage: next.step,
        startedAt: job.startedAt || new Date(),
      };

      if (next.status === 'success') {
        data.finishedAt = new Date();
        data.resultVideoUrl = providerResult?.videoUrl || job.resultVideoUrl;
        data.coverUrl = providerResult?.coverUrl || job.coverUrl || job.avatar.previewImage;
        data.duration = providerResult?.duration || job.duration || estimateDuration(job.script);
      }

      const updatedJob = await this.prisma.generationJob.update({
        where: { id: job.id },
        data,
        include: { avatar: true, voice: true, project: true, logs: true },
      });

      await this.createLog(updatedJob, {
        step: next.step,
        status: next.status === 'success' ? 'success' : 'running',
        progress: next.progress,
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
    if (stage.action === 'composeVideo') {
      return this.provider.composeVideo({ job });
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

  async ensureProject(job) {
    const existing = await this.prisma.project.findUnique({ where: { jobId: job.id } });
    const data = {
      userId: job.userId,
      title: job.title,
      script: job.script,
      avatarId: job.avatarId,
      voiceId: job.voiceId,
      jobId: job.id,
      videoUrl: job.resultVideoUrl,
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
