import { deriveAgentAccount, registerWorker, checkWorkerRegistration } from '@neardefi/shade-agent-js';
import { generateSeedPhrase } from 'near-seed-phrase';
import { getAccount, contractId, TGAS } from './near-provider.js';
import * as nearAPI from 'near-api-js';
import crypto from 'crypto';

export class WorkerRegistration {
    constructor(config = {}) {
        this.agentContractId = config.agentContractId || contractId;
        this.mainAccountId = config.mainAccountId;
        this.mainPrivateKey = config.mainPrivateKey;
        this.codeHash = config.codeHash;
        
        this.workerAccountId = null;
        this.workerPrivateKey = null;
        this.teeClient = null;
    }

    async initializeTEEClient() {
        try {
            // Try to initialize TEE client
            const { TappdClient } = await import('@phala/dstack-sdk');
            this.teeClient = new TappdClient();
            console.log('✅ TEE client initialized');
        } catch (error) {
            console.log('⚠️ TEE client not available:', error.message);
            this.teeClient = null;
        }
    }

    async getTEEEntropy() {
        try {
            if (!this.teeClient) {
                await this.initializeTEEClient();
            }
            
            if (this.teeClient) {
                const randomString = Buffer.from(crypto.randomBytes(32)).toString('hex');
                const keyFromTee = await this.teeClient.deriveKey(randomString, randomString);
                return keyFromTee.asUint8Array(32);
            }
            
            return null;
        } catch (error) {
            console.log('⚠️ TEE entropy not available:', error.message);
            return null;
        }
    }

    getImplicitAccountId(publicKeyStr) {
        const publicKey = nearAPI.utils.PublicKey.from(publicKeyStr);
        return Buffer.from(publicKey.data).toString('hex').toLowerCase();
    }

    async deriveWorkerAccount() {
        try {
            console.log('🔑 Deriving worker account following shade-agent-js pattern...');
            
            if (process.env.NODE_ENV !== 'production') {
                // In development, use the main account
                this.workerAccountId = this.mainAccountId;
                this.workerPrivateKey = this.mainPrivateKey;
                console.log(`✅ Development mode - using main account: ${this.workerAccountId}`);
                return;
            }
            
            // Production mode - derive from TEE entropy or crypto randomness
            const randomArray = new Uint8Array(32);
            crypto.getRandomValues(randomArray);
            
            let hash;
            try {
                const teeEntropy = await this.getTEEEntropy();
                if (teeEntropy) {
                    console.log('🔐 Using TEE entropy for worker derivation');
                    hash = Buffer.from(
                        await crypto.subtle.digest(
                            'SHA-256',
                            Buffer.concat([randomArray, teeEntropy])
                        )
                    );
                } else {
                    throw new Error('TEE not available');
                }
            } catch (teeError) {
                console.log('🔧 TEE not available, using crypto randomness');
                hash = Buffer.from(
                    await crypto.subtle.digest('SHA-256', randomArray)
                );
            }
            
            // Generate seed phrase and derive worker account
            const data = generateSeedPhrase(hash);
            this.workerAccountId = this.getImplicitAccountId(data.publicKey);
            this.workerPrivateKey = data.secretKey;
            
            console.log(`✅ Worker account derived: ${this.workerAccountId}`);
            
        } catch (error) {
            console.error('❌ Worker account derivation failed:', error);
            throw error;
        }
    }

    async fundWorkerAccount() {
        try {
            if (process.env.NODE_ENV !== 'production') {
                console.log('✅ Development mode - skipping worker funding');
                return;
            }
            
            console.log('💰 Funding worker account...');
            
            const mainAccount = await getAccount(this.mainAccountId);
            
            // Check worker balance
            let balance;
            try {
                const workerAccount = await getAccount(this.workerAccountId);
                balance = await workerAccount.getAccountBalance();
            } catch (e) {
                if (e.type === 'AccountDoesNotExist') {
                    balance = { available: '0' };
                } else {
                    throw e;
                }
            }
            
            console.log(`💰 Worker balance: ${nearAPI.utils.format.formatNearAmount(balance.available)} NEAR`);
            
            // Fund if balance is low
            const requiredBalance = nearAPI.utils.format.parseNearAmount('0.25');
            if (BigInt(balance.available) < BigInt(requiredBalance)) {
                const fundAmount = nearAPI.utils.format.parseNearAmount('0.3');
                console.log(`💸 Funding worker with ${nearAPI.utils.format.formatNearAmount(fundAmount)} NEAR`);
                
                await mainAccount.sendMoney(this.workerAccountId, fundAmount);
                
                // Wait for funding to complete
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const newBalance = await getAccount(this.workerAccountId).then(acc => acc.getAccountBalance());
                console.log(`✅ Worker funded. New balance: ${nearAPI.utils.format.formatNearAmount(newBalance.available)} NEAR`);
            } else {
                console.log('✅ Worker account already has sufficient balance');
            }
            
        } catch (error) {
            console.error('❌ Worker funding failed:', error);
            throw error;
        }
    }

    async ensureCodeHashApproved() {
        try {
            console.log('🔍 Checking code hash approval...');
            
            const mainAccount = await getAccount(this.mainAccountId);
            
            // Check if code hash is approved
            const approvedHashes = await mainAccount.viewFunction({
                contractId: this.agentContractId,
                methodName: 'get_approved_codehashes',
                args: {}
            });
            
            console.log('📋 Approved code hashes:', approvedHashes);
            
            if (!approvedHashes.includes(this.codeHash)) {
                console.log(`📝 Approving code hash: ${this.codeHash}`);
                
                const result = await mainAccount.functionCall({
                    contractId: this.agentContractId,
                    methodName: 'approve_codehash',
                    args: {
                        codehash: this.codeHash
                    },
                    gas: TGAS * BigInt(100),
                    attachedDeposit: '0'
                });
                
                console.log(`✅ Code hash approved:`, result.transaction.hash);
            } else {
                console.log('✅ Code hash already approved');
            }
            
        } catch (error) {
            console.error('❌ Code hash approval failed:', error);
            throw error;
        }
    }

    async checkWorkerRegistration() {
        try {
            console.log('🔍 Checking worker registration...');
            
            const account = await getAccount(this.workerAccountId);
            
            const isRegistered = await account.viewFunction({
                contractId: this.agentContractId,
                methodName: 'is_worker_registered',
                args: {
                    worker_account_id: this.workerAccountId
                }
            });
            
            console.log(`📋 Worker registration status: ${isRegistered}`);
            return isRegistered;
            
        } catch (error) {
            console.error('❌ Failed to check worker registration:', error);
            return false;
        }
    }

    async registerWorker() {
        try {
            console.log('📝 Registering worker...');
            
            if (process.env.NODE_ENV !== 'production') {
                console.log('✅ Development mode - skipping registration');
                return { registered: true, development: true };
            }
            
            // Check if already registered
            const isRegistered = await this.checkWorkerRegistration();
            if (isRegistered) {
                console.log('✅ Worker already registered');
                return { registered: true, alreadyRegistered: true };
            }
            
            // Ensure code hash is approved
            await this.ensureCodeHashApproved();
            
            // Register with TEE attestation
            try {
                const result = await this.registerWithTEEAttestation();
                console.log('✅ Worker registered with TEE attestation');
                return result;
            } catch (teeError) {
                console.log('⚠️ TEE registration failed, trying code hash registration:', teeError.message);
                const result = await this.registerWithCodeHash();
                console.log('✅ Worker registered with code hash');
                return result;
            }
            
        } catch (error) {
            console.error('❌ Worker registration failed:', error);
            throw error;
        }
    }

    async registerWithTEEAttestation() {
        console.log('🔐 Attempting TEE attestation registration...');
        
        if (!this.teeClient) {
            await this.initializeTEEClient();
        }
        
        if (!this.teeClient) {
            throw new Error('TEE client not available');
        }
        
        // Generate real attestation quote
        const attestationQuote = await this.generateRealAttestationQuote();
        
        const workerAccount = await getAccount(this.workerAccountId);
        
        const result = await workerAccount.functionCall({
            contractId: this.agentContractId,
            methodName: 'register_worker',
            args: {
                code_hash: this.codeHash,
                attestation_quote: Array.from(attestationQuote)
            },
            gas: TGAS * BigInt(200),
            attachedDeposit: '0'
        });
        
        return {
            registered: true,
            method: 'tee_attestation',
            transaction: result.transaction.hash
        };
    }

    async registerWithCodeHash() {
        console.log('🔑 Registering with code hash only...');
        
        const workerAccount = await getAccount(this.workerAccountId);
        
        const result = await workerAccount.functionCall({
            contractId: this.agentContractId,
            methodName: 'register_worker_simple',
            args: {
                code_hash: this.codeHash
            },
            gas: TGAS * BigInt(100),
            attachedDeposit: '0'
        });
        
        return {
            registered: true,
            method: 'code_hash',
            transaction: result.transaction.hash
        };
    }

    async generateRealAttestationQuote() {
        try {
            if (!this.teeClient) {
                throw new Error('TEE client not available');
            }
            
            // Generate a real attestation quote using the TEE client
            const quote = await this.teeClient.getRemoteAttestation({
                challenge: this.codeHash
            });
            
            return new Uint8Array(quote);
            
        } catch (error) {
            console.error('❌ Failed to generate real attestation quote:', error);
            throw error;
        }
    }

    generateCodeHash() {
        return crypto.createHash('sha256')
            .update(process.env.npm_package_version || '1.0.0')
            .update(process.env.NODE_ENV || 'development')
            .update(Date.now().toString())
            .digest('hex');
    }
} 