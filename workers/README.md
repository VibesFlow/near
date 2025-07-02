# VibesFlow Workers - NEAR Shade Agents Production Deployment

Complete production deployment guide following **EXACT** NEAR Shade Agents documentation patterns.

## Overview

VibesFlow consists of two worker agents:
- **Dispatcher Worker** (Port 3000): Handles Filecoin storage via Synapse SDK 
- **Chunker Worker** (Port 3001): Handles 60-second audio chunking with VRF raffles

Both workers follow the **exact** shade-agent-js pattern with:
- TEE-derived worker accounts 
- Real hardware attestation on Phala Cloud
- NEAR Chain Signatures integration
- Production contract integration

## Prerequisites

1. **NEAR Accounts**:
   - `dispatcher.vibesflow.testnet` (funded with 1+ NEAR)
   - `chunker.vibesflow.testnet` (funded with 1+ NEAR)

2. **Deployed Contracts**:
   - `v1dispatcher.vibesflow.testnet` 
   - `v1chunker.vibesflow.testnet`

3. **Filecoin Wallet** (for dispatcher):
   - Funded with 150+ USDFC on Calibration network
   - Address: `0xedD801D6c993B3c8052e485825A725ee09F1ff4D`

4. **Tools**:
   - Docker with linux/amd64 platform support
   - Phala Cloud account
   - GHCR access (GitHub Container Registry)

## Step 1: Build and Push Docker Images

### Dispatcher Worker

```bash
cd near/workers/dispatcher
yarn docker:image
yarn docker:push
```

Get the code hash:
```bash
yarn get:codehash
# or manually: docker inspect ghcr.io/vibesflow/dispatcher:latest --format='{{index .RepoDigests 0}}' | cut -d@ -f2
```

### Chunker Worker

```bash
cd near/workers/chunker  
yarn docker:image
yarn docker:push
```

Get the code hash:
```bash
yarn get:codehash
# or manually: docker inspect ghcr.io/vibesflow/chunker:latest --format='{{index .RepoDigests 0}}' | cut -d@ -f2
```

## Step 2: Update Code Hashes in Contracts

Update both agent contracts with the new code hashes:

### Dispatcher Contract
```bash
near contract call-function as-transaction v1dispatcher.vibesflow.testnet approve_codehash json-args '{"codehash": "YOUR_DISPATCHER_HASH_WITHOUT_SHA256_PREFIX"}' prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' sign-as dispatcher.vibesflow.testnet network-config testnet
```

### Chunker Contract  
```bash
near contract call-function as-transaction v1chunker.vibesflow.testnet approve_codehash json-args '{"codehash": "YOUR_CHUNKER_HASH_WITHOUT_SHA256_PREFIX"}' prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' sign-as chunker.vibesflow.testnet network-config testnet
```

## Step 3: Configure Environment Variables in Phala Cloud

In Phala Cloud dashboard → Deploy → Docker Compose → Advanced Features → Environment Variables:

```env
# Dispatcher Credentials
NEAR_ACCOUNT_ID_DISPATCHER=dispatcher.vibesflow.testnet
NEAR_PRIVATE_KEY_DISPATCHER=ed25519:5yTVvbXBbjP2cjMYcXVp93uJPhDgbNCuM9AEXw64pP2apb27s1zJrAWPq5Gy9jZjdCBZhHuVrmCakYX9NCDS14gg
AGENT_CONTRACT_ID_DISPATCHER=v1dispatcher.vibesflow.testnet

# Chunker Credentials  
NEAR_ACCOUNT_ID_CHUNKER=chunker.vibesflow.testnet
NEAR_PRIVATE_KEY_CHUNKER=ed25519:3viEdZwKhkqHFpRvcsZQvyoVxDAs9ZDHPXh3Jqcjwk7MkhcGqxJ1CEFNrzUbWTdSW669UfmLjkJHfLfPDS3QqMp1
AGENT_CONTRACT_ID_CHUNKER=v1chunker.vibesflow.testnet

# Filecoin Credentials (for dispatcher)
FILECOIN_PRIVATE_KEY=0x4c8d4b17abd3e7855352c996092c5c3d814ee22314f9ef5fcb958b3d7a2d1868
FILECOIN_ADDRESS=0xedD801D6c993B3c8052e485825A725ee09F1ff4D

# Code Hashes (update with your actual hashes)
DISPATCHER_CODEHASH=YOUR_DISPATCHER_HASH_HERE
CHUNKER_CODEHASH=YOUR_CHUNKER_HASH_HERE
```

## Step 4: Deploy to Phala Cloud

1. Go to [Phala Cloud Dashboard](https://cloud.phala.network/dashboard)
2. Click **Deploy** → **Docker Compose**  
3. Paste the contents of `docker-compose.yaml` from this directory
4. Go to **Advanced Features** → **Environment Variables**
5. Add all the environment variables from Step 3
6. Choose **dstack-prod8** (or latest production image)
7. Select appropriate resources (2 vCPU, 4GB RAM recommended)
8. Click **Deploy**

## Step 5: Verify Deployment

After deployment, you should see **TWO endpoints**:

### Dispatcher (Port 3000)
- **Root**: `https://YOUR_DEPLOYMENT_ID-3000.dstack-prod8.phala.network/`
  - Should return dispatcher service info
- **Health**: `https://YOUR_DEPLOYMENT_ID-3000.dstack-prod8.phala.network/health`
  - Should show TEE verification status

### Chunker (Port 3001)  
- **Root**: `https://YOUR_DEPLOYMENT_ID-3001.dstack-prod8.phala.network/`
  - Should return chunker service info
- **Health**: `https://YOUR_DEPLOYMENT_ID-3001.dstack-prod8.phala.network/health`
  - Should show TEE verification status

## Step 6: Test Worker Registration

Both workers should automatically register with their contracts during startup. Check logs:

### Check Phala Logs
1. Go to your deployment details
2. Click **Containers** tab
3. Check both `vibesflow-dispatcher` and `vibesflow-chunker` containers
4. Look for successful registration messages:
   - `✅ Worker registration successful`
   - `🔐 TEE Verified: true`

### Verify Contract Registration
```bash
# Check dispatcher worker registration
near contract call-function as-read-only v1dispatcher.vibesflow.testnet get_worker json-args '{"account_id": "DERIVED_WORKER_ACCOUNT_ID"}' network-config testnet

# Check chunker worker registration  
near contract call-function as-read-only v1chunker.vibesflow.testnet get_worker json-args '{"account_id": "DERIVED_WORKER_ACCOUNT_ID"}' network-config testnet
```

## API Endpoints

### Dispatcher Worker (Port 3000)
- `POST /upload` - Upload chunks to Filecoin storage
- `GET /upload/:id/status` - Check upload status
- `GET /balance` - Check USDFC balance
- `GET /metrics` - Storage metrics

### Chunker Worker (Port 3001)
- `POST /chunk/start` - Start chunking session
- `POST /chunk/participant` - Add participant to raffle
- `POST /chunk/finalize` - Finalize chunking session
- `GET /chunk/status/:rtaId` - Get chunk status

## Troubleshooting

### Common Issues

1. **"Cannot GET /"**: Port conflicts or service not starting
   - Check that both services use different ports (3000, 3001)
   - Verify environment variables are set correctly

2. **Worker registration fails**: 
   - Ensure code hashes are approved in contracts
   - Check NEAR account has sufficient balance
   - Verify TEE attestation is working

3. **TEE attestation fails**:
   - Normal in development, workers will use development attestation
   - In production on Phala, should show real TEE verification

4. **USDFC payment issues**:
   - Ensure Filecoin wallet has sufficient USDFC balance
   - Check payment contract approvals

### Debug Commands

```bash
# Test individual services locally
cd near/workers/dispatcher && yarn phala:local
cd near/workers/chunker && yarn phala:local

# Check Docker images
docker images | grep vibesflow

# Check code hashes  
yarn get:codehash
```

## Security Notes

- Private keys are stored as secure environment variables in Phala Cloud
- TEE attestation provides hardware-level security guarantees
- Worker accounts are derived using TEE entropy following shade-agent-js pattern
- All transactions use NEAR Chain Signatures for cross-chain operations

## Production Checklist

- [ ] Both Docker images built and pushed to GHCR
- [ ] Code hashes approved in both agent contracts  
- [ ] Environment variables configured in Phala Cloud
- [ ] Both endpoints (3000, 3001) accessible and returning proper responses
- [ ] TEE attestation working (check logs for "🔐 TEE Verified: true")
- [ ] Worker registration successful in both contracts
- [ ] USDFC balance sufficient for storage operations
- [ ] Chunker VRF system operational

## Next Steps

Once deployed and verified:
1. Test chunk upload flow using dispatcher endpoint
2. Test chunk raffle system using chunker endpoints  
3. Monitor TEE attestation and worker health
4. Scale resources based on usage patterns 