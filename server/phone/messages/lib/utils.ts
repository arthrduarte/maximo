import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';

export function isUSPhoneNumber(formattedPhone: string): boolean {
    // Check if number starts with +1
    const countryCode = formattedPhone.slice(0, 2);
    if (countryCode !== '+1') return false;

    // Extract area code (next 3 digits after +1)
    const areaCode = parseInt(formattedPhone.slice(2, 5));

    // Check if the area code is in the Canadian codes list
    const canadaCodes = [ 905, 902, 873, 867, 825, 807, 819, 782, 780, 778, 705, 647, 709, 639, 613, 587, 604, 581, 519, 579, 514, 506, 450, 438, 437, 431, 418, 416, 365, 403, 343, 306, 250, 289, 236, 226, 249, 204 ];

    // Return true if it's a +1 number but NOT a Canadian area code
    return !canadaCodes.includes(areaCode);
}


// Simple in-memory store for rate limiting
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// Rate limit events for monitoring
interface RateLimitEvent {
  timestamp: string;
  phone: string;
  ip?: string;
  endpoint: string;
  count: number;
}

// Log rate limit events for monitoring
function logRateLimitEvent(event: RateLimitEvent): void {
  console.warn('RATE LIMIT EVENT:', event);
  
  // In production, you might want to log these events to a file or monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Example: Append to a log file
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, 'rate-limit-events.log');
    
    try {
      // Create logs directory if it doesn't exist
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      // Append log entry
      fs.appendFileSync(
        logFile, 
        `${new Date().toISOString()} | ${event.phone} | ${event.ip || 'unknown'} | ${event.endpoint} | ${event.count}\n`
      );
    } catch (error) {
      console.error('Failed to write rate limit log:', error);
    }
  }
}

// Cleanup interval in milliseconds (every 10 minutes)
const CLEANUP_INTERVAL = 10 * 60 * 1000;

// Store to track message counts per phone number
const messageStore: RateLimitStore = {};

// Store to track admin API requests
const adminMessageStore: RateLimitStore = {};

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const key in messageStore) {
    if (messageStore[key].resetTime < now) {
      delete messageStore[key];
    }
  }
  
  for (const key in adminMessageStore) {
    if (adminMessageStore[key].resetTime < now) {
      delete adminMessageStore[key];
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Creates a rate limiter middleware for SMS messages
 * @param windowMs Time window in milliseconds
 * @param maxMessages Maximum messages allowed in the time window
 * @returns Express middleware function
 */
export function smsRateLimiter(windowMs = 60000, maxMessages = 10) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Extract phone number from Twilio SMS webhook
    const phone = req.body.From;
    
    if (!phone) {
      return next();
    }

    const now = Date.now();
    
    // Initialize or update entry for this phone number
    if (!messageStore[phone] || messageStore[phone].resetTime < now) {
      messageStore[phone] = {
        count: 1,
        resetTime: now + windowMs
      };
      return next();
    }
    
    // Increment count for existing entries
    messageStore[phone].count += 1;
    
    // Check if rate limit exceeded
    if (messageStore[phone].count > maxMessages) {
      // Log rate limit event
      logRateLimitEvent({
        timestamp: new Date().toISOString(),
        phone,
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        endpoint: '/api/sms/webhook',
        count: messageStore[phone].count
      });
      
      console.warn(`🚫 Rate limit exceeded for ${phone}: ${messageStore[phone].count} messages in ${windowMs/1000}s`);
      
      // Set a flag on the request to indicate it's rate limited
      (req as any).isRateLimited = true;
      
      // Continue to the next middleware but skip processing in the handler
      next();
      return;
    }
    
    next();
  };
}

/**
 * Creates a rate limiter middleware for admin SMS endpoint
 * @param windowMs Time window in milliseconds
 * @param maxMessages Maximum messages allowed in the time window
 * @returns Express middleware function
 */
export function adminSmsRateLimiter(windowMs = 60000, maxMessages = 20) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Extract phone number from request body
    const phone = req.body.to;
    
    if (!phone) {
      return next();
    }

    const now = Date.now();
    
    // Get a unique key combining IP and phone 
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${phone}`;
    
    // Initialize or update entry for this phone number
    if (!adminMessageStore[key] || adminMessageStore[key].resetTime < now) {
      adminMessageStore[key] = {
        count: 1,
        resetTime: now + windowMs
      };
      return next();
    }
    
    // Increment count for existing entries
    adminMessageStore[key].count += 1;
    
    // Check if rate limit exceeded
    if (adminMessageStore[key].count > maxMessages) {
      // Log rate limit event
      logRateLimitEvent({
        timestamp: new Date().toISOString(),
        phone,
        ip,
        endpoint: '/admin/send-sms',
        count: adminMessageStore[key].count
      });
      
      console.warn(`Admin SMS rate limit exceeded for ${key}: ${adminMessageStore[key].count} messages in ${windowMs}ms`);
      return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
    }
    
    next();
  };
}

/**
 * Checks if a phone number is currently rate limited
 * @param phone The phone number to check
 * @returns true if rate limited, false otherwise
 */
export function isRateLimited(phone: string): boolean {
  if (!phone) return false;
  
  const now = Date.now();
  
  // If the entry doesn't exist or has expired, not rate limited
  if (!messageStore[phone] || messageStore[phone].resetTime < now) {
    return false;
  }
  
  // Check if over the limit (10 messages per minute)
  if (messageStore[phone].count > 10) {
    console.warn(`🚫 Number ${phone} is rate limited (${messageStore[phone].count} msgs)`);
    return true;
  }
  
  return false;
} 