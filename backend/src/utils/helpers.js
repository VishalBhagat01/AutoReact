/**
 * Backend utility functions
 */

import { isValidFigmaUrl } from '../utility/url.js';

export { isValidFigmaUrl };

/**
 * Validate Figma token format
 * @param {string} token - Token to validate
 * @returns {boolean} Is valid
 */
export const isValidFigmaToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  return token.startsWith('figd_');
};

/**
 * Format error response
 * @param {string} message - Error message
 * @param {number} status - HTTP status
 * @returns {Object} Error object
 */
export const formatError = (message, status = 400) => {
  return {
    success: false,
    error: message,
    status,
  };
};

/**
 * Format success response
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @returns {Object} Success object
 */
export const formatSuccess = (data, message = 'Success') => {
  return {
    success: true,
    data,
    message,
  };
};

/**
 * Extract node metadata
 * @param {Object} node - Figma node
 * @returns {Object} Metadata
 */
export const extractNodeMetadata = (node) => {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    hasChildren: node.children && node.children.length > 0,
    childCount: node.children ? node.children.length : 0,
  };
};

/**
 * Log request/response
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {number} status - Response status
 * @param {number} duration - Duration in ms
 */
export const logRequest = (method, path, status, duration) => {
  const statusEmoji = status < 300 ? '✅' : status < 400 ? '⚠️' : '❌';
  console.log(`${statusEmoji} ${method} ${path} - ${status} (${duration}ms)`);
};
