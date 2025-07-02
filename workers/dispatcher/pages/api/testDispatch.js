import { contractCall } from '@neardefi/shade-agent-js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { rtaId, chunkId, chunkData, metadata } = req.body;
        
        if (!rtaId || !chunkId) {
            return res.status(400).json({ 
                error: 'Missing required fields: rtaId, chunkId'
            });
        }

        console.log(`📦 Dispatcher processing: RTA ${rtaId}, Chunk ${chunkId}`);

        // Simulate dispatch to Filecoin via Synapse
        const mockFilecoinCID = `baf${Math.random().toString(36).substring(2, 15)}`;
        
        // Record dispatch in contract (only if worker is registered)
        try {
            await contractCall({
                contractId: process.env.NEXT_PUBLIC_contractId,
                methodName: 'record_dispatch',
                args: {
                    rta_id: rtaId,
                    chunk_id: chunkId,
                    filecoin_cid: mockFilecoinCID
                }
            });
            console.log('✅ Dispatch recorded in contract');
        } catch (contractError) {
            console.warn('⚠️ Contract recording failed:', contractError.message);
        }

        res.status(200).json({
            success: true,
            rtaId,
            chunkId,
            filecoinCID: mockFilecoinCID,
            status: 'dispatched',
            timestamp: Date.now(),
            message: 'Chunk dispatched to Filecoin storage'
        });

    } catch (error) {
        console.error('❌ Dispatch error:', error);
        res.status(500).json({ 
            error: 'Dispatch failed', 
            details: error.message 
        });
    }
}

async function getAccount(accountId) {
    const { connect, keyStores, utils } = await import('near-api-js');
    
    const keyStore = new keyStores.InMemoryKeyStore();
    
    if (process.env.NEAR_PRIVATE_KEY) {
        const keyPair = utils.KeyPair.fromString(process.env.NEAR_PRIVATE_KEY);
        await keyStore.setKey('testnet', accountId, keyPair);
    }
    
    const config = {
        networkId: 'testnet',
        nodeUrl: 'https://rpc.testnet.near.org',
        keyStore,
    };
    
    const near = await connect(config);
    return near.account(accountId);
} 