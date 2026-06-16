const express = require('express');
const redis = require('../config/redis');
const {MAX_REQUESTS} = require('../config/index.js');

const router = express.Router();

router.get('/stats', async(req, res) =>{
    try {
        const fixedKeys = await redis.keys('ratelimit:*');
        const slidingKeys = await redis.keys('sliding:*');
        const tokenBucketKeys = await redis.keys('tokenbucket:*');

        const fixedStats = await Promise.all(fixedKeys.map(async (key) =>{
            const count = await redis.get(key);
            const ttl = await redis.ttl(key);
            return {
                ip : key.replace('ratelimit:', ''),
                count : parseInt(count),
                remaining : Math.max(MAX_REQUESTS - parseInt(count) , 0),
                ttl,
                blocked : parseInt(count) > MAX_REQUESTS, 
            }
        }));

        const slidingstats = await Promise.all(slidingKeys.map(async (key) =>{
            const count = await redis.zcard(key);
            const ttl =await redis.ttl(key);
            return{
                ip : key.replace('sliding:', ''),
                count,
                remaining : Math.max(MAX_REQUESTS - count, 0),
                ttl,
                blocked: count >= MAX_REQUESTS
            }
        }));

        const tokenBucketStats = await Promise.all(tokenBucketKeys.map(async (key) => {
            const data = await redis.get(key);
            const ttl  = await redis.ttl(key);
            const state = data ? JSON.parse(data) : { tokens: MAX_REQUESTS, lastRefill: Date.now() };
            return {
                ip: key.replace('tokenbucket:', ''),
                tokens: Math.max(Math.floor(state.tokens), 0),
                remaining: Math.max(Math.floor(state.tokens), 0),
                ttl,
                blocked: state.tokens <= 0,
            };
        }));

        res.json({
            fixedWindow : fixedStats,
            slidingWindow : slidingstats,
            tokenBucket:   tokenBucketStats,
            timestamp : new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({
            error : 'failed to fetch stats'
        });
    }
});

module.exports = router ;