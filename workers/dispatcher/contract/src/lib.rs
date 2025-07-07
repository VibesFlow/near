use hex::{decode, encode};
use near_sdk::{
    env::{self, block_timestamp},
    near, require,
    store::{IterableMap, IterableSet},
    AccountId, Gas, NearToken, PanicOnDefault, Promise,
};

mod ecdsa;
mod external;
mod utils;

// Filecoin Calibration chain configuration
const FILECOIN_CALIBRATION_CHAIN_ID: u64 = 314159;
const FILECOIN_RPC_URL: &str = "https://api.calibration.node.glif.io/rpc/v1";

// Dispatcher tracking
#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct DispatchRecord {
    pub chunk_id: String,
    pub rta_id: String,
    pub filecoin_cid: String,
    pub timestamp: u64,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Worker {
    checksum: String,
    codehash: String,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pub owner_id: AccountId,
    pub approved_codehashes: IterableSet<String>,
    pub worker_by_account_id: IterableMap<AccountId, Worker>,
    // Minimal dispatcher functionality
    pub dispatch_records: IterableMap<String, Vec<DispatchRecord>>, // rta_id -> dispatches
}

#[near]
impl Contract {
    #[init]
    #[private]
    pub fn init(owner_id: AccountId) -> Self {
        Self {
            owner_id,
            approved_codehashes: IterableSet::new(b"a"),
            worker_by_account_id: IterableMap::new(b"b"),
            dispatch_records: IterableMap::new(b"c"),
        }
    }

    // Approve a new codehash (from template)
    pub fn approve_codehash(&mut self, codehash: String) {
        self.require_owner();
        self.approved_codehashes.insert(codehash);
    }

    // Get approved codehashes (for worker registration)
    pub fn get_approved_codehashes(&self) -> Vec<String> {
        self.approved_codehashes.iter().cloned().collect()
    }

    /// Core signing function (from template)
    pub fn sign_tx(
        &mut self,
        payload: Vec<u8>,
        derivation_path: String,
        key_version: u32,
    ) -> Promise {
        // Require registered worker for production security
        self.require_registered_worker();

        // Call the MPC contract to get a signature for the payload
        ecdsa::get_sig(payload, derivation_path, key_version)
    }

    // Register worker with TEE attestation - MODIFIED to accept pre-verified data from worker
    pub fn register_worker(
        &mut self,
        verified_codehash: String,
        worker_account_id: String,
        checksum: String,
        tee_verification_proof: String, // JSON proof that worker verified TEE
    ) -> bool {
        // Verify the codehash is approved
        require!(self.approved_codehashes.contains(&verified_codehash), "Codehash not approved");

        // Verify the caller matches the worker account
        require!(
            env::predecessor_account_id().to_string() == worker_account_id,
            "Caller must match worker account"
        );

        let predecessor = env::predecessor_account_id();
        self.worker_by_account_id.insert(
            predecessor,
            Worker {
                checksum,
                codehash: verified_codehash,
            },
        );

        true
    }

    // Development registration
    pub fn register_worker_dev(&mut self, codehash: String) -> bool {
        // verify the code hashes are approved
        require!(self.approved_codehashes.contains(&codehash), "Codehash not approved");

        let predecessor = env::predecessor_account_id();
        self.worker_by_account_id.insert(
            predecessor,
            Worker {
                checksum: "dev".to_string(),
                codehash,
            },
        );

        true
    }

    // MINIMAL dispatcher-specific functionality - record dispatches to Filecoin
    pub fn record_dispatch(
        &mut self,
        rta_id: String,
        chunk_id: String,
        filecoin_cid: String,
    ) {
        self.require_registered_worker();

        let record = DispatchRecord {
            chunk_id,
            rta_id: rta_id.clone(),
            filecoin_cid,
            timestamp: block_timestamp(),
        };

        let mut records = self.dispatch_records.get(&rta_id).cloned().unwrap_or_default();
        records.push(record);
        self.dispatch_records.insert(rta_id, records);
    }

    // Get dispatch records for an RTA
    pub fn get_rta_dispatches(&self, rta_id: String) -> Vec<DispatchRecord> {
        self.dispatch_records.get(&rta_id).cloned().unwrap_or_default()
    }

    // Check if worker is registered
    pub fn is_worker_registered(&self, worker_account_id: AccountId) -> bool {
        self.worker_by_account_id.contains_key(&worker_account_id)
    }

    // View functions
    pub fn get_worker(&self, account_id: AccountId) -> Worker {
        self.worker_by_account_id
            .get(&account_id)
            .unwrap()
            .to_owned()
    }

    // Get contract owner
    pub fn get_owner(&self) -> AccountId {
        self.owner_id.clone()
    }

    // Helpers for method access control
    fn require_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id);
    }

    fn require_registered_worker(&self) {
        let worker = self.get_worker(env::predecessor_account_id());
        require!(self.approved_codehashes.contains(&worker.codehash));
    }
}
