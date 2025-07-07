#!/usr/bin/env node

/**
 * VibesFlow Dispatcher Worker Setup Script
 * Following NEAR Shade Agents documentation requirements:
 * 1. Fund worker account with testnet NEAR
 * 2. Approve codehash in the contract
 */

import * as dotenv from 'dotenv';
import nearAPI from 'near-api-js';
import crypto from 'crypto';
import { generateSeedPhrase } from 'near-seed-phrase';

dotenv.config();

const { connect, keyStores, utils } = nearAPI;

// Configuration
const NETWORK_ID = 'testnet';
const MAIN_ACCOUNT_ID = process.env.NEAR_ACCOUNT_ID;
const MAIN_PRIVATE_KEY = process.env.NEAR_PRIVATE_KEY;
const AGENT_CONTRACT_ID = process.env.AGENT_CONTRACT_ID;

// Docker image SHA256 (without sha256: prefix)
const DOCKER_CODEHASH = '5398b71a222acbc39cc8f0a3e7e142455b63a1b7e030047cddb2843dd7ddae06';

console.log('🚀 VibesFlow Dispatcher Worker Setup');
console.log('📋 Main Account:', MAIN_ACCOUNT_ID);
console.log('🔗 Contract:', AGENT_CONTRACT_ID);
console.log('🔑 Codehash:', DOCKER_CODEHASH);

async function setupWorker() {
    try {
        // Initialize NEAR connection
        const keyStore = new keyStores.InMemoryKeyStore();
        await keyStore.setKey(NETWORK_ID, MAIN_ACCOUNT_ID, utils.KeyPair.fromString(MAIN_PRIVATE_KEY));

        const config = {
            networkId: NETWORK_ID,
            keyStore,
            nodeUrl: 'https://rpc.testnet.near.org',
            walletUrl: 'https://testnet-wallet.near.org',
            helperUrl: 'https://helper.testnet.near.org',
            explorerUrl: 'https://testnet.nearblocks.io',
        };

        const near = await connect(config);
        const mainAccount = await near.account(MAIN_ACCOUNT_ID);
        
        console.log('\n✅ NEAR connection established');

        // Step 1: Derive worker account (same logic as in server.js)
        console.log('\n📝 Step 1: Deriving worker account...');
        const derivationSeed = `${MAIN_ACCOUNT_ID}:${AGENT_CONTRACT_ID}:dispatcher-worker`;
        const hash = Buffer.from(
            await crypto.subtle.digest('SHA-256', Buffer.from(derivationSeed, 'utf8'))
        );
        
        const data = generateSeedPhrase(hash);
        const workerAccountId = getImplicitAccountId(data.publicKey);
        
        console.log(`🔑 Worker Account: ${workerAccountId}`);
        console.log(`🔑 Worker Public Key: ${data.publicKey}`);

        // Step 2: Fund worker account (per documentation requirement)
        console.log('\n💰 Step 2: Funding worker account...');
        
        try {
            const workerAccount = await near.account(workerAccountId);
            let balance;
            try {
                balance = await workerAccount.getAccountBalance();
            } catch (e) {
                if (e.type === 'AccountDoesNotExist') {
                    balance = { available: '0' };
                } else {
                    throw e;
                }
            }
            
            console.log(`💰 Current balance: ${utils.format.formatNearAmount(balance.available)} NEAR`);
            
            const requiredBalance = utils.format.parseNearAmount('1.0'); // 1 NEAR as per docs
            if (BigInt(balance.available) < BigInt(requiredBalance)) {
                const fundAmount = utils.format.parseNearAmount('2.0'); // Fund with 2 NEAR
                console.log(`💸 Funding worker with ${utils.format.formatNearAmount(fundAmount)} NEAR...`);
                
                await mainAccount.sendMoney(workerAccountId, fundAmount);
                await sleep(3000); // Wait for transaction
                
                const newBalance = await workerAccount.getAccountBalance();
                console.log(`✅ Worker funded: ${utils.format.formatNearAmount(newBalance.available)} NEAR`);
            } else {
                console.log('✅ Worker account has sufficient balance');
            }
        } catch (error) {
            console.error('❌ Worker funding failed:', error.message);
            // Continue anyway - might be already funded
        }

        // Step 3: Approve codehash (per documentation requirement)
        console.log('\n📝 Step 3: Approving codehash in contract...');
        
        try {
            // First check if codehash is already approved
            const approvedHashes = await mainAccount.viewFunction(
                AGENT_CONTRACT_ID,
                'get_approved_codehashes',
                {}
            );
            console.log('📋 Current approved codehashes:', approvedHashes);
            
            if (!approvedHashes.includes(DOCKER_CODEHASH)) {
                console.log('📝 Approving new codehash...');
                
                const result = await mainAccount.functionCall(
                    AGENT_CONTRACT_ID,
                    'approve_codehash',
                    { codehash: DOCKER_CODEHASH },
                    '300000000000000', // 300 TGas
                    '0' // No deposit
                );
                
                console.log('✅ Codehash approved successfully');
                console.log('🔗 Transaction:', `https://testnet.nearblocks.io/txns/${result.transaction.hash}`);
            } else {
                console.log('✅ Codehash already approved');
            }
        } catch (error) {
            console.error('❌ Codehash approval failed:', error.message);
            throw error;
        }

        console.log('\n🎉 Worker setup completed successfully!');
        console.log('\n📋 Summary:');
        console.log(`   Main Account: ${MAIN_ACCOUNT_ID}`);
        console.log(`   Worker Account: ${workerAccountId}`);
        console.log(`   Agent Contract: ${AGENT_CONTRACT_ID}`);
        console.log(`   Approved Codehash: ${DOCKER_CODEHASH}`);
        console.log('\n✅ Ready for Phala Cloud deployment!');

    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

function getImplicitAccountId(publicKeyStr) {
    const publicKey = utils.PublicKey.from(publicKeyStr);
    return Buffer.from(publicKey.data).toString('hex').toLowerCase();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run setup
setupWorker().catch(console.error); 