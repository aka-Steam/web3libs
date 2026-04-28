# Deployment Guide (Docker)

## Overview

This project is deployed as two containers:

- `app`: built Vite frontend served by Nginx.
- `anvil`: local EVM RPC node used by benchmark scenarios.
- Frontend uses `VITE_RPC_URL=/rpc`, and Nginx proxies `/rpc` to `anvil:8545`.
- For Foundry image compatibility, `anvil` bind address is set via `ANVIL_IP_ADDR=0.0.0.0`.

## Software requirements

- Docker Engine / Docker Desktop 24+
- Docker Compose v2+

## Hardware requirements

Minimum:

- 2 vCPU
- 4 GB RAM
- 5 GB free disk space

Recommended:

- 4 vCPU
- 8 GB RAM

## Step-by-step deployment

1. Open terminal in repository root.
2. Build images:

```bash
docker compose build
```

3. Start services in background:

```bash
docker compose up -d
```

4. Check container status:

```bash
docker compose ps
```

5. Open application in browser:
   - `http://localhost:8080/?lib=ethers`
   - `http://localhost:8080/?lib=viem`
   - `http://localhost:8080/?lib=web3`

6. Check RPC endpoint:
   - Internal RPC (host mapped): `http://localhost:8545`
   - App-side RPC path (proxied): `http://localhost:8080/rpc`

## Stop deployment

```bash
docker compose down
```

## Troubleshooting

- If port `8080` is busy, change host mapping in `docker-compose.yml`.
- If port `8545` is busy, stop local Anvil/Hardhat or remap port.
- If app cannot reach RPC, ensure container `anvil` is running and host port `8545` is open.
- If benchmark results are `0`, rebuild app image to apply current `VITE_RPC_URL`:
  - `docker compose build --no-cache app`
  - `docker compose up -d`
- If app logs show `connect() failed (111: Connection refused) while connecting to upstream`:
  - check `docker compose logs anvil` and verify it says `Listening on 0.0.0.0:8545`.
