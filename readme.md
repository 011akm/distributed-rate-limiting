# Distributed Rate Limiter

A production-ready distributed rate limiter built with Node.js, Express, and Redis. Implements multiple rate limiting algorithms with atomic Lua scripts, Nginx load balancing, live monitoring dashboard, and Docker support.

---

## What is a Rate Limiter?

A rate limiter controls how many requests a user can make in a given time window. This project demonstrates how rate limiting works in distributed systems — where multiple servers share state via Redis to enforce limits consistently across all instances.

---

## Architecture

                ┌─────────────┐
                │   Client    │
                └──────┬──────┘
                       │
          ┌────────────▼────────────┐
          │     Nginx :80           │
          │     Load Balancer       │
          │     Round Robin         │
          └─────┬──────────┬────────┘
                │          │
      ┌─────────▼──┐  ┌───▼─────────┐
      │ App1 :3000 │  │ App2 :3001  │
      │ Express    │  │ Express     │
      └─────────┬──┘  └───┬─────────┘
                │          │
          ┌─────▼──────────▼─────┐
          │        Redis         │
          │   (shared state)     │
          └──────────────────────┘

---

## Algorithms Implemented

### 1. Fixed Window
- Counts requests in fixed time buckets
- Simple and memory efficient
- Uses Redis `INCR` + `EXPIRE` via atomic Lua script
- **Weakness:** burst traffic possible at window boundaries

### 2. Sliding Window
- Tracks exact timestamps of each request using Redis sorted sets
- Always looks back exactly N seconds from current time
- Eliminates boundary burst problem completely
- Uses `ZADD` + `ZREMRANGEBYSCORE` + `ZCARD` via atomic Lua script

### 3. Token Bucket
- Each user has a bucket of tokens refilled at a fixed rate
- Tokens consumed on each request
- Allows controlled bursts — saved tokens can be spent together
- Industry standard — used by Stripe, AWS, Cloudflare

### 4. Atomic Lua Scripts
All algorithms use Lua scripts to ensure atomicity in Redis.

**The problem without Lua:**
```js
const count = await redis.incr(key);   // call 1
// server crashes here → key never expires → user blocked forever
await redis.expire(key, 60);           // call 2
```

**The fix with Lua:**
```lua
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
-- runs as one atomic unit, nothing can interrupt it
```

---

## Algorithm Comparison

|                     | Fixed Window | Sliding Window | Token Bucket  |
|---------------------|--------------|----------------|---------------|
| Burst at boundary   | ❌           |   ✅          | ✅           |
| Controlled burst    | ❌          |    ❌          | ✅           |
| Memory per user     | O(1)         |   O(n)         | O(1)          |
| Race condition safe | ✅ Lua      |   ✅ Lua       | ✅ Lua       |
| Industry usage      | Basic        |   Common       | Most common   |

---

## Tech Stack

| Tool                    |          Purpose              |
|-------------------------|-------------------------------|
| Node.js                 | Runtime                       |
| Express.js              | HTTP framework                |
| Redis                   | Shared distributed state      |
| ioredis                 | Redis client for Node.js      |
| Nginx                   | Load balancer + reverse proxy |
| Docker + Docker Compose | Containerization              |
| Morgan                  | HTTP request logging          |
| autocannon              | Stress testing                |

---

## Project Structure

distributed-rate-limiter/

├── nginx/

│   └── nginx.conf            # Nginx load balancer config

├── src/

│   ├── config/

│   │   ├── index.js          # limits, window size, port

│   │   └── redis.js          # redis client setup

│   ├── middleware/

│   │   ├── fixedWindow.js    # fixed window + lua script

│   │   ├── slidingWindow.js  # sliding window + lua script

│   │   └── tokenBucket.js    # token bucket + lua script

│   ├── routes/

│   │   ├── test.js           # rate limited test endpoints

│   │   └── stats.js          # dashboard stats endpoint

│   └── server.js             # entry point

├── public/

│   ├── index.html            # monitoring dashboard

│   ├── style.css             # dashboard styles

│   └── dashboard.js          # dashboard logic + chart

├── .env.example              # environment variable template

├── .gitignore

├── Dockerfile

├── docker-compose.yml

└── README.md

---

## Getting Started

### Prerequisites
- Docker + Docker Compose installed

### Run with Docker (recommended)
```bash
git clone https://github.com/011akm/distributed-rate-limiting.git
cd distributed-rate-limiting
docker-compose up --build
```

Server runs at `http://localhost`
Dashboard at `http://localhost`

### Run Locally
```bash
# Install dependencies
npm install

# Start Redis via Docker
docker run -d --name redis -p 6379:6379 redis

# Copy environment variables
cp .env.example .env

# Start server
npm start
```

---

## API Endpoints

| Method |      Endpoint       |    Algorithm   |           Description              |
|--------|---------------------|----------------|------------------------------------|
| GET    | `/api/test`         | Fixed window   | Rate limited endpoint              |
| GET    | `/api/test-sliding` | Sliding window | Rate limited endpoint              |
| GET    | `/api/test-token`   | Token bucket   | Rate limited endpoint              |
| GET    | `/api/stats`        |       —        | Live stats for dashboard           |
| GET    | `/health`           |       —        | Health check                       |
| GET    | `/which`            |       —        | Shows which server handled request |

---

## Rate Limit Headers

Every response includes:

X-RateLimit-Limit: 5        ← max requests allowed

X-RateLimit-Remaining: 3    ← requests left in window

X-RateLimit-Reset: 45       ← seconds until reset

X-RateLimit-Algorithm: sliding-window

Retry-After: 45             ← only on 429 responses

---

## Configuration

Copy `.env.example` to `.env` and update values:

```env
PORT=3000
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
WINDOW_SIZE_MS=60000
MAX_REQUESTS=5
```

| Variable       | Default   |        Description          |
|----------------|-----------|-----------------------------|
| PORT           | 3000      | Server port                 |
| REDIS_HOST     | 127.0.0.1 | Redis host                  |
| REDIS_PORT     | 6379      | Redis port                  |
| WINDOW_SIZE_MS | 60000     | Window size in milliseconds |
| MAX_REQUESTS   | 5         | Max requests per window     |

---

## Monitoring Dashboard

Live dashboard at `http://localhost` showing:

- Total IPs currently tracked
- Number of blocked IPs
- Per-algorithm IP counts
- Per-IP request count, remaining limit, TTL
- Token bucket token count per IP
- Live request activity chart (allowed vs blocked)
- Auto-refreshes every 2 seconds

---

## Load Balancing with Nginx

Nginx distributes traffic across two Node.js instances using round robin:

Request 1 → App1 :3000

Request 2 → App2 :3001

Request 3 → App1 :3000

Request 4 → App2 :3001

Verify load balancing is working:
```bash
curl http://localhost/which
# {"server":"3000","ip":"..."}

curl http://localhost/which
# {"server":"3001","ip":"..."}
```

---

## Distributed Simulation

Rate limits are enforced correctly across all servers — users cannot bypass limits by hitting different servers:

App1 → request 1 ✅  Redis count = 1

App1 → request 2 ✅  Redis count = 2

App1 → request 3 ✅  Redis count = 3

App2 → request 4 ✅  Redis count = 4

App2 → request 5 ✅  Redis count = 5

App2 → request 6 ❌  Redis count = 6 → 429 blocked

---

## Stress Test Results

**Tool:** autocannon
**Config:** 10 concurrent connections, 5 seconds
**Endpoint:** `GET /api/test-sliding`

```bash
autocannon -c 10 -d 5 http://localhost/api/test-sliding
```

| Metric | Value |
|--------|-------|
| Total requests | 3,460 |
| Allowed (2xx) | 7 |
| Blocked (429) | 3,453 |
| Avg latency | 13.95ms |
| Max latency | 96ms |
| Avg req/sec | 692 |

99.8% of requests correctly blocked under high concurrency.
Rate limiter maintained correctness with zero crashes.

---

## Key Design Decisions

**Why Redis over in-memory store?**
In-memory state dies on server restart and cannot be shared across multiple servers. Redis provides persistent shared state — the foundation of distributed rate limiting.

**Why Lua scripts for atomicity?**
Two separate Redis calls have a gap between them where failures can cause permanent bugs. Lua scripts execute as a single atomic unit in Redis — nothing can interrupt them.

**Why sliding window over fixed window?**
Fixed window allows 2x the rate limit at window boundaries. Sliding window always evaluates the last N seconds — no boundary exploitation possible.

**Why token bucket?**
Token bucket is the industry standard used by Stripe, AWS, and Cloudflare. It allows controlled bursts — users who haven't made requests recently can spend saved tokens, making it more fair than sliding window for real-world APIs.

**Why Nginx?**
Nginx provides a single entry point for all traffic and automatically distributes requests across Node.js instances. Combined with Redis shared state, this proves the rate limiter works correctly in a true distributed environment.

---

## What I Learned

- Distributed systems require shared external state — server memory doesn't scale
- Atomicity matters at scale — race conditions are invisible until they cause real bugs
- Algorithm choice has real tradeoffs — simplicity vs correctness vs memory vs fairness
- Redis is not just a cache — sorted sets, Lua scripting, atomic operations
- Nginx + Docker Compose makes multi-service architecture reproducible in one command
- Token bucket is more fair than sliding window for real-world API traffic patterns

---

## Author

Aman Kumar — BTech 
GitHub: [github.com/011akm](https://github.com/011akm)