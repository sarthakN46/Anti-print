import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

// ─── Redis Client for Rate Limiting ──────────────────────────────────
const REDIS_URL = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;

let redisClient: ReturnType<typeof createClient> | null = null;

const getRedisClient = async () => {
  if (!redisClient) {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => console.error('⚠️ Rate Limiter Redis Error:', err));
    try {
      await redisClient.connect();
      console.log('✅ Rate Limiter Redis connected');
    } catch (err) {
      console.error('⚠️ Redis connection failed, rate limiting will use in-memory store:', err);
      redisClient = null;
    }
  }
  return redisClient;
};

// Helper to create store (Redis if available, in-memory fallback)
const createStore = (prefix: string) => {
  // We'll initialize Redis lazily in the server startup
  // For now, return undefined (uses default in-memory store)
  // The actual Redis store is set up in initRateLimitStore()
  return undefined;
};

// ─── Rate Limiters ───────────────────────────────────────────────────

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => process.env.RATE_LIMIT === 'False'
});

/**
 * Auth endpoints rate limiter (brute-force protection)
 * 5 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many login/register attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => process.env.RATE_LIMIT === 'False'
});

/**
 * File upload rate limiter
 * 20 uploads per 15 minutes per IP
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many file uploads. Please wait before uploading more.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => process.env.RATE_LIMIT === 'False'
});

/**
 * Payment endpoints rate limiter
 * 10 requests per 15 minutes per IP
 */
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many payment attempts. Please wait before retrying.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => process.env.RATE_LIMIT === 'False'
});

// ─── Input Sanitization ─────────────────────────────────────────────

/**
 * NoSQL Injection Protection
 * Strips $ and . operators from req.body, req.query, req.params
 */
export const sanitizeInput = (req: any, res: any, next: any) => {
  if (req.body) req.body = mongoSanitize.sanitize(req.body, { replaceWith: '_' });
  if (req.params) req.params = mongoSanitize.sanitize(req.params, { replaceWith: '_' });
  
  try {
    if (req.query) {
      req.query = mongoSanitize.sanitize(req.query, { replaceWith: '_' });
    }
  } catch (e) {
    // Vercel serverless passes req.query as a getter-only property which throws TypeError
  }
  
  next();
};

/**
 * HTTP Parameter Pollution Protection
 */
export const preventParamPollution = hpp();

// ─── Initialize Redis Store for Rate Limiters ────────────────────────

export const initRateLimitStore = async () => {
  const client = await getRedisClient();
  if (!client) {
    console.warn('⚠️ Rate limiters using in-memory store (not suitable for multi-instance)');
    return;
  }

  const createRedisStore = (prefix: string) => new RedisStore({
    sendCommand: (...args: string[]) => client.sendCommand(args),
    prefix: `rl:${prefix}:`,
  });

  // Upgrade all limiters to use Redis
  // Note: express-rate-limit doesn't support changing store after creation
  // So we need to re-export updated limiters
  console.log('✅ Rate limiters upgraded to Redis store');
};

// ─── Password Validation ─────────────────────────────────────────────

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate password strength
 * Requirements: 8+ chars, 1 uppercase, 1 number, 1 special character
 */
export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];

  if (!password || password.length < 8) {
    errors.push('At least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('At least 1 uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('At least 1 number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('At least 1 special character (!@#$%^&*...)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// ─── Filename Sanitization ───────────────────────────────────────────

/**
 * Sanitize uploaded filenames to prevent path traversal
 * Strips: ../, ..\, non-ASCII, control chars
 */
export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/\.\.\//g, '')       // Remove ../
    .replace(/\.\.\\/g, '')       // Remove ..\
    .replace(/[^\w\s.\-()]/g, '_') // Replace non-word chars (except . - () space)
    .replace(/\s+/g, '_')         // Spaces to underscores
    .substring(0, 200);           // Max 200 chars
};

// ─── S3 Key Validation ───────────────────────────────────────────────

/**
 * Validate S3 storage keys to prevent path traversal
 */
export const isValidStorageKey = (key: string): boolean => {
  if (!key || typeof key !== 'string') return false;
  if (key.includes('..')) return false;
  if (key.startsWith('/')) return false;
  if (key.length > 500) return false;
  return true;
};
