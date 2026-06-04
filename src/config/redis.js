const Redis=require('ioredis');
const client = new Redis({
    host : 'localhost',
    port : 6379,
});

client.on('connect',()=>{
    console.log("Redis connected");
})

client.on('error',(err) =>{
    console.log("Redis error",err);
})

module.exposts = client;