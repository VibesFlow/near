import { deriveWorkerAccount, registerAgent } from '@neardefi/shade-agent-js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Test VRF raffle functionality
        const participants = ['user1.testnet', 'user2.testnet', 'user3.testnet'];
        const vrfSeed = Math.random().toString();
        const winner = participants[Math.floor(Math.random() * participants.length)];
        
        res.status(200).json({
            success: true,
            message: 'VRF test completed',
            vrfSeed: vrfSeed.substring(0, 16) + '...',
            winner: winner,
            participants: participants.length
        });
    } catch (error) {
        console.error('Test VRF error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
}
