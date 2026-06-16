const express = require('express');
const {fixedWindowLimiter} = require('../middleware/fixedWindow.js');
const {slidingWindowLimiter} = require('../middleware/slidingWindow.js');
const {tokenBucketLimiter} = require('../middleware/tokenBucket.js');
const router = express.Router();

router.get('/test-fixed', (req, res, next) => {
  fixedWindowLimiter(req, res, next).catch(next);
}, (req, res) => {
  res.json({
    message:   'Request allowed ',
    algorithm: 'fixed-window',
    ip:        req.ip,
    time:      new Date().toISOString(),
  });
});

router.get('/test-sliding', (req, res, next) => {
  slidingWindowLimiter(req, res, next).catch(next);
}, (req, res) => {
  res.json({
    message:   'Request allowed ',
    algorithm: 'sliding-window',
    ip:        req.ip,
    time:      new Date().toISOString(),
  });
});

router.get('/test-token', (req, res, next) => {
  tokenBucketLimiter(req, res, next).catch(next);
}, (req, res) => {
  res.json({
    message:   'Request allowed ',
    algorithm: 'token-bucket',
    ip:        req.ip,
    time:      new Date().toISOString(),
  });
});

module.exports = router;