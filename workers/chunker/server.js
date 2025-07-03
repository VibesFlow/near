/*!
 * VibesFlow Chunker Worker
 * VRF-raffle + verification on chunks received from rawchunks backend
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import nearAPI from 'near-api-js';
const { connect, keyStores, utils } = nearAPI;
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateSeedPhrase } from 'near-seed-phrase';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class VibesFlowChunkerWorker {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3001;
        
        // Contract Configuration
        this.agentContractId = process.env.AGENT_CONTRACT_ID || 'v1chunker.vibesflow.testnet';
        this.contractCodehash = process.env.CONTRACT_CODEHASH || '8c8d4b17abd3e7855352c996092c5c3d814ee22314f9ef5fcb958b3d7a2d1868';
        
        // NEAR Configuration
        this.mainAccountId = process.env.NEAR_ACCOUNT_ID || 'chunker.vibesflow.testnet';
        this.mainPrivateKey = process.env.NEAR_PRIVATE_KEY;
        
        // Worker Account
        this.workerAccountId = null;
        this.workerPrivateKey = null;
        
        // Backend URLs
        this.dispatcherUrl = process.env.DISPATCHER_URL || 'http://localhost:3000';
        
        // State Management
        this.near = null;
        this.mainAccount = null;
        this.workerAccount = null;
        this.isRegistered = false;
        this.activeRaffles = new Map();
        this.processingQueue = new Map();
        
        // Directories
        this.tempDir = path.join(__dirname, 'temp');
        this.receiptsDir = path.join(__dirname, 'receipts');
    }

    async initialize() {
        try {
            console.log('🚀 Initializing VibesFlow Chunker Worker (Shade Agent)...');
            console.log(`📋 Main Account: ${this.mainAccountId}`);
            console.log(`🔗 Agent Contract: ${this.agentContractId}`);
            console.log(`🎲 VRF Raffling Service for Raw Chunks`);
            
            await this.setupDirectories();
            await this.initializeNEAR();
            await this.deriveWorkerAccount();
            await this.fundWorkerAccount();
            await this.registerWorker();
            
            console.log('✅ Chunker Worker initialization completed successfully');
            
        } catch (error) {
            console.error('❌ Worker initialization failed:', error);
            throw error;
        }
    }

    async setupDirectories() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
            await fs.mkdir(this.receiptsDir, { recursive: true });
            console.log('📁 Directories created successfully');
        } catch (error) {
            console.error('Failed to create directories:', error);
            throw error;
        }
    }

    async initializeNEAR() {
        try {
            const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
            
            if (!this.mainPrivateKey) {
                throw new Error('NEAR_PRIVATE_KEY environment variable required');
            }
            
            await keyStore.setKey('testnet', this.mainAccountId, utils.KeyPair.fromString(this.mainPrivateKey));

            const config = {
                networkId: 'testnet',
                keyStore,
                nodeUrl: 'https://rpc.testnet.near.org',
                walletUrl: 'https://testnet-wallet.near.org',
                helperUrl: 'https://helper.testnet.near.org',
                explorerUrl: 'https://testnet.nearblocks.io',
            };

            this.near = await connect(config);
            this.mainAccount = await this.near.account(this.mainAccountId);
            
            console.log(`✅ NEAR initialized: ${this.mainAccountId}`);

        } catch (error) {
            console.error('❌ NEAR initialization failed:', error);
            throw error;
        }
    }

    async deriveWorkerAccount() {
        try {
            console.log('🔑 Deriving worker account following shade-agent-js pattern...');
            
            const derivationSeed = `${this.mainAccountId}:${this.agentContractId}:chunker-worker`;
            const hash = Buffer.from(
                await crypto.subtle.digest('SHA-256', Buffer.from(derivationSeed, 'utf8'))
            );
            
            const data = generateSeedPhrase(hash);
            this.workerAccountId = this.getImplicitAccountId(data.publicKey);
            this.workerPrivateKey = data.secretKey;
            
            const keyPair = utils.KeyPair.fromString(this.workerPrivateKey);
            await this.near.connection.signer.keyStore.setKey('testnet', this.workerAccountId, keyPair);
            
            console.log(`✅ Worker account derived: ${this.workerAccountId}`);
            
        } catch (error) {
            console.error('❌ Worker account derivation failed:', error);
            throw error;
        }
    }

    getImplicitAccountId(publicKeyStr) {
        const publicKey = utils.PublicKey.from(publicKeyStr);
        return Buffer.from(publicKey.data).toString('hex').toLowerCase();
    }

    async fundWorkerAccount() {
        try {
            console.log('💰 Funding worker account...');
            
            this.workerAccount = await this.near.account(this.workerAccountId);
            
            let balance;
            try {
                balance = await this.workerAccount.getAccountBalance();
            } catch (e) {
                if (e.type === 'AccountDoesNotExist') {
                    balance = { available: '0' };
                } else {
                    throw e;
                }
            }
            
            const requiredBalance = utils.format.parseNearAmount('0.3');
            if (BigInt(balance.available) < BigInt(requiredBalance)) {
                const fundAmount = utils.format.parseNearAmount('0.5');
                console.log(`💸 Funding worker with ${utils.format.formatNearAmount(fundAmount)} NEAR`);
                
                await this.mainAccount.sendMoney(this.workerAccountId, fundAmount);
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                console.log(`✅ Worker funded`);
            } else {
                console.log('✅ Worker account has sufficient balance');
            }
            
        } catch (error) {
            console.error('❌ Worker funding failed:', error);
            throw error;
        }
    }

    async registerWorker() {
        try {
            console.log('📝 Registering worker with contract...');
            this.isRegistered = true; // For development
            console.log('✅ Worker registration completed (dev mode)');
            
        } catch (error) {
            console.error('❌ Worker registration failed:', error);
            this.isRegistered = false;
        }
    }

    setupExpress() {
        this.app.use(cors({
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
            credentials: false
        }));

        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'chunker-worker',
                timestamp: Date.now(),
                worker_account: this.workerAccountId,
                registered: this.isRegistered,
                active_raffles: this.activeRaffles.size,
                processing_queue: this.processingQueue.size
            });
        });

        // MAIN ENDPOINT: Process raw chunk from rawchunks backend
        this.app.post('/process/raw-chunk', async (req, res) => {
            await this.handleRawChunkProcessing(req, res);
        });

        // Dispatcher confirmation endpoint
        this.app.post('/confirm/upload', async (req, res) => {
            await this.handleUploadConfirmation(req, res);
        });

        console.log('✅ Express server configured with chunker endpoints');
    }

    // VRF PROCESSING LOGIC
    async handleRawChunkProcessing(req, res) {
        try {
            console.log('🎲 Processing raw chunk for VRF raffle...');
            
            const { action, chunkId, rtaId, audioData, metadata } = req.body;

            if (action !== 'process_raw_chunk') {
                return res.status(400).json({ error: 'Invalid action' });
            }

            if (!chunkId || !rtaId || !audioData) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Initialize VRF for this RTA if not exists
            if (!this.activeRaffles.has(rtaId)) {
                await this.initializeVRFForRTA(rtaId);
            }

            // Store processing state
            this.processingQueue.set(chunkId, {
                rtaId,
                metadata,
                audioData,
                status: 'processing',
                timestamp: Date.now()
            });

            // Generate VRF seed for this chunk
            const vrfSeed = await this.generateSecureVRFSeed(rtaId, chunkId);
            
            // Get participants for raffle
            const participants = await this.getRaffleParticipants(rtaId);
            
            // Perform VRF raffle
            const raffleResult = await this.performVRFRaffle(vrfSeed, participants, chunkId);
            
            // Add chunk owner to metadata
            const enhancedMetadata = {
                ...metadata,
                chunk_owner: raffleResult.winner,
                raffle_proof: raffleResult.proof,
                vrf_seed: vrfSeed,
                raffled_at: Date.now()
            };

            // Forward to dispatcher for upload (INDEPENDENT PROCESS)
            this.forwardToDispatcher(chunkId, rtaId, audioData, enhancedMetadata)
                .catch(error => console.error('Dispatcher forward error:', error));

            // Update processing state
            this.processingQueue.set(chunkId, {
                ...this.processingQueue.get(chunkId),
                status: 'raffled',
                raffleResult,
                enhancedMetadata
            });

            res.json({
                success: true,
                chunkId,
                rtaId,
                chunk_owner: raffleResult.winner,
                raffle_proof: raffleResult.proof,
                message: 'Chunk processed and raffled successfully'
            });

        } catch (error) {
            console.error('❌ Raw chunk processing failed:', error);
            res.status(500).json({
                error: 'Processing failed',
                message: error.message
            });
        }
    }

    async initializeVRFForRTA(rtaId) {
        try {
            console.log(`🎲 Initializing VRF for RTA: ${rtaId}`);
            
            const blockInfo = await this.getLatestBlockInfo();
            const vrfSeed = this.generateVRFSeed(rtaId, blockInfo);
            
            this.activeRaffles.set(rtaId, {
                vrfSeed,
                blockInfo,
                participants: new Set(),
                chunks: new Map(),
                initialized_at: Date.now()
            });
            
            console.log(`✅ VRF initialized for RTA: ${rtaId}`);
            
        } catch (error) {
            console.error('❌ VRF initialization failed:', error);
            throw error;
        }
    }

    async getLatestBlockInfo() {
        try {
            const status = await this.near.connection.provider.status();
            const block = await this.near.connection.provider.block(status.sync_info.latest_block_hash);
            
            return {
                hash: block.header.hash,
                height: block.header.height,
                timestamp: block.header.timestamp,
                prev_hash: block.header.prev_hash
            };
            
        } catch (error) {
            console.error('Failed to get block info:', error);
            return {
                hash: crypto.randomBytes(32).toString('hex'),
                height: Date.now(),
                timestamp: Date.now() * 1000000,
                prev_hash: crypto.randomBytes(32).toString('hex')
            };
        }
    }

    generateVRFSeed(rtaId, blockInfo) {
        const seedString = `${rtaId}:${blockInfo.hash}:${blockInfo.height}:${blockInfo.timestamp}`;
        return crypto.createHash('sha256').update(seedString).digest('hex');
    }

    async generateSecureVRFSeed(rtaId, chunkId) {
        const raffleState = this.activeRaffles.get(rtaId);
        if (!raffleState) {
            throw new Error(`No VRF state for RTA: ${rtaId}`);
        }
        
        const chunkSeedString = `${raffleState.vrfSeed}:${chunkId}:${Date.now()}`;
        return crypto.createHash('sha256').update(chunkSeedString).digest('hex');
    }

    async getRaffleParticipants(rtaId) {
        return [
            'alice.testnet',
            'bob.testnet', 
            'charlie.testnet',
            'diana.testnet',
            'eve.testnet'
        ];
    }

    async performVRFRaffle(vrfSeed, participants, chunkId) {
        try {
            console.log(`🎲 Performing VRF raffle for chunk: ${chunkId}`);
            
            if (!participants || participants.length === 0) {
                throw new Error('No participants for raffle');
            }
            
            // Create deterministic random from VRF seed
            const hash = crypto.createHash('sha256').update(`${vrfSeed}:${chunkId}`).digest();
            const randomValue = parseInt(hash.toString('hex').substring(0, 8), 16);
            
            // Select winner
            const winnerIndex = randomValue % participants.length;
            const winner = participants[winnerIndex];
            
            // Generate proof
            const proof = {
                vrf_seed: vrfSeed,
                chunk_id: chunkId,
                participants: participants,
                random_value: randomValue,
                winner_index: winnerIndex,
                winner: winner,
                timestamp: Date.now(),
                proof_hash: crypto.createHash('sha256').update(`${vrfSeed}:${chunkId}:${winner}`).digest('hex')
            };
            
            console.log(`🏆 VRF Winner: ${winner} (index ${winnerIndex} of ${participants.length})`);
            
            return {
                winner,
                proof,
                participants_count: participants.length
            };
            
        } catch (error) {
            console.error('❌ VRF raffle failed:', error);
            throw error;
        }
    }

    async forwardToDispatcher(chunkId, rtaId, audioData, enhancedMetadata) {
        try {
            console.log(`📤 Forwarding chunk to dispatcher: ${chunkId}`);
            
            const dispatcherPayload = {
                action: 'upload_chunk',
                chunkId,
                rtaId,
                audioData,
                metadata: enhancedMetadata,
                source: 'chunker-vrf'
            };
            
            const response = await fetch(`${this.dispatcherUrl}/upload/chunk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dispatcherPayload)
            });
            
            if (!response.ok) {
                throw new Error(`Dispatcher responded with ${response.status}`);
            }
            
            const result = await response.json();
            console.log(`✅ Chunk forwarded to dispatcher: ${chunkId}`);
            
            return result;
            
        } catch (error) {
            console.error(`❌ Failed to forward chunk to dispatcher: ${chunkId}`, error);
            throw error;
        }
    }

    async handleUploadConfirmation(req, res) {
        try {
            const { chunkId, cid, pdp, status } = req.body;
            
            if (!chunkId) {
                return res.status(400).json({ error: 'Missing chunkId' });
            }
            
            console.log(`📬 Upload confirmation for chunk: ${chunkId}, CID: ${cid}, Status: ${status}`);
            
            // Update processing queue
            const processingState = this.processingQueue.get(chunkId);
            if (processingState) {
                this.processingQueue.set(chunkId, {
                    ...processingState,
                    status: 'completed',
                    upload_result: { cid, pdp, status }
                });
            }
            
            res.json({
                success: true,
                chunkId,
                message: 'Upload confirmation received'
            });
            
        } catch (error) {
            console.error('❌ Upload confirmation failed:', error);
            res.status(500).json({
                error: 'Confirmation processing failed',
                message: error.message
            });
        }
    }

    async start() {
        try {
            await this.initialize();
            this.setupExpress();
            
            const server = this.app.listen(this.port, () => {
                console.log('🚀 VibesFlow Chunker Worker started successfully');
                console.log(`📡 Server running on port ${this.port}`);
                console.log(`🎲 VRF Raffling Service ready`);
                console.log(`🔗 Worker Account: ${this.workerAccountId}`);
                console.log(`📋 Contract: ${this.agentContractId}`);
                console.log(`✅ Ready to process raw chunks from backend`);
            });

            process.on('SIGTERM', () => {
                console.log('🛑 Received SIGTERM, shutting down gracefully...');
                server.close(() => {
                    console.log('👋 Chunker worker shut down complete');
                    process.exit(0);
                });
            });

        } catch (error) {
            console.error('❌ Failed to start chunker worker:', error);
            process.exit(1);
        }
    }
}

const worker = new VibesFlowChunkerWorker();
worker.start().catch(console.error);
