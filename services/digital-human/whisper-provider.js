import { DigitalHumanProvider } from './provider.js';

export class WhisperProvider extends DigitalHumanProvider {
  async synthesizeSpeech() {
    throw new Error('Whisper provider only handles subtitle transcription.');
  }

  async animateAvatar() {
    throw new Error('Whisper provider only handles subtitle transcription.');
  }

  async transcribeSubtitle() {
    throw new Error('Whisper provider is not configured. Implement transcribeSubtitle to call Whisper.');
  }

  async composeVideo() {
    throw new Error('Whisper provider only handles subtitle transcription.');
  }
}
