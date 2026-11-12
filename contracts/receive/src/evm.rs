//! Minimal EVM helpers: RLP, EIP-1559 transactions, ERC-20 calldata, addresses.

use near_sdk::env;

/// keccak256("Transfer(address,address,uint256)")
pub const TRANSFER_TOPIC: [u8; 32] = [
    0xdd, 0xf2, 0x52, 0xad, 0x1b, 0xe2, 0xc8, 0x9b, 0x69, 0xc2, 0xb0, 0x68, 0xfc, 0x37, 0x8d, 0xaa,
    0x95, 0x2b, 0xa7, 0xf1, 0x63, 0xc4, 0xa1, 0x16, 0x28, 0xf5, 0x5a, 0x4d, 0xf5, 0x23, 0xb3, 0xef,
];

/// `transfer(address,uint256)` selector.
pub const ERC20_TRANSFER_SELECTOR: [u8; 4] = [0xa9, 0x05, 0x9c, 0xbb];

/// secp256k1 group order n.
const SECP256K1_N: [u8; 32] = [
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe,
    0xba, 0xae, 0xdc, 0xe6, 0xaf, 0x48, 0xa0, 0x3b, 0xbf, 0xd2, 0x5e, 0x8c, 0xd0, 0x36, 0x41, 0x41,
];
/// n / 2, the upper bound of a canonical ("low") s.
const SECP256K1_HALF_N: [u8; 32] = [
    0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0x5d, 0x57, 0x6e, 0x73, 0x57, 0xa4, 0x50, 0x1d, 0xdf, 0xe9, 0x2f, 0x46, 0x68, 0x1b, 0x20, 0xa0,
];

/// EVM address of an uncompressed secp256k1 public key (64 bytes, no 0x04 prefix).
pub fn address_from_public_key(public_key: &[u8; 64]) -> [u8; 20] {
    let hash = env::keccak256_array(public_key);
    let mut address = [0u8; 20];
    address.copy_from_slice(&hash[12..]);
    address
}

fn strip_leading_zeros(bytes: &[u8]) -> &[u8] {
    let first = bytes.iter().position(|b| *b != 0).unwrap_or(bytes.len());
    &bytes[first..]
}

fn rlp_length_prefix(len: usize, short_base: u8, long_base: u8) -> Vec<u8> {
    if len <= 55 {
        vec![short_base + len as u8]
    } else {
        let len_bytes = (len as u64).to_be_bytes();
        let len_bytes = strip_leading_zeros(&len_bytes);
        let mut out = vec![long_base + len_bytes.len() as u8];
        out.extend_from_slice(len_bytes);
        out
    }
}

pub fn rlp_bytes(bytes: &[u8]) -> Vec<u8> {
    if bytes.len() == 1 && bytes[0] < 0x80 {
        return vec![bytes[0]];
    }
    let mut out = rlp_length_prefix(bytes.len(), 0x80, 0xb7);
    out.extend_from_slice(bytes);
    out
}

/// RLP of an unsigned integer given as big-endian bytes (minimal encoding).
pub fn rlp_uint_be(bytes: &[u8]) -> Vec<u8> {
    rlp_bytes(strip_leading_zeros(bytes))
}

pub fn rlp_u64(value: u64) -> Vec<u8> {
    rlp_uint_be(&value.to_be_bytes())
}

pub fn rlp_u128(value: u128) -> Vec<u8> {
    rlp_uint_be(&value.to_be_bytes())
}

pub fn rlp_list(items: &[Vec<u8>]) -> Vec<u8> {
    let payload_len: usize = items.iter().map(|i| i.len()).sum();
    let mut out = rlp_length_prefix(payload_len, 0xc0, 0xf7);
    for item in items {
        out.extend_from_slice(item);
    }
    out
}

/// calldata for `transfer(to, amount)`; `amount` is a 32-byte big-endian word.
pub fn erc20_transfer_calldata(to: &[u8; 20], amount: &[u8; 32]) -> Vec<u8> {
    let mut data = Vec::with_capacity(68);
    data.extend_from_slice(&ERC20_TRANSFER_SELECTOR);
    data.extend_from_slice(&[0u8; 12]);
    data.extend_from_slice(to);
    data.extend_from_slice(amount);
    data
}

/// An EIP-1559 (type 2) transaction with an empty access list.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Eip1559Tx {
    pub chain_id: u64,
    pub nonce: u64,
    pub max_priority_fee_per_gas: u128,
    pub max_fee_per_gas: u128,
    pub gas_limit: u64,
    pub to: [u8; 20],
    pub value: u128,
    pub data: Vec<u8>,
}

impl Eip1559Tx {
    fn fields(&self) -> Vec<Vec<u8>> {
        vec![
            rlp_u64(self.chain_id),
            rlp_u64(self.nonce),
            rlp_u128(self.max_priority_fee_per_gas),
            rlp_u128(self.max_fee_per_gas),
            rlp_u64(self.gas_limit),
            rlp_bytes(&self.to),
            rlp_u128(self.value),
            rlp_bytes(&self.data),
            rlp_list(&[]),
        ]
    }

    /// The bytes whose keccak256 is signed: `0x02 || rlp([...])`.
    pub fn signing_preimage(&self) -> Vec<u8> {
        let mut out = vec![0x02];
        out.extend_from_slice(&rlp_list(&self.fields()));
        out
    }

    pub fn signing_hash(&self) -> [u8; 32] {
        env::keccak256_array(&self.signing_preimage())
    }

    /// Raw signed transaction `0x02 || rlp([..., y_parity, r, s])`.
    pub fn encode_signed(&self, y_parity: u8, r: &[u8; 32], s: &[u8; 32]) -> Vec<u8> {
        let mut fields = self.fields();
        fields.push(rlp_u64(y_parity as u64));
        fields.push(rlp_uint_be(r));
        fields.push(rlp_uint_be(s));
        let mut out = vec![0x02];
        out.extend_from_slice(&rlp_list(&fields));
        out
    }
}

fn gt(a: &[u8; 32], b: &[u8; 32]) -> bool {
    a > b // big-endian byte arrays compare as integers
}

fn sub(a: &[u8; 32], b: &[u8; 32]) -> [u8; 32] {
    let mut out = [0u8; 32];
    let mut borrow = 0i16;
    for i in (0..32).rev() {
        let mut d = a[i] as i16 - b[i] as i16 - borrow;
        if d < 0 {
            d += 256;
            borrow = 1;
        } else {
            borrow = 0;
        }
        out[i] = d as u8;
    }
    out
}

/// Returns (s, y_parity) with s moved to the lower half of the curve order, as
/// EVM chains require (EIP-2). Flipping s flips the parity of R.
pub fn normalize_s(s: &[u8; 32], y_parity: u8) -> ([u8; 32], u8) {
    if gt(s, &SECP256K1_HALF_N) {
        (sub(&SECP256K1_N, s), y_parity ^ 1)
    } else {
        (*s, y_parity)
    }
}

pub fn parse_address(s: &str) -> Option<[u8; 20]> {
    let raw = hex::decode(s.strip_prefix("0x").unwrap_or(s)).ok()?;
    raw.try_into().ok()
}

pub fn parse_h256(s: &str) -> Option<[u8; 32]> {
    let raw = hex::decode(s.strip_prefix("0x").unwrap_or(s)).ok()?;
    raw.try_into().ok()
}

pub fn parse_quantity(s: &str) -> Option<u64> {
    let digits = s.strip_prefix("0x")?;
    if digits.is_empty() {
        return None;
    }
    u64::from_str_radix(digits, 16).ok()
}

pub fn to_hex(bytes: &[u8]) -> String {
    format!("0x{}", hex::encode(bytes))
}
