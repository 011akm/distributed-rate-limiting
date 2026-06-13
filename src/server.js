require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const testRoutes = require('./routes/test.js')
const statsRoutes = require('./routes/stats.js')
const {PORT} = require('./config/index.js');

const app= express();

app.use(express.json());
app.use(morgan('dev'));

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', testRoutes);
app.use('/api', statsRoutes);

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
});