# VibesFlow NEAR Protocol Integration

## 🚀 Deployed Contracts

### RTA Factory Contract
- **Address**: `rta-factory.vibesflow.testnet`
- **Transaction**: [GZ2fawtxexemzwizDEskrp7nUMDzt4Dw3PUa8846etp9](https://testnet.nearblocks.io/txns/GZ2fawtxexemzwizDEskrp7nUMDzt4Dw3PUa8846etp9)
- **Purpose**: Creates and manages dynamic vibestream NFTs following NEP-171 standard
- **Features**:
  - Dynamic NFT creation for vibestreams
  - Chunk data management with ownership tracking
  - RTA finalization when streams close
  - Rich metadata with VRF proof integration

### Vibe Agents Contracts
- **Address**: `v1chunker.vibesflow.testnet`
- **Transaction**: [F2xsHyiUMwMHWFUoeu7Aa4pdbkU9i5qKmrHvV5Q3WGQe](https://testnet.nearblocks.io/txns/F2xsHyiUMwMHWFUoeu7Aa4pdbkU9i5qKmrHvV5Q3WGQe)
- **Purpose**: Chunker agent contract for TEE worker orchestration
- **Features**:
  - Worker registration and management
  - Cross-chain signatures (NEAR/Filecoin/Ethereum)
  - Workflow orchestration for Chunker tasks
  - MPC signatures via Chain Signatures

## 🤖 TEE Workers

### Worker Accounts
- **Swapper**: `swapper.vibesflow.testnet`
- **Chunker**: `chunker.vibesflow.testnet`  
- **Dispatcher**: `dispatcher.vibesflow.testnet`
- **Producer**: `producer.vibesflow.testnet`

### Docker Images
- `vibesflow/swapper:0.1.0` → `ghcr.io/vibesflow/swapper:latest`
- `vibesflow/chunker:0.1.0` → `ghcr.io/vibesflow/chunker:latest`
- `vibesflow/dispatcher:0.1.0` → `ghcr.io/vibesflow/dispatcher:latest`
- `vibesflow/producer:0.1.0` → `ghcr.io/vibesflow/producer:latest`

### Approved Code Hashes
- **Swapper**: `97c410b0b4f2b138ec004fb28ecd8ff9e217fcdaeada340e25ce0b28b8b21681`
- **Chunker**: `5d3f0f90fb6b0d3cb88b29d5a25726535563c281c62a79ec08c965904a814474`
- **Dispatcher**: `9738d754b4a3d58103f6b6faa1793d1dd87ba0dfc64234bcb5d3e2b50cc12fbf`
- **Producer**: `93892e904d933316a0202b78e863c0badde1ce30e05f28b43f059d6c6b6f91ab`

## 🌐 Network Configuration

### NEAR Testnet
- **RPC**: `https://rpc.testnet.near.org`
- **Explorer**: `https://testnet.nearblocks.io`
- **Main Account**: `vibesflow.testnet`

### Filecoin Calibration
- **RPC**: `https://api.calibration.node.glif.io/rpc/v1`
- **Storage**: Via Synapse SDK with CDN enabled
- **Purpose**: Audio chunk storage with rich metadata

### Ethereum Sepolia  
- **RPC**: `https://sepolia.infura.io/v3/your_infura_key`
- **Purpose**: Cross-chain operations and balance verification

## 📋 Integration Guide

### Frontend Integration (React Native/Expo)

Update your app configuration with the deployed contract addresses:

```typescript
// App configuration
export const CONTRACTS = {
  RTA: 'rtav2.vibesflow.testnet',
  CHUNKER_V1: 'v1chunker.vibesflow.testnet',
  NETWORK: 'testnet'
};

// Worker endpoints (when deployed to Phala)
export const WORKERS = {
  SWAPPER: 'https://your-phala-endpoint/swapper',
  CHUNKER: 'https://your-phala-endpoint/chunker', 
  DISPATCHER: 'https://your-phala-endpoint/dispatcher',
  PRODUCER: 'https://your-phala-endpoint/producer'
};
```

### Testing the Flow

1. **Start the app**: `npx expo start`
2. **Create Vibestream**: Use VibestreamModal to create RTA NFT
3. **Start Audio**: VibePlayer auto-starts Lyria integration
4. **Verify Workers**: Check that chunks are processed and uploaded
5. **Close Stream**: Verify RTA finalization and Filecoin storage

## 🔧 Deployment Commands

### Contracts
```bash
# Deploy RTA Factory
cd contracts/rtav2
cargo near build
near deploy rtav2.vibesflow.testnet target/near/rta_factory.wasm
near call rtav2.vibesflow.testnet new_default_meta '{"owner_id": "vibesflow.testnet", "vibe_agents_contract": "v1chunker.vibesflow.testnet"}' --accountId vibesflow.testnet

# Deploy Vibe Agents
cd ../chunker  
cargo near build
near deploy v1chunker.vibesflow.testnet target/near/vibe_agents.wasm
near call v1chunker.vibesflow.testnet init '{"owner_id": "vibesflow.testnet", "rta_factory_contract": "rta-factory.vibesflow.testnet"}' --accountId vibesflow.testnet
```

### Workers (Local Development)
```bash
cd shade-agents
docker-compose up -d
```

### Workers (Phala Production)
1. Push images to GitHub Container Registry
2. Deploy via Phala Cloud dashboard using `docker-compose.yaml`
3. Register workers with approved code hashes

## 📚 Documentation

- [Shade Agents Documentation](https://docs.near.org/ai/shade-agents/production/production-deploying)
- [Shade Agent Template](https://github.com/NearDeFi/shade-agent-template)
- [Synapse SDK](https://github.com/FilOzone/synapse-sdk)
- [Chain Signatures](https://docs.near.org/chain-signatures)

## 🔐 Security Notes

- All private keys are stored in worker .env files
- TEE workers use Chain Signatures for MPC operations
- Code hashes are approved in the v1Chunker contract
- Workers authenticate via TEE attestation in production

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Update contract addresses in your app
# Edit your app configuration with the addresses above

# 3. Start the app
npx expo start

# 4. Test the complete flow
# Create vibestream → Generate music → Process chunks → Store on Filecoin
``` 