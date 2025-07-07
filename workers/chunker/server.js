/*! 
 * VibesFlow Chunker Shade Agent - Simplified
 * 1. Get chunk notification with participants in metadata
 * 2. VRF raffle participants (offchain) 
 * 3. Store proof on v1chunker.vibesflow.testnet contract
 * 4. Update metadata with owner field
 * 5. Move to next chunk
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { Consumer } from 'sqs-consumer';
import AWS from 'aws-sdk';
import { connect, keyStores, KeyPair } from 'near-api-js';
import { createHash } from 'crypto';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3001;
const NEAR_NETWORK = process.env.NEAR_NETWORK || 'testnet';
const NEAR_ACCOUNT_ID = process.env.NEAR_ACCOUNT_ID;
const NEAR_PRIVATE_KEY = process.env.NEAR_PRIVATE_KEY;
const AGENT_CONTRACT_ID = process.env.AGENT_CONTRACT_ID;
const RAWCHUNKS_SQS_QUEUE_URL = process.env.RAWCHUNKS_SQS_QUEUE_URL;
const RAWCHUNKS_URL = process.env.RAWCHUNKS_URL;
const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_URL = process.env.PINATA_URL;

// AWS Configuration
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

let near, account;

async function initNear() {
  try {
    const keyStore = new keyStores.InMemoryKeyStore();
    const keyPair = KeyPair.fromString(NEAR_PRIVATE_KEY);
    await keyStore.setKey(NEAR_NETWORK, NEAR_ACCOUNT_ID, keyPair);
    
    const config = {
      networkId: NEAR_NETWORK,
      keyStore: keyStore,
      nodeUrl: `https://rpc.${NEAR_NETWORK}.near.org`,
      walletUrl: `https://wallet.${NEAR_NETWORK}.near.org`,
      helperUrl: `https://helper.${NEAR_NETWORK}.near.org`,
      explorerUrl: `https://explorer.${NEAR_NETWORK}.near.org`,
    };
    
    near = await connect(config);
    account = await near.account(NEAR_ACCOUNT_ID);
    console.log(`✅ Connected to NEAR as ${NEAR_ACCOUNT_ID}`);
  } catch (error) {
    console.error('❌ Failed to initialize NEAR:', error);
    process.exit(1);
  }
}

// Simple VRF Implementation
function performVrfRaffle(chunkId, participants, blockData) {
  const seed = createHash('sha256')
    .update(chunkId + JSON.stringify(participants) + blockData)
    .digest('hex');
  
  const randomValue = parseInt(seed.substring(0, 8), 16);
  const winnerIndex = randomValue % participants.length;
  const winner = participants[winnerIndex];
  
  return {
    seed,
    randomValue,
    winnerIndex,
    winner,
    participants,
    timestamp: Date.now()
  };
}

// Store VRF Proof on Contract
async function storeVrfProof(chunkId, rtaId, vrfResult) {
  try {
    const result = await account.functionCall({
      contractId: AGENT_CONTRACT_ID,
      methodName: 'store_chunk_record',
      args: {
        chunk_id: chunkId,
        rta_id: rtaId,
        owner: vrfResult.winner,
        vrf_proof: JSON.stringify(vrfResult)
      },
      gas: '100000000000000',
      attachedDeposit: '0'
    });
    
    console.log(`✅ VRF proof stored for chunk ${chunkId}, owner: ${vrfResult.winner}`);
    return result;
  } catch (error) {
    console.error('❌ Failed to store VRF proof:', error);
    throw error;
  }
}

// Update Metadata with Owner
async function updateMetadataWithOwner(rtaId, chunkId, owner) {
  try {
    const updateData = {
      action: 'update_chunk_owner',
      rtaId,
      chunkId,
      owner: `${owner}.testnet`
    };
    
    const response = await fetch(`${RAWCHUNKS_URL}/update-metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PINATA_JWT}`
      },
      body: JSON.stringify(updateData)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update metadata: ${response.statusText}`);
    }
    
    console.log(`✅ Updated metadata for ${rtaId} chunk ${chunkId} with owner: ${owner}`);
    return await response.json();
  } catch (error) {
    console.error('❌ Failed to update metadata:', error);
    throw error;
  }
}

// Process Chunk Message
async function processChunk(message) {
  try {
    const { chunkId, rtaId, metadata } = message;
    
    if (!metadata || !metadata.participants || !Array.isArray(metadata.participants)) {
      console.error('❌ No participants found in metadata');
      return;
    }
    
    console.log(`🎲 Processing chunk ${chunkId} with ${metadata.participants.length} participants`);
    
    // Get latest block for VRF seed
    const blockData = await near.connection.provider.block({ finality: 'final' });
    const blockHash = blockData.header.hash;
    
    // Perform VRF raffle
    const vrfResult = performVrfRaffle(chunkId, metadata.participants, blockHash);
    console.log(`🎯 VRF Winner: ${vrfResult.winner} (index ${vrfResult.winnerIndex})`);
    
    // Store proof on contract
    await storeVrfProof(chunkId, rtaId, vrfResult);
    
    // Update metadata with owner
    await updateMetadataWithOwner(rtaId, chunkId, vrfResult.winner);
    
    console.log(`✅ Completed processing chunk ${chunkId}`);
    
  } catch (error) {
    console.error('❌ Failed to process chunk:', error);
    throw error;
  }
}

// SQS Consumer
const consumer = Consumer.create({
  queueUrl: RAWCHUNKS_SQS_QUEUE_URL,
  handleMessage: async (message) => {
    try {
      const data = JSON.parse(message.Body);
      if (data.action === 'process_wav_chunk') {
        await processChunk(data);
      }
    } catch (error) {
      console.error('❌ Error processing SQS message:', error);
      throw error;
    }
  },
  sqs: new AWS.SQS()
});

consumer.on('error', (err) => {
  console.error('❌ SQS Consumer error:', err);
});

consumer.on('processing_error', (err) => {
  console.error('❌ SQS Processing error:', err);
});

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    account: NEAR_ACCOUNT_ID,
    contract: AGENT_CONTRACT_ID
  });
});

// Start Server
async function startServer() {
  await initNear();
  
  app.listen(PORT, () => {
    console.log(`🚀 Chunker Shade Agent running on port ${PORT}`);
  });
  
  consumer.start();
  console.log('🔄 SQS Consumer started');
}

// Graceful Shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down gracefully...');
  consumer.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully...');
  consumer.stop();
  process.exit(0);
});

startServer().catch(console.error);
