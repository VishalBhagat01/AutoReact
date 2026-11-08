import mongoose from 'mongoose';
import { AppError } from './errorHandler.js';

/**
 * Middleware to validate MongoDB ObjectId route parameters
 * @param {string} [paramName='id'] - Name of the route parameter to check
 */
export const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError(
          `Invalid ID format: '${id}'. Must be a valid 24-character hexadecimal MongoDB ObjectId.`,
          400,
          'INVALID_OBJECT_ID'
        )
      );
    }
    return next();
  };
};

export default validateObjectId;

