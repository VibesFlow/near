import { Synapse, TOKENS, CONTRACT_ADDRESSES, RPC_URLS, PandoraService, SIZE_CONSTANTS, TIME_CONSTANTS } from '@filoz/synapse-sdk';
import { ethers } from 'ethers';

/**
 * StorageService - Production implementation following fs-upload-dapp tutorial exactly
 * Updated for Synapse SDK v0.13.0 with proper integration patterns
 * 
 * Features:
 * - Exact fs-upload-dapp configuration and flow
 * - Production USDFC payment setup using PandoraService
 * - CDN enabled for all uploads
 * - Full CID and PDP receipt handling
 * - Support for audio files with proper metadata
 * - No dev mode fallbacks - PRODUCTION ONLY
 */
export class StorageService {
    constructor(config = {}) {
        // Storage configuration following fs-upload-dapp config.ts exactly
        this.config = {
            storageCapacity: config.storageCapacity || 10, // GB, maximum storage capacity
            persistencePeriod: config.persistencePeriod || 30, // days, data persistence duration
            minDaysThreshold: config.minDaysThreshold || 10, // days, threshold for low-balance warnings
            withCDN: true // Whether to use CDN for the storage for faster retrieval
        };
        
        // Filecoin configuration - PRODUCTION only
        this.filecoinPrivateKey = config.filecoinPrivateKey;
        this.filecoinRpcUrl = config.filecoinRpcUrl || RPC_URLS.calibration.http;
        this.network = 'calibration'; 
        
        // SDK instances
        this.synapse = null;
        this.filecoinProvider = null;
        this.filecoinSigner = null;
        this.pandoraService = null;
        
        // State tracking
        this.isInitialized = false;
        this.lastBalanceCheck = 0;
        this.balanceCheckInterval = 60000; // 1 minute
    }

    async initialize() {
        try {
            console.log('🔌 Initializing Storage Service following fs-upload-dapp patterns...');
            console.log(`📋 Network: ${this.network}`);
            console.log(`💰 USDFC Token: ${TOKENS.USDFC}`);
            console.log(`🗄️ Pandora Contract: ${CONTRACT_ADDRESSES.PANDORA_SERVICE.calibration}`);
            console.log(`💳 Payments Contract: ${CONTRACT_ADDRESSES.PAYMENTS.calibration}`);
            console.log(`⚡ CDN Enabled: ${this.config.withCDN}`);
            
            // Initialize Filecoin provider and signer
            this.filecoinProvider = new ethers.JsonRpcProvider(this.filecoinRpcUrl);
            this.filecoinSigner = new ethers.Wallet(this.filecoinPrivateKey, this.filecoinProvider);
            
            console.log(`✅ Filecoin signer initialized: ${this.filecoinSigner.address}`);
            
            // Check FIL balance
            const balance = await this.filecoinProvider.getBalance(this.filecoinSigner.address);
            console.log(`💰 Current tFIL balance: ${ethers.formatEther(balance)} tFIL`);
            
            // Initialize Synapse SDK following fs-upload-dapp tutorial exactly
            this.synapse = await Synapse.create({
                privateKey: this.filecoinPrivateKey,
                rpcURL: this.filecoinRpcUrl
            });
            
            // Initialize Pandora service for proof set management
            this.pandoraService = new PandoraService(
                this.synapse.getProvider(),
                this.synapse.getPandoraAddress()
            );
            
            console.log(`✅ Synapse SDK initialized with CDN support`);
            
            // Setup storage payments following fs-upload-dapp patterns
            await this.setupStoragePayments();
            
            this.isInitialized = true;
            console.log('✅ Storage Service initialization complete');
            
        } catch (error) {
            console.error('❌ Storage Service initialization failed:', error);
            throw error;
        }
    }

    async setupStoragePayments() {
        try {
            console.log('💰 Setting up storage payments following fs-upload-dapp patterns...');
            
            // Get balance information following useBalances.ts pattern
            const balances = await this.getBalances();
            console.log(`💳 Current USDFC wallet balance: ${balances.usdfcBalance} USDFC`);
            console.log(`🏦 USDFC balance in payments contract: ${balances.pandoraBalance} USDFC`);
            
            // Calculate storage metrics using PandoraService
            const storageCapacityBytes = this.config.storageCapacity * SIZE_CONSTANTS.GiB;
            const pandoraBalance = await this.pandoraService.checkAllowanceForStorage(
                storageCapacityBytes,
                this.config.withCDN,
                this.synapse.payments
            );
            
            // Calculate required allowances
            const rateNeeded = pandoraBalance.rateAllowanceNeeded - pandoraBalance.currentRateUsed;
            const lockupNeeded = this.calculateRequiredLockup(pandoraBalance);
            const depositNeeded = lockupNeeded - pandoraBalance.currentLockupAllowance;
            
            console.log(`📊 Rate needed: ${ethers.formatUnits(rateNeeded, 18)} USDFC per epoch`);
            console.log(`📊 Lockup needed: ${ethers.formatUnits(lockupNeeded, 18)} USDFC total`);
            console.log(`📊 Deposit needed: ${ethers.formatUnits(depositNeeded > 0n ? depositNeeded : 0n, 18)} USDFC`);
            
            // Perform payment setup if needed
            if (depositNeeded > 0n || rateNeeded > 0n) {
                await this.handlePayment({
                    lockupAllowance: lockupNeeded,
                    epochRateAllowance: rateNeeded > 0n ? rateNeeded : pandoraBalance.currentRateAllowance,
                    depositAmount: depositNeeded > 0n ? depositNeeded : 0n
                });
            }
            
            console.log('✅ Storage payments setup complete');
            
        } catch (error) {
            console.error('❌ Storage payments setup failed:', error);
            console.warn('⚠️ Continuing without complete payment setup - some features may not work');
        }
    }

    async handlePayment({ lockupAllowance, epochRateAllowance, depositAmount }) {
        try {
            console.log('💰 Processing payment following usePayment.ts pattern...');
            
            const paymentsAddress = CONTRACT_ADDRESSES.PAYMENTS.calibration;
            const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
            
            // Check current allowance
            const allowance = await this.synapse.payments.allowance(TOKENS.USDFC, paymentsAddress);
            const balance = await this.synapse.payments.walletBalance(TOKENS.USDFC);
            
            if (balance < depositAmount) {
                throw new Error(`Insufficient USDFC balance. Have: ${ethers.formatUnits(balance, 18)}, Need: ${ethers.formatUnits(depositAmount, 18)}`);
            }
            
            // Approve USDFC spending if needed
            if (allowance < MAX_UINT256) {
                console.log('💰 Approving USDFC to cover storage costs...');
                const approveTx = await this.synapse.payments.approve(TOKENS.USDFC, paymentsAddress, MAX_UINT256);
                await approveTx.wait();
                console.log('💰 Successfully approved USDFC to cover storage costs');
            }
            
            // Deposit USDFC if needed
            if (depositAmount > 0n) {
                console.log(`💰 Depositing ${ethers.formatUnits(depositAmount, 18)} USDFC to cover storage costs...`);
                const depositTx = await this.synapse.payments.deposit(depositAmount);
                await depositTx.wait();
                console.log('💰 Successfully deposited USDFC to cover storage costs');
            }
            
            // Approve Pandora service
            console.log('💰 Approving Pandora service USDFC spending rates...');
            const serviceApproveTx = await this.synapse.payments.approveService(
                CONTRACT_ADDRESSES.PANDORA_SERVICE.calibration,
                epochRateAllowance,
                lockupAllowance
            );
            await serviceApproveTx.wait();
            console.log('💰 Successfully approved Pandora spending rates');
            
        } catch (error) {
            console.error('❌ Payment processing failed:', error);
            throw error;
        }
    }

    calculateRequiredLockup(pandoraBalance) {
        const persistencePeriodDays = BigInt(this.config.persistencePeriod);
        const lockupPerDay = TIME_CONSTANTS.EPOCHS_PER_DAY * pandoraBalance.rateAllowanceNeeded;
        const currentLockupRemaining = pandoraBalance.currentLockupAllowance - pandoraBalance.currentLockupUsed;
        const persistenceDaysLeft = Number(currentLockupRemaining) / Number(lockupPerDay);
        
        return Number(persistencePeriodDays) > persistenceDaysLeft
            ? BigInt(parseInt(((Number(persistencePeriodDays) - persistenceDaysLeft) * Number(lockupPerDay) + Number(pandoraBalance.currentLockupUsed)).toString()))
            : pandoraBalance.currentLockupAllowance;
    }

    async uploadFile(fileBuffer, filename, metadata = {}) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            console.log(`📤 Uploading audio file: ${filename} following fs-upload-dapp patterns`);
            console.log(`📊 File size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);
            
            // Convert to Uint8Array following fs-upload-dapp useFileUpload.ts
            const uint8ArrayBytes = new Uint8Array(fileBuffer);
            
            // Create storage service following fs-upload-dapp patterns
            console.log('🗄️ Creating storage service...');
            const storageService = await this.synapse.createStorage({
                withCDN: this.config.withCDN
            });
            
            console.log(`🗄️ Storage service created with CDN: ${this.config.withCDN}`);
            
            // Upload file following fs-upload-dapp useFileUpload.ts exactly
            console.log('📁 Uploading to storage provider...');
            const uploadResult = await storageService.upload(uint8ArrayBytes);
            
            if (!uploadResult || !uploadResult.commp) {
                throw new Error('Upload failed - no CommP returned');
            }
            
            console.log(`✅ File uploaded successfully:`);
            console.log(`📊 CommP (CID): ${uploadResult.commp}`);
            console.log(`📏 Size: ${uploadResult.size || uint8ArrayBytes.length} bytes`);
            
            // Return complete upload result following fs-upload-dapp format
            return {
                success: true,
                // CID information (primary identifier)
                cid: uploadResult.commp,
                commp: uploadResult.commp,
                filecoinCid: uploadResult.commp,
                
                // PDP information for proof of storage
                proofSetId: storageService.proofSetId,
                pdpProofSetId: storageService.proofSetId,
                
                // File information
                filename,
                size: uploadResult.size || uint8ArrayBytes.length,
                
                // Metadata
                metadata: {
                    ...metadata,
                    uploadedAt: new Date().toISOString(),
                    uploadedBy: 'dispatcher-worker',
                    network: this.network,
                    withCDN: this.config.withCDN
                },
                
                // Status
                uploadStatus: "🎉 File successfully stored on Filecoin!",
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error(`❌ File upload failed for ${filename}:`, error);
            throw error;
        }
    }

    async uploadChunk(chunkData, chunkId, rtaId, chunkOwner, metadata = {}) {
        try {
            console.log(`📤 Processing chunk upload for chunk: ${chunkId} (RTA: ${rtaId})`);
            
            // Convert base64 chunk data to buffer
            const chunkBuffer = Buffer.from(chunkData, 'base64');
            console.log(`📊 Chunk size: ${(chunkBuffer.length / 1024 / 1024).toFixed(2)}MB`);
            
            // Create enhanced metadata
            const chunkMetadata = {
                rtaId,
                chunkId,
                chunkOwner: chunkOwner || 'unknown',
                ...metadata,
                uploadedAt: new Date().toISOString(),
                uploadedBy: 'dispatcher-worker',
                type: 'audio-chunk'
            };
            
            // Upload using the regular file upload method
            const uploadResult = await this.uploadFile(chunkBuffer, `chunk_${chunkId}.bin`, chunkMetadata);
            
            console.log(`✅ Chunk upload completed: ${chunkId}`);
            console.log(`📊 CID: ${uploadResult.cid}`);
            
            return {
                ...uploadResult,
                rtaId,
                chunkId,
                chunkOwner
            };
            
        } catch (error) {
            console.error(`❌ Chunk upload failed for ${chunkId}:`, error);
            throw error;
        }
    }

    async downloadFile(cid) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            console.log(`📥 Downloading content with CID: ${cid}`);
            
            // Create storage service for download following fs-upload-dapp useDownloadRoot.ts
            const storageService = await this.synapse.createStorage({
                withCDN: this.config.withCDN
            });
            
            // Download file
            const uint8ArrayBytes = await storageService.download(cid);
            
            if (!uint8ArrayBytes) {
                throw new Error('Content not found');
            }
            
            console.log(`✅ Downloaded ${uint8ArrayBytes.length} bytes`);
            return uint8ArrayBytes;
            
        } catch (error) {
            console.error(`❌ Failed to download ${cid}:`, error);
            throw error;
        }
    }

    async getBalances() {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            // Get balances following useBalances.ts pattern
            const [filRaw, usdfcRaw, paymentsRaw] = await Promise.all([
                this.synapse.payments.walletBalance(), // FIL balance
                this.synapse.payments.walletBalance(TOKENS.USDFC), // USDFC wallet balance
                this.synapse.payments.balance(TOKENS.USDFC) // USDFC in payments contract
            ]);
            
            const usdfcDecimals = this.synapse.payments.decimals(TOKENS.USDFC);
            
            return {
                filBalance: Number(ethers.formatUnits(filRaw, 18)).toFixed(5),
                usdfcBalance: Number(ethers.formatUnits(usdfcRaw, usdfcDecimals)).toFixed(5),
                pandoraBalance: Number(ethers.formatUnits(paymentsRaw, usdfcDecimals)).toFixed(5)
            };
            
        } catch (error) {
            console.error('❌ Error getting balances:', error);
            return { filBalance: '0', usdfcBalance: '0', pandoraBalance: '0' };
        }
    }

    async calculateStorageMetrics() {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            const balances = await this.getBalances();
            const storageCapacityBytes = this.config.storageCapacity * SIZE_CONSTANTS.GiB;
            
            // Calculate storage metrics using PandoraService
            const pandoraBalance = await this.pandoraService.checkAllowanceForStorage(
                storageCapacityBytes,
                this.config.withCDN,
                this.synapse.payments
            );
            
            return {
                balances,
                storageConfig: this.config,
                pandoraBalance,
                rateNeeded: ethers.formatUnits(pandoraBalance.rateAllowanceNeeded, 18),
                currentRateUsed: ethers.formatUnits(pandoraBalance.currentRateUsed, 18),
                currentLockupAllowance: ethers.formatUnits(pandoraBalance.currentLockupAllowance, 18)
            };
            
        } catch (error) {
            console.error('❌ Error calculating storage metrics:', error);
            throw error;
        }
    }
} 