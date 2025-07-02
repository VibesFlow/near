import { Synapse, TOKENS, CONTRACT_ADDRESSES, RPC_URLS, TIME_CONSTANTS, SIZE_CONSTANTS } from '@filoz/synapse-sdk';
import { ethers } from 'ethers';

export class StorageService {
    constructor(config = {}) {
        this.filecoinPrivateKey = config.filecoinPrivateKey;
        this.filecoinRpcUrl = config.filecoinRpcUrl || RPC_URLS.calibration.http;
        this.usdfc_address = config.usdfc_address || TOKENS.USDFC.calibration;
        this.pandoraAddress = config.pandoraAddress || CONTRACT_ADDRESSES.PANDORA.calibration;
        this.pdpVerifierAddress = config.pdpVerifierAddress || CONTRACT_ADDRESSES.PDP_VERIFIER.calibration;
        
        this.storageConfig = {
            storageCapacity: config.storageCapacity || 10, // GB
            persistencePeriod: config.persistencePeriod || 30, // days
            minDaysThreshold: config.minDaysThreshold || 10, // days
            withCDN: config.withCDN || true
        };
        
        this.synapseSDK = null;
        this.filecoinProvider = null;
        this.filecoinSigner = null;
        this.storageService = null;
        this.paymentsContract = null;
    }

    async initialize() {
        try {
            console.log('🔌 Initializing Storage Service...');
            
            // Initialize Filecoin provider and signer
            this.filecoinProvider = new ethers.JsonRpcProvider(this.filecoinRpcUrl);
            this.filecoinSigner = new ethers.Wallet(this.filecoinPrivateKey, this.filecoinProvider);
            
            console.log(`✅ Filecoin signer: ${this.filecoinSigner.address}`);
            
            // Initialize Synapse SDK
            this.synapseSDK = await Synapse.create({
                privateKey: this.filecoinPrivateKey,
                rpcURL: this.filecoinRpcUrl
            });
            
            this.paymentsContract = this.synapseSDK.payments;
            
            // Setup storage payments
            await this.setupStoragePayments();
            
            // Initialize storage service
            this.storageService = await this.synapseSDK.createStorage({
                withCDN: this.storageConfig.withCDN
            });
            
            console.log('✅ Storage Service initialized');
            
        } catch (error) {
            console.error('❌ Storage Service initialization failed:', error);
            throw error;
        }
    }

    async setupStoragePayments() {
        try {
            console.log('💰 Setting up storage payments...');
            
            // Check current USDFC balance
            const walletBalance = await this.paymentsContract.walletBalance(TOKENS.USDFC);
            const walletBalanceFormatted = ethers.formatUnits(walletBalance, this.paymentsContract.decimals(TOKENS.USDFC));
            console.log(`💳 Current USDFC wallet balance: ${walletBalanceFormatted} USDFC`);
            
            // Check balance in payments contract
            const paymentsBalance = await this.paymentsContract.balance(TOKENS.USDFC);
            const paymentsBalanceFormatted = ethers.formatUnits(paymentsBalance, this.paymentsContract.decimals(TOKENS.USDFC));
            console.log(`🏦 USDFC balance in payments contract: ${paymentsBalanceFormatted} USDFC`);
            
            // Calculate required amounts
            const storageMetrics = await this.calculateStorageMetrics();
            
            // Deposit funds if needed
            if (storageMetrics.depositNeeded > 0n) {
                console.log(`💰 Depositing ${ethers.formatUnits(storageMetrics.depositNeeded, 18)} USDFC...`);
                try {
                    const depositTx = await this.paymentsContract.deposit(storageMetrics.depositNeeded, TOKENS.USDFC);
                    await depositTx.wait();
                    console.log('✅ USDFC deposited');
                } catch (depositError) {
                    console.warn('⚠️ Deposit failed, continuing:', depositError.message);
                }
            }
            
            // Approve Pandora service
            console.log('💰 Approving Pandora service...');
            try {
                const approveTx = await this.paymentsContract.approveService(
                    this.pandoraAddress,
                    storageMetrics.rateAllowance,
                    storageMetrics.lockupAllowance
                );
                await approveTx.wait();
                console.log('✅ Pandora service approved');
            } catch (approvalError) {
                console.warn('⚠️ Approval failed, continuing:', approvalError.message);
            }
            
        } catch (error) {
            console.error('❌ Storage payments setup failed:', error);
            // Don't throw - allow service to continue
        }
    }

    async calculateStorageMetrics() {
        const storageCapacityBytes = this.storageConfig.storageCapacity * Number(SIZE_CONSTANTS.GiB);
        
        // Use higher allowances for reliable operation
        const rateAllowance = ethers.parseUnits('10', 18); // 10 USDFC per epoch
        const lockupAllowance = ethers.parseUnits('100', 18); // 100 USDFC lockup allowance
        
        // Check current balance to determine deposit needed
        const currentBalance = await this.paymentsContract.balance(TOKENS.USDFC);
        const depositNeeded = lockupAllowance > currentBalance ? lockupAllowance - currentBalance : 0n;
        
        return {
            rateAllowance,
            lockupAllowance,
            depositNeeded,
            storageCapacityBytes
        };
    }

    async getOrCreateProofSet() {
        try {
            console.log('🔍 Getting or creating proof set...');
            
            const proofSets = await this.synapseSDK.getProofSets();
            
            if (proofSets && proofSets.length > 0) {
                const proofSet = proofSets[0];
                console.log(`✅ Using existing proof set: ${proofSet.proofSetId}`);
                return proofSet;
            }
            
            // Create new proof set
            console.log('🔨 Creating new proof set...');
            const proofSet = await this.synapseSDK.createProofSet({
                fileSizeCapacity: this.storageConfig.storageCapacity * Number(SIZE_CONSTANTS.GiB),
                minimumAvailabilityPeriod: Math.max(
                    this.storageConfig.persistencePeriod * Number(TIME_CONSTANTS.DAY),
                    this.storageConfig.minDaysThreshold * Number(TIME_CONSTANTS.DAY)
                )
            });
            
            console.log(`✅ Created proof set: ${proofSet.proofSetId}`);
            return proofSet;
            
        } catch (error) {
            console.error('❌ Failed to get/create proof set:', error);
            throw error;
        }
    }

    async uploadFile(fileBuffer, filename, metadata = {}) {
        try {
            console.log(`📤 Uploading file: ${filename}`);
            
            if (!this.storageService) {
                throw new Error('Storage service not initialized');
            }
            
            // Get or create proof set
            const proofSet = await this.getOrCreateProofSet();
            
            // Upload file
            const uploadResult = await this.storageService.upload(fileBuffer, {
                filename,
                proofSet: proofSet.proofSetId,
                metadata
            });
            
            console.log(`✅ File uploaded: ${uploadResult.cid}`);
            return {
                cid: uploadResult.cid,
                size: fileBuffer.length,
                filename,
                proofSetId: proofSet.proofSetId,
                metadata,
                url: this.storageConfig.withCDN ? uploadResult.cdnUrl : uploadResult.url,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error(`❌ File upload failed for ${filename}:`, error);
            throw error;
        }
    }

    async getUploadStatus(cid) {
        try {
            const status = await this.storageService.getStatus(cid);
            return status;
        } catch (error) {
            console.error(`❌ Failed to get status for ${cid}:`, error);
            throw error;
        }
    }

    async downloadFile(cid) {
        try {
            const fileData = await this.storageService.download(cid);
            return fileData;
        } catch (error) {
            console.error(`❌ Failed to download ${cid}:`, error);
            throw error;
        }
    }

    formatUSDFC(amount) {
        try {
            return ethers.formatUnits(amount, 18);
        } catch (error) {
            return '0';
        }
    }
} 