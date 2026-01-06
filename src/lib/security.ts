import { z } from 'zod';

// Sanitize input to prevent XSS attacks
export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Validate and sanitize HTML content
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  // Remove all script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

// Validate email format
export const emailSchema = z.string().email('Invalid email address').max(255);

// Validate phone number (international format with optional +)
export const phoneSchema = z.string()
  .regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format')
  .max(20);

// Validate country
export const countrySchema = z.string().min(2).max(100);

// Validate gender
export const genderSchema = z.enum(['male', 'female', 'other', 'prefer_not_to_say']);

// Validate content for SQL injection patterns
export function hasSqlInjection(input: string): boolean {
  if (!input) return false;
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/gi,
    /(-{2}|;|'|"|`)/g,
    /(\bOR\b|\bAND\b)\s*(\d+\s*=\s*\d+|'[^']*'\s*=\s*'[^']*')/gi,
  ];
  return sqlPatterns.some(pattern => pattern.test(input));
}

// Validate and escape for safe database usage
export function validateSafeInput(input: string, maxLength: number = 500): { isValid: boolean; sanitized: string; error?: string } {
  if (!input) return { isValid: true, sanitized: '' };
  
  if (input.length > maxLength) {
    return { isValid: false, sanitized: '', error: `Input exceeds maximum length of ${maxLength} characters` };
  }
  
  if (hasSqlInjection(input)) {
    return { isValid: false, sanitized: '', error: 'Input contains potentially unsafe characters' };
  }
  
  const sanitized = sanitizeInput(input.trim());
  return { isValid: true, sanitized };
}

// CSP Headers helper (for edge functions)
export const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

// Rate limiting helper (simple in-memory for demo - use Redis in production)
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

export function checkRateLimit(identifier: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now - record.timestamp > windowMs) {
    rateLimitMap.set(identifier, { count: 1, timestamp: now });
    return true;
  }
  
  if (record.count >= maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
}

// Validate SMTP configuration
export const smtpConfigSchema = z.object({
  host: z.string().min(1, 'SMTP host is required').max(255),
  port: z.number().min(1).max(65535),
  username: z.string().min(1, 'Username is required').max(255),
  password: z.string().min(1, 'Password is required').max(255),
  senderEmail: z.string().email('Invalid sender email'),
  senderName: z.string().min(1, 'Sender name is required').max(100),
});

// CSRF token generation
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}
