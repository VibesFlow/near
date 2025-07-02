import { contractCall } from '@neardefi/shade-agent-js';
import { ethers } from 'ethers';

const contractId = process.env.NEXT_PUBLIC_contractId;

// Filecoin Calibration network configuration
const FILECOIN_RPC_URL = process.env.FILECOIN_RPC_URL || 'https://api.calibration.node.glif.io/rpc/v1';
const FILECOIN_CHAIN_ID = 314159;

// USDFC contract address on Filecoin Calibration
const USDFC_CONTRACT = process.env.USDFC_ADDRESS || '0x7ea6eA49B0b0Ae9c5db7907d139D9Cd3439862a1';

// Pandora service address for USDFC approvals
const PANDORA_ADDRESS = process.env.PANDORA_ADDRESS || '0x1f63F2f0f316b631F61F9c5a6e75F8A4e4be0e4d';

export default async function sendTransaction(req, res) {
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { operation, to, amount, data } = req.body;

        let transactionData;
        
        switch (operation) {
            case 'approve_usdfc':
                transactionData = await buildUSDFCApprovalTransaction(amount || '1000000000000000000000'); // 1000 USDFC default
                break;
            case 'transfer_usdfc':
                transactionData = await buildUSDFCTransferTransaction(to, amount);
                break;
            case 'approve_pandora':
                transactionData = await buildPandoraApprovalTransaction(amount || '100000000000000000000'); // 100 USDFC default
                break;
            case 'custom':
                transactionData = await buildCustomTransaction(to, amount || '0', data || '0x');
                break;
            default:
                return res.status(400).json({ error: 'Invalid operation. Use: approve_usdfc, transfer_usdfc, approve_pandora, or custom' });
        }

        const { transaction, hashesToSign } = transactionData;

        let signRes;
        let verified = false;
        
        // Call the agent contract to get a signature for the payload
        try {
            signRes = await contractCall({
                contractId: contractId,
                methodName: 'sign_tx',
                args: {
                    payload: hashesToSign[0],
                    derivation_path: 'filecoin-1',
                    key_version: 0, // secp256k1
                },
            });
            verified = true;
        } catch (e) {
            console.error('Contract call error:', e);
        }

        if (!verified) {
            res.status(400).json({ verified, error: 'Failed to sign transaction' });
            return;
        }

        // Reconstruct the signed transaction
        const signedTransaction = await finalizeFilecoinTransaction(transaction, signRes);

        // Broadcast the signed transaction
        const txHash = await broadcastFilecoinTransaction(signedTransaction);
        
        res.status(200).json({ 
            success: true,
            txHash: txHash,
            operation: operation,
            to: transaction.to || 'N/A',
            value: transaction.value || '0',
            chainId: FILECOIN_CHAIN_ID
        });
        
    } catch (error) {
        console.error('Send transaction error:', error);
        res.status(500).json({ 
            error: 'Failed to send transaction', 
            details: error.message 
        });
    }
}

async function buildUSDFCApprovalTransaction(amount) {
    // Get the sender address (derived from the agent contract)
    const senderAddress = await getFilecoinAddress();
    
    // Create approval transaction for Pandora service
    const provider = new ethers.JsonRpcProvider(FILECOIN_RPC_URL);
    
    // USDFC approve function: approve(spender, amount)
    const usdfc = new ethers.Contract(USDFC_CONTRACT, [
        'function approve(address spender, uint256 amount) returns (bool)'
    ], provider);
    
    const data = usdfc.interface.encodeFunctionData('approve', [PANDORA_ADDRESS, amount]);
    
    const nonce = await provider.getTransactionCount(senderAddress);
    const gasPrice = await provider.getFeeData();
    
    const transaction = {
        to: USDFC_CONTRACT,
        value: '0',
        data: data,
        nonce: nonce,
        gasLimit: '100000',
        maxFeePerGas: gasPrice.maxFeePerGas?.toString() || '1000000000',
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString() || '1000000000',
        chainId: FILECOIN_CHAIN_ID,
        type: 2
    };
    
    const transactionHash = ethers.keccak256(ethers.serializeTransaction(transaction));
    
    return {
        transaction,
        hashesToSign: [Array.from(ethers.getBytes(transactionHash))]
    };
}

async function buildPandoraApprovalTransaction(amount) {
    // Build specific approval for Pandora service with proper allowance
    const senderAddress = await getFilecoinAddress();
    const provider = new ethers.JsonRpcProvider(FILECOIN_RPC_URL);
    
    // USDFC approve function for Pandora with high allowance
    const usdfc = new ethers.Contract(USDFC_CONTRACT, [
        'function approve(address spender, uint256 amount) returns (bool)'
    ], provider);
    
    const data = usdfc.interface.encodeFunctionData('approve', [PANDORA_ADDRESS, amount]);
    
    const nonce = await provider.getTransactionCount(senderAddress);
    const gasPrice = await provider.getFeeData();
    
    const transaction = {
        to: USDFC_CONTRACT,
        value: '0',
        data: data,
        nonce: nonce,
        gasLimit: '150000',
        maxFeePerGas: gasPrice.maxFeePerGas?.toString() || '1000000000',
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString() || '1000000000',
        chainId: FILECOIN_CHAIN_ID,
        type: 2
    };
    
    const transactionHash = ethers.keccak256(ethers.serializeTransaction(transaction));
    
    return {
        transaction,
        hashesToSign: [Array.from(ethers.getBytes(transactionHash))]
    };
}

async function buildUSDFCTransferTransaction(to, amount) {
    const senderAddress = await getFilecoinAddress();
    const provider = new ethers.JsonRpcProvider(FILECOIN_RPC_URL);
    
    // USDFC transfer function: transfer(to, amount)
    const usdfc = new ethers.Contract(USDFC_CONTRACT, [
        'function transfer(address to, uint256 amount) returns (bool)'
    ], provider);
    
    const data = usdfc.interface.encodeFunctionData('transfer', [to, amount]);
    
    const nonce = await provider.getTransactionCount(senderAddress);
    const gasPrice = await provider.getFeeData();
    
    const transaction = {
        to: USDFC_CONTRACT,
        value: '0',
        data: data,
        nonce: nonce,
        gasLimit: '100000',
        maxFeePerGas: gasPrice.maxFeePerGas?.toString() || '1000000000',
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString() || '1000000000',
        chainId: FILECOIN_CHAIN_ID,
        type: 2
    };
    
    const transactionHash = ethers.keccak256(ethers.serializeTransaction(transaction));
    
    return {
        transaction,
        hashesToSign: [Array.from(ethers.getBytes(transactionHash))]
    };
}

async function buildCustomTransaction(to, value, data) {
    const senderAddress = await getFilecoinAddress();
    const provider = new ethers.JsonRpcProvider(FILECOIN_RPC_URL);
    
    const nonce = await provider.getTransactionCount(senderAddress);
    const gasPrice = await provider.getFeeData();
    
    const transaction = {
        to: to,
        value: value,
        data: data,
        nonce: nonce,
        gasLimit: '200000',
        maxFeePerGas: gasPrice.maxFeePerGas?.toString() || '1000000000',
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString() || '1000000000',
        chainId: FILECOIN_CHAIN_ID,
        type: 2
    };
    
    const transactionHash = ethers.keccak256(ethers.serializeTransaction(transaction));
    
    return {
        transaction,
        hashesToSign: [Array.from(ethers.getBytes(transactionHash))]
    };
}

async function getFilecoinAddress() {
    // This would typically derive the address from the agent contract
    // For now, return the funded wallet address from env
    return process.env.FILECOIN_ADDRESS || '0xedD801D6c993B3c8052e485825A725ee09F1ff4D';
}

async function finalizeFilecoinTransaction(transaction, signature) {
    // Convert signature components to proper format
    const r = '0x' + signature.r;
    const s = '0x' + signature.s;
    const v = signature.v;
    
    // Create signed transaction
    const signedTx = ethers.serializeTransaction(transaction, { r, s, v });
    
    return signedTx;
}

async function broadcastFilecoinTransaction(signedTransaction) {
    const provider = new ethers.JsonRpcProvider(FILECOIN_RPC_URL);
    
    try {
        const txResponse = await provider.broadcastTransaction(signedTransaction);
        return txResponse.hash;
    } catch (error) {
        console.error('Broadcast error:', error);
        throw new Error(`Failed to broadcast transaction: ${error.message}`);
    }
} 