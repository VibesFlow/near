import { StorageService } from '../../utils/storage-service.js';

// Global storage service instance
let storageService = null;

async function getStorageService() {
    if (!storageService) {
        storageService = new StorageService({
            filecoinPrivateKey: process.env.FILECOIN_PRIVATE_KEY,
            filecoinRpcUrl: process.env.FILECOIN_RPC_URL,
            storageCapacity: parseInt(process.env.STORAGE_CAPACITY_GB || '10'),
            persistencePeriod: parseInt(process.env.PERSISTENCE_PERIOD_DAYS || '30'),
            withCDN: process.env.WITH_CDN === 'true'
        });
        
        await storageService.initialize();
    }
    return storageService;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const storage = await getStorageService();
        
        // Get current balances
        const walletBalance = await storage.paymentsContract.walletBalance(storage.usdfc_address);
        const paymentsBalance = await storage.paymentsContract.balance(storage.usdfc_address);
        
        // Calculate storage metrics
        const storageMetrics = await storage.calculateStorageMetrics();
        
        res.status(200).json({
            success: true,
            metrics: {
                storageConfig: storage.storageConfig,
                balances: {
                    wallet: storage.formatUSDFC(walletBalance),
                    payments: storage.formatUSDFC(paymentsBalance)
                },
                requirements: {
                    rateAllowance: storage.formatUSDFC(storageMetrics.rateAllowance),
                    lockupAllowance: storage.formatUSDFC(storageMetrics.lockupAllowance),
                    depositNeeded: storage.formatUSDFC(storageMetrics.depositNeeded)
                },
                addresses: {
                    usdfc: storage.usdfc_address,
                    pandora: storage.pandoraAddress,
                    pdpVerifier: storage.pdpVerifierAddress
                }
            }
        });

    } catch (error) {
        console.error('❌ Failed to get storage metrics:', error);
        res.status(500).json({
            error: 'Failed to get storage metrics: ' + error.message
        });
    }
} 