import { DigitalHumanProvider, estimateDuration } from './provider.js';

const MOCK_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

export class MockDigitalHumanProvider extends DigitalHumanProvider {
  async synthesizeSpeech({ job }) {
    return {
      audioUrl: `mock://audio/${job.id}`,
      duration: estimateDuration(job.script),
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
    return {
      videoUrl: MOCK_VIDEO_URL,
      coverUrl: job.avatar?.previewImage || job.coverUrl || '',
      duration: job.duration || estimateDuration(job.script),
    };
  }
}
