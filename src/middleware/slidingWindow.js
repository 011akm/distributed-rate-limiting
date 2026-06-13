const redis = require('../config/redis.js');
const { WINDOW_SIZE_MS, MAX_REQUESTS } = require('../config/index.js');

const luaScripts = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    local clearBefore = now - window 

    redis.call('ZREMRANGEBYSCORE', key , 0, clearBefore)

    local count = redis.call('ZCARD', key)
    if count < limit then
        redis.call('ZADD', key, now, now)
        redis.call('EXPIRE', key, math.ceil(window/1000))
        return {count + 1, 1}
    end

    return {count, 0}
`;

async function slidingWindowLimiter(req,res,next){
    const clientId = req.ip;
    const key = `sliding:${clientId}`;
    const now = Date.now();

    const [count , allowed] = await redis.eval(luaScripts, 1, key, now, WINDOW_SIZE_MS, MAX_REQUESTS);
    const remaining = Math.max(MAX_REQUESTS - count, 0);

    res.set('X-RateLimit-Limit',     MAX_REQUESTS);
    res.set('X-RateLimit-Remaining', remaining);
    res.set('X-RateLimit-Algorithm', 'sliding-window');

    if(!allowed){
        console.log(`[BLOCKED] IP: ${clientId} | Active requests: ${count}/${MAX_REQUESTS} | Time: ${new Date().toISOString()}`);
        return res.status(429).json({
            error : 'Too Many Requests',
            algorithm : 'sliding-window',
            message : `Limit is ${MAX_REQUESTS} requests/min. Try again later.`,
        });
    }
    next();
}

module.exports = {slidingWindowLimiter};