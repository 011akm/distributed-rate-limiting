const express = require('express');
const {rateLimiter} = require('./middleware/ratelimiter.js');

const app= express();
const PORT =3000;

app.use(express.json());
app.use(rateLimiter);

app.get('/test',(req,res) =>{
  res.json({
    meassage : 'Request allowed',
    time: new Date().toISOString(),
    ip : req.ip,
  });
});

app.get('/health',(req,res) =>{
  res.json({
    status : 'OK'
  });
});

app.listen(PORT,()=>{
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Rate Limit: 5 requests / 60 seconds`);
});