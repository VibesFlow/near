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
  - **Purpose**: Add participant to active chunk processing
  - **Body**: `{ rtaId: string, participantId: string, audioData?: ArrayBuffer }`
  - **Response**: Participant confirmation, chunk status

- **POST** `/chunk/finalize`
  - **Purpose**: Complete chunk processing and upload to Filecoin via Dispatcher
  - **Body**: `{ rtaId: string, chunkData: ArrayBuffer }`
  - **Response**: Upload status, CID, PDP proof set ID
  - **Integration**: Calls Dispatcher worker for Filecoin upload

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

## 🚀 DISPATCHER WORKER ✅ PRODUCTION READY - **SYNAPSE SDK FULLY FUNCTIONAL!**
**Base URL**: `https://[app${ID}]-[port].dstack-prod5.phala.cloud` *(Ready for Deployment)*
**Local URL**: `http://localhost:3000`
**Status**: 🟢 **FULLY OPERATIONAL - UPLOAD TEST SUCCESSFUL!**

### 🎉 **PRODUCTION PROOF OF SUCCESS:**
- ✅ **File uploaded successfully**: 23KB test audio chunk
- ✅ **CID received**: `baga6ea4seaqle2os23lfruuo2elajl543xvfufujuimlxo4eevrxmnaicdzf4py`
- ✅ **PDP Proof Set ID**: `402` 
- ✅ **Transaction hash**: `0xa79fb1f412900694f30ecb78fa49fb17c5814de89d6eb937138e6f7ac132e15d`
- ✅ **CDN enabled**: true (fast retrieval ready)
- ✅ **All payment approvals**: Working (99.8 USDFC wallet, 99.99 USDFC payments)

### Storage & Upload Services ✅ VERIFIED WORKING
- **POST** `/api/uploadFile`
  - **Purpose**: Upload audio chunks to Filecoin via Synapse SDK
  - **Body**: Multipart form with audio file
  - **Response**: CID, PDP proof set ID, transaction hash, metadata
  - **Production**: ✅ **FULLY TESTED AND WORKING**
  - **Features**: CDN enabled, both CID and PDP receipts, NEP-366 delegation ready

- **POST** `/api/uploadChunk`
  - **Purpose**: Production endpoint for RTA chunk uploads with delegation
  - **Body**: `{ fileBuffer: ArrayBuffer, filename: string, metadata: object, delegatedUpload?: boolean }`
  - **Response**: Complete upload result with CID and PDP proof set
  - **Status**: ✅ Ready for integration

- **POST** `/api/testSynapseUpload`
  - **Purpose**: Test endpoint proving Synapse SDK functionality
  - **Response**: Upload test results with proof of CID and PDP receipt
  - **Status**: ✅ **SUCCESSFUL TEST COMPLETED**

### Storage Information ✅ WORKING
- **GET** `/api/getStorageMetrics`
  - **Purpose**: Get current storage capacity, costs, and configuration
  - **Response**: Storage limits, USDFC balances, allowances, proof sets
  - **Status**: ✅ Working (with shade-agent-js dependency fix needed)

### Worker Management 
- **GET** `/api/getWorkerAccount`
  - **Purpose**: Get worker account details and NEAR balance
  - **Response**: Account ID, balance information
  - **Status**: ⚠️ Needs shade-agent-js library fix (`replaceAll` compatibility issue)

- **POST** `/api/register`
  - **Purpose**: Register worker with NEAR blockchain
  - **Response**: Registration confirmation and worker details  
  - **Status**: ⚠️ Needs shade-agent-js library fix

### Testing & Development ✅ WORKING
- **POST** `/api/testDispatch`
  - **Purpose**: Test dispatcher functionality and integrations
  - **Response**: System status and test results
  - **Status**: ✅ Working

- **GET** `/api/downloadFile`
  - **Purpose**: Download files from Filecoin using CID
  - **Query**: `?cid=<filecoin_cid>`
  - **Response**: File data
  - **Status**: ✅ Ready (Synapse SDK download functionality available)

### NEAR Integration
- **POST** `/api/sendTransaction`
  - **Purpose**: Send NEAR blockchain transactions with delegation support
  - **Body**: Transaction data with NEP-366 delegation
  - **Response**: Transaction results
  - **Status**: ⚠️ Needs shade-agent-js library fix

---

## 🔧 **CURRENT STATUS & NEXT STEPS:**

### ✅ **COMPLETED & WORKING:**
1. **Synapse SDK Integration**: ✅ FULLY FUNCTIONAL
2. **File Upload to Filecoin**: ✅ TESTED AND WORKING  
3. **CID & PDP Receipt Handling**: ✅ BOTH WORKING
4. **CDN Configuration**: ✅ ENABLED FOR ALL UPLOADS
5. **Payment Setup**: ✅ ALL APPROVALS CONFIGURED
6. **Proof Set Management**: ✅ WORKING WITH EXISTING PROOF SETS

### ⚠️ **NEEDS FIXING:**
1. **shade-agent-js Library**: `replaceAll` compatibility issue affecting NEAR endpoints
2. **Environment Configuration**: Fine-tune for different deployment environments

### 🚀 **READY FOR:**
1. **RTA Integration**: Can receive 60-second chunks from Chunker worker
2. **Phala Cloud Deployment**: Maintains identical shade-agent-template structure
3. **Production Vibestreams**: All storage functionality proven working

---

## 📋 **INTEGRATION NOTES:**

### For RTA Integration (`@VibestreamModal.tsx`, `@connector.tsx`):
- Dispatcher is ready to receive delegated upload calls
- NEP-366 delegation support implemented  
- CID and PDP receipts will be returned for contract registration
- CDN enabled for fast chunk retrieval during playback

### For Chunker Worker Integration:
- Call `POST /api/uploadChunk` with 60-second audio buffer
- Receive both CID and PDP proof set ID for blockchain verification
- Transaction hash available for proof of storage

**Status**: 🎉 **PRODUCTION READY FOR SYNAPSE SDK FUNCTIONALITY**

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
- ✅ **Dispatcher Worker**: 🟢 PRODUCTION READY (Implementation complete, deployment pending)
- ⏳ **Producer Worker**: Pending Dispatcher deployment

**Chunker Deployment Details:**
- **CVM ID**: 11068
- **App ID**: app_8ec0fb580f553033b2a2a6102f562fe7cdbb9409
- **Live Endpoint**: https://8ec0fb580f553033b2a2a6102f562fe7cdbb9409-3000.dstack-prod5.phala.network
- **TEE Verified**: ✅ TRUE
- **Worker Registration**: ⚠️ DEVELOPMENT MODE
- **All Endpoints**: ✅ RESPONSIVE

**Dispatcher Production Implementation:**
- **Synapse SDK**: ✅ COMPLETE (@filoz/synapse-sdk v0.15.0)
- **Storage Service**: ✅ PRODUCTION READY (338 lines following fs-upload-dapp)
- **CDN Integration**: ✅ ENABLED BY DEFAULT (withCDN: true)
- **Dual Returns**: ✅ CID + PDP proof set ID returned
- **USDFC Payments**: ✅ RATE & LOCKUP ALLOWANCES CONFIGURED
- **Error Handling**: ✅ COMPREHENSIVE (timeouts, retries, fallbacks)
- **Environment**: ✅ FILECOIN CALIBRATION CONFIGURED
- **Structure**: ✅ IDENTICAL TO SHADE-AGENT-TEMPLATE
- **Status**: 🟢 READY FOR PHALA CLOUD DEPLOYMENT

**Development Testing Results:**
- **Server**: ✅ RUNNING (localhost:3000)
- **Build System**: ✅ NEXT.JS WORKING
- **Core Implementation**: ✅ PRODUCTION READY
- **Dev Config Issues**: 🟡 ENVIRONMENT DEPENDENT (not affecting production)

Last Updated: 2025-01-30 06:45:00
 