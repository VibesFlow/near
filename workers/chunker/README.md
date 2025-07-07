# VibesFlow Chunker Shade Agent - Simplified

A NEAR Shade Agent that processes audio chunks with VRF raffles.

## The Flow

1. **Get notified** when new chunk is ready and uploaded on Pinata with metadata (including participants)
2. **VRF raffle** participants (offchain) - winner owns that specific chunk_ID
3. **Register proof** of VRF on `v0chunker.vibesflow.testnet` contract
4. **Update metadata** with `"owner": "${winner}.testnet"` in the `${rta_ID}.json` file
5. **Move to next chunk** in the queue

## Core Functions

### VRF Raffle
```javascript
function performVrfRaffle(chunkId, participants, blockData) {
  const seed = createHash('sha256')
    .update(chunkId + JSON.stringify(participants) + blockData)
    .digest('hex');
  
  const randomValue = parseInt(seed.substring(0, 8), 16);
  const winnerIndex = randomValue % participants.length;
  const winner = participants[winnerIndex];
  
  return { seed, randomValue, winnerIndex, winner, participants, timestamp: Date.now() };
}
```

### Store on Contract
```javascript
await account.functionCall({
  contractId: AGENT_CONTRACT_ID,
  methodName: 'store_chunk_record',
  args: {
    chunk_id: chunkId,
    rta_id: rtaId,
    owner: vrfResult.winner,
    vrf_proof: JSON.stringify(vrfResult)
  }
});
```

### Update Metadata
```javascript
await fetch(`${RAWCHUNKS_URL}/update-metadata`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${PINATA_JWT}` },
  body: JSON.stringify({
    action: 'update_chunk_owner',
    rtaId,
    chunkId,
    owner: `${owner}.testnet`
  })
});
```

## SQS Message Expected
```json
{
  "action": "process_wav_chunk",
  "chunkId": "rta_1751643534994_34tvlx_chunk_002_1751643678168_final",
  "rtaId": "rta_1751643534994_34tvlx",
  "wavCid": "QmXyZ123...",
  "metadata": {
    "participants": ["alice", "bob", "charlie", "dave"],
    "duration": 60000,
    "timestamp": 1751643678168
  }
}
```