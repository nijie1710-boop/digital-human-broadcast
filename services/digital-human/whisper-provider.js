export class WhisperProvider {
  async transcribe() {
    throw new Error('Whisper provider is not configured in MVP mode');
  }
}
