import multer from 'multer';
import { StorageService } from '../../utils/storage-service.js';

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
    },
});

// Global storage service instance
let storageService = null;

async function initializeStorageService() {
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
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Initialize storage service
        const storage = await initializeStorageService();
        
        // Handle file upload
        upload.single('file')(req, res, async (err) => {
            if (err) {
                console.error('Multer error:', err);
                return res.status(400).json({ error: 'File upload error: ' + err.message });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file provided' });
            }

            try {
                console.log(`📤 Processing file upload: ${req.file.originalname}`);
                
                // Prepare metadata
                const metadata = {
                    originalName: req.file.originalname,
                    mimeType: req.file.mimetype,
                    uploadedAt: new Date().toISOString(),
                    uploadedBy: 'dispatcher-worker',
                    size: req.file.size
                };

                // Upload to Synapse storage
                const uploadResult = await storage.uploadFile(
                    req.file.buffer,
                    req.file.originalname,
                    metadata
                );

                console.log(`✅ File uploaded successfully: ${uploadResult.cid}`);

                res.status(200).json({
                    success: true,
                    upload: uploadResult,
                    message: 'File uploaded successfully'
                });

            } catch (uploadError) {
                console.error('❌ File upload failed:', uploadError);
                res.status(500).json({
                    error: 'Upload failed: ' + uploadError.message
                });
            }
        });

    } catch (error) {
        console.error('❌ Storage service initialization failed:', error);
        res.status(500).json({
            error: 'Storage service unavailable: ' + error.message
        });
    }
}

export const config = {
    api: {
        bodyParser: false, // Disable body parsing, multer will handle it
    },
}; 