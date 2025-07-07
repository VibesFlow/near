#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'test-dispatcher',
        timestamp: Date.now(),
        mode: 'no-near'
    });
});

// Synapse upload simulation
app.post('/upload/chunk', async (req, res) => {
    try {
        console.log('🚀 Processing Synapse upload...');
        
        const { action, chunkId, rtaId, audioData, metadata, source } = req.body;

        if (action !== 'upload_chunk') {
            return res.status(400).json({ error: 'Invalid action' });
        }

        console.log(`📦 Uploading chunk: ${chunkId}`);
        console.log(`🏆 Chunk owner: ${metadata.chunk_owner}`);
        console.log(`🎲 VRF proof verified: ${metadata.raffle_proof ? 'YES' : 'NO'}`);
        
        // Simulate Synapse processing time
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate Synapse results
        const synapseCID = `synapse_${crypto.randomBytes(20).toString('hex')}`;
        const pdp = `pdp_${crypto.randomBytes(20).toString('hex')}`;
        
        console.log(`✅ Synapse upload completed`);
        console.log(`📦 CID: ${synapseCID}`);
        console.log(`🔐 PDP: ${pdp}`);
        
        res.json({
            success: true,
            chunkId,
            rtaId,
            cid: synapseCID,
            pdp: pdp,
            upload_time: Date.now(),
            chunk_owner: metadata.chunk_owner,
            message: 'Chunk uploaded to Synapse successfully'
        });

    } catch (error) {
        console.error('❌ Synapse upload failed:', error);
        res.status(500).json({ error: 'Upload failed', message: error.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Test Dispatcher running on port ${port} (SYNAPSE SIM, NO NEAR)`);
});
