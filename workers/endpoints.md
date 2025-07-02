# VibesFlow Shade Agents - API Endpoints

## 🎵 CHUNKER WORKER ✅ PRODUCTION LIVE
**Base URL**: `https://[app${ID}]-[port].dstack-prod5.phala.cloud` *(Pending Deployment)*
**Local URL**: `http://localhost:3001`
**Status**: 🟢 FULLY OPERATIONAL

### Health & Status
- **GET** `/health`
  - **Purpose**: Health check and worker status
  - **Response**: Worker info, active streams, TEE verification status
  - **Production**: Always available

### Chunk Processing
- **POST** `/chunk/start`
  - **Purpose**: Start 60-second chunk processing for an RTA
  - **Body**: `{ rtaId: string, config?: object, audioFilePath?: string }`
  - **Response**: Chunk configuration, VRF seed
  - **Notes**: Only activates if `store_to_filecoin: true` in RTA config

- **POST** `/chunk/participant`
  - **Purpose**: Add participant to VRF ownership raffle
  - **Body**: `{ rtaId: string, accountId: string }`
  - **Response**: Participant count confirmation
  - **Notes**: Called when user joins stream

- **POST** `/chunk/finalize`
  - **Purpose**: Stop chunk processing and create final chunk
  - **Body**: `{ rtaId: string, forceFinalChunk?: boolean }`
  - **Response**: Final chunk summary
  - **Notes**: Called when stream ends

### Query & Status
- **GET** `/chunk/status/:rtaId`
  - **Purpose**: Get real-time chunk processing status
  - **Response**: Active status, current chunk, participants, next chunk timing
  - **Notes**: Monitor endpoint for active streams

- **GET** `/chunk/ownership/:chunkId`
  - **Purpose**: Get VRF raffle winner for specific chunk
  - **Response**: Owner account, VRF proof, participant count
  - **Notes**: Queries agent contract directly

- **GET** `/chunk/metadata/:chunkId`
  - **Purpose**: Get detailed chunk file metadata
  - **Response**: File info, audio specs, ownership details
  - **Notes**: For dispatcher worker consumption

### Test Endpoints
- **POST** `/test/vrf-seed`
  - **Purpose**: Test VRF seed generation
  - **Body**: `{ rtaId: string }`
  - **Response**: Generated VRF seed

- **POST** `/test/vrf-raffle`
  - **Purpose**: Test VRF raffle functionality
  - **Body**: `{ rtaId: string, chunkId: string, participants: string[] }`
  - **Response**: Raffle winner and proof

- **POST** `/test/wav-header`
  - **Purpose**: Test WAV header creation
  - **Body**: `{ dataLength: number, sampleRate?: number, channels?: number, bitsPerSample?: number }`
  - **Response**: WAV header data

- **POST** `/test/real-audio`
  - **Purpose**: Process real audio files for testing
  - **Body**: `{ audioFile: string, participants?: string[] }`
  - **Response**: Complete processing results with real audio chunks

---

## 📁 DISPATCHER WORKER ✅ PRODUCTION READY
**Base URL**: `https://[app${ID}]-[port].dstack-prod5.phala.cloud` *(Pending Deployment)*
**Local URL**: `http://localhost:3000`
**Status**: 🟡 READY FOR DEPLOYMENT

### Health & Status
- **GET** `/health`
  - **Purpose**: Health check and worker status
  - **Response**: Worker info, Synapse SDK status, storage service status, TEE verification
  - **Production**: Always available

### Synapse Storage Upload
- **POST** `/upload/chunk`
  - **Purpose**: Upload chunk to Filecoin via Synapse SDK
  - **Body**: `{ rtaId: string, chunkId: string, chunkData: string (base64), chunkOwner?: string, metadata?: object }`
  - **Response**: Upload ID and initial status
  - **Notes**: Follows fs-upload-dapp tutorial exactly

- **GET** `/upload/status/:uploadId`
  - **Purpose**: Get real-time upload progress
  - **Response**: Status, progress %, CommP (CID), PDP proof set ID, estimated costs
  - **Notes**: Real-time progress tracking with BigInt serialization fix

### Balance & Payment Management
- **POST** `/balance/check`
  - **Purpose**: Check USDFC wallet and payments contract balances
  - **Body**: `{ rtaId?: string }`
  - **Response**: Wallet balance, payments balance, sufficiency status
  - **Notes**: Following fs-upload-dapp payment patterns

### Storage Management
- **GET** `/upload/history/:rtaId`
  - **Purpose**: Get upload history for an RTA
  - **Response**: Array of upload records
  - **Notes**: Queries agent contract and local cache

- **GET** `/storage/metrics`
  - **Purpose**: Get storage configuration and metrics
  - **Response**: Rate allowances, lockup allowances, storage capacity, proof set info
  - **Notes**: 100GB configuration with CDN enabled

- **GET** `/storage/download/:cid`
  - **Purpose**: Download data from storage via CDN
  - **Response**: Binary data stream
  - **Notes**: CDN-enabled fast retrieval

---

## 🏭 PRODUCER WORKER  
**Base URL**: `https://v1producer.phala.cloud` *(Coming Soon)*
**Status**: ⏳ PENDING

### (Endpoints will be documented after Dispatcher deployment success)

---

## 🔐 PRODUCTION REQUIREMENTS

### Authentication
- All workers use NEAR account authentication
- TEE attestation verification for all endpoints
- MPC signatures for cross-chain operations

### Rate Limiting
- Health checks: No limit
- Processing endpoints: 10 req/minute per RTA
- Query endpoints: 100 req/minute

### Error Handling
- Standard HTTP status codes
- Detailed error messages in development
- Minimal error exposure in production

### Monitoring
- All workers expose `/health` for monitoring
- Comprehensive logging to stdout
- Metrics export for Phala Cloud dashboard

---

## 🚀 DEPLOYMENT STATUS

- ✅ **Chunker Worker**: 🟢 LIVE IN PRODUCTION (All endpoints operational)
- ✅ **Dispatcher Worker**: 🟡 READY FOR DEPLOYMENT (All endpoints tested)
- ⏳ **Producer Worker**: Pending Dispatcher success

**Chunker Deployment Details:**
- **CVM ID**: 11068
- **App ID**: app_8ec0fb580f553033b2a2a6102f562fe7cdbb9409
- **Live Endpoint**: https://8ec0fb580f553033b2a2a6102f562fe7cdbb9409-3000.dstack-prod5.phala.network
- **TEE Verified**: ✅ TRUE
- **Worker Registration**: ⚠️ DEVELOPMENT MODE
- **All Endpoints**: ✅ RESPONSIVE

**Dispatcher Production Results:**
- **REAL FILE UPLOAD SUCCESS**: ✅ VERIFIED
- **Real CommP (CID)**: `baga6ea4seaqkte2xmnzw5uz7w4zhmtrenvmkt2nkp4a5fewmlkjiiha7kjs6gkq`
- **Real PDP Proof Set ID**: `402`
- **Upload Duration**: ~82 seconds
- **CDN Enabled**: ✅ TRUE
- **Status**: Production ready with real Synapse SDK integration

Last Updated: 2025-01-30 06:20:00
 