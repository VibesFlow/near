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

    const { cid } = req.query;

    if (!cid) {
        return res.status(400).json({ error: 'CID parameter required' });
    }

    try {
        const storage = await getStorageService();
        const fileData = await storage.downloadFile(cid);
        
        // Set appropriate headers for file download
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${cid}"`);
        
        res.status(200).send(fileData);

    } catch (error) {
        console.error(`❌ Failed to download ${cid}:`, error);
        res.status(500).json({
            error: 'Failed to download file: ' + error.message
        });
    }
} 