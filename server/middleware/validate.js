const { ZodError } = require('zod');

/**
 * Express middleware to validate request body using a Zod schema.
 * Rejects invalid payloads with 400 Bad Request and detailed schema issues.
 * @param {import('zod').ZodSchema} schema
 */
const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.issues.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }));
      const formatted = details.map(d => `${d.field ? `${d.field}: ` : ''}${d.message}`).join(', ');
      return res.status(400).json({
        success: false,
        message: formatted ? `Validation error: ${formatted}` : 'Validation failed on request body',
        errors: details
      });
    }
    next(err);
  }
};

/**
 * Express middleware to validate request query parameters using a Zod schema.
 * @param {import('zod').ZodSchema} schema
 */
const validateQuery = (schema) => (req, res, next) => {
  try {
    req.query = schema.parse(req.query);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.issues.map(e => ({
        parameter: e.path.join('.'),
        message: e.message
      }));
      const formatted = details.map(d => `${d.parameter ? `${d.parameter}: ` : ''}${d.message}`).join(', ');
      return res.status(400).json({
        success: false,
        message: formatted ? `Validation error: ${formatted}` : 'Validation failed on query parameters',
        errors: details
      });
    }
    next(err);
  }
};

module.exports = {
  validateBody,
  validateQuery
};

