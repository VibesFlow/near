# ✅ PRODUCTION DEPLOYMENT READY

## Images Built and Pushed ✅

### Dispatcher Worker
- **Image**: `ghcr.io/vibesflow/dispatcher:latest`
- **Digest**: `sha256:e37aad8413f17218546991dbe866893802ec0505d1e3bc03a876b06053984925`
- **Code Hash**: `e37aad8413f1`
- **Port**: 3000
- **Status**: ✅ APPROVED in contract `v1dispatcher.vibesflow.testnet`

### Chunker Worker  
- **Image**: `ghcr.io/vibesflow/chunker:latest`
- **Digest**: `sha256:4c45af7bea806284aa900368c935d42c6204ac18e4e403397693d0eef91db304`
- **Code Hash**: `4c45af7bea80`
- **Port**: 3001
- **Status**: ✅ APPROVED in contract `v1chunker.vibesflow.testnet`

## Contract Approvals ✅

```bash
# COMPLETED - Code hashes approved by vibesflow.testnet
near call v1dispatcher.vibesflow.testnet approve_codehash '{"codehash": "e37aad8413f1"}' --accountId vibesflow.testnet
near call v1chunker.vibesflow.testnet approve_codehash '{"codehash": "4c45af7bea80"}' --accountId vibesflow.testnet
```

## Phala Cloud Deployment

### 1. Use This Docker Compose
File: `docker-compose.yaml` (in this directory)

### 2. Set These Environment Variables in Phala UI

```env
# Dispatcher Credentials
NEAR_ACCOUNT_ID_DISPATCHER=dispatcher.vibesflow.testnet
NEAR_PRIVATE_KEY_DISPATCHER=ed25519:5gqqjjH298qKShccWLQmSdQHZrDN24ioLdBWN2ELiDMoTkosXiKrv8J1FNGjRCzxQUdqQeNiw2465ykcVp2v8qM3
AGENT_CONTRACT_ID_DISPATCHER=v1dispatcher.vibesflow.testnet

# Chunker Credentials
NEAR_ACCOUNT_ID_CHUNKER=chunker.vibesflow.testnet
NEAR_PRIVATE_KEY_CHUNKER=ed25519:4ChMngBabnszUdEgxxGYz5onJV3WHYbnmDYutNLCeXzxSe4s25kG9J1P3NMNtjbxLD5BmNRn7Qtv7m1QVrmNGpD
AGENT_CONTRACT_ID_CHUNKER=v1chunker.vibesflow.testnet

# Filecoin Credentials (for dispatcher)
FILECOIN_PRIVATE_KEY=0x4c8d4b17abd3e7855352c996092c5c3d814ee22314f9ef5fcb958b3d7a2d1868
FILECOIN_ADDRESS=0xedD801D6c993B3c8052e485825A725ee09F1ff4D

# Code Hashes (APPROVED)
DISPATCHER_CODEHASH=e37aad8413f1
CHUNKER_CODEHASH=4c45af7bea80
```

### 3. Expected Endpoints After Deployment

**Dispatcher (Port 3000)**: 
- Root: `https://DEPLOYMENT_ID-3000.dstack-prod8.phala.network/`
- Health: `https://DEPLOYMENT_ID-3000.dstack-prod8.phala.network/health`

**Chunker (Port 3001)**:
- Root: `https://DEPLOYMENT_ID-3001.dstack-prod8.phala.network/`  
- Health: `https://DEPLOYMENT_ID-3001.dstack-prod8.phala.network/health`

### 4. What Should Work

- ✅ Both endpoints return proper JSON (not "Cannot GET /")
- ✅ Health endpoints show TEE verification status  
- ✅ Workers auto-register with TEE-derived accounts
- ✅ NEAR Chain Signatures integration
- ✅ Real Filecoin storage via Synapse SDK (dispatcher)
- ✅ 60-second audio chunking with VRF raffles (chunker)

## Production Features

- **Real TEE Attestation**: Hardware-verified on Phala Cloud
- **Worker Account Derivation**: Using exact shade-agent-js pattern
- **NEAR Chain Signatures**: Production MPC integration
- **No Dev Mode**: All production security enabled
- **Port Separation**: Dispatcher (3000) + Chunker (3001)
- **Environment Variables**: Secure configuration via Phala UI

## Deployment Steps

1. **Go to [Phala Cloud Dashboard](https://cloud.phala.network/dashboard)**
2. **Click Deploy → Docker Compose**
3. **Paste the `docker-compose.yaml` contents**
4. **Go to Advanced Features → Environment Variables** 
5. **Add all variables from section 2 above**
6. **Choose dstack-prod8 or latest**
7. **Select 2 vCPU, 4GB RAM**
8. **Deploy**

The workers will automatically:
- Derive TEE-based worker accounts
- Fund worker accounts from main accounts  
- Generate real TEE attestation
- Register with agent contracts
- Start serving API endpoints

**This is production-ready deployment with NO MOCKS, NO PLACEHOLDERS, NO DEV MODE.**
