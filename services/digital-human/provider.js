export class DigitalHumanProvider {
  async synthesizeSpeech() {
    throw new Error(`${this.constructor.name}.synthesizeSpeech is not configured`);
  }

  async animateAvatar() {
    throw new Error(`${this.constructor.name}.animateAvatar is not configured`);
  }

  async transcribeSubtitle() {
    throw new Error(`${this.constructor.name}.transcribeSubtitle is not configured`);
  }

  async composeVideo() {
    throw new Error(`${this.constructor.name}.composeVideo is not configured`);
  }

  async cloneVoice() {
    throw new Error(`${this.constructor.name}.cloneVoice is not configured`);
  }

  async pollVoiceClone() {
    throw new Error(`${this.constructor.name}.pollVoiceClone is not configured`);
  }
}

export function estimateDuration(script) {
  const seconds = Math.max(15, Math.min(90, Math.ceil(String(script || '').length / 4)));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
