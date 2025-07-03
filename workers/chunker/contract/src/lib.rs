use hex::{decode, encode};
use near_sdk::{
    env::{self, block_timestamp},
    near, require, near_bindgen,
    store::{IterableMap, IterableSet},
    AccountId, Gas, NearToken, PanicOnDefault, Promise,
    borsh::{BorshDeserialize, BorshSerialize},
    serde::{Deserialize, Serialize},
    schemars::JsonSchema,
};

use dcap_qvl::{verify, QuoteCollateralV3};

mod collateral;
mod ecdsa;
mod external;
mod utils;

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Worker {
    checksum: String,
    codehash: String,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct ChunkRecord {
    chunk_id: String,
    audio_data_hash: String,
    timestamp: u64,
    rta_id: String,
    metadata: String,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    pub owner_id: AccountId,
    pub approved_codehashes: IterableSet<String>,
    pub worker_by_account_id: IterableMap<AccountId, Worker>,
    pub chunk_records: IterableMap<String, ChunkRecord>, // chunk_id -> ChunkRecord
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn init(owner_id: AccountId) -> Self {
        Self {
            owner_id,
            approved_codehashes: IterableSet::new(b"a".to_vec()),
            worker_by_account_id: IterableMap::new(b"w".to_vec()),
            chunk_records: IterableMap::new(b"c".to_vec()),
        }
    }

    /// Approve a new codehash
    pub fn approve_codehash(&mut self, codehash: String) {
        self.require_owner();
        self.approved_codehashes.insert(codehash);
    }

    /// PRODUCTION TEE VERIFICATION - Following shade-agent-template exactly
    pub fn register_worker(
        &mut self,
        quote_hex: String,
        collateral: String,
        checksum: String,
        tcb_info: String,
    ) -> bool {
        let worker_account_id = env::predecessor_account_id();

        // Parse quote from hex
        let quote = hex::decode(&quote_hex).expect("Invalid quote hex");
        
        // Parse collateral using our collateral module
        let quote_collateral = collateral::get_collateral(collateral);
        
        // Get current time for verification
        let now = env::block_timestamp() / 1_000_000_000; // Convert nanoseconds to seconds
        
        // Verify the quote using dcap-qvl - REAL TEE VERIFICATION
        let verification_result = verify::verify(&quote, &quote_collateral, now)
            .expect("Quote verification failed");
        
        // Extract RTMR3 from the verified report
        let rtmr3 = hex::encode(verification_result.report.as_td10().unwrap().rt_mr3.to_vec());

        // Verify the codehash from the TCB info - REAL CODEHASH VERIFICATION
        let verified_codehash = collateral::verify_codehash(tcb_info, rtmr3);
        
        // Check if the verified codehash is approved
        require!(
            self.approved_codehashes.contains(&verified_codehash),
            "Codehash not approved"
        );

        // Register the worker with VERIFIED codehash
        let worker = Worker {
            checksum,
            codehash: verified_codehash,
        };

        self.worker_by_account_id.insert(worker_account_id, worker);
        true
    }

    /// Development registration method (only for local testing)
    pub fn register_worker_dev(&mut self, codehash: String) -> bool {
        let worker_account_id = env::predecessor_account_id();
        
        require!(
            self.approved_codehashes.contains(&codehash),
            "Codehash not approved"
        );

        let worker = Worker {
            checksum: "dev-mode".to_string(),
            codehash,
        };

        self.worker_by_account_id.insert(worker_account_id, worker);
        true
    }

    /// Store chunk processing record
    pub fn store_chunk_record(
        &mut self,
        chunk_id: String,
        audio_data_hash: String,
        rta_id: String,
        metadata: String,
    ) {
        self.require_registered_worker();
        
        let record = ChunkRecord {
            chunk_id: chunk_id.clone(),
            audio_data_hash,
            timestamp: env::block_timestamp_ms(),
            rta_id,
            metadata,
        };
        
        self.chunk_records.insert(chunk_id, record);
    }

    /// Get chunk record
    pub fn get_chunk_record(&self, chunk_id: String) -> Option<ChunkRecord> {
        self.chunk_records.get(&chunk_id).cloned()
    }

    /// Get all chunks for an RTA
    pub fn get_rta_chunks(&self, rta_id: String) -> Vec<ChunkRecord> {
        let mut chunks = Vec::new();
        
        for (_, record) in self.chunk_records.iter() {
            if record.rta_id == rta_id {
                chunks.push(record.clone());
            }
        }
        
        chunks
    }

    /// Will throw an error if the worker agent is not registered with a codehash in self.approved_codehashes
    pub fn sign_tx(
        &mut self,
        payload: Vec<u8>,
        derivation_path: String,
        key_version: u32,
    ) -> Promise {
        // Comment out this line for local development
        self.require_registered_worker();

        // Call the MPC contract to get a signature for the payload
        ecdsa::get_sig(payload, derivation_path, key_version)
    }

    // View functions
    pub fn get_worker(&self, account_id: AccountId) -> Worker {
        self.worker_by_account_id
            .get(&account_id)
            .unwrap()
            .clone()
    }

    pub fn is_worker_registered(&self, account_id: AccountId) -> bool {
        self.worker_by_account_id.contains_key(&account_id)
    }

    pub fn get_approved_codehashes(&self) -> Vec<String> {
        self.approved_codehashes.iter().cloned().collect()
    }

    // Helpers
    fn require_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id);
    }

    fn require_registered_worker(&self) {
        let predecessor = env::predecessor_account_id();
        require!(self.worker_by_account_id.contains_key(&predecessor));
    }
}
