import { deriveWorkerAccount, registerAgent } from '@neardefi/shade-agent-js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Test storage upload functionality
        const testData = Buffer.from('test audio chunk data');
        
        // For now, just return success
        // In production, this would integrate with Synapse SDK
        res.status(200).json({
            success: true,
            message: 'Storage test completed',
            size: testData.length
        });
    } catch (error) {
        console.error('Test upload error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
}
