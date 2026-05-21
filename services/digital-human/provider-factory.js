import { AliyunProvider } from './aliyun-provider.js';
import { DIDProvider } from './did-provider.js';
import { HeyGenProvider } from './heygen-provider.js';
import { MockDigitalHumanProvider } from './mock-provider.js';

export function createDigitalHumanProvider(name = 'mock') {
  const providerName = String(name || 'mock').toLowerCase();

  if (providerName === 'mock') {
    return new MockDigitalHumanProvider();
  }

  if (['aliyun', 'dashscope', 'bailian'].includes(providerName)) {
    return new AliyunProvider();
  }

  if (['did', 'd-id', 'd_id'].includes(providerName)) {
    return new DIDProvider();
  }

  if (['heygen', 'hey-gen'].includes(providerName)) {
    return new HeyGenProvider();
  }

  throw new Error(`Unsupported DIGITAL_HUMAN_PROVIDER: ${name}. Use "mock", "aliyun", "did", or "heygen".`);
}
