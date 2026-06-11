const express = require('express');
const {rateLimiter} = require('./middleware/ratelimiter.js');

const app= express();
const PORT =3000;

app.use(express.json());
app.use((req,res,next) =>{
  rateLimiter(req ,res, next).catch(next);
});

app.get('/',(req,res) =>{
  res.end("Welcome to distributed rate Limiting,use /test or /health route");
})

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

app.use((err,req,res,next) =>{
  console.log('Server error:', err);
  res.status(500).json({error : 'Internal server error'});
});

app.listen(PORT,()=>{
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Rate Limit: 5 requests / 60 seconds`);
});