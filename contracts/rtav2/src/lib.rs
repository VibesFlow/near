/*!
RTAFactory: Real-Time Asset NFT Factory for VibesFlow
Licensed under MIT License

Creates and manages dynamic vibestream NFTs following NEP-171 standard.
Workers handle chunking, VRF, and processing.
*/

use near_contract_standards::non_fungible_token::metadata::{
    NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata, NFT_METADATA_SPEC,
};
use near_contract_standards::non_fungible_token::{Token, TokenId, NonFungibleToken};
use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
use near_contract_standards::non_fungible_token::NonFungibleTokenResolver;
use near_contract_standards::non_fungible_token::approval::NonFungibleTokenApproval;
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::LazyOption;
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, near_bindgen, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise,
    PromiseOrValue,
};
use schemars::JsonSchema;
use std::collections::HashMap;

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
    NonFungibleToken,
    Metadata,
    TokenMetadata,
    Enumeration,
    Approval,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, JsonSchema)]
#[serde(crate = "near_sdk::serde")]
pub struct RTAConfig {
    pub mode: String, // "solo" or "group"
    pub store_to_filecoin: bool,
    pub distance: Option<u32>, // meters, up to 10
    pub ticket_amount: Option<u32>,
    pub ticket_price: Option<String>,
    pub pay_per_stream: bool,
    pub stream_price: Option<String>,
    pub creator: String,
    pub created_at: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, JsonSchema)]
#[serde(crate = "near_sdk::serde")]
pub struct RTAMetadata {
    pub rta_id: String,
    pub config: RTAConfig,
    pub is_live: bool,
    pub is_closed: bool,
    pub chunk_cids: Vec<String>,
    pub chunk_ownership: HashMap<u32, String>,
    pub total_chunks: u32,
    pub filecoin_master_cid: Option<String>,
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct Delegation {
    pub delegate: AccountId,
    pub can_update: bool,
    pub can_finalize: bool,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct RTAv2 {
    tokens: NonFungibleToken,
    metadata: LazyOption<NFTContractMetadata>,
    delegations: std::collections::HashMap<String, Delegation>,
}

const DATA_IMAGE_SVG_NEAR_ICON: &str = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 288 288'%3E%3Cg id='l' data-name='l'%3E%3Cpath d='m187.58,79.81l-30.1,44.69a3.2,3.2,0,0,0,4.75,4.2L191.86,106a1.2,1.2,0,0,1,2,.91v80.46a1.2,1.2,0,0,1-2.12.77L102.18,77.93A15.35,15.35,0,0,0,90.47,72.5H87.34A15.34,15.34,0,0,0,72,87.84V201.16A15.34,15.34,0,0,0,87.34,216.5h0a15.35,15.35,0,0,0,13.08-7.31l30.1-44.69a3.2,3.2,0,0,0-4.75-4.2L96.14,182a1.2,1.2,0,0,1-2-.91V100.64a1.2,1.2,0,0,1,2.12-.77l89.55,109.21A15.35,15.35,0,0,0,197.53,215.5h3.13A15.34,15.34,0,0,0,216,200.16V86.84A15.34,15.34,0,0,0,200.66,71.5h0A15.35,15.35,0,0,0,187.58,79.81Z'/%3E%3C/g%3E%3C/svg%3E";

#[near_bindgen]
impl RTAv2 {
    #[init]
    pub fn new_default_meta(owner_id: AccountId) -> Self {
        Self::new(
            owner_id,
            NFTContractMetadata {
                spec: NFT_METADATA_SPEC.to_string(),
                name: "VibesFlow Real-Time Assets".to_string(),
                symbol: "VRTA".to_string(),
                icon: Some(DATA_IMAGE_SVG_NEAR_ICON.to_string()),
                base_uri: None,
                reference: None,
                reference_hash: None,
            },
        )
    }

    #[init]
    pub fn new(owner_id: AccountId, metadata: NFTContractMetadata) -> Self {
        require!(!env::state_exists(), "Already initialized");
        metadata.assert_valid();
        Self {
            tokens: NonFungibleToken::new(
                StorageKey::NonFungibleToken,
                owner_id,
                Some(StorageKey::TokenMetadata),
                Some(StorageKey::Enumeration),
                Some(StorageKey::Approval),
            ),
            metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)),
            delegations: std::collections::HashMap::new(),
        }
    }

    #[payable]
    pub fn create_rta(
        &mut self,
        rta_id: String,
        config: RTAConfig,
        receiver_id: AccountId,
    ) -> Token {
        let deposit = env::attached_deposit();
        let min_deposit = self.calculate_minimum_deposit(&config);
        require!(deposit >= min_deposit, "Insufficient deposit for RTA creation");
        let token_id = format!("rta_{}", rta_id);
        let rta_metadata = RTAMetadata {
            rta_id: rta_id.clone(),
            config: config.clone(),
            is_live: false,
            is_closed: false,
            chunk_cids: Vec::new(),
            chunk_ownership: HashMap::new(),
            total_chunks: 0,
            filecoin_master_cid: None,
        };
        let token_metadata = TokenMetadata {
            title: Some(format!("VibesFlow RTA #{}", rta_id)),
            description: Some(format!(
                "Real-Time Asset for RTA #{} in {} mode{}{}",
                rta_id,
                config.mode,
                if config.store_to_filecoin { ", stored on Filecoin" } else { "" },
                if config.mode == "group" {
                    format!(", max {} participants", config.ticket_amount.unwrap_or(0))
                } else { "".to_string() }
            )),
            media: None,
            media_hash: None,
            copies: Some(1),
            issued_at: Some(env::block_timestamp().to_string()),
            expires_at: None,
            starts_at: Some(config.created_at.to_string()),
            updated_at: Some(env::block_timestamp().to_string()),
            extra: Some(serde_json::to_string(&rta_metadata).unwrap()),
            reference: None,
            reference_hash: None,
        };
        self.tokens.internal_mint(token_id, receiver_id, Some(token_metadata))
    }

    pub fn delegate_rta_permissions(&mut self, rta_id: String, delegate: AccountId, permissions: Vec<String>) {
        let mut can_update = false;
        let mut can_finalize = false;
        for perm in permissions {
            if perm == "update_chunks" { can_update = true; }
            if perm == "finalize_rta" { can_finalize = true; }
        }
        self.delegations.insert(rta_id, Delegation { delegate, can_update, can_finalize });
    }

    pub fn check_delegation(&self, rta_id: String, delegate: AccountId) -> bool {
        self.delegations.get(&rta_id).map_or(false, |d| d.delegate == delegate && (d.can_update || d.can_finalize))
    }

    pub fn add_cids(&mut self, rta_id: String, cids: Vec<String>, chunk_owners: Vec<AccountId>) {
        let caller = env::predecessor_account_id();
        let delegation = self.delegations.get(&rta_id).expect("No delegation");
        require!(delegation.delegate == caller && delegation.can_update, "Not authorized");
        let token_id = format!("rta_{}", rta_id);
        let token = self.tokens.nft_token(token_id.clone()).expect("RTA not found");
        if let Some(extra) = &token.metadata.as_ref().unwrap().extra {
            let mut rta_metadata: RTAMetadata = serde_json::from_str(extra).unwrap();
            require!(!rta_metadata.is_closed, "RTA is closed; cannot add more chunks");
            for (i, cid) in cids.iter().enumerate() {
                rta_metadata.chunk_cids.push(cid.clone());
                if let Some(owner) = chunk_owners.get(i) {
                    rta_metadata.chunk_ownership.insert(rta_metadata.total_chunks + 1, owner.to_string());
                }
                rta_metadata.total_chunks += 1;
            }
            let mut updated_metadata = token.metadata.unwrap();
            updated_metadata.updated_at = Some(env::block_timestamp().to_string());
            updated_metadata.extra = Some(serde_json::to_string(&rta_metadata).unwrap());
            self.tokens.token_metadata_by_id.as_mut().unwrap().insert(&token_id, &updated_metadata);
        }
    }

    pub fn finalize(&mut self, rta_id: String, filecoin_master_cid: String) {
        let caller = env::predecessor_account_id();
        let delegation = self.delegations.get(&rta_id).expect("No delegation");
        require!(delegation.delegate == caller && delegation.can_finalize, "Not authorized");
        let token_id = format!("rta_{}", rta_id);
        let token = self.tokens.nft_token(token_id.clone()).expect("RTA not found");
        if let Some(extra) = &token.metadata.as_ref().unwrap().extra {
            let mut rta_metadata: RTAMetadata = serde_json::from_str(extra).unwrap();
            require!(!rta_metadata.is_closed, "RTA is already closed");
            rta_metadata.filecoin_master_cid = Some(filecoin_master_cid);
            rta_metadata.is_closed = true;
            let mut updated_metadata = token.metadata.unwrap();
            updated_metadata.updated_at = Some(env::block_timestamp().to_string());
            updated_metadata.extra = Some(serde_json::to_string(&rta_metadata).unwrap());
            self.tokens.token_metadata_by_id.as_mut().unwrap().insert(&token_id, &updated_metadata);
        }
    }

    pub fn get_rta_metadata(&self, rta_id: String) -> Option<RTAMetadata> {
        let token_id = format!("rta_{}", rta_id);
        let token = self.tokens.nft_token(token_id)?;
        if let Some(extra) = &token.metadata.as_ref()?.extra {
            serde_json::from_str(extra).ok()
        } else {
            None
        }
    }

    pub fn is_closed(&self, rta_id: String) -> bool {
        self.get_rta_metadata(rta_id)
            .map(|metadata| metadata.is_closed)
            .unwrap_or(false)
    }

    fn calculate_minimum_deposit(&self, config: &RTAConfig) -> NearToken {
        let mut base_cost = NearToken::from_millinear(10); // 0.01 NEAR base
        
        if config.store_to_filecoin {
            base_cost = NearToken::from_yoctonear(base_cost.as_yoctonear() + 5_000_000_000_000_000_000_000); // +0.005 NEAR for Filecoin
        }
        
        if config.mode == "group" && config.ticket_amount.unwrap_or(0) > 10 {
            base_cost = NearToken::from_yoctonear(base_cost.as_yoctonear() + 5_000_000_000_000_000_000_000); // +0.005 NEAR for large groups
        }
        
        base_cost
    }
}

#[near_bindgen]
impl NonFungibleTokenCore for RTAv2 {
    #[payable]
    fn nft_transfer(&mut self, _receiver_id: AccountId, _token_id: TokenId, _approval_id: Option<u64>, _memo: Option<String>) {
        env::panic_str("Non-transferable NFT: transfer is disabled");
    }
    #[payable]
    fn nft_transfer_call(&mut self, _receiver_id: AccountId, _token_id: TokenId, _approval_id: Option<u64>, _memo: Option<String>, _msg: String) -> PromiseOrValue<bool> {
        env::panic_str("Non-transferable NFT: transfer_call is disabled");
    }
    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}

#[near_bindgen]
impl NonFungibleTokenResolver for RTAv2 {
    #[private]
    fn nft_resolve_transfer(&mut self, _previous_owner_id: AccountId, _receiver_id: AccountId, _token_id: TokenId, _approved_account_ids: Option<std::collections::HashMap<AccountId, u64>>) -> bool {
        env::panic_str("Non-transferable NFT: resolve_transfer is disabled");
    }
}

#[near_bindgen]
impl NonFungibleTokenApproval for RTAv2 {
    #[payable]
    fn nft_approve(&mut self, _token_id: TokenId, _account_id: AccountId, _msg: Option<String>) -> Option<Promise> {
        env::panic_str("Non-transferable NFT: approval is disabled");
    }
    #[payable]
    fn nft_revoke(&mut self, _token_id: TokenId, _account_id: AccountId) {
        env::panic_str("Non-transferable NFT: revoke is disabled");
    }
    #[payable]
    fn nft_revoke_all(&mut self, _token_id: TokenId) {
        env::panic_str("Non-transferable NFT: revoke_all is disabled");
    }
    fn nft_is_approved(&self, _token_id: TokenId, _approved_account_id: AccountId, _approval_id: Option<u64>) -> bool {
        false
    }
}

#[near_bindgen]
impl NonFungibleTokenEnumeration for RTAv2 {
    fn nft_total_supply(&self) -> U128 {
        self.tokens.nft_total_supply()
    }
    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens.nft_tokens(from_index, limit)
    }
    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        self.tokens.nft_supply_for_owner(account_id)
    }
    fn nft_tokens_for_owner(&self, account_id: AccountId, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens.nft_tokens_for_owner(account_id, from_index, limit)
    }
}

#[near_bindgen]
impl NonFungibleTokenMetadataProvider for RTAv2 {
    fn nft_metadata(&self) -> NFTContractMetadata {
        self.metadata.get().unwrap()
    }
}