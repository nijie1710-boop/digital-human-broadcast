import { DigitalHumanProvider } from './provider.js';

export class MuseTalkProvider extends DigitalHumanProvider {
  async synthesizeSpeech() {
    throw new Error('MuseTalk provider only handles avatar animation.');
  }

  async animateAvatar() {
    throw new Error('MuseTalk provider is not configured. Implement animateAvatar to call the local model service.');
  }

  async transcribeSubtitle() {
    throw new Error('MuseTalk provider only handles avatar animation.');
  }

  async composeVideo() {
    throw new Error('MuseTalk provider only handles avatar animation.');
  }
}
