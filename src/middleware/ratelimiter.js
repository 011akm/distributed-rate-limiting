const {WINDOW_SIZE_MS , MAX_REQUESTS} = require('../config/index.js');
const redis =require('../config/redis.js');

const WINDOW_SIZE_SEC = WINDOW_SIZE_MS / 1000;

async function rateLimiter(req,res,next){
  const clientId = req.ip;
  const key = `ratelimit:${clientId}`;
  const count = await redis.incr(key);

  if(count === 1){
    await redis.expire(key, WINDOW_SIZE_SEC);
  }
  
  const ttl = await redis.ttl(key);

  if(count > MAX_REQUESTS){
    res.set('Retry-After', ttl);
    res.set('X-RateLimit-Limit', MAX_REQUESTS);
    res.set('X-RateLimit-Remaining', 0);
    res.set('X-RateLimit-Reset', ttl);
    return res.status(429).json({
      error : 'Too Many Requests',
      meassage : `Limit is ${MAX_REQUESTS} requests/min. Try again in ${ttl}s.`
    });
  }

  res.set('X-RateLimit-Limit',     MAX_REQUESTS);
  res.set('X-RateLimit-Remaining', MAX_REQUESTS - count);
  res.set('X-RateLimit-Reset', ttl);
  next();
  
}

module.exports = { rateLimiter};