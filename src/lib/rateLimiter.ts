/**
 * Simple in-memory rate limiter
 * Tracks requests by IP address and enforces limits
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a request is allowed for the given identifier
   * @param identifier - Unique identifier (e.g., IP address)
   * @returns Object with allowed status and remaining requests
   */
  check(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    // No entry or expired entry
    if (!entry || now >= entry.resetAt) {
      const resetAt = now + this.windowMs;
      this.requests.set(identifier, { count: 1, resetAt });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt };
    }

    // Check if limit exceeded
    if (entry.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    // Increment count
    entry.count++;
    this.requests.set(identifier, entry);

    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (now >= entry.resetAt) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * Reset limit for a specific identifier
   */
  reset(identifier: string) {
    this.requests.delete(identifier);
  }

  /**
   * Get current status for an identifier without incrementing
   */
  getStatus(identifier: string): { remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry || now >= entry.resetAt) {
      return { remaining: this.maxRequests, resetAt: now + this.windowMs };
    }

    return {
      remaining: Math.max(0, this.maxRequests - entry.count),
      resetAt: entry.resetAt,
    };
  }
}

// Create singleton instance
// Default: 10 requests per minute
export const aiAgentRateLimiter = new RateLimiter(10, 60000);

/**
 * Get client IP from request headers
 */
export function getClientIP(req: Request): string {
  // Check various headers for IP (works with most proxies/load balancers)
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback to a default (not ideal but prevents crashes)
  return "unknown";
}
