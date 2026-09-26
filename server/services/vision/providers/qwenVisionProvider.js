/**
 * CrowdCity AI — Qwen Vision Provider
 * Open-Source Multimodal Vision Provider using Qwen/Qwen3-VL-2B-Instruct
 * 
 * Supports:
 * - Hugging Face Router endpoint (https://router.huggingface.co/hf-inference/v1/chat/completions)
 * - OpenAI-compatible local endpoints (vLLM, Ollama /v1/chat/completions)
 * - Free/open-weights models without paid proprietary API lock-in
 */

import logger from '../../../config/logger.js';

export class QwenVisionProvider {
  /**
   * @param {Object} [config]
   * @param {string} [config.model]
   * @param {string} [config.endpointUrl]
   * @param {string} [config.token]
   * @param {number} [config.timeoutMs]
   */
  constructor(config = {}) {
    this.model = config.model || process.env.VISION_MODEL || 'Qwen/Qwen3-VL-2B-Instruct';
    this.endpointUrl = config.endpointUrl || process.env.VISION_INFERENCE_URL || 'https://router.huggingface.co/hf-inference/v1/chat/completions';
    this.token = config.token !== undefined ? config.token : (process.env.HF_TOKEN || '');
    this.timeoutMs = config.timeoutMs || parseInt(process.env.VISION_TIMEOUT_MS, 10) || 60000; // 60s timeout for multimodal vision inference
  }

  /**
   * Inspects civic photo and extracts structured municipal issue details.
   * 
   * @param {Object} params
   * @param {string} params.imageBase64 Formatted data URI or raw base64
   * @param {string} [params.mimeType] 'image/jpeg' | 'image/png' | 'image/webp'
   * @param {string} [params.lang] 'en' | 'en-IN' | 'ta' | 'ta-IN'
   * @returns {Promise<Object>} Raw structured output from model
   */
  async analyze({ imageBase64, mimeType = 'image/jpeg', lang = 'en' }) {
    const formattedUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:${mimeType};base64,${imageBase64}`;

    const isTamil = (lang === 'ta' || lang === 'ta-IN' || lang === 'tanglish');

    const languageDirective = isTamil
      ? `LANGUAGE & SCRIPT MANDATE:
- All generated user-facing text ("detected_issue", "description", "evidence_observed") MUST be written in clear TAMIL or TANGLISH (Tamil written using Latin script).
- STRICT PROHIBITION: NEVER output Chinese characters (中文/汉字), Hanzi, or any East Asian scripts under any circumstance.
- "suggested_category" and all JSON property keys MUST strictly remain in canonical ENGLISH.`
      : `LANGUAGE & SCRIPT MANDATE:
- All generated user-facing text ("detected_issue", "description", "evidence_observed") MUST be 100% EXCLUSIVELY in natural, professional ENGLISH using the Latin alphabet.
- STRICT PROHIBITION: NEVER output Chinese characters (中文/汉字), Hanzi, or any East Asian scripts under any circumstance.
- Example: Output "Bus trapped in road pothole", NEVER "Bus陷入路面坑洼".
- "suggested_category" MUST strictly remain one of the canonical English taxonomy names.`;

    const systemPrompt = `You are an expert municipal visual inspector for CrowdCity AI (Tamil Nadu Municipal Governance).
Analyze the citizen's photo to perform visual hazard detection and object recognition.

${languageDirective}

TAXONOMY & CATEGORIES:
- "Roads": Potholes, road craters, cracked asphalt, missing manhole covers, damaged footpaths/sidewalks.
- "Streetlights": Dark unlit streetlight pole, tilted light post, dangling fixture, damaged electrical street box.
- "Water Supply": Leaking water pipe, burst municipal line, broken street water tap.
- "Drainage": Clogged storm drain, overflowing sewer, black wastewater accumulation on street.
- "Garbage": Overflowing dumpsters, roadside garbage pile, uncollected trash heap, open dumping.
- "Traffic": Damaged traffic signals, missing/bent traffic signs, damaged zebra crossing, road obstruction.
- "Public Property": Broken bus stop shelter, damaged municipal fence, damaged public signboards.
- "Parks": Fallen tree blocking path, broken public playground equipment.
- "Sanitation": Public urinal overflow, unsanitary public toilet condition.
- "Safety Hazard": Exposed live electric wire, open sinkhole, hazardous building debris.
- "Other": Other genuine public municipal infrastructure problem.

INVALID / NON-CIVIC PHOTOS:
- Human faces, selfies, pets/animals, indoor furniture/bedrooms, clothing, personal documents/paper, food plates, completely dark or blank images.
- If the photo is non-civic, set "is_valid_civic_issue": false and describe what is visible.

OUTPUT SCHEMA (Return strictly ONE JSON object with no markdown wrappers):
{
  "is_valid_civic_issue": true or false,
  "detected_issue": "Concise 3-6 word hazard title (e.g. 'Deep Asphalt Road Pothole')",
  "suggested_category": "Roads" | "Streetlights" | "Water Supply" | "Drainage" | "Garbage" | "Traffic" | "Public Property" | "Parks" | "Sanitation" | "Safety Hazard" | "Other",
  "description": "Clear 2-sentence objective summary of the visual condition and civic hazard.",
  "evidence_observed": ["Specific observable detail 1", "Specific observable detail 2"],
  "priority_hint": "Low" | "Medium" | "High" | "Critical",
  "confidence": 0.85 to 0.99,
  "needs_user_confirmation": true
}`;

    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.token && this.token.trim()) {
      headers['Authorization'] = `Bearer ${this.token.trim()}`;
    }

    const payload = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: formattedUrl }
            },
            {
              type: 'text',
              text: isTamil
                ? 'Inspect this photo for civic hazards. Output structured JSON strictly in Tamil or Tanglish (Latin script). Never output Chinese characters.'
                : 'Inspect this photo for civic hazards. Output structured JSON strictly in English (Latin alphabet). Never output Chinese characters.'
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 512,
      response_format: { type: 'json_object' }
    };

    // Pre-flight check: Hugging Face Router requires bearer token
    if (this.endpointUrl.includes('router.huggingface.co') && (!this.token || !this.token.trim())) {
      logger.warn('Qwen Vision Provider: HF_TOKEN is not configured for Hugging Face Router endpoint. Failing fast without unauthenticated network roundtrip.');
      const err = new Error('Hugging Face Router requires HF_TOKEN to be configured');
      err.status = 401;
      err.code = 'CONFIG_MISSING';
      throw err;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      let activeEndpoint = this.endpointUrl;
      let activeModel = this.model;

      // Hugging Face router normalization: map hf-inference path and 2B model alias directly to active serverless VL endpoint
      if (activeEndpoint.includes('router.huggingface.co')) {
        if (activeEndpoint.includes('/hf-inference/v1/')) {
          activeEndpoint = activeEndpoint.replace('/hf-inference/v1/', '/v1/');
        }
        if (activeModel === 'Qwen/Qwen3-VL-2B-Instruct') {
          activeModel = 'Qwen/Qwen3-VL-30B-A3B-Instruct';
        }
        payload.model = activeModel;
      }

      logger.info(`Sending image analysis request to Qwen provider at ${activeEndpoint} (model: ${activeModel})`);
      let response = await fetch(activeEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      // Handle Hugging Face router cluster routing fallback for Qwen3-VL if needed
      if (!response.ok && response.status === 400 && activeEndpoint.includes('router.huggingface.co')) {
        const firstErrorText = await response.text().catch(() => '');
        if (firstErrorText.includes('Model not supported by provider hf-inference') || firstErrorText.includes('model_not_supported')) {
          activeEndpoint = 'https://router.huggingface.co/v1/chat/completions';
          activeModel = 'Qwen/Qwen3-VL-30B-A3B-Instruct';
          payload.model = activeModel;
          logger.info(`Retrying Hugging Face Router with active Qwen3-VL endpoint: ${activeEndpoint} (model: ${activeModel})`);
          response = await fetch(activeEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal
          });
        } else {
          logger.warn(`Qwen Vision Provider returned HTTP ${response.status}: ${firstErrorText.slice(0, 300)}`);
          const error = new Error(`Vision provider returned HTTP ${response.status}`);
          error.status = response.status;
          error.details = firstErrorText;
          throw error;
        }
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.warn(`Qwen Vision Provider returned HTTP ${response.status}: ${errorText.slice(0, 300)}`);
        
        const error = new Error(`Vision provider returned HTTP ${response.status}`);
        error.status = response.status;
        error.details = errorText;
        throw error;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Vision provider returned empty content');
      }

      // Clean any possible code fence blocks
      let cleaned = content.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleaned);

      // Defensive sanitization: ensure no Chinese characters reach callers
      const containsHanzi = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.detected_issue === 'string' && containsHanzi.test(parsed.detected_issue)) {
          const stripped = parsed.detected_issue.replace(/[\u4E00-\u9FFF\u3400-\u4DBF]+/g, ' ').replace(/\s+/g, ' ').trim();
          parsed.detected_issue = stripped.length >= 3 ? stripped : 'Civic Infrastructure Hazard';
        }
        if (typeof parsed.description === 'string' && containsHanzi.test(parsed.description)) {
          parsed.description = 'Visual analysis identified an infrastructure hazard requiring municipal attention.';
        }
        if (Array.isArray(parsed.evidence_observed)) {
          parsed.evidence_observed = parsed.evidence_observed.filter(e => typeof e === 'string' && !containsHanzi.test(e));
        }
      }

      return parsed;
    } catch (err) {
      if (err.name === 'AbortError') {
        logger.warn(`Qwen Vision Provider timed out after ${this.timeoutMs}ms`);
        const timeoutErr = new Error('Vision provider request timed out');
        timeoutErr.code = 'TIMEOUT';
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export default QwenVisionProvider;
