use near_sdk::store::{IterableMap, IterableSet};
use near_sdk::{
    env, near, require,
    AccountId, PanicOnDefault, Promise,
};

mod external;
mod ecdsa;
mod utils;

// Worker registration structure
#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Worker {
    pub account_id: AccountId,
    pub public_key: String,
    pub registered_at: u64,
    pub is_active: bool,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pub owner: AccountId,
    pub worker_by_account_id: IterableMap<AccountId, Worker>,
    pub approved_codehashes: IterableSet<String>,
    pub mpc_contract: AccountId,
}

#[near]
impl Contract {
    #[init]
    pub fn init(owner_id: AccountId) -> Self {
        Self {
            owner: owner_id,
            worker_by_account_id: IterableMap::new(b"w"),
            approved_codehashes: IterableSet::new(b"c"),
            mpc_contract: "v1.signer-prod.testnet".parse().unwrap(),
        }
    }

    // Owner functions
    pub fn approve_codehash(&mut self, codehash: String) {
        self.require_owner();
        self.approved_codehashes.insert(codehash);
    }

    pub fn remove_codehash(&mut self, codehash: String) {
        self.require_owner();
        self.approved_codehashes.remove(&codehash);
    }

    pub fn set_mpc_contract(&mut self, mpc_contract: AccountId) {
        self.require_owner();
        self.mpc_contract = mpc_contract;
    }

    // Worker registration functions
    pub fn register_worker(&mut self, public_key: String) {
        let account_id = env::predecessor_account_id();
        
        // Check if already registered
        require!(
            !self.worker_by_account_id.contains_key(&account_id),
            "Worker already registered"
        );

        let worker = Worker {
            account_id: account_id.clone(),
            public_key,
            registered_at: env::block_timestamp(),
            is_active: true,
        };

        self.worker_by_account_id.insert(account_id, worker);
    }

    pub fn deactivate_worker(&mut self) {
        let account_id = env::predecessor_account_id();
        
        if let Some(worker) = self.worker_by_account_id.get(&account_id) {
            let mut updated_worker = worker.clone();
            updated_worker.is_active = false;
            self.worker_by_account_id.insert(account_id, updated_worker);
        } else {
            panic!("Worker not found");
        }
    }

    // VRF Proof submission
    pub fn submit_vrf_proof(&mut self, _payload: Vec<u8>, proof: String) {
        self.require_registered_worker();
        
        // Store the VRF proof
        // We are currently in 'dev mode' - in prod this is where we will verify the proof
        env::log_str(&format!("VRF proof submitted: {}", proof));
    }

    // MPC signature function
    pub fn sign_tx(
        &mut self,
        payload: Vec<u8>,
        derivation_path: String,
        key_version: u32,
    ) -> Promise {
        self.require_registered_worker();

        // Call the MPC contract to get a signature for the payload
        ecdsa::get_sig(payload, derivation_path, key_version)
    }

    // View functions
    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }

    pub fn is_worker_registered(&self, account_id: AccountId) -> bool {
        self.worker_by_account_id.contains_key(&account_id)
    }

    pub fn is_codehash_approved(&self, codehash: String) -> bool {
        self.approved_codehashes.contains(&codehash)
    }

    pub fn get_worker(&self, account_id: AccountId) -> Option<Worker> {
        self.worker_by_account_id.get(&account_id).cloned()
    }

    pub fn get_mpc_contract(&self) -> AccountId {
        self.mpc_contract.clone()
    }

    // Private helper functions
    fn require_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner,
            "Only owner can call this method"
        );
    }

    fn require_registered_worker(&self) {
        let predecessor = env::predecessor_account_id();
        require!(
            self.worker_by_account_id.contains_key(&predecessor),
            "Worker not registered"
        );
    }
} 