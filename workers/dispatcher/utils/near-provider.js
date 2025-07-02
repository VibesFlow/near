import * as dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
    // load .env.development.local in dev
    dotenv.config({ path: './.env.development.local' });
} else {
    // load .env in production
    dotenv.config();
}

import { connect, keyStores, utils } from 'near-api-js';
import { parseSeedPhrase } from "near-seed-phrase";

// from .env
let _contractId = process.env.NEXT_PUBLIC_contractId;
// from .env.development.local
let secretKey = process.env.NEXT_PUBLIC_secretKey;
let _accountId = process.env.NEXT_PUBLIC_accountId;

if (process.env.NODE_ENV !== 'production') {
    console.log('Development mode: using seed phrase');
    if (!_accountId) {
        _accountId = process.env.NEAR_ACCOUNT_ID;
    }
    if (!secretKey && process.env.NEAR_PRIVATE_KEY) {
        // Convert private key to seed phrase for development
        secretKey = process.env.NEAR_PRIVATE_KEY;
    }
    if (!_contractId) {
        _contractId = process.env.NEXT_PUBLIC_contractId;
    }
}

export const contractId = _contractId;
export const accountId = _accountId;

const config = {
    networkId: 'testnet',
    nodeUrl: 'https://rpc.testnet.near.org',
    walletUrl: 'https://testnet-wallet.near.org',
    helperUrl: 'https://helper.testnet.near.org',
    explorerUrl: 'https://testnet.nearblocks.io',
};

export async function getNear() {
    const keyStore = new keyStores.InMemoryKeyStore();
    
    if (process.env.NODE_ENV !== 'production') {
// .env.development.local - automatically set key to dev account
        if (secretKey && accountId) {
            let keyPair;
            if (secretKey.startsWith('ed25519:')) {
                keyPair = utils.KeyPair.fromString(secretKey);
        } else {
                // Handle seed phrase
                const parsedKey = parseSeedPhrase(secretKey);
                keyPair = utils.KeyPair.fromString(parsedKey.secretKey);
            }
            await keyStore.setKey(config.networkId, accountId, keyPair);
            
            // Also set key for contract account
            await keyStore.setKey(config.networkId, contractId, keyPair);
        }
    }
    
    const near = await connect({ ...config, keyStore });
    return near;
}

export async function getAccount(accountId) {
    const near = await getNear();
    return near.account(accountId);
        }

// Gas constants
export const TGAS = BigInt('1000000000000');
export const MAX_GAS = TGAS * BigInt(200);
export const STORAGE_BYTE_COST = BigInt('10000000000000000000'); // 0.01 NEAR

export function toNear(amount) {
    return utils.format.parseNearAmount(amount);
}

export function fromNear(amount) {
    return utils.format.formatNearAmount(amount);
    }
