const {WINDOW_SIZE_MS , MAX_REQUESTS} = require('../config/index.js');
const redis =require('../config/redis.js');

const WINDOW_SIZE_SEC = WINDOW_SIZE_MS / 1000;

const luaScripts = `
  local count=redis.call('INCR' , KEYS[1])
  if count == 1 then
    redis.call('EXPIRE' , KEYS[1] , ARGV[1])
  end
  return count
`;

async function fixedWindowLimiter(req,res,next){
  const clientId = req.ip;
  const key = `ratelimit:${clientId}`;
  
  const count = await redis.eval(luaScripts, 1, key, WINDOW_SIZE_SEC)
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

module.exports = {fixedWindowLimiter};