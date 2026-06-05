const {WINDOW_SIZE_MS , MAX_REQUESTS} = require('../config/index.js');
const redis =require('../config/redis.js');

async function rateLimiter(req,res,next){
  const clientId = req.ip;
  const key = `ratelimit:${clinetId}`;
  const now = Date.now();
  const windowSec = WINDOW_SIZE_MS / 1000;

  const data = await redis.get(key);

  if(!data){
    const record = {count : 1, windowStart : now };
    await redis.set(key,JSON.stringify(record),'EX',windowSec);
    setHeaders(res,MAX_REQUESTS - 1,WINDOW_SIZE_MS);
    return next(); 
  }

  const record = JSON.parse(data);
  const windowAge = now - record.windowStart;
  const windowExpired = windowAge >= WINDOW_SIZE_MS;

  if(windowExpired){
    const fresh = {count : 1,windowStart : now};
    await redis.set(key,JSON.stringify(fresh),'EX', windowSec);
    setHeaders(res,MAX_REQUESTS - 1, WINDOW_SIZE_MS);
    return next();
  }

  if(record.count < MAX_REQUESTS){
    record.count++;
    const remaining = MAX_REQUESTS - record.count;
    const windowLeft = WINDOW_SIZE_MS - windowAge;
    await redis.set(key, JSON.stringify(record),'EX',Math.ceil(windowLeft / 1000));
    setHeaders(res, remaining, windowLeft);
    return next();
  }

  const retryAfter = Math.ceil((WINDOW_SIZE_MS - windowAge) / 1000);
  res.set('Retry-After', retryAfter);
  res.set('X-RateLimit-Limit',     MAX_REQUESTS);
  res.set('X-RateLimit-Remaining', 0);
  return res.status(429).json({
    error : 'Too Many Requests',
    meassage : `Limit is ${MAX_REQUESTS} requests/min. Try again in ${retryAfter}s.`
  });
}

function setHeaders(res,remianing,windowLeftMs){
  res.set('X-RateLimit-Limit', MAX_REQUESTS);
  res.set('X-RateLimit-Remaining', remianing);
  res.set('X-RateLimit-Reset', Math.ceil(windowLeftMs/1000));
}

module.exports = { rateLimiter};