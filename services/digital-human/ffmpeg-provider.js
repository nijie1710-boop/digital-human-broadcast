import { DigitalHumanProvider } from './provider.js';

export class FFmpegProvider extends DigitalHumanProvider {
  async synthesizeSpeech() {
    throw new Error('FFmpeg provider only handles final video composition.');
  }

  async animateAvatar() {
    throw new Error('FFmpeg provider only handles final video composition.');
  }

  async transcribeSubtitle() {
    throw new Error('FFmpeg provider only handles final video composition.');
  }

  async composeVideo() {
    throw new Error('FFmpeg provider is not configured. Implement composeVideo to call FFmpeg.');
  }
}
