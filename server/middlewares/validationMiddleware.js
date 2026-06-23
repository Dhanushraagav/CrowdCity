import { ApiError } from './errorMiddleware.js';

// Simple XSS sanitization helper (escapes HTML tags)
const sanitizeInputString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .trim()
    .replace(/<[^>]*>/g, ''); // Strip all HTML tag elements entirely for civic entries
};

// Middleware wrapper generator
const validateSchema = (schema) => {
  return (req, res, next) => {
    try {
      // Validate Body
      if (schema.body) {
        for (const [key, rule] of Object.entries(schema.body)) {
          let value = req.body[key];
          
          if (rule.required && (value === undefined || value === null || value === '')) {
            throw new ApiError(400, `Field '${key}' is required.`);
          }

          if (value !== undefined && value !== null && value !== '') {
            // Apply sanitization if it's a string
            if (typeof value === 'string') {
              value = sanitizeInputString(value);
              req.body[key] = value;
            }

            // Type check
            if (rule.type === 'string' && typeof value !== 'string') {
              throw new ApiError(400, `Field '${key}' must be a string.`);
            }
            if (rule.type === 'number') {
              const num = Number(value);
              if (isNaN(num)) {
                throw new ApiError(400, `Field '${key}' must be a number.`);
              }
              req.body[key] = num;
              value = num;
            }
            if (rule.type === 'array' && !Array.isArray(value)) {
              throw new ApiError(400, `Field '${key}' must be an array.`);
            }

            // String length checks
            if (rule.type === 'string') {
              if (rule.minLength && value.length < rule.minLength) {
                throw new ApiError(400, `Field '${key}' must be at least ${rule.minLength} characters.`);
              }
              if (rule.maxLength && value.length > rule.maxLength) {
                throw new ApiError(400, `Field '${key}' cannot exceed ${rule.maxLength} characters.`);
              }
            }

            // Number value checks
            if (rule.type === 'number') {
              if (rule.min !== undefined && value < rule.min) {
                throw new ApiError(400, `Field '${key}' must be at least ${rule.min}.`);
              }
              if (rule.max !== undefined && value > rule.max) {
                throw new ApiError(400, `Field '${key}' cannot be greater than ${rule.max}.`);
              }
            }

            // Enum check
            if (rule.enum && !rule.enum.includes(value)) {
              throw new ApiError(400, `Field '${key}' must be one of: [${rule.enum.join(', ')}].`);
            }
          }
        }
      }

      // Validate Params
      if (schema.params) {
        for (const [key, rule] of Object.entries(schema.params)) {
          const value = req.params[key];
          if (rule.required && !value) {
            throw new ApiError(400, `Parameter '${key}' is required.`);
          }
          if (value) {
            if (rule.pattern && !rule.pattern.test(value)) {
              throw new ApiError(400, `Parameter '${key}' has an invalid format.`);
            }
          }
        }
      }

      // Validate Query
      if (schema.query) {
        for (const [key, rule] of Object.entries(schema.query)) {
          const value = req.query[key];
          if (rule.required && !value) {
            throw new ApiError(400, `Query parameter '${key}' is required.`);
          }
          if (value && rule.enum && !rule.enum.includes(value)) {
            throw new ApiError(400, `Query parameter '${key}' must be one of: [${rule.enum.join(', ')}].`);
          }
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

// UUID validation regex (allows standard UUIDs and mock-user-* or mock-c-* formats)
const idRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$|^mock-[a-zA-Z0-9\-]+$/;

// Common validation schemas
export const validateCreateIssue = validateSchema({
  body: {
    title: { type: 'string', required: true, minLength: 5, maxLength: 100 },
    description: { type: 'string', required: true, minLength: 10, maxLength: 1000 },
    category: { type: 'string', required: true, enum: ['roads', 'streetlights', 'water_supply', 'drainage', 'garbage', 'traffic', 'public_property', 'parks', 'sanitation', 'safety_hazard', 'environment', 'other'] },
    latitude: { type: 'number', required: true, min: -90, max: 90 },
    longitude: { type: 'number', required: true, min: -180, max: 180 },
    address: { type: 'string', required: false, minLength: 5, maxLength: 200 }
  }
});

export const validateAnalyzeIssue = validateSchema({
  body: {
    title: { type: 'string', required: true, minLength: 5, maxLength: 100 },
    description: { type: 'string', required: true, minLength: 10, maxLength: 1000 }
  }
});

export const validateAddComment = validateSchema({
  params: {
    id: { required: true, pattern: idRegex }
  },
  body: {
    comment_text: { type: 'string', required: true, minLength: 1, maxLength: 500 }
  }
});

export const validateEditComment = validateSchema({
  params: {
    commentId: { required: true, pattern: idRegex }
  },
  body: {
    comment_text: { type: 'string', required: true, minLength: 1, maxLength: 500 }
  }
});

export const validateUpdateStatus = validateSchema({
  params: {
    id: { required: true, pattern: idRegex }
  },
  body: {
    status: { type: 'string', required: true, enum: ['pending', 'assigned', 'in_progress', 'resolved', 'rejected', 'verified', 'timeline_update'] },
    notes: { type: 'string', required: false, maxLength: 500 }
  }
});

export const validateChatPayload = (req, res, next) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      throw new ApiError(400, 'Messages history array is required.');
    }
    if (messages.length === 0) {
      throw new ApiError(400, 'Messages history cannot be empty.');
    }
    for (const msg of messages) {
      if (typeof msg !== 'object' || !msg.role || !msg.content) {
        throw new ApiError(400, 'Each message object must contain a role and content.');
      }
      if (!['user', 'assistant', 'system'].includes(msg.role)) {
        throw new ApiError(400, 'Message role must be one of: [user, assistant, system].');
      }
      msg.content = sanitizeInputString(msg.content);
    }
    next();
  } catch (err) {
    next(err);
  }
};

export const validateUserId = validateSchema({
  body: {
    userId: { type: 'string', required: true, pattern: idRegex },
    role: { type: 'string', required: true, enum: ['citizen', 'authority', 'admin'] }
  }
});

export const validateIdParam = (paramName) => {
  return validateSchema({
    params: {
      [paramName]: { required: true, pattern: idRegex }
    }
  });
};
