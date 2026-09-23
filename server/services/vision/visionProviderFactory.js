/**
 * CrowdCity AI — Vision Provider Factory
 * Dynamically instantiates the appropriate vision provider based on environment configuration.
 */

import { QwenVisionProvider } from './providers/qwenVisionProvider.js';
import { MockVisionProvider } from './providers/mockVisionProvider.js';
import logger from '../../config/logger.js';

let cachedProvider = null;
let currentProviderType = null;

/**
 * Gets or creates a vision provider instance.
 * 
 * @param {string} [type] Optional override ('huggingface' | 'local' | 'mock')
 * @param {Object} [config] Optional config override
 * @returns {Object} Vision provider instance
 */
export function getVisionProvider(type = null, config = {}) {
  const providerType = (type || process.env.VISION_PROVIDER || 'huggingface').toLowerCase().trim();

  // If cached and same type, return cached (unless custom config passed)
  if (cachedProvider && currentProviderType === providerType && Object.keys(config).length === 0) {
    return cachedProvider;
  }

  logger.info(`Initializing Vision Provider: ${providerType}`);

  let provider;
  switch (providerType) {
    case 'mock':
      provider = new MockVisionProvider(config);
      break;
    case 'local':
      provider = new QwenVisionProvider({
        endpointUrl: process.env.VISION_INFERENCE_URL || 'http://localhost:11434/v1/chat/completions',
        model: process.env.VISION_MODEL || 'Qwen/Qwen3-VL-2B-Instruct',
        ...config
      });
      break;
    case 'huggingface':
    default:
      provider = new QwenVisionProvider({
        endpointUrl: process.env.VISION_INFERENCE_URL || 'https://router.huggingface.co/hf-inference/v1/chat/completions',
        model: process.env.VISION_MODEL || 'Qwen/Qwen3-VL-2B-Instruct',
        token: process.env.HF_TOKEN || '',
        ...config
      });
      break;
  }

  cachedProvider = provider;
  currentProviderType = providerType;
  return provider;
}

/**
 * Resets cached provider (useful for test isolation).
 */
export function resetVisionProviderCache() {
  cachedProvider = null;
  currentProviderType = null;
}

export default {
  getVisionProvider,
  resetVisionProviderCache
};
