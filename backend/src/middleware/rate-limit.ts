import rateLimit from 'express-rate-limit';

/**
 * Rate limiter to prevent infinite polling loops and abuse
 * 
 * Limits:
 * - 100 requests per minute per IP
 * - Returns 429 Too Many Requests when exceeded
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Max 100 requests per window per IP
  message: {
    error: 'Too many requests. Please try again later.',
    retryAfter: 60,
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/health',
});

/**
 * Stricter rate limiter for status polling endpoints
 * Prevents infinite loop scenarios
 */
export const statusPollingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Max 30 requests per minute (0.5 req/sec)
  message: {
    error: 'Polling rate exceeded. Please slow down.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
