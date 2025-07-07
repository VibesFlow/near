# VibesFlow Chunker Worker

NEAR Shade Agent for VRF Raffling of Audio Chunks

## Overview

The Chunker Worker is a NEAR Shade Agent that performs VRF (Verifiable Random Function) raffling on audio chunks received from the rawchunks backend. It follows the NEAR Shade Agents documentation exactly and is designed for production deployment on Phala Cloud.

## Features

- **VRF Raffling**: Performs verifiable random raffles to determine chunk ownership
- **Shade Agent Compliance**: Full NEAR Shade Agent implementation with TEE attestation
- **Independent Processing**: VRF processing runs independently from dispatcher uploads
- **Pinata Integration**: Cleanup of successfully uploaded chunks
- **Production Ready**: Designed for Phala Cloud deployment

## Architecture

```
[RawChunks Backend] -> [Chunker Worker] -> [Dispatcher]
                           |
                    [NEAR Contract]
                    (VRF Proofs)
```

## Environment Variables

```bash
# NEAR Configuration
NEAR_ACCOUNT_ID=chunker.vibesflow.testnet
NEAR_PRIVATE_KEY=your_private_key

# Contract Configuration  
AGENT_CONTRACT_ID=v1chunker.vibesflow.testnet
CONTRACT_CODEHASH=your_codehash

# Backend URLs
RAWCHUNKS_BACKEND_URL=https://...
DISPATCHER_URL=http://localhost:3000

# Pinata Configuration
PINATA_JWT=your_jwt
```

## API Endpoints

- `GET /health` - Health check
- `POST /process/raw-chunk` - Process raw chunk with VRF raffle
- `POST /confirm/upload` - Confirm successful upload from dispatcher
- `GET /raffle/status/:rtaId` - Get raffle status for RTA
- `GET /chunk/ownership/:chunkId` - Get chunk ownership info

## Development

```bash
npm install
npm run dev
```

## Docker Deployment

```bash
npm run docker:build
npm run docker:push
```

## Phala Cloud Deployment

Use the provided docker-compose.yaml for Phala Cloud deployment.

## VRF Process

1. Receive raw chunk from backend
2. Initialize VRF seed using NEAR block data
3. Perform deterministic raffle
4. Add chunk owner to metadata
5. Forward to dispatcher for upload
6. Store proof in NEAR contract
7. Clean up after successful upload confirmation
