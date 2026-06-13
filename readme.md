# Distributed Rate Limiter

A production-ready distributed rate limiter built with Node.js, Express, and Redis. Implements multiple rate limiting algorithms with atomic Lua scripts, live monitoring dashboard, and Docker support.

---

## What is a Rate Limiter?

A rate limiter controls how many requests a user can make in a given time window. This project demonstrates how rate limiting works in distributed systems — where multiple servers share state via Redis to enforce limits consistently.

---

## Architecture

                ┌─────────────┐
                │   Client    │
                └──────┬──────┘
                       │
          ┌────────────▼────────────┐
          │      Express Server     │
          │   (middleware chain)    │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │   Rate Limiter Layer    │
          │  Fixed Window /         │
          │  Sliding Window         │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │          Redis          │
          │   (shared state for     │
          │   multiple servers)     │
          └─────────────────────────┘

---

## Algorithms Implemented

### 1. Fixed Window
- Counts requests in fixed time buckets (e.g. 5 requests per minute)
- Simple and memory efficient
- Uses Redis `INCR` + `EXPIRE` via atomic Lua script
- **Weakness:** burst traffic possible at window boundaries

### 2. Sliding Window
- Tracks exact timestamps of each request using Redis sorted sets
- Always looks back exactly N seconds from current time
- Eliminates boundary burst problem completely
- Uses `ZADD` + `ZREMRANGEBYSCORE` + `ZCARD` via atomic Lua script

### 3. Atomic Lua Scripts
Both algorithms use Lua scripts to ensure atomicity in Redis.

**The problem without Lua:**
```js
const count = await redis.incr(key);   // call 1
// server crashes here ← key never expires, user blocked forever
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

|                     | Fixed Window | Sliding Window  |
|---------------------|--------------|-----------------|
| Burst problem       | ❌           |    ✅          |
| Memory usage        | Low          |    Medium       |
| Complexity          | Simple       |    Medium       |
| Race condition safe | ✅ Lua       |   ✅ Lua       |
| Industry usage      | Basic        |    Common       |

---

## Tech Stack

| Tool                    |         Purpose          |
|-------------------------|--------------------------|
| Node.js                 | Runtime                  |
| Express                 | HTTP framework           |
| Redis                   | Shared distributed state |
| ioredis                 | Redis client for Node.js |
| Docker + Docker Compose | Containerization         |
| Morgan                  | HTTP request logging     |
| autocannon              | Stress testing           |

---

## Project Structure

distributed-rate-limiter/

├── src/

│   ├── config/

│   │   ├── index.js          # limits, window size, port

│   │   └── redis.js          # redis client setup

│   ├── middleware/

│   │   ├── fixedWindow.js    # fixed window + lua script

│   │   └── slidingWindow.js  # sliding window + lua script

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
git clone https://github.com/011akm/distributed-rate-limiter.git
cd distributed-rate-limiter
docker-compose up --build
```

Server runs at `http://localhost:3000`
Dashboard at `http://localhost:3000`

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

| Method |      Endpoint      | Algorithm      |       Description         |
|--------|--------------------|----------------|---------------------------|
| GET    | `/api/test-fixed`  | Fixed window   | Rate limited endpoint     |
| GET    | `/api/test-sliding`| Sliding window | Rate limited endpoint     |
| GET    | `/api/stats`       |      —         | Live stats for dashboard  |
| GET    | `/health`          |      —         | Health check              |

---

## Rate Limit Headers

Every response includes headers so clients know their current status:

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

Live dashboard at `http://localhost:3000` showing:

- Total IPs currently tracked
- Number of blocked IPs
- Per-IP request count and remaining limit
- TTL (seconds until window resets) per IP
- Live request activity chart (allowed vs blocked)
- Auto-refreshes every 2 seconds

---

## Distributed Simulation

Proved that rate limits are shared correctly across multiple servers:

```bash
# Terminal 1
PORT=3000 npm start

# Terminal 2
PORT=3001 npm start
```

Both servers share the same Redis counter — users cannot bypass the limit by hitting different servers.

---

## Stress Test Results

**Tool:** autocannon  
**Config:** 10 concurrent connections, 5 seconds  
**Endpoint:** `GET /api/test-sliding` (sliding window algorithm)

```bash
autocannon -c 10 -d 5 http://localhost:3000/api/test-sliding
```

| Metric         | Value   |
|----------------|---------|
| Total requests | 3,460   |
| Allowed (2xx)  | 7       |
| Blocked (429)  | 3,453   |
| Avg latency    | 13.95ms |
| Max latency    | 96ms    |
| Avg req/sec    | 692     |

99.8% of requests correctly blocked under high concurrency. Rate limiter maintained correctness with zero crashes.

---

## Key Design Decisions

**Why Redis over in-memory store?**  
In-memory state dies on server restart and cannot be shared across multiple servers. Redis provides persistent shared state — the foundation of distributed rate limiting.

**Why Lua scripts for atomicity?**  
Two separate Redis calls have a gap between them where failures can cause permanent bugs (key never expires → user blocked forever). Lua scripts execute as a single atomic unit in Redis — nothing can interrupt them.

**Why sliding window over fixed window?**  
Fixed window allows 2x the rate limit at window boundaries (burst problem). Sliding window always evaluates the last N seconds from the current moment — no boundary exploitation is possible.

---

## What I Learned

- Distributed systems require shared external state — server memory doesn't scale
- Atomicity matters at scale — race conditions are invisible until they cause real bugs
- Algorithm choice has real tradeoffs — simplicity vs correctness vs memory usage
- Redis is not just a cache — it's a powerful data structure server (sorted sets, Lua)
- Docker Compose makes multi-service setups reproducible for anyone

---

## Roadmap

- [ ] Token bucket algorithm
- [ ] Nginx load balancer in Docker Compose
- [ ] Prometheus metrics endpoint
- [ ] Grafana dashboard integration

---

## Author

Aman Kumar — BTech  
GitHub: github.com/011akm

