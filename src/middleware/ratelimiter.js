const {WINDOW_SIZE_MS , MAX_REQUESTS} = require('../config/index.js');
const store = {};

function rateLimiter(req ,res ,next){
  const clientId = req.ip;
  const now= Date.now();

  if(!store[clientId]){
    store[clientId] = {count:1 , windowStart : now};
    setHeaders(res,MAX_REQUESTS -1 ,WINDOW_SIZE_MS);
    return next();
  }
  const record = store[clientId];
  const windowAge = now - record.windowStart;
  const windowExpired = windowAge >= WINDOW_SIZE_MS;

  if(windowExpired){
    record.count=1;
    record.windowStart =now;
    setHeaders(res,MAX_REQUESTS -1 ,WINDOW_SIZE_MS);
    return next();
  }

  if(record.count < MAX_REQUESTS){
    record.count++;
    const remianing = MAX_REQUESTS -record.count;
    const windowLeft = WINDOW_SIZE_MS - windowAge;
    setHeaders(res,remianing, windowLeft);
    return next();
  }

  const retryAfter = Math.ceil((WINDOW_SIZE_MS - windowAge)/1000);
  res.set('Retry-After' ,retryAfter);
  res.set('X-RateLimit-Limit', MAX_REQUESTS);
  res.set('X-RateLimit-Remaining',0);
  return res.status(429).json({
    error : 'Too many requests',
    message : `Limit is ${MAX_REQUESTS} requests/min. Try again in ${retryAfter}s.`
  });
}

function setHeaders(res,remianing,windowLeftMs){
  res.set('X-RateLimit-Limit', MAX_REQUESTS);
  res.set('X-RateLimit-Remaining', remianing);
  res.set('X-RateLimit-Reset', Math.ceil(windowLeftMs/1000));
}

module.exports = { rateLimiter};