import { DigitalHumanProvider } from './provider.js';

const MOCK_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

const stages = [
  { afterSeconds: 0, progress: 0, status: 'pending', stage: '创建任务' },
  { afterSeconds: 2, progress: 20, status: 'running', stage: 'TTS 生成' },
  { afterSeconds: 5, progress: 45, status: 'running', stage: '数字人驱动' },
  { afterSeconds: 8, progress: 70, status: 'running', stage: '字幕生成' },
  { afterSeconds: 11, progress: 90, status: 'running', stage: '视频合成' },
  { afterSeconds: 14, progress: 100, status: 'success', stage: '完成' },
];

function resolveStage(job) {
  const baseTime = job.startedAt || job.createdAt;
  const elapsedSeconds = Math.floor((Date.now() - new Date(baseTime).getTime()) / 1000);
  return stages.reduce((current, stage) => (elapsedSeconds >= stage.afterSeconds ? stage : current), stages[0]);
}

function estimateDuration(script) {
  const seconds = Math.max(15, Math.min(90, Math.ceil(script.length / 4)));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export class MockDigitalHumanProvider extends DigitalHumanProvider {
  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async createJob(payload) {
    return this.prisma.generationJob.create({
      data: {
        ...payload,
        status: 'pending',
        progress: 0,
        stage: '创建任务',
        duration: estimateDuration(payload.script),
      },
      include: { avatar: true, voice: true },
    });
  }

  async sync() {
    const activeJobs = await this.prisma.generationJob.findMany({
      where: { status: { in: ['pending', 'running'] } },
      include: { avatar: true, voice: true, project: true },
    });

    for (const job of activeJobs) {
      const next = resolveStage(job);
      const updates = {
        status: next.status,
        progress: next.progress,
        stage: next.stage,
        startedAt: job.startedAt || new Date(),
      };

      if (next.status === 'success') {
        updates.finishedAt = new Date();
        updates.resultVideoUrl = job.resultVideoUrl || MOCK_VIDEO_URL;
        updates.coverUrl = job.coverUrl || job.avatar.previewImage;
      }

      const updatedJob = await this.prisma.generationJob.update({
        where: { id: job.id },
        data: updates,
        include: { avatar: true, voice: true, project: true },
      });

      if (updatedJob.status === 'success' && !updatedJob.project) {
        await this.prisma.project.create({
          data: {
            title: updatedJob.title,
            script: updatedJob.script,
            avatarId: updatedJob.avatarId,
            voiceId: updatedJob.voiceId,
            jobId: updatedJob.id,
            videoUrl: updatedJob.resultVideoUrl || MOCK_VIDEO_URL,
            coverUrl: updatedJob.coverUrl || updatedJob.avatar.previewImage,
            duration: updatedJob.duration || estimateDuration(updatedJob.script),
            status: 'ready',
          },
        });
      }
    }

    await this.prisma.voice.updateMany({
      where: {
        status: 'pending',
        createdAt: { lt: new Date(Date.now() - 8000) },
      },
      data: { status: 'ready' },
    });
  }

  async cancelJob(id) {
    const job = await this.prisma.generationJob.findUnique({ where: { id } });
    if (!job) return null;
    if (!['pending', 'running'].includes(job.status)) return job;

    return this.prisma.generationJob.update({
      where: { id },
      data: {
        status: 'cancelled',
        stage: '已取消',
        finishedAt: new Date(),
      },
      include: { avatar: true, voice: true },
    });
  }

  async retryJob(id) {
    const job = await this.prisma.generationJob.findUnique({ where: { id } });
    if (!job) return null;

    return this.prisma.generationJob.update({
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
      include: { avatar: true, voice: true },
    });
  }
}
