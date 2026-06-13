const express = require('express');
const redis = require('../config/redis');
const {MAX_REQUESTS} = require('../config/index.js');

const router = express.Router();

router.get('/stats', async(req, res) =>{
    try {
        const fixedKeys = await redis.keys('ratelimit:*');
        const slidingKeys = await redis.keys('sliding:*');

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
                blocked:   count >= MAX_REQUESTS
            }
        }));

        res.json({
            fixedWindow : fixedStats,
            slidingWindow : slidingstats,
            timestamp : new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({
            error : 'failed to fetch stats'
        });
    }
});

module.exports = router ;