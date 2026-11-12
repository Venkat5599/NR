use super::*;
use k256::ecdsa::SigningKey;
use near_sdk::test_utils::{VMContextBuilder, get_logs};
use near_sdk::testing_env;

const CONTRACT: &str = "receive.testnet";
const SIGNER: &str = "v1.signer-prod.testnet";
const USDC: &str = "0x036cbd53842c5426634e7929541ec2318f3dcf7e";

/// A real Base Sepolia USDC Transfer log (block 57732715), as returned by
/// `eth_getTransactionReceipt` on https://sepolia.base.org.
fn real_log() -> RpcLog {
    serde_json::from_str(include_str!("../fixtures/base-sepolia-usdc-transfer-log.json")).unwrap()
}

fn key(seed: u8) -> SigningKey {
    SigningKey::from_bytes(&[seed; 32].into()).unwrap()
}

fn uncompressed(k: &SigningKey) -> [u8; 64] {
    let point = k.verifying_key().to_encoded_point(false);
    point.as_bytes()[1..].try_into().unwrap()
}

fn near_key_string(k: &SigningKey) -> String {
    String::from(&PublicKey::from_parts(CurveType::SECP256K1, uncompressed(k).to_vec()).unwrap())
}

fn sign_json(k: &SigningKey, hash: &[u8; 32]) -> Value {
    let (sig, recid) = k.sign_prehash_recoverable(hash).unwrap();
    let bytes = sig.to_bytes();
    let mut big_r = vec![if recid.is_y_odd() { 3 } else { 2 }];
    big_r.extend_from_slice(&bytes[..32]);
    json!({
        "scheme": "Secp256k1",
        "big_r": { "affine_point": hex::encode(big_r) },
        "s": { "scalar": hex::encode(&bytes[32..]) },
        "recovery_id": recid.to_byte(),
    })
}

fn context(predecessor: &str, deposit: NearToken) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(CONTRACT.parse().unwrap())
        .predecessor_account_id(predecessor.parse().unwrap())
        .signer_account_id(predecessor.parse().unwrap())
        .attached_deposit(deposit)
        .prepaid_gas(Gas::from_tgas(300))
        .build());
}

fn signer_root() -> SigningKey {
    key(7)
}

fn receiver_key() -> SigningKey {
    key(9)
}

fn new_contract() -> Contract {
    context(CONTRACT, NearToken::from_yoctonear(0));
    Contract::new(
        SIGNER.parse().unwrap(),
        0,
        3,
        near_key_string(&signer_root()),
        vec![ChainInit {
            name: "Base".into(),
            evm_chain_id: 84532,
            finality: "Finalized".into(),
            tokens: vec![USDC.into()],
            gas_limit: 100_000,
            max_fee_per_gas_cap: U128(1_000_000_000),
        }],
    )
}

/// Registers alice.testnet with the receiver test key; returns her receive address.
fn register_alice(c: &mut Contract, forward_to: Option<&str>) -> String {
    context(CONTRACT, NearToken::from_yoctonear(0));
    let view = c
        .on_registered(
            "alice.testnet".parse().unwrap(),
            forward_to.map(String::from),
            U128(REGISTER_DEPOSIT.as_yoctonear()),
            Ok(near_key_string(&receiver_key())),
        )
        .unwrap();
    view.receive_address
}

/// The real log, re-addressed to `to` (unit tests only; the testnet run uses real logs).
fn log_to(to: &str) -> RpcLog {
    let mut log = real_log();
    log.topics[2] = format!("0x000000000000000000000000{}", to.trim_start_matches("0x"));
    log
}

fn fees() -> Fees {
    Fees { max_fee_per_gas: U128(2_000_000), max_priority_fee_per_gas: U128(1_000_000) }
}

fn verify_response(k: &SigningKey, hash: &[u8; 32]) -> Value {
    json!({ "payload_hash": hex::encode(hash), "signature": sign_json(k, hash) })
}

fn submit(c: &mut Contract, log: &RpcLog) -> (String, [u8; 32]) {
    context("relayer.testnet", RECOVER_DEPOSIT);
    let _ = c.recover("Base".into(), log.clone(), fees());
    let parsed = parse_log(log).unwrap();
    let key = transfer_key("Base", &parsed.transaction_hash, parsed.log_index);
    (key, payload::log_payload_hash(6, 2, &parsed))
}

fn outcome(p: PromiseOrValue<RecoverOutcome>) -> Option<RecoverOutcome> {
    match p {
        PromiseOrValue::Value(v) => Some(v),
        PromiseOrValue::Promise(_) => None,
    }
}

#[test]
fn decodes_the_real_base_sepolia_usdc_transfer_log() {
    let log = parse_log(&real_log()).unwrap();
    let (from, to, amount) = decode_transfer(&log).unwrap();
    assert_eq!(to_hex(&from), "0xc1f380ff86c07f16afb04ccaf125ae114e943000");
    assert_eq!(to_hex(&to), "0x0a3440d212716282ebaf08b7871ba5bfe2c8ce34");
    assert_eq!(amount, 2_000_000);
    assert_eq!(to_hex(&log.address), USDC);
    assert_eq!(log.log_index, 3);
}

/// Root key of the signer's foreign-tx domain 3 on testnet.
const SIGNER_FOREIGN_TX_KEY: &str = "secp256k1:2KGCoy2pZt7n85QfJnQzCT1eHySuNpquUfNc8ySpRbr15F5kqU7agJYjfo5RkrzNd4tZimDFv2wAZri7RRZ32qj1";

#[test]
fn real_signer_response_recovers_to_the_signer_foreign_tx_key() {
    let response: Value =
        serde_json::from_str(include_str!("../fixtures/signer-verify-response.json")).unwrap();
    let hash = evm::parse_h256(response["payload_hash"].as_str().unwrap()).unwrap();
    let (r, s, v) = parse_k256_signature(&response["signature"]).unwrap();
    let expected = parse_secp256k1_key(SIGNER_FOREIGN_TX_KEY).unwrap();
    assert_eq!(recover_key(&hash, &r, &s, v), Some(expected));
}

#[test]
fn payload_hash_matches_the_one_the_signer_signed_on_testnet() {
    let log = parse_log(&real_log()).unwrap();
    let hash = payload::log_payload_hash(6, 2, &log);
    assert_eq!(hex::encode(hash), include_str!("../fixtures/signer-payload-hash.txt").trim());
}

#[test]
fn refuses_non_transfer_logs() {
    let mut log = parse_log(&real_log()).unwrap();
    log.topics[0] = [1u8; 32];
    assert!(decode_transfer(&log).is_err());
    let mut removed = parse_log(&real_log()).unwrap();
    removed.removed = true;
    assert!(decode_transfer(&removed).is_err());
}

#[test]
fn registration_derives_the_receive_address_from_the_signer_key() {
    let mut c = new_contract();
    let address = register_alice(&mut c, None);
    let expected = evm::address_from_public_key(&uncompressed(&receiver_key()));
    assert_eq!(address, to_hex(&expected));
    assert_eq!(c.get_receiver_by_address(address).unwrap().account_id.as_str(), "alice.testnet");
}

#[test]
#[should_panic(expected = "recipient is not a registered receive address")]
fn refuses_a_transfer_to_an_unregistered_address() {
    let mut c = new_contract();
    register_alice(&mut c, None);
    submit(&mut c, &real_log());
}

#[test]
#[should_panic(expected = "transfer already submitted")]
fn refuses_replay_of_the_same_transfer() {
    let mut c = new_contract();
    let addr = register_alice(&mut c, None);
    let log = log_to(&addr);
    submit(&mut c, &log);
    submit(&mut c, &log);
}

#[test]
#[should_panic(expected = "transfer already submitted")]
fn refuses_replay_after_the_transfer_was_verified() {
    let mut c = new_contract();
    let addr = register_alice(&mut c, None);
    let log = log_to(&addr);
    let (key, hash) = submit(&mut c, &log);
    context(CONTRACT, NearToken::from_yoctonear(0));
    let r = c.on_verified(key, hex::encode(hash), Ok(verify_response(&signer_root(), &hash)));
    assert!(outcome(r).is_none());
    submit(&mut c, &log);
}

#[test]
#[should_panic(expected = "callback can only be called by this contract")]
fn refuses_a_verification_callback_from_another_account() {
    let mut c = new_contract();
    let addr = register_alice(&mut c, None);
    let (key, hash) = submit(&mut c, &log_to(&addr));
    context(SIGNER, NearToken::from_yoctonear(0));
    let _ = c.on_verified(key, hex::encode(hash), Ok(verify_response(&signer_root(), &hash)));
}

#[test]
fn refuses_a_failed_verification_promise_and_frees_the_transfer() {
    let mut c = new_contract();
    let addr = register_alice(&mut c, None);
    let log = log_to(&addr);
    let (key, hash) = submit(&mut c, &log);
    context(CONTRACT, NearToken::from_yoctonear(0));
    let r = outcome(c.on_verified(key, hex::encode(hash), Err(PromiseError::Failed)));
    assert!(matches!(r, Some(RecoverOutcome::Rejected { .. })));
    let parsed = parse_log(&log).unwrap();
    assert!(c.get_transfer("Base".into(), to_hex(&parsed.transaction_hash), 3).is_none());
}

#[test]
fn refuses_a_response_not_signed_by_the_signer_key() {
    let mut c = new_contract();
    let addr = register_alice(&mut c, None);
    let (key, hash) = submit(&mut c, &log_to(&addr));
    context(CONTRACT, NearToken::from_yoctonear(0));
    let forged = verify_response(&key_for_forgery(), &hash);
    let r = outcome(c.on_verified(key, hex::encode(hash), Ok(forged)));
    assert_eq!(
        r,
        Some(RecoverOutcome::Rejected {
            reason: "response signature is not from the signer's foreign-tx key".into()
        })
    );
}

fn key_for_forgery() -> SigningKey {
    key(11)
}

#[test]
fn refuses_a_response_for_a_different_payload() {
    let mut c = new_contract();
    let addr = register_alice(&mut c, None);
    let (key, hash) = submit(&mut c, &log_to(&addr));
    context(CONTRACT, NearToken::from_yoctonear(0));
    let other = [5u8; 32];
    let r = outcome(c.on_verified(key, hex::encode(hash), Ok(verify_response(&signer_root(), &other))));
    assert_eq!(
        r,
        Some(RecoverOutcome::Rejected {
            reason: "verified payload differs from the submitted log".into()
        })
    );
}

/// Runs a transfer through verification and signing; returns the record.
fn verified_and_signed(forward_to: Option<&str>) -> (Contract, TransferRecord) {
    let mut c = new_contract();
    let addr = register_alice(&mut c, forward_to);
    let log = log_to(&addr);
    let (key, hash) = submit(&mut c, &log);
    context(CONTRACT, NearToken::from_yoctonear(0));
    let r = c.on_verified(key.clone(), hex::encode(hash), Ok(verify_response(&signer_root(), &hash)));
    assert!(outcome(r).is_none(), "a sign request is returned");
    let record = c.transfers.get(&key).cloned().unwrap();
    assert_eq!(record.status, TransferStatus::Verified);
    let signing_hash = c.forward_tx(&record).signing_hash();
    let signed = c.on_signed(
        key.clone(),
        hex::encode(signing_hash),
        Ok(sign_json(&receiver_key(), &signing_hash)),
    );
    assert!(matches!(signed, RecoverOutcome::Signed { .. }), "{signed:?}");
    let record = c.transfers.get(&key).cloned().unwrap();
    (c, record)
}

#[test]
fn forwards_to_the_registered_forwarding_address() {
    let forward = "0x1111111111111111111111111111111111111111";
    let (_, record) = verified_and_signed(Some(forward));
    assert_eq!(record.status, TransferStatus::Signed);
    assert_eq!(record.destination.as_deref(), Some(forward));
    assert!(!record.refund);
    assert_eq!(record.nonce, Some(0));
    let raw = record.signed_tx.unwrap();
    assert!(raw.contains(&format!("a9059cbb000000000000000000000000{}", &forward[2..])));
    assert!(raw.contains(&USDC[2..]));
}

#[test]
fn refunds_the_sender_without_a_forwarding_address() {
    let (_, record) = verified_and_signed(None);
    assert!(record.refund);
    assert_eq!(record.destination.as_deref(), Some("0xc1f380ff86c07f16afb04ccaf125ae114e943000"));
}

#[test]
fn signed_transaction_recovers_to_the_receive_address() {
    let (c, record) = verified_and_signed(None);
    let tx = c.forward_tx(&record);
    let raw = hex::decode(&record.signed_tx.unwrap()[2..]).unwrap();
    // The last 66 bytes are rlp(r) and rlp(s) (each 0xa0 + 32 bytes when no leading zero byte).
    let n = raw.len();
    let (r, s) = (&raw[n - 65..n - 33], &raw[n - 32..]);
    let parity = if raw[n - 67] == 0x80 { 0 } else { raw[n - 67] };
    let mut sig = [0u8; 64];
    sig[..32].copy_from_slice(r);
    sig[32..].copy_from_slice(s);
    let key = env::ecrecover(&tx.signing_hash(), &sig, parity, true).expect("low-s signature");
    assert_eq!(to_hex(&evm::address_from_public_key(&key)), record.receive_address);
}

#[test]
fn a_signature_by_another_key_is_not_stored() {
    let mut c = new_contract();
    let addr = register_alice(&mut c, None);
    let (key, hash) = submit(&mut c, &log_to(&addr));
    context(CONTRACT, NearToken::from_yoctonear(0));
    let _ = c.on_verified(key.clone(), hex::encode(hash), Ok(verify_response(&signer_root(), &hash)));
    let record = c.transfers.get(&key).cloned().unwrap();
    let signing_hash = c.forward_tx(&record).signing_hash();
    let r = c.on_signed(key.clone(), hex::encode(signing_hash), Ok(sign_json(&key_for_forgery(), &signing_hash)));
    assert!(matches!(r, RecoverOutcome::SignFailed { .. }));
    assert_eq!(c.transfers.get(&key).unwrap().status, TransferStatus::Verified);
    assert!(get_logs().iter().any(|l| l.contains("does not match")));
}

#[test]
fn nonces_increase_per_receive_address() {
    let mut c = new_contract();
    let addr = register_alice(&mut c, None);
    for log_index in [3u64, 4] {
        let mut log = log_to(&addr);
        log.log_index = format!("0x{log_index:x}");
        let (key, hash) = submit(&mut c, &log);
        context(CONTRACT, NearToken::from_yoctonear(0));
        let _ = c.on_verified(key.clone(), hex::encode(hash), Ok(verify_response(&signer_root(), &hash)));
        assert_eq!(c.transfers.get(&key).unwrap().nonce, Some(log_index - 3));
    }
}

#[test]
#[should_panic(expected = "max fee above the chain cap")]
fn refuses_fees_above_the_cap() {
    let mut c = new_contract();
    let addr = register_alice(&mut c, None);
    context("relayer.testnet", RECOVER_DEPOSIT);
    let high = Fees { max_fee_per_gas: U128(10_000_000_000), max_priority_fee_per_gas: U128(1) };
    let _ = c.recover("Base".into(), log_to(&addr), high);
}

#[test]
fn high_s_is_normalized() {
    let n_minus_one: [u8; 32] = hex::decode("fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140")
        .unwrap()
        .try_into()
        .unwrap();
    let (s, parity) = evm::normalize_s(&n_minus_one, 0);
    let mut one = [0u8; 32];
    one[31] = 1;
    assert_eq!(s, one);
    assert_eq!(parity, 1);
}

#[test]
fn rlp_matches_known_vectors() {
    assert_eq!(evm::rlp_u64(0), vec![0x80]);
    assert_eq!(evm::rlp_u64(15), vec![0x0f]);
    assert_eq!(evm::rlp_u64(1024), vec![0x82, 0x04, 0x00]);
    assert_eq!(evm::rlp_bytes(b"dog"), vec![0x83, b'd', b'o', b'g']);
    assert_eq!(evm::rlp_list(&[]), vec![0xc0]);
    let long = vec![0u8; 56];
    assert_eq!(&evm::rlp_bytes(&long)[..2], &[0xb8, 56]);
}
