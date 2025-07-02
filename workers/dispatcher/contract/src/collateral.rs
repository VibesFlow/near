use crate::*;
use serde_json::Value;
use sha2::{Digest as _, Sha256, Sha384};

pub fn get_collateral(raw_quote_collateral: String) -> QuoteCollateralV3 {
    let quote_collateral: serde_json::Value =
        serde_json::from_str(&raw_quote_collateral).expect("TCB Info should be valid JSON");

    let tcb_info_issuer_chain = quote_collateral["tcb_info_issuer_chain"]
        .as_str()
        .unwrap()
        .to_owned();
    let tcb_info = quote_collateral["tcb_info"].as_str().unwrap().to_owned();
    let tcb_info_signature =
        hex::decode(quote_collateral["tcb_info_signature"].as_str().unwrap()).unwrap();
    let qe_identity_issuer_chain = quote_collateral["qe_identity_issuer_chain"]
        .as_str()
        .unwrap()
        .to_owned();
    let qe_identity = quote_collateral["qe_identity"].as_str().unwrap().to_owned();
    let qe_identity_signature =
        hex::decode(quote_collateral["qe_identity_signature"].as_str().unwrap()).unwrap();

    QuoteCollateralV3 {
        tcb_info_issuer_chain,
        tcb_info,
        tcb_info_signature,
        qe_identity_issuer_chain,
        qe_identity,
        qe_identity_signature,
    }
}

pub fn verify_codehash(raw_tcb_info: String, rtmr3: String) -> String {
    let tcb_info: Value =
        serde_json::from_str(&raw_tcb_info).expect("TCB Info should be valid JSON");
    let event_log = tcb_info["event_log"].as_array().unwrap();
    // get compose hash from events
    let expected_compose_hash = event_log
        .iter()
        .filter(|e| e["event"].as_str().unwrap() == "compose-hash")
        .next()
        .unwrap()["digest"]
        .as_str()
        .unwrap();

    // replay the rtmr3 and compose hash
    let replayed_rtmr3 = replay_rtmr(event_log.to_owned(), 3);
    let app_compose = tcb_info["app_compose"].as_str().unwrap();
    let replayed_compose_hash: String = replay_app_compose(app_compose);

    // compose hash match expected
    require!(replayed_compose_hash == expected_compose_hash);
    // event with compose hash matches report rtmr3
    require!(replayed_rtmr3 == rtmr3);

    let (_, right) = app_compose.split_once("\\n        image:").unwrap();
    let (left, _) = right.split_once("\\n").unwrap();
    let (_, codehash) = left.split_once("@sha256:").unwrap();

    codehash.to_owned()
}

// helpers

fn replay_rtmr(event_log: Vec<Value>, imr: u8) -> String {
    let mut digest = [0u8; 48];

    // filter by imr
    let filtered_events = event_log
        .iter()
        .filter(|e| e["imr"].as_u64().unwrap() as u8 == imr);

    // hash all digests together
    for event in filtered_events {
        let mut hasher = Sha384::new();
        hasher.update(digest);
        hasher.update(
            decode(event["digest"].as_str().unwrap())
                .unwrap()
                .as_slice(),
        );
        digest = hasher.finalize().into();
    }

    // return hex encoded digest (rtmr[imr])
    encode(digest)
}

fn replay_app_compose(app_compose: &str) -> String {
    // sha256 of app_compose from TcbInfo
    let mut sha256 = Sha256::new();
    sha256.update(app_compose);
    let sha256bytes: [u8; 32] = sha256.finalize().into();

    // sha384 of custom encoding: [phala_prefix]:[event_name]:[sha256_payload]
    let mut hasher = Sha384::new();
    hasher.update(vec![0x01, 0x00, 0x00, 0x08]);
    hasher.update(b":");
    hasher.update("compose-hash".as_bytes());
    hasher.update(b":");
    hasher.update(sha256bytes);
    let digest: [u8; 48] = hasher.finalize().into();

    encode(digest)
} 