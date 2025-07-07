# VibesFlow NEAR Protocol Integration

## 🚀 Deployed Contracts

### RTA Factory Contract
- **Address**: `rtav2.vibesflow.testnet`
- **Purpose**: Creates and manages dynamic vibestream NFTs implementing NEP-171 and NEP-366 for delegation
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