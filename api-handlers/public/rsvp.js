import { createHmac } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import publicRsvpHandlerService from '../../lib/public-rsvp-handler.cjs';
import publicRsvpService from '../../lib/public-rsvp.cjs';
import authService from '../../lib/supabase-auth-service.cjs';

let rsvpLimiter;
function getRsvpLimiter() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!rsvpLimiter) {
    rsvpLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, '10 m'),
      analytics: false,
      prefix: 'invitta:ratelimit:rsvp',
    });
  }
  return rsvpLimiter;
}

const handler = publicRsvpHandlerService.createPublicRsvpHandler({
  submitRsvp: ({ input }) => publicRsvpService.submitPublicRsvp({ input, config: authService.getAuthConfig() }),
  rateLimit: async ({ ip, slug }) => {
    const limiter = getRsvpLimiter();
    if (!limiter) return true;
    try {
      const secret = authService.getAuthConfig().secretKey;
      if (!secret) return true;
      const privateIpKey = createHmac('sha256', secret).update(ip).digest('hex');
      const result = await limiter.limit(`${privateIpKey}:${slug}`);
      return result.success;
    } catch (_) {
      // Keep the invitation available if the optional rate-limit store is temporarily down.
      return true;
    }
  },
});

export default handler;
