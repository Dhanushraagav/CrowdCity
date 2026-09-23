/**
 * CrowdCity AI — Mock Vision Provider
 * Used for deterministic automated unit tests and offline testing.
 */

export class MockVisionProvider {
  constructor(config = {}) {
    this.shouldFail = config.shouldFail || false;
    this.failureType = config.failureType || 'HTTP_503';
    this.customResponse = config.customResponse || null;
  }

  setMockResponse(response) {
    this.customResponse = response;
  }

  setShouldFail(shouldFail, failureType = 'HTTP_503') {
    this.shouldFail = shouldFail;
    this.failureType = failureType;
  }

  async analyze({ imageBase64, mimeType }) {
    if (this.shouldFail) {
      if (this.failureType === 'TIMEOUT') {
        const err = new Error('Vision provider request timed out');
        err.code = 'TIMEOUT';
        throw err;
      }
      if (this.failureType === 'HTTP_429') {
        const err = new Error('Rate limit exceeded');
        err.status = 429;
        throw err;
      }
      const err = new Error('Service temporarily unavailable');
      err.status = 503;
      throw err;
    }

    if (this.customResponse) {
      return this.customResponse;
    }

    // Default mock response: Road hazard with valid schema
    return {
      is_valid_civic_issue: true,
      detected_issue: 'Deep Asphalt Road Pothole',
      suggested_category: 'Roads',
      description: 'Crater on roadway surface causing potential vehicular hazard and traffic disruption.',
      evidence_observed: [
        'Depression in road surface',
        'Broken asphalt chunks and exposed gravel layer'
      ],
      priority_hint: 'High',
      confidence: 0.94,
      needs_user_confirmation: true
    };
  }
}

export default MockVisionProvider;
