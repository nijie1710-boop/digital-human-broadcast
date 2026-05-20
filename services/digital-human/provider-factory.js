import { MockDigitalHumanProvider } from './mock-provider.js';

export function createDigitalHumanProvider(name = 'mock') {
  const providerName = String(name || 'mock').toLowerCase();

  if (providerName === 'mock') {
    return new MockDigitalHumanProvider();
  }

  throw new Error(`Unsupported DIGITAL_HUMAN_PROVIDER: ${name}. Only "mock" is available in this MVP.`);
}
