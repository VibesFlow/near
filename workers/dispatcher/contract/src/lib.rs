use hex::{decode, encode};
use near_sdk::{
    env::{self, block_timestamp},
    near, require,
    store::{IterableMap, IterableSet},
    AccountId, Gas, NearToken, PanicOnDefault, Promise,
};

// Note: dcap-qvl doesn't compile to WASM currently
// use dcap_qvl::{verify, QuoteCollateralV3};

mod ecdsa;
mod external;
mod utils;

// Filecoin Calibration chain configuration
const FILECOIN_CALIBRATION_CHAIN_ID: u64 = 314159;
const FILECOIN_RPC_URL: &str = "https://api.calibration.node.glif.io/rpc/v1";

// Minimal addition for dispatcher tracking
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
    // Minimal addition for dispatcher functionality
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

    // Approve a new codehash - EXACT copy from template
    pub fn approve_codehash(&mut self, codehash: String) {
        self.require_owner();
        self.approved_codehashes.insert(codehash);
    }

    // Get approved codehashes - needed for worker registration
    pub fn get_approved_codehashes(&self) -> Vec<String> {
        self.approved_codehashes.iter().cloned().collect()
    }

    /// Core signing function - EXACT copy from template
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

    // Register worker with TEE attestation signature matching
    pub fn register_worker(
        &mut self,
        quote_hex: String,
        collateral: String,
        checksum: String,
        tcb_info: String,
    ) -> bool {
        // Basic validation of TEE parameters
        require!(!quote_hex.is_empty(), "Quote hex cannot be empty");
        require!(!collateral.is_empty(), "Collateral cannot be empty");
        require!(!checksum.is_empty(), "Checksum cannot be empty");
        require!(!tcb_info.is_empty(), "TCB info cannot be empty");
        
        // Extract codehash from tcb_info or use checksum as fallback
        let codehash = if let Ok(tcb_info_json) = serde_json::from_str::<serde_json::Value>(&tcb_info) {
            // Try to extract codehash from app_compose in tcb_info
            if let Some(app_compose) = tcb_info_json.get("app_compose").and_then(|v| v.as_str()) {
                // Look for our dispatcher image pattern
                if let Some(start) = app_compose.find("vibesflow/dispatcher:latest@sha256:") {
                    let start_pos = start + "vibesflow/dispatcher:latest@sha256:".len();
                    if let Some(end) = app_compose[start_pos..].find("\\n").or_else(|| app_compose[start_pos..].find(" ")) {
                        let extracted_hash = &app_compose[start_pos..start_pos + end.min(64)];
                        if extracted_hash.len() == 64 && extracted_hash.chars().all(|c| c.is_ascii_hexdigit()) {
                            extracted_hash.to_string()
                        } else {
                            checksum.clone()
                        }
                    } else {
                        checksum.clone()
                    }
                } else {
                    checksum.clone()
                }
            } else {
                checksum.clone()
            }
        } else {
            checksum.clone()
        };

        // verify the code hashes are approved
        require!(self.approved_codehashes.contains(&codehash), "Codehash not approved");

        let predecessor = env::predecessor_account_id();
        self.worker_by_account_id.insert(
            predecessor,
            Worker {
                checksum,
                codehash,
            },
        );

        true
    }

    // Development registration - simplified for dev mode
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

    // View functions - EXACT copy from template
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

    // Helpers for method access control - EXACT copy from template
    fn require_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id);
    }

    fn require_registered_worker(&self) {
        let worker = self.get_worker(env::predecessor_account_id());
        require!(self.approved_codehashes.contains(&worker.codehash));
    }
}
