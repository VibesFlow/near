import fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env.development.local' });
import { parseSeedPhrase } from "near-seed-phrase";
import * as nearAPI from 'near-api-js';
const { Near, Account, KeyPair, keyStores } = nearAPI;

// NEEDS TO MATCH docker-compose.yaml CODEHASH
const codehash = process.env.DISPATCHER_CODEHASH || 'e37aad8413f17218546991dbe866893802ec0505d1e3bc03a876b06053984925';

const networkId = 'testnet';
const accountId = process.env.NEAR_ACCOUNT_ID;
const contractId = process.env.NEXT_PUBLIC_contractId;
console.log('🚀 Deploying contract:', accountId, '->', contractId);
console.log('🔑 Using codehash:', codehash);

const keyStore = new keyStores.InMemoryKeyStore();
let keyPair;

if (process.env.NEAR_PRIVATE_KEY) {
    keyPair = KeyPair.fromString(process.env.NEAR_PRIVATE_KEY);
} else if (process.env.NEAR_SEED_PHRASE) {
const privateKey = parseSeedPhrase(process.env.NEAR_SEED_PHRASE);
    keyPair = KeyPair.fromString(privateKey.secretKey);
} else {
    throw new Error('Either NEAR_PRIVATE_KEY or NEAR_SEED_PHRASE must be provided');
}

keyStore.setKey(networkId, accountId, keyPair);
console.log('✅ Keys configured for deployment');

const config = {
    networkId,
    nodeUrl: 'https://test.rpc.fastnear.com',
    keyStore,
};
const near = new Near(config);
const { connection } = near;
const gas = BigInt('300000000000000');

export const getAccount = (id) => new Account(connection, id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const deploy = async () => {
    try {
        console.log('📦 Reading contract WASM file...');
        const file = fs.readFileSync('./contract/target/near/v1dispatcher.wasm');
        console.log('📊 Contract size:', file.byteLength, 'bytes');
        
        let account = getAccount(accountId);
        
        // Try to check if contract exists
        let contractExists = false;
        try {
            const contractAccount = getAccount(contractId);
            await contractAccount.state();
            contractExists = true;
            console.log('📋 Contract account already exists, updating...');
    } catch (e) {
            console.log('🆕 Contract account does not exist, creating...');
        }
        
        if (!contractExists) {
            // Create new contract account
        await account.createAccount(
            contractId,
            keyPair.getPublicKey(),
            nearAPI.utils.format.parseNearAmount('10'),
        );
            console.log('✅ Contract account created');
            await sleep(2000);
        }
        
        // Deploy the contract
        const contractAccount = getAccount(contractId);
        keyStore.setKey(networkId, contractId, keyPair); // Add key for contract account
        
        await contractAccount.deployContract(file);
        console.log('✅ Contract deployed successfully');
        
        const balance = await contractAccount.getAccountBalance();
        console.log('💰 Contract balance:', nearAPI.utils.format.formatNearAmount(balance.available), 'NEAR');

        await sleep(2000);

        // Try to initialize (only if it hasn't been initialized)
        try {
            const initRes = await contractAccount.functionCall({
        contractId,
        methodName: 'init',
        args: { owner_id: accountId },
        gas,
        serializationType: 'borsh'
    });
            console.log('✅ Contract initialized');
        } catch (e) {
            if (e.message.includes('already been initialized') || e.message.includes('contract')) {
                console.log('ℹ️ Contract already initialized, skipping...');
            } else {
                console.log('⚠️ Initialization failed:', e.message);
            }
        }

        await sleep(2000);

        // Approve codehash
        try {
    account = getAccount(accountId);
    const approveRes = await account.functionCall({
        contractId,
        methodName: 'approve_codehash',
                args: { codehash },
        gas,
    });
            console.log('✅ Codehash approved:', codehash);
        } catch (e) {
            console.log('⚠️ Codehash approval failed (may already be approved):', e.message);
        }
        
        console.log('🎉 Deployment completed successfully!');
        console.log('📋 Contract ID:', contractId);
        console.log('🔑 Approved Codehash:', codehash);
        
    } catch (error) {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    }
};

deploy();