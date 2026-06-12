const express = require('express');
const {fixedWindowLimiter} = require('./middleware/fixedWindow.js');
const {slidingWindowLimiter} = require('./middleware/slidingWindow.js');

const app= express();
const PORT =3000;

app.use(express.json());

app.get('/',(req,res) =>{
  res.end("Welcome to distributed rate Limiting,use /test or /health route");
})

app.get('/test-sliding', (req,res,next) =>{
  slidingWindowLimiter(req,res,next).catch(next);
}, (req,res)=>{
  res.json({
    message : 'Request allowed',
    algorith : 'sliding Window',
  })
});

app.get('/test-fixed',(req,res,next) =>{
  fixedWindowLimiter(req,res,next).catch(next);
}, (req, res) =>{
  res.json({
    meassage : 'Request allowed',
    algorith : 'fixed Window',
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