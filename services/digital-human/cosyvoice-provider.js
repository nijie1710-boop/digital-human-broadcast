import { DigitalHumanProvider } from './provider.js';

export class CosyVoiceProvider extends DigitalHumanProvider {
  async synthesizeSpeech() {
    throw new Error('CosyVoice provider is not configured. Set credentials and implement synthesizeSpeech.');
  }

  async animateAvatar() {
    throw new Error('CosyVoice provider only handles speech synthesis.');
  }

  async transcribeSubtitle() {
    throw new Error('CosyVoice provider only handles speech synthesis.');
  }

  async composeVideo() {
    throw new Error('CosyVoice provider only handles speech synthesis.');
  }
}
