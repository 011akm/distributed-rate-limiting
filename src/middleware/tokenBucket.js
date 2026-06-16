const redis = require('../config/redis.js');
const { MAX_REQUESTS, WINDOW_SIZE_MS } = require('../config/index.js');

const BUCKET_CAPACITY = MAX_REQUESTS;
const REFILL_RATE = 1;
const REFILL_INTERVAL = WINDOW_SIZE_MS / MAX_REQUESTS;

const luaScript = `

    local key  = KEYS[1]
    local now  = tonumber(ARGV[1])
    local capacity = tonumber(ARGV[2])
    local refillRate = tonumber(ARGV[3])
    local refillInterval = tonumber(ARGV[4])
    
    local data  = redis.call('GET',key)
    local tokens
    local lastRefill

    if not data then
       tokens = capacity - 1
       lastRefill = now
    else
        local state = cjson.decode(data)
        tokens = state.tokens
        lastRefill = state.lastRefill

        local elapsed = now - lastRefill
        local newTokens = math.floor(elapsed / refillInterval) * refillRate

        if newTokens > 0 then
           tokens = math.min(tokens + newTokens , capacity)
           lastRefill = lastRefill + (math.floor(elapsed /refillInterval) * refillInterval)
        end
        
        if tokens <= 0 then
           redis.call('SET', key, cjson.encode({tokens = tokens, lastRefill = lastRefill}),'EX', math.ceil(refillInterval * capacity / 1000))
           return {0 , tokens, lastRefill}
        end

        tokens=tokens - 1;
    end

    redis.call('SET', key, cjson.encode({tokens = tokens, lastRefill = lastRefill}), 'EX', math.ceil(refillInterval * capacity / 1000))
    return {1, tokens, lastRefill}
`;

async function tokenBucketLimiter(req,res,next){
    const clientId = req.ip;
    const key = `tokenbucket:${clientId}`;
    const now = Date.now();

    const [allowed, tokens] = await redis.eval(luaScript, 1, key, now,BUCKET_CAPACITY,REFILL_RATE,  REFILL_INTERVAL);

    res.set('X-RateLimit-Limit', BUCKET_CAPACITY);
    res.set('X-RateLimit-Remaining', Math.max(tokens, 0));
    res.set('X-RateLimit-Algorithm', 'Token Bucket');

    if(!allowed){
        const retryAfter = Math.ceil(REFILL_INTERVAL / 1000);
        res.set('Retry-After', retryAfter);
        return res.status(429).json({
            error : 'Too many Requests',
            algorithm : 'Token Bucket',
            message : `No tokens available. Next token in ${retryAfter}s.`,
            tokens : 0,
        });
    }

    next();
}

module.exports = {tokenBucketLimiter};