//! The payload the signer signs for `verify_foreign_transaction`:
//! `sha256(borsh(ForeignTxSignPayload::V1 { request, values }))`.
//!
//! Only the shapes this contract uses are encoded (an EVM request with one
//! `Log` extractor and its extracted log). Variant indices follow the signer's
//! interface types and must never change.

use near_sdk::env;

/// `ForeignChainRpcRequest` variant index for EVM chains.
pub fn evm_request_variant(chain: &str) -> Option<u8> {
    Some(match chain {
        "Abstract" => 0,
        "Ethereum" => 1,
        "Bnb" => 5,
        "Base" => 6,
        "Arbitrum" => 7,
        "Polygon" => 8,
        "HyperEvm" => 9,
        "Avalanche" => 13,
        _ => return None,
    })
}

/// `EvmFinality` variant index.
pub fn finality_variant(finality: &str) -> Option<u8> {
    Some(match finality {
        "Latest" => 0,
        "Safe" => 1,
        "Finalized" => 2,
        _ => return None,
    })
}

/// An EVM log as the signer extracts it from `eth_getTransactionReceipt`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EvmLog {
    pub removed: bool,
    pub log_index: u64,
    pub transaction_index: u64,
    pub transaction_hash: [u8; 32],
    pub block_hash: [u8; 32],
    pub block_number: u64,
    pub address: [u8; 20],
    /// Kept exactly as the RPC returned it (lowercase `0x` hex).
    pub data: String,
    pub topics: Vec<[u8; 32]>,
}

fn put_u32(buf: &mut Vec<u8>, v: u32) {
    buf.extend_from_slice(&v.to_le_bytes());
}

fn put_u64(buf: &mut Vec<u8>, v: u64) {
    buf.extend_from_slice(&v.to_le_bytes());
}

/// Borsh bytes of `ForeignTxSignPayload::V1` for one `Log { log_index }` extractor.
pub fn log_payload_bytes(chain_variant: u8, finality: u8, log: &EvmLog) -> Vec<u8> {
    let mut b = Vec::with_capacity(256 + log.data.len());
    b.push(0); // ForeignTxSignPayload::V1
    // request: ForeignChainRpcRequest::<chain>(EvmRpcRequest)
    b.push(chain_variant);
    b.extend_from_slice(&log.transaction_hash); // tx_id
    put_u32(&mut b, 1); // extractors.len()
    b.push(1); // EvmExtractor::Log
    put_u64(&mut b, log.log_index);
    b.push(finality);
    // values: Vec<ExtractedValue>
    put_u32(&mut b, 1);
    b.push(1); // ExtractedValue::EvmExtractedValue
    b.push(1); // EvmExtractedValue::Log
    b.push(log.removed as u8);
    put_u64(&mut b, log.log_index);
    put_u64(&mut b, log.transaction_index);
    b.extend_from_slice(&log.transaction_hash);
    b.extend_from_slice(&log.block_hash);
    put_u64(&mut b, log.block_number);
    b.extend_from_slice(&log.address);
    put_u32(&mut b, log.data.len() as u32);
    b.extend_from_slice(log.data.as_bytes());
    put_u32(&mut b, log.topics.len() as u32);
    for t in &log.topics {
        b.extend_from_slice(t);
    }
    b
}

pub fn log_payload_hash(chain_variant: u8, finality: u8, log: &EvmLog) -> [u8; 32] {
    env::sha256_array(&log_payload_bytes(chain_variant, finality, log))
}
