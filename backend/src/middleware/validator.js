import { parseFigmaUrl, isValidFigmaUrl } from '../utility/url.js';
import { AppError } from './errorHandler.js';

/**
 * Middleware to validate Figma URL import requests
 */
export const validateFigmaImportRequest = (req, res, next) => {
  const { url } = req.body || {};

  if (!url) {
    return next(new AppError('Figma URL is required in request body', 400, 'MISSING_URL'));
  }

  if (typeof url !== 'string') {
    return next(new AppError('Figma URL must be a string', 400, 'INVALID_URL_TYPE'));
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return next(new AppError('Figma URL cannot be empty', 400, 'EMPTY_URL'));
  }

  if (!isValidFigmaUrl(trimmed)) {
    return next(
      new AppError(
        'Invalid Figma URL format. Expected: https://www.figma.com/file/:key or https://www.figma.com/design/:key',
        400,
        'INVALID_FIGMA_URL'
      )
    );
  }

  // Attach pre-parsed metadata to request for controllers to consume
  req.figmaMeta = parseFigmaUrl(trimmed);
  return next();
};

