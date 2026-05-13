import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Create axios instance
const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Import and parse a Figma file
 * @param {string} url - Figma file URL
 * @returns {Promise<Object>} Parsed design tree
 */
export const importFigmaFile = async (url) => {
  try {
    const response = await client.post('/api/figma/import', { url });
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to import Figma file');
    }
    
    return response.data.data;
  } catch (error) {
    const message = error.response?.data?.error || error.message || 'Failed to import Figma file';
    throw new Error(message);
  }
};

/**
 * Check API health
 * @returns {Promise<Object>} Health status
 */
export const checkHealth = async () => {
  try {
    const response = await client.get('/health');
    return response.data;
  } catch (error) {
    throw new Error('API health check failed');
  }
};

export default client;
