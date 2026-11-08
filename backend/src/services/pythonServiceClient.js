import axios from 'axios';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Reusable HTTP Client for internal Node.js to Python FastAPI Microservice communication.
 * 
 * Responsibilities:
 *  - Reads Python service URL and shared secret from environment variables.
 *  - Dispatches structured JSON requests with internal authentication headers.
 *  - Implements automatic retries with exponential backoff for transient network failures.
 *  - Sanitizes logs to prevent secret leakage.
 *  - Standardizes error envelopes into AppError instances.
 */
export class PythonServiceClient {
  /**
   * @param {Object} [config] - Client configuration options
   * @param {string} [config.baseUrl] - Base URL of the Python microservice
   * @param {string} [config.secret] - Internal shared service secret
   * @param {number} [config.timeout] - Request timeout in milliseconds
   * @param {number} [config.maxRetries] - Maximum retry attempts for transient errors
   */
  constructor(config = {}) {
    this._customBaseUrl = config.baseUrl || null;
    this._customSecret = config.secret !== undefined ? config.secret : null;
    this.timeout = config.timeout || parseInt(process.env.PYTHON_SERVICE_TIMEOUT_MS, 10) || 10000;
    this.maxRetries = config.maxRetries !== undefined ? config.maxRetries : 2;
  }

  get baseUrl() {
    return (
      this._customBaseUrl ||
      process.env.PYTHON_SERVICE_URL ||
      process.env.AI_SERVICE_URL ||
      'http://127.0.0.1:8000'
    ).replace(/\/+$/, '');
  }

  set baseUrl(url) {
    this._customBaseUrl = url;
  }

  get secret() {
    return (
      this._customSecret !== null
        ? this._customSecret
        : (process.env.PYTHON_SERVICE_SECRET || process.env.SERVICE_SECRET || 'your_internal_service_secret')
    );
  }

  set secret(sec) {
    this._customSecret = sec;
  }

  /**
   * Mask sensitive service secrets from string messages or log entries
   * @param {string} text - Raw message
   * @returns {string} Sanitized string
   */
  maskSecret(text) {
    if (!text || typeof text !== 'string') return text;
    const currentSecret = this.secret;
    if (currentSecret && currentSecret.length > 3) {
      return text.split(currentSecret).join('***REDACTED_SECRET***');
    }
    return text;
  }

  /**
   * Dispatches an HTTP request to the Python microservice with retries and timeout
   * @param {Object} reqOptions - Axios request configuration
   * @param {number} [retriesLeft] - Remaining retry attempts
   * @returns {Promise<any>} Response JSON data
   */
  async request(reqOptions, retriesLeft = this.maxRetries) {
    const url = reqOptions.url.startsWith('http')
      ? reqOptions.url
      : `${this.baseUrl}${reqOptions.url.startsWith('/') ? '' : '/'}${reqOptions.url}`;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(this.secret ? { 'X-Service-Secret': this.secret } : {}),
      ...(reqOptions.headers || {}),
    };

    const config = {
      ...reqOptions,
      url,
      headers,
      timeout: reqOptions.timeout || this.timeout,
    };

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      const isTransient = this._isTransientError(error);

      // If error is transient and retries remain, wait with exponential backoff and retry
      if (isTransient && retriesLeft > 0) {
        const attempt = this.maxRetries - retriesLeft + 1;
        const delayMs = Math.pow(2, attempt) * 150; // 300ms, 600ms, etc.
        if (process.env.NODE_ENV !== 'test') {
          console.warn(
            `⚠️ [PythonServiceClient] Transient error (${error.code || error.response?.status}) ` +
            `calling ${config.method?.toUpperCase() || 'GET'} ${reqOptions.url}. ` +
            `Retrying in ${delayMs}ms (${attempt}/${this.maxRetries})...`
          );
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return this.request(reqOptions, retriesLeft - 1);
      }

      // Convert axios error into standardized AppError
      throw this._formatError(error, reqOptions);
    }
  }

  /**
   * Determine if an error is transient (network connection issue or server temporarily down)
   * @private
   */
  _isTransientError(error) {
    if (!error.response) {
      // Network disconnect, connection refused, DNS lookup failure, connection timeout
      return ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ENOTFOUND'].includes(error.code);
    }
    // 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout
    return [502, 503, 504].includes(error.response.status);
  }

  /**
   * Format error into AppError instance without exposing internal credentials
   * @private
   */
  _formatError(error, reqOptions) {
    const endpoint = reqOptions.url;

    if (!error.response) {
      if (error.code === 'ECONNREFUSED') {
        return new AppError(
          `Python AI microservice is currently unreachable at ${this.baseUrl}. Please verify the Python service is running.`,
          503,
          'AI_SERVICE_UNAVAILABLE',
          { endpoint, code: error.code }
        );
      }
      if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        return new AppError(
          `Python AI microservice request timed out after ${this.timeout}ms on ${endpoint}`,
          504,
          'AI_SERVICE_TIMEOUT',
          { endpoint, code: error.code }
        );
      }
      return new AppError(
        `Failed to connect to Python AI microservice: ${this.maskSecret(error.message)}`,
        503,
        'AI_SERVICE_CONNECTION_ERROR',
        { endpoint, code: error.code }
      );
    }

    const status = error.response.status;
    const data = error.response.data || {};
    const apiError = typeof data.error === 'string' ? data.error : data.message || 'Error from Python service';
    const errorCode = data.code || `AI_SERVICE_${status}`;

    if (status === 401) {
      return new AppError(
        'Internal service authentication failed: missing or invalid credentials.',
        500,
        'AI_SERVICE_AUTH_ERROR',
        { endpoint, status }
      );
    }

    if (status === 403) {
      return new AppError(
        'Internal service authorization failed: service secret mismatch between Node.js and Python.',
        500,
        'AI_SERVICE_FORBIDDEN',
        { endpoint, status }
      );
    }

    if (status === 422) {
      return new AppError(
        `Python AI microservice rejected design payload validation: ${this.maskSecret(apiError)}`,
        422,
        'AI_SERVICE_VALIDATION_ERROR',
        { endpoint, details: data.details || null }
      );
    }

    return new AppError(
      `Python AI service returned status ${status}: ${this.maskSecret(apiError)}`,
      status >= 500 ? 502 : status,
      errorCode,
      { endpoint, details: data.details || null }
    );
  }

  /**
   * Check Python microservice operational health status
   * GET /health or /api/v1/health
   * @param {boolean} [versioned=false] - Whether to use /api/v1/health
   * @returns {Promise<Object>}
   */
  async checkHealth(versioned = false) {
    const endpoint = versioned ? '/api/v1/health' : '/health';
    return this.request({
      method: 'GET',
      url: endpoint,
    });
  }

  /**
   * Retrieve processing capabilities from Python microservice
   * GET /api/v1/capabilities
   * @returns {Promise<Object>}
   */
  async getCapabilities() {
    return this.request({
      method: 'GET',
      url: '/api/v1/capabilities',
    });
  }

  /**
   * Submit normalized design payload to Python microservice for structural inspection
   * POST /api/v1/design/analyze
   * @param {Object} designPayload - Normalized design payload (tree, pages, or nodes)
   * @param {Object} [options] - Additional request options
   * @returns {Promise<Object>} Structured analysis response
   */
  async analyzeDesign(designPayload, options = {}) {
    if (!designPayload || typeof designPayload !== 'object') {
      throw new AppError('Design payload object is required for AI analysis', 400, 'MISSING_PAYLOAD');
    }

    return this.request({
      method: 'POST',
      url: '/api/v1/design/analyze',
      data: designPayload,
      timeout: options.timeout,
    });
  }

  /**
   * Non-blocking availability probe for health checks and status reporting
   * @returns {Promise<boolean>}
   */
  async isServiceAvailable() {
    try {
      const res = await this.checkHealth();
      return res && res.status === 'ok';
    } catch {
      return false;
    }
  }
}

// Export singleton instance configured from current environment
export const pythonServiceClient = new PythonServiceClient();
export default pythonServiceClient;
