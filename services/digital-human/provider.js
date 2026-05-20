export class DigitalHumanProvider {
  async sync() {
    throw new Error('DigitalHumanProvider.sync must be implemented');
  }

  async createJob() {
    throw new Error('DigitalHumanProvider.createJob must be implemented');
  }

  async retryJob() {
    throw new Error('DigitalHumanProvider.retryJob must be implemented');
  }

  async cancelJob() {
    throw new Error('DigitalHumanProvider.cancelJob must be implemented');
  }
}
