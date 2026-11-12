//! Receive contract.
//!
//! Every registered receiver (a NEAR account) gets an EVM receive address: the
//! address of the signer key derived for (this contract, path = receiver account id).
//! When tokens arrive at that address on a supported EVM chain, anyone can call
//! `recover`. The contract asks the signer to verify the transfer log on the
//! foreign chain, checks the verified payload and its signature, records the
//! transfer (replay protected) and asks the signer to sign an EVM transaction
//! from the receive address that forwards the tokens to the receiver's
//! forwarding address, or back to the sender when none is registered. The
//! signed transaction is stored here; any relayer can broadcast it.
//!
//! There are no owner or admin methods.

pub mod evm;
pub mod payload;

use near_sdk::json_types::U128;
use near_sdk::serde_json::{self, Value, json};
use near_sdk::store::LookupMap;
use near_sdk::{
    AccountId, CurveType, Gas, NearToken, PanicOnDefault, Promise, PromiseError, PromiseOrValue,
    PublicKey, env, log, near, require,
};
use std::str::FromStr;

use evm::{Eip1559Tx, TRANSFER_TOPIC, to_hex};
use payload::EvmLog;

pub const REGISTER_DEPOSIT: NearToken = NearToken::from_millinear(10);
pub const RECOVER_DEPOSIT: NearToken = NearToken::from_millinear(20);

const GAS_DERIVED_KEY_VIEW: Gas = Gas::from_tgas(10);
const GAS_ON_REGISTERED: Gas = Gas::from_tgas(15);
const GAS_VERIFY: Gas = Gas::from_tgas(40);
const GAS_ON_VERIFIED: Gas = Gas::from_tgas(130);
const GAS_ON_CHECKED: Gas = Gas::from_tgas(20);
const GAS_SIGN: Gas = Gas::from_tgas(40);
const GAS_ON_SIGNED: Gas = Gas::from_tgas(40);
const SIGNER_DEPOSIT: NearToken = NearToken::from_yoctonear(1);

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ChainInit {
    /// Signer chain name, e.g. "Base".
    pub name: String,
    /// EIP-155 chain id the forward transaction is signed for, e.g. 84532.
    pub evm_chain_id: u64,
    /// "Latest" | "Safe" | "Finalized".
    pub finality: String,
    /// ERC-20 token contracts accepted on this chain.
    pub tokens: Vec<String>,
    /// Gas limit of the forward transaction.
    pub gas_limit: u64,
    /// Upper bound for `max_fee_per_gas` a caller may request, in wei.
    pub max_fee_per_gas_cap: U128,
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct ChainConfig {
    pub init: ChainInit,
    pub request_variant: u8,
    pub finality_variant: u8,
    pub tokens: Vec<[u8; 20]>,
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct Receiver {
    pub public_key: [u8; 64],
    pub address: [u8; 20],
    pub forward_to: Option<[u8; 20]>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ReceiverView {
    pub account_id: AccountId,
    pub receive_address: String,
    pub public_key: String,
    pub forward_to: Option<String>,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TransferStatus {
    /// Verification requested from the signer.
    Verifying,
    /// Verified; forward transaction assigned a nonce but not signed (yet).
    Verified,
    /// Forward transaction signed and stored.
    Signed,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TransferRecord {
    pub chain: String,
    pub tx_id: String,
    pub log_index: u64,
    pub receiver: AccountId,
    pub receive_address: String,
    pub token: String,
    pub from: String,
    pub amount: U128,
    pub status: TransferStatus,
    pub destination: Option<String>,
    pub refund: bool,
    pub nonce: Option<u64>,
    pub max_fee_per_gas: U128,
    pub max_priority_fee_per_gas: U128,
    pub signed_tx: Option<String>,
    pub evm_tx_hash: Option<String>,
}

/// A log as returned by `eth_getTransactionReceipt` / `eth_getLogs`.
#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RpcLog {
    #[serde(default)]
    pub removed: bool,
    pub log_index: String,
    pub transaction_index: String,
    pub transaction_hash: String,
    pub block_hash: String,
    pub block_number: String,
    pub address: String,
    pub data: String,
    pub topics: Vec<String>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Fees {
    pub max_fee_per_gas: U128,
    pub max_priority_fee_per_gas: U128,
}

/// A decoded ERC-20 `Transfer` log.
#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DecodedTransfer {
    pub token: String,
    pub from: String,
    pub to: String,
    pub amount: U128,
    pub tx_id: String,
    pub log_index: u64,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CheckResult {
    pub verified: bool,
    pub reason: Option<String>,
    pub payload_hash: String,
    pub transfer: DecodedTransfer,
    pub recipient: Option<AccountId>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RecoverOutcome {
    /// Verification failed or was refused; the record was removed and the
    /// transfer can be submitted again.
    Rejected { reason: String },
    /// Signed forward transaction.
    Signed { signed_tx: String, evm_tx_hash: String },
    /// Signing failed; the transfer stays verified and `resign` can retry.
    SignFailed { reason: String },
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ConfigView {
    pub signer_id: AccountId,
    pub sign_domain_id: u64,
    pub foreign_tx_domain_id: u64,
    pub foreign_tx_public_key: String,
    pub chains: Vec<ChainInit>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    signer_id: AccountId,
    sign_domain_id: u64,
    foreign_tx_domain_id: u64,
    /// Root key of the signer's foreign-tx domain, uncompressed without prefix.
    foreign_tx_public_key: [u8; 64],
    chains: Vec<ChainConfig>,
    receivers: LookupMap<AccountId, Receiver>,
    receiver_by_address: LookupMap<[u8; 20], AccountId>,
    transfers: LookupMap<String, TransferRecord>,
    /// Next EVM nonce per (chain, receive address).
    nonces: LookupMap<String, u64>,
}

pub fn parse_secp256k1_key(s: &str) -> Option<[u8; 64]> {
    let key = PublicKey::from_str(s).ok()?;
    if key.curve_type() != CurveType::SECP256K1 {
        return None;
    }
    key.as_bytes().get(1..65)?.try_into().ok()
}

pub fn transfer_key(chain: &str, tx_id: &[u8; 32], log_index: u64) -> String {
    format!("{chain}:{}:{log_index}", to_hex(tx_id))
}

fn nonce_key(chain: &str, address: &[u8; 20]) -> String {
    format!("{chain}:{}", to_hex(address))
}

/// Parses an RPC log into the signer's log shape.
pub fn parse_log(log: &RpcLog) -> Result<EvmLog, String> {
    let q = |name: &str, v: &str| evm::parse_quantity(v).ok_or(format!("invalid {name}"));
    let h = |name: &str, v: &str| evm::parse_h256(v).ok_or(format!("invalid {name}"));
    let topics = log
        .topics
        .iter()
        .map(|t| h("topic", t))
        .collect::<Result<Vec<_>, _>>()?;
    if !log.data.starts_with("0x") || hex::decode(&log.data[2..]).is_err() {
        return Err("invalid data".into());
    }
    Ok(EvmLog {
        removed: log.removed,
        log_index: q("logIndex", &log.log_index)?,
        transaction_index: q("transactionIndex", &log.transaction_index)?,
        transaction_hash: h("transactionHash", &log.transaction_hash)?,
        block_hash: h("blockHash", &log.block_hash)?,
        block_number: q("blockNumber", &log.block_number)?,
        address: evm::parse_address(&log.address).ok_or("invalid address")?,
        data: log.data.clone(),
        topics,
    })
}

/// Decodes an ERC-20 `Transfer(address indexed from, address indexed to, uint256 value)` log.
pub fn decode_transfer(log: &EvmLog) -> Result<([u8; 20], [u8; 20], u128), String> {
    if log.removed {
        return Err("log was removed by a reorg".into());
    }
    if log.topics.len() != 3 || log.topics[0] != TRANSFER_TOPIC {
        return Err("not an ERC-20 Transfer log".into());
    }
    let word_to_address = |w: &[u8; 32]| -> Result<[u8; 20], String> {
        if w[..12].iter().any(|b| *b != 0) {
            return Err("topic is not an address".into());
        }
        Ok(w[12..].try_into().unwrap())
    };
    let from = word_to_address(&log.topics[1])?;
    let to = word_to_address(&log.topics[2])?;
    let data = hex::decode(&log.data[2..]).map_err(|_| "invalid data")?;
    if data.len() != 32 {
        return Err("Transfer data is not one word".into());
    }
    if data[..16].iter().any(|b| *b != 0) {
        return Err("amount exceeds u128".into());
    }
    let amount = u128::from_be_bytes(data[16..].try_into().unwrap());
    if amount == 0 {
        return Err("zero amount".into());
    }
    Ok((from, to, amount))
}

/// Parses a `SignatureResponse::Secp256k1` JSON value into (r, s, y_parity of R).
pub fn parse_k256_signature(v: &Value) -> Result<([u8; 32], [u8; 32], u8), String> {
    if v.get("scheme").and_then(Value::as_str) != Some("Secp256k1") {
        return Err("signature scheme is not Secp256k1".into());
    }
    let big_r = v
        .pointer("/big_r/affine_point")
        .and_then(Value::as_str)
        .and_then(|s| hex::decode(s).ok())
        .ok_or("invalid big_r")?;
    let s: [u8; 32] = v
        .pointer("/s/scalar")
        .and_then(Value::as_str)
        .and_then(|s| hex::decode(s).ok())
        .and_then(|b| b.try_into().ok())
        .ok_or("invalid s")?;
    if big_r.len() != 33 || (big_r[0] != 2 && big_r[0] != 3) {
        return Err("big_r is not a compressed point".into());
    }
    // The signer normalizes `s` to the low half and reports the matching
    // recovery id, which then differs from the parity of `big_r`.
    let recovery_id = v
        .get("recovery_id")
        .and_then(Value::as_u64)
        .filter(|id| *id <= 1)
        .ok_or("invalid recovery_id")?;
    let r: [u8; 32] = big_r[1..].try_into().unwrap();
    Ok((r, s, recovery_id as u8))
}

fn recover_key(hash: &[u8; 32], r: &[u8; 32], s: &[u8; 32], v: u8) -> Option<[u8; 64]> {
    let mut sig = [0u8; 64];
    sig[..32].copy_from_slice(r);
    sig[32..].copy_from_slice(s);
    env::ecrecover(hash, &sig, v, false)
}

#[near]
impl Contract {
    #[init]
    pub fn new(
        signer_id: AccountId,
        sign_domain_id: u64,
        foreign_tx_domain_id: u64,
        foreign_tx_public_key: String,
        chains: Vec<ChainInit>,
    ) -> Self {
        let foreign_tx_public_key = parse_secp256k1_key(&foreign_tx_public_key)
            .unwrap_or_else(|| env::panic_str("foreign_tx_public_key must be a secp256k1 key"));
        let chains = chains
            .into_iter()
            .map(|c| {
                let request_variant = payload::evm_request_variant(&c.name)
                    .unwrap_or_else(|| env::panic_str("unsupported chain"));
                let finality_variant = payload::finality_variant(&c.finality)
                    .unwrap_or_else(|| env::panic_str("unsupported finality"));
                let tokens = c
                    .tokens
                    .iter()
                    .map(|t| evm::parse_address(t).unwrap_or_else(|| env::panic_str("bad token")))
                    .collect();
                ChainConfig { init: c, request_variant, finality_variant, tokens }
            })
            .collect();
        Self {
            signer_id,
            sign_domain_id,
            foreign_tx_domain_id,
            foreign_tx_public_key,
            chains,
            receivers: LookupMap::new(b"r"),
            receiver_by_address: LookupMap::new(b"a"),
            transfers: LookupMap::new(b"t"),
            nonces: LookupMap::new(b"n"),
        }
    }

    fn chain(&self, name: &str) -> &ChainConfig {
        self.chains
            .iter()
            .find(|c| c.init.name == name)
            .unwrap_or_else(|| env::panic_str("unsupported chain"))
    }

    fn assert_callback(&self) {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "callback can only be called by this contract"
        );
    }

    // ---------------------------------------------------------------- register

    /// Registers the caller as a receiver, or updates its forwarding address.
    /// `forward_to` is the EVM address verified transfers are forwarded to;
    /// without one, verified transfers are refunded to their sender.
    #[payable]
    pub fn register(&mut self, forward_to: Option<String>) -> PromiseOrValue<ReceiverView> {
        let account = env::predecessor_account_id();
        let forward = forward_to.map(|f| {
            evm::parse_address(&f).unwrap_or_else(|| env::panic_str("invalid forward_to address"))
        });
        if let Some(existing) = self.receivers.get_mut(&account) {
            existing.forward_to = forward;
            let view = Self::receiver_view(&account, existing);
            return PromiseOrValue::Value(view);
        }
        require!(
            env::attached_deposit() >= REGISTER_DEPOSIT,
            format!("attach at least {REGISTER_DEPOSIT} for storage")
        );
        let args = json!({
            "path": account.as_str(),
            "predecessor": env::current_account_id(),
            "domain_id": self.sign_domain_id,
        });
        Promise::new(self.signer_id.clone())
            .function_call(
                String::from("derived_public_key"),
                serde_json::to_vec(&args).unwrap(),
                NearToken::from_yoctonear(0),
                GAS_DERIVED_KEY_VIEW,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_ON_REGISTERED)
                    .on_registered(account, forward.map(|f| to_hex(&f)), U128(env::attached_deposit().as_yoctonear())),
            )
            .into()
    }

    #[private]
    pub fn on_registered(
        &mut self,
        account: AccountId,
        forward_to: Option<String>,
        deposit: U128,
        #[callback_result] derived: Result<String, PromiseError>,
    ) -> Option<ReceiverView> {
        self.assert_callback();
        let public_key = derived.ok().as_deref().and_then(parse_secp256k1_key);
        let Some(public_key) = public_key else {
            log!("registration failed: signer did not return a derived key");
            Promise::new(account).transfer(NearToken::from_yoctonear(deposit.0)).detach();
            return None;
        };
        let address = evm::address_from_public_key(&public_key);
        let receiver = Receiver {
            public_key,
            address,
            forward_to: forward_to.and_then(|f| evm::parse_address(&f)),
        };
        self.receiver_by_address.insert(address, account.clone());
        let view = Self::receiver_view(&account, &receiver);
        self.receivers.insert(account, receiver);
        log!("registered {} receive address {}", view.account_id, view.receive_address);
        Some(view)
    }

    fn receiver_view(account: &AccountId, r: &Receiver) -> ReceiverView {
        ReceiverView {
            account_id: account.clone(),
            receive_address: to_hex(&r.address),
            public_key: to_hex(&r.public_key),
            forward_to: r.forward_to.map(|f| to_hex(&f)),
        }
    }

    // ----------------------------------------------------------------- recover

    fn verify_promise(&self, chain: &ChainConfig, log: &EvmLog, expected: &[u8; 32]) -> Promise {
        let args = json!({
            "request": {
                "request": {
                    chain.init.name.clone(): {
                        "tx_id": hex::encode(log.transaction_hash),
                        "extractors": [{ "Log": { "log_index": log.log_index } }],
                        "finality": chain.init.finality,
                    }
                },
                "domain_id": self.foreign_tx_domain_id,
                "payload_version": 1,
                "expected_payload_hash": hex::encode(expected),
            }
        });
        Promise::new(self.signer_id.clone()).function_call(
            String::from("verify_foreign_transaction"),
            serde_json::to_vec(&args).unwrap(),
            SIGNER_DEPOSIT,
            GAS_VERIFY,
        )
    }

    /// Checks that a verify response is the signer's signature over `expected`.
    fn check_verify_response(
        &self,
        expected: &[u8; 32],
        response: Result<Value, PromiseError>,
    ) -> Result<(), String> {
        let response = response.map_err(|_| "signer did not verify the transaction".to_string())?;
        let payload_hash = response
            .get("payload_hash")
            .and_then(Value::as_str)
            .and_then(evm::parse_h256)
            .ok_or("response has no payload_hash")?;
        if &payload_hash != expected {
            return Err("verified payload differs from the submitted log".into());
        }
        let signature = response.get("signature").ok_or("response has no signature")?;
        let (r, s, v) = parse_k256_signature(signature)?;
        match recover_key(expected, &r, &s, v) {
            Some(key) if key == self.foreign_tx_public_key => Ok(()),
            _ => Err("response signature is not from the signer's foreign-tx key".into()),
        }
    }

    /// Verifies a transfer to a receive address through the signer and, once
    /// verified, requests a signed forward (or refund) transaction.
    /// `log` is the Transfer log exactly as the chain RPC returns it.
    #[payable]
    pub fn recover(&mut self, chain: String, log: RpcLog, fees: Fees) -> Promise {
        require!(
            env::attached_deposit() >= RECOVER_DEPOSIT,
            format!("attach at least {RECOVER_DEPOSIT}")
        );
        let cfg = self.chain(&chain).clone();
        self.check_fees(&cfg, &fees);
        let evm_log = parse_log(&log).unwrap_or_else(|e| env::panic_str(&e));
        let (from, to, amount) = decode_transfer(&evm_log).unwrap_or_else(|e| env::panic_str(&e));
        require!(cfg.tokens.contains(&evm_log.address), "token not accepted on this chain");
        let receiver = self
            .receiver_by_address
            .get(&to)
            .cloned()
            .unwrap_or_else(|| env::panic_str("recipient is not a registered receive address"));
        let key = transfer_key(&chain, &evm_log.transaction_hash, evm_log.log_index);
        require!(!self.transfers.contains_key(&key), "transfer already submitted");
        self.transfers.insert(
            key.clone(),
            TransferRecord {
                chain: chain.clone(),
                tx_id: to_hex(&evm_log.transaction_hash),
                log_index: evm_log.log_index,
                receiver,
                receive_address: to_hex(&to),
                token: to_hex(&evm_log.address),
                from: to_hex(&from),
                amount: U128(amount),
                status: TransferStatus::Verifying,
                destination: None,
                refund: false,
                nonce: None,
                max_fee_per_gas: fees.max_fee_per_gas,
                max_priority_fee_per_gas: fees.max_priority_fee_per_gas,
                signed_tx: None,
                evm_tx_hash: None,
            },
        );
        let expected = payload::log_payload_hash(cfg.request_variant, cfg.finality_variant, &evm_log);
        self.verify_promise(&cfg, &evm_log, &expected).then(
            Self::ext(env::current_account_id())
                .with_static_gas(GAS_ON_VERIFIED)
                .with_unused_gas_weight(0)
                .on_verified(key, hex::encode(expected)),
        )
    }

    #[private]
    pub fn on_verified(
        &mut self,
        key: String,
        expected_payload_hash: String,
        #[callback_result] response: Result<Value, PromiseError>,
    ) -> PromiseOrValue<RecoverOutcome> {
        self.assert_callback();
        let record = self
            .transfers
            .get(&key)
            .cloned()
            .unwrap_or_else(|| env::panic_str("unknown transfer"));
        require!(record.status == TransferStatus::Verifying, "transfer is not awaiting verification");
        let expected = evm::parse_h256(&expected_payload_hash).unwrap();
        if let Err(reason) = self.check_verify_response(&expected, response) {
            self.transfers.remove(&key);
            log!("transfer {key} rejected: {reason}");
            return PromiseOrValue::Value(RecoverOutcome::Rejected { reason });
        }
        let Some(receiver) = self.receivers.get(&record.receiver).cloned() else {
            self.transfers.remove(&key);
            let reason = "recipient is not registered".to_string();
            return PromiseOrValue::Value(RecoverOutcome::Rejected { reason });
        };
        let from = evm::parse_address(&record.from).unwrap();
        let (destination, refund) = match receiver.forward_to {
            Some(f) => (f, false),
            None => (from, true),
        };
        let nkey = nonce_key(&record.chain, &receiver.address);
        let nonce = self.nonces.get(&nkey).copied().unwrap_or(0);
        self.nonces.insert(nkey, nonce + 1);
        let mut record = record;
        record.status = TransferStatus::Verified;
        record.destination = Some(to_hex(&destination));
        record.refund = refund;
        record.nonce = Some(nonce);
        self.transfers.insert(key.clone(), record.clone());
        log!("transfer {key} verified; nonce {nonce}");
        self.request_signature(&key, &record).into()
    }

    fn forward_tx(&self, record: &TransferRecord) -> Eip1559Tx {
        let cfg = self.chain(&record.chain);
        let destination = evm::parse_address(record.destination.as_ref().unwrap()).unwrap();
        let mut amount = [0u8; 32];
        amount[16..].copy_from_slice(&record.amount.0.to_be_bytes());
        Eip1559Tx {
            chain_id: cfg.init.evm_chain_id,
            nonce: record.nonce.unwrap(),
            max_priority_fee_per_gas: record.max_priority_fee_per_gas.0,
            max_fee_per_gas: record.max_fee_per_gas.0,
            gas_limit: cfg.init.gas_limit,
            to: evm::parse_address(&record.token).unwrap(),
            value: 0,
            data: evm::erc20_transfer_calldata(&destination, &amount),
        }
    }

    fn request_signature(&self, key: &str, record: &TransferRecord) -> Promise {
        let hash = self.forward_tx(record).signing_hash();
        let args = json!({
            "request": {
                "path": record.receiver.as_str(),
                "payload_v2": { "Ecdsa": hex::encode(hash) },
                "domain_id": self.sign_domain_id,
            }
        });
        Promise::new(self.signer_id.clone())
            .function_call(
                String::from("sign"),
                serde_json::to_vec(&args).unwrap(),
                SIGNER_DEPOSIT,
                GAS_SIGN,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_ON_SIGNED)
                    .with_unused_gas_weight(0)
                    .on_signed(key.to_string(), hex::encode(hash)),
            )
    }

    #[private]
    pub fn on_signed(
        &mut self,
        key: String,
        signing_hash: String,
        #[callback_result] signature: Result<Value, PromiseError>,
    ) -> RecoverOutcome {
        self.assert_callback();
        let mut record = self
            .transfers
            .get(&key)
            .cloned()
            .unwrap_or_else(|| env::panic_str("unknown transfer"));
        let tx = self.forward_tx(&record);
        let hash = tx.signing_hash();
        if hex::encode(hash) != signing_hash {
            // A newer `resign` changed the fees; this signature is for an older version.
            return RecoverOutcome::SignFailed { reason: "stale signature".into() };
        }
        let receiver = self.receivers.get(&record.receiver).cloned().unwrap();
        let parsed = signature
            .map_err(|_| "signer did not sign".to_string())
            .and_then(|v| parse_k256_signature(&v));
        let (r, s, parity) = match parsed {
            Ok(p) => p,
            Err(reason) => {
                log!("transfer {key}: {reason}");
                return RecoverOutcome::SignFailed { reason };
            }
        };
        let (s, parity) = evm::normalize_s(&s, parity);
        if recover_key(&hash, &r, &s, parity) != Some(receiver.public_key) {
            let reason = "signature does not match the receive address key".to_string();
            log!("transfer {key}: {reason}");
            return RecoverOutcome::SignFailed { reason };
        }
        let raw = tx.encode_signed(parity, &r, &s);
        let signed_tx = to_hex(&raw);
        let evm_tx_hash = to_hex(&env::keccak256_array(&raw));
        record.status = TransferStatus::Signed;
        record.signed_tx = Some(signed_tx.clone());
        record.evm_tx_hash = Some(evm_tx_hash.clone());
        self.transfers.insert(key.clone(), record);
        log!("transfer {key} signed: {evm_tx_hash}");
        RecoverOutcome::Signed { signed_tx, evm_tx_hash }
    }

    /// Signs the forward transaction of a verified transfer again with new
    /// fees. The nonce and content stay the same, so at most one of the signed
    /// versions can ever be included on chain.
    #[payable]
    pub fn resign(&mut self, chain: String, tx_id: String, log_index: u64, fees: Fees) -> Promise {
        require!(env::attached_deposit() >= SIGNER_DEPOSIT, "attach 1 yoctoNEAR");
        let cfg = self.chain(&chain).clone();
        self.check_fees(&cfg, &fees);
        let tx = evm::parse_h256(&tx_id).unwrap_or_else(|| env::panic_str("invalid tx_id"));
        let key = transfer_key(&chain, &tx, log_index);
        let mut record = self
            .transfers
            .get(&key)
            .cloned()
            .unwrap_or_else(|| env::panic_str("unknown transfer"));
        require!(record.status != TransferStatus::Verifying, "transfer is not verified");
        record.max_fee_per_gas = fees.max_fee_per_gas;
        record.max_priority_fee_per_gas = fees.max_priority_fee_per_gas;
        self.transfers.insert(key.clone(), record.clone());
        self.request_signature(&key, &record)
    }

    fn check_fees(&self, cfg: &ChainConfig, fees: &Fees) {
        require!(
            fees.max_priority_fee_per_gas.0 <= fees.max_fee_per_gas.0,
            "priority fee above max fee"
        );
        require!(
            fees.max_fee_per_gas.0 <= cfg.init.max_fee_per_gas_cap.0,
            "max fee above the chain cap"
        );
    }

    // ------------------------------------------------------------ check only

    /// Verifies any ERC-20 Transfer log through the signer without recording
    /// or forwarding anything. Returns whether the signer's verification
    /// matched the submitted log and whom it was sent to.
    #[payable]
    pub fn check_transfer(&mut self, chain: String, log: RpcLog) -> Promise {
        require!(env::attached_deposit() >= SIGNER_DEPOSIT, "attach 1 yoctoNEAR");
        let cfg = self.chain(&chain).clone();
        let evm_log = parse_log(&log).unwrap_or_else(|e| env::panic_str(&e));
        decode_transfer(&evm_log).unwrap_or_else(|e| env::panic_str(&e));
        let expected = payload::log_payload_hash(cfg.request_variant, cfg.finality_variant, &evm_log);
        self.verify_promise(&cfg, &evm_log, &expected).then(
            Self::ext(env::current_account_id())
                .with_static_gas(GAS_ON_CHECKED)
                .with_unused_gas_weight(0)
                .on_checked(log, hex::encode(expected)),
        )
    }

    #[private]
    pub fn on_checked(
        &mut self,
        log: RpcLog,
        expected_payload_hash: String,
        #[callback_result] response: Result<Value, PromiseError>,
    ) -> CheckResult {
        self.assert_callback();
        let evm_log = parse_log(&log).unwrap();
        let (from, to, amount) = decode_transfer(&evm_log).unwrap();
        let expected = evm::parse_h256(&expected_payload_hash).unwrap();
        let result = self.check_verify_response(&expected, response);
        CheckResult {
            verified: result.is_ok(),
            reason: result.err(),
            payload_hash: to_hex(&expected),
            transfer: DecodedTransfer {
                token: to_hex(&evm_log.address),
                from: to_hex(&from),
                to: to_hex(&to),
                amount: U128(amount),
                tx_id: to_hex(&evm_log.transaction_hash),
                log_index: evm_log.log_index,
            },
            recipient: self.receiver_by_address.get(&to).cloned(),
        }
    }

    // ------------------------------------------------------------------ views

    pub fn get_config(&self) -> ConfigView {
        ConfigView {
            signer_id: self.signer_id.clone(),
            sign_domain_id: self.sign_domain_id,
            foreign_tx_domain_id: self.foreign_tx_domain_id,
            foreign_tx_public_key: to_hex(&self.foreign_tx_public_key),
            chains: self.chains.iter().map(|c| c.init.clone()).collect(),
        }
    }

    pub fn get_receiver(&self, account_id: AccountId) -> Option<ReceiverView> {
        self.receivers.get(&account_id).map(|r| Self::receiver_view(&account_id, r))
    }

    pub fn get_receiver_by_address(&self, address: String) -> Option<ReceiverView> {
        let address = evm::parse_address(&address)?;
        let account = self.receiver_by_address.get(&address)?;
        self.get_receiver(account.clone())
    }

    pub fn get_transfer(&self, chain: String, tx_id: String, log_index: u64) -> Option<TransferRecord> {
        let tx = evm::parse_h256(&tx_id)?;
        self.transfers.get(&transfer_key(&chain, &tx, log_index)).cloned()
    }

    pub fn get_next_nonce(&self, chain: String, address: String) -> u64 {
        evm::parse_address(&address)
            .and_then(|a| self.nonces.get(&nonce_key(&chain, &a)).copied())
            .unwrap_or(0)
    }

    /// The signer payload hash the contract expects for a log (for off-chain checks).
    pub fn expected_payload_hash(&self, chain: String, log: RpcLog) -> String {
        let cfg = self.chain(&chain);
        let evm_log = parse_log(&log).unwrap_or_else(|e| env::panic_str(&e));
        to_hex(&payload::log_payload_hash(cfg.request_variant, cfg.finality_variant, &evm_log))
    }
}

#[cfg(test)]
mod tests;
