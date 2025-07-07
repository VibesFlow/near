import * as dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
    dotenv.config({ path: './.env.development.local' });
} else {
    dotenv.config();
}

import * as nearAPI from 'near-api-js';
const {
    Near,
    Account,
    KeyPair,
    keyStores,
    utils: { PublicKey },
} = nearAPI;

let _contractId = process.env.NEXT_PUBLIC_contractId;

let secretKey = process.env.NEXT_PUBLIC_secretKey;
let _accountId = process.env.NEXT_PUBLIC_accountId;

export const contractId = _contractId;

const networkId = /testnet/gi.test(contractId) ? 'testnet' : 'mainnet';
const keyStore = new keyStores.InMemoryKeyStore();
const config =
    networkId === 'testnet'
        ? {
              networkId,
              keyStore,
              nodeUrl: 'https://test.rpc.fastnear.com',
          }
        : {
              networkId,
              keyStore,
              nodeUrl: 'https://free.rpc.fastnear.com',
          };
const near = new Near(config);
const { connection } = near;
const { provider } = connection;
const gas = BigInt('300000000000000');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// helpers

export const setKey = (accountId, secretKey) => {
    if (!accountId || !secretKey) return;
    _accountId = accountId;
    const keyPair = KeyPair.fromString(secretKey);
    // set in-memory keystore only
    keyStore.setKey(networkId, accountId, keyPair);
};
if (secretKey) {
    setKey(_accountId, secretKey);
}

export const getDevAccountKeyPair = () => {
    const keyPair = KeyPair.fromString(process.env.NEXT_PUBLIC_secretKey);
    keyStore.setKey(networkId, contractId, keyPair);
    return keyPair;
};

export const getImplicit = (pubKeyStr) =>
    Buffer.from(PublicKey.from(pubKeyStr).data).toString('hex').toLowerCase();

export const getAccount = (id = _accountId) => new Account(connection, id);

export const getBalance = async (accountId) => {
    let balance = { available: '0' };
    try {
        const account = getAccount(accountId);
        balance = await account.getAccountBalance();
    } catch (e) {
        if (e.type === 'AccountDoesNotExist') {
            console.log(e.type);
        } else {
            throw e;
        }
    }
    return balance;
};

export const contractView = async ({
    accountId,
    contractId = _contractId,
    methodName,
    args = {},
}) => {
    const account = getAccount(accountId);

    let res;
    try {
        res = await account.viewFunction({
            contractId,
            methodName,
            args,
            gas,
        });
    } catch (e) {
        if (/deserialize/gi.test(JSON.stringify(e))) {
            console.log(`Bad arguments to ${methodName} method`);
        }
        throw e;
    }
    return res;
};

export const contractCall = async ({
    accountId,
    contractId = _contractId,
    methodName,
    args,
}) => {
    const account = getAccount(accountId);
    let res;
    try {
        res = await account.functionCall({
            contractId,
            methodName,
            args,
            gas,
        });
    } catch (e) {
        console.log(e);
        if (/deserialize/gi.test(JSON.stringify(e))) {
            return console.log(`Bad arguments to ${methodName} method`);
        }
        if (e.context?.transactionHash) {
            const maxPings = 30;
            let pings = 0;
            while (
                res.final_execution_status != 'EXECUTED' &&
                pings < maxPings
            ) {
                await sleep(1000);
                res = await provider.txStatus(
                    e.context.transactionHash,
                    account.accountId,
                    'INCLUDED',
                );
                pings += 1;
            }
            if (pings >= maxPings) {
                console.warn(
                    `Request status polling exited before desired outcome.\n  Current status: ${res.final_execution_status}\nSignature Request will likley fail.`,
                );
            }
            return parseSuccessValue(res);
        }
        throw e;
    }
    return parseSuccessValue(res);
};

const parseSuccessValue = (transaction) => {
    if (transaction.status.SuccessValue.length === 0) return;

    try {
        return JSON.parse(
            Buffer.from(transaction.status.SuccessValue, 'base64').toString(
                'ascii',
            ),
        );
    } catch (e) {
        console.log(
            `Error parsing success value for transaction ${JSON.stringify(
                transaction,
            )}`,
        );
    }
};
