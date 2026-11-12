//! Lunar payments.
//!
//! A person keeps a small "pocket" of NEAR in this contract and sets a daily cap. Their phone
//! keyboard holds a NEAR function-call key that can only call `pay` here. NEAR does not let a
//! function-call key attach a deposit, so every method that moves money out to the owner or
//! changes a setting requires 1 yoctoNEAR attached: only the owner's full-access key (their
//! wallet) can call those. The keyboard key can only pay, and only up to the cap per UTC day.
//!
//! Every payment and every refused attempt is written as a NEP-297 event (`standard: "lunar"`),
//! so the public record page can list them from chain data alone.

use near_sdk::json_types::U128;
use near_sdk::store::LookupMap;
use near_sdk::{
    assert_one_yocto, env, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault,
    Promise, PromiseError,
};

const NS_PER_DAY: u64 = 86_400 * 1_000_000_000;
const GAS_FOR_RESOLVE: Gas = Gas::from_tgas(10);
/// Longest memo stored in an event; longer memos are cut.
const MAX_MEMO: usize = 80;

#[derive(BorshStorageKey)]
#[near]
enum Key {
    Pockets,
    Receive,
}

/// One person's pocket. Amounts are yoctoNEAR.
#[near(serializers = [borsh])]
#[derive(Clone, Default)]
pub struct Pocket {
    pub balance: u128,
    pub daily_cap: u128,
    pub spent_today: u128,
    /// UTC day number (`block_timestamp / 1 day`) that `spent_today` belongs to.
    pub day: u64,
}

/// Where a person wants to be paid. Read by the keyboard to show a cross-chain quote.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct ReceivePref {
    /// Chain name as the Intents token list spells it, e.g. "base", "arb", "sol", "near".
    pub chain: String,
    /// Token symbol, e.g. "USDC".
    pub token: String,
    /// Address on that chain.
    pub address: String,
}

#[near(serializers = [json])]
#[derive(Debug, PartialEq)]
pub struct PocketView {
    pub balance: U128,
    pub daily_cap: U128,
    pub spent_today: U128,
    pub left_today: U128,
}

#[near(serializers = [json])]
#[derive(Debug, PartialEq)]
pub enum PayResult {
    Sent,
    RefusedOverCap,
    RefusedLowBalance,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pockets: LookupMap<AccountId, Pocket>,
    receive: LookupMap<AccountId, ReceivePref>,
}

fn emit(event: &str, data: near_sdk::serde_json::Value) {
    env::log_str(&format!(
        "EVENT_JSON:{}",
        near_sdk::serde_json::json!({ "standard": "lunar", "version": "1.0.0", "event": event, "data": [data] })
    ));
}

fn today() -> u64 {
    env::block_timestamp() / NS_PER_DAY
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self { pockets: LookupMap::new(Key::Pockets), receive: LookupMap::new(Key::Receive) }
    }

    // ------------------------------------------------------------------ owner (wallet) methods

    /// Adds the attached NEAR to the caller's pocket. A function-call key can't attach NEAR,
    /// so only the owner's wallet can top up.
    #[payable]
    pub fn deposit(&mut self) -> U128 {
        let who = env::predecessor_account_id();
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "attach NEAR to deposit");
        let mut p = self.pockets.get(&who).cloned().unwrap_or_default();
        p.balance += amount;
        let bal = p.balance;
        self.pockets.insert(who.clone(), p);
        emit("deposit", near_sdk::serde_json::json!({ "account": who, "amount": U128(amount) }));
        U128(bal)
    }

    /// Sets how much the keyboard key may spend per UTC day. Wallet only (1 yocto).
    #[payable]
    pub fn set_daily_cap(&mut self, cap: U128) {
        assert_one_yocto();
        let who = env::predecessor_account_id();
        let mut p = self.pockets.get(&who).cloned().unwrap_or_default();
        p.daily_cap = cap.0;
        self.pockets.insert(who.clone(), p);
        emit("cap_set", near_sdk::serde_json::json!({ "account": who, "cap": cap }));
    }

    /// Sends pocket money back to the owner. Wallet only (1 yocto).
    #[payable]
    pub fn withdraw(&mut self, amount: U128) -> Promise {
        assert_one_yocto();
        let who = env::predecessor_account_id();
        let mut p = self.pockets.get(&who).cloned().unwrap_or_default();
        require!(p.balance >= amount.0, "not enough in the pocket");
        p.balance -= amount.0;
        self.pockets.insert(who.clone(), p);
        emit("withdraw", near_sdk::serde_json::json!({ "account": who, "amount": amount }));
        Promise::new(who).transfer(NearToken::from_yoctonear(amount.0 + 1))
    }

    /// Where the caller wants to be paid. Wallet only (1 yocto), so a keyboard key can't
    /// redirect incoming payments.
    #[payable]
    pub fn set_receive(&mut self, pref: ReceivePref) {
        assert_one_yocto();
        require!(pref.chain.len() <= 16 && pref.token.len() <= 16 && pref.address.len() <= 128, "field too long");
        let who = env::predecessor_account_id();
        emit("receive_set", near_sdk::serde_json::json!({ "account": who, "chain": pref.chain, "token": pref.token, "address": pref.address }));
        self.receive.insert(who, pref);
    }

    // ------------------------------------------------------------------ keyboard method

    /// Pays `amount` yoctoNEAR from the caller's pocket to `to`, if today's total stays within
    /// the cap. Refusals don't panic: they are recorded as events and returned, so the public
    /// record can show them.
    pub fn pay(&mut self, to: AccountId, amount: U128, memo: Option<String>) -> PayResult {
        let who = env::predecessor_account_id();
        let memo = memo.map(|m| m.chars().take(MAX_MEMO).collect::<String>());
        require!(amount.0 > 0, "amount must be above zero");
        require!(to != who, "can't pay yourself");
        let mut p = self.pockets.get(&who).cloned().unwrap_or_default();
        let day = today();
        if p.day != day {
            p.day = day;
            p.spent_today = 0;
        }
        let base = near_sdk::serde_json::json!({ "from": who, "to": to, "amount": U128(amount.0), "memo": memo });
        if p.spent_today.saturating_add(amount.0) > p.daily_cap {
            let mut d = base;
            d["cap"] = near_sdk::serde_json::json!(U128(p.daily_cap));
            d["spent_today"] = near_sdk::serde_json::json!(U128(p.spent_today));
            emit("refused_over_cap", d);
            self.pockets.insert(who, p);
            return PayResult::RefusedOverCap;
        }
        if p.balance < amount.0 {
            emit("refused_low_balance", base);
            self.pockets.insert(who, p);
            return PayResult::RefusedLowBalance;
        }
        p.balance -= amount.0;
        p.spent_today += amount.0;
        self.pockets.insert(who.clone(), p);
        emit("pay", base);
        let _ = Promise::new(to.clone())
            .transfer(NearToken::from_yoctonear(amount.0))
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_FOR_RESOLVE).on_paid(who, to, amount));
        PayResult::Sent
    }

    /// If the transfer failed (for example `to` doesn't exist), the money goes back to the
    /// pocket and today's total drops again.
    #[private]
    pub fn on_paid(&mut self, from: AccountId, to: AccountId, amount: U128, #[callback_result] r: Result<(), PromiseError>) -> bool {
        if r.is_ok() {
            return true;
        }
        let mut p = self.pockets.get(&from).cloned().unwrap_or_default();
        p.balance += amount.0;
        if p.day == today() {
            p.spent_today = p.spent_today.saturating_sub(amount.0);
        }
        self.pockets.insert(from.clone(), p);
        emit("pay_failed_refunded", near_sdk::serde_json::json!({ "from": from, "to": to, "amount": amount }));
        false
    }

    // ------------------------------------------------------------------ views

    pub fn get_pocket(&self, account: AccountId) -> PocketView {
        let p = self.pockets.get(&account).cloned().unwrap_or_default();
        let spent = if p.day == today() { p.spent_today } else { 0 };
        PocketView {
            balance: U128(p.balance),
            daily_cap: U128(p.daily_cap),
            spent_today: U128(spent),
            left_today: U128(p.daily_cap.saturating_sub(spent).min(p.balance)),
        }
    }

    pub fn get_receive(&self, account: AccountId) -> Option<ReceivePref> {
        self.receive.get(&account).cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{get_logs, VMContextBuilder};
    use near_sdk::testing_env;

    const NEAR: u128 = 10u128.pow(24);

    fn ctx(who: &str, deposit: u128, ts: u64) {
        testing_env!(VMContextBuilder::new()
            .current_account_id("pay.testnet".parse().unwrap())
            .predecessor_account_id(who.parse().unwrap())
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(ts)
            .build());
    }

    fn setup(cap: u128, balance: u128) -> Contract {
        ctx("alice.testnet", balance, 0);
        let mut c = Contract::new();
        c.deposit();
        ctx("alice.testnet", 1, 0);
        c.set_daily_cap(U128(cap));
        c
    }

    #[test]
    fn pays_within_the_cap() {
        let mut c = setup(2 * NEAR, 5 * NEAR);
        ctx("alice.testnet", 0, 1);
        assert_eq!(c.pay("bob.testnet".parse().unwrap(), U128(NEAR), Some("dinner".into())), PayResult::Sent);
        let v = c.get_pocket("alice.testnet".parse().unwrap());
        assert_eq!(v.balance.0, 4 * NEAR);
        assert_eq!(v.left_today.0, NEAR);
        assert!(get_logs().iter().any(|l| l.contains("\"event\":\"pay\"")));
    }

    #[test]
    fn refuses_the_payment_that_crosses_the_cap() {
        let mut c = setup(2 * NEAR, 5 * NEAR);
        ctx("alice.testnet", 0, 1);
        assert_eq!(c.pay("bob.testnet".parse().unwrap(), U128(NEAR + NEAR / 2), None), PayResult::Sent);
        assert_eq!(c.pay("bob.testnet".parse().unwrap(), U128(NEAR), None), PayResult::RefusedOverCap);
        assert!(get_logs().iter().any(|l| l.contains("refused_over_cap")));
        assert_eq!(c.get_pocket("alice.testnet".parse().unwrap()).balance.0, 5 * NEAR - NEAR - NEAR / 2);
    }

    #[test]
    fn the_cap_resets_the_next_utc_day() {
        let mut c = setup(2 * NEAR, 5 * NEAR);
        ctx("alice.testnet", 0, 1);
        assert_eq!(c.pay("bob.testnet".parse().unwrap(), U128(2 * NEAR), None), PayResult::Sent);
        assert_eq!(c.pay("bob.testnet".parse().unwrap(), U128(1), None), PayResult::RefusedOverCap);
        ctx("alice.testnet", 0, NS_PER_DAY + 1);
        assert_eq!(c.pay("bob.testnet".parse().unwrap(), U128(2 * NEAR), None), PayResult::Sent);
    }

    #[test]
    fn no_cap_set_means_nothing_can_be_paid() {
        ctx("carol.testnet", 3 * NEAR, 0);
        let mut c = Contract::new();
        c.deposit();
        ctx("carol.testnet", 0, 1);
        assert_eq!(c.pay("bob.testnet".parse().unwrap(), U128(1), None), PayResult::RefusedOverCap);
    }

    #[test]
    fn refuses_more_than_the_pocket_holds() {
        let mut c = setup(10 * NEAR, NEAR);
        ctx("alice.testnet", 0, 1);
        assert_eq!(c.pay("bob.testnet".parse().unwrap(), U128(2 * NEAR), None), PayResult::RefusedLowBalance);
    }

    #[test]
    #[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
    fn a_keyboard_key_cannot_raise_the_cap() {
        let mut c = setup(NEAR, NEAR);
        ctx("alice.testnet", 0, 1); // function-call keys can't attach a deposit
        c.set_daily_cap(U128(1000 * NEAR));
    }

    #[test]
    #[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
    fn a_keyboard_key_cannot_withdraw() {
        let mut c = setup(NEAR, NEAR);
        ctx("alice.testnet", 0, 1);
        let _ = c.withdraw(U128(NEAR));
    }

    #[test]
    #[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
    fn a_keyboard_key_cannot_redirect_incoming_payments() {
        let mut c = setup(NEAR, NEAR);
        ctx("alice.testnet", 0, 1);
        c.set_receive(ReceivePref { chain: "base".into(), token: "USDC".into(), address: "0xattacker".into() });
    }

    #[test]
    fn a_failed_transfer_goes_back_to_the_pocket() {
        let mut c = setup(2 * NEAR, 5 * NEAR);
        ctx("alice.testnet", 0, 1);
        let _ = c.pay("nobody.testnet".parse().unwrap(), U128(NEAR), None);
        ctx("pay.testnet", 0, 2);
        let ok = c.on_paid("alice.testnet".parse().unwrap(), "nobody.testnet".parse().unwrap(), U128(NEAR), Err(PromiseError::Failed));
        assert!(!ok);
        let v = c.get_pocket("alice.testnet".parse().unwrap());
        assert_eq!(v.balance.0, 5 * NEAR);
        assert_eq!(v.spent_today.0, 0);
    }

    #[test]
    fn memo_is_cut_to_80_chars() {
        let mut c = setup(2 * NEAR, 5 * NEAR);
        ctx("alice.testnet", 0, 1);
        let _ = c.pay("bob.testnet".parse().unwrap(), U128(1), Some("x".repeat(500)));
        let log = get_logs().into_iter().find(|l| l.contains("\"event\":\"pay\"")).unwrap();
        assert!(log.contains(&"x".repeat(80)) && !log.contains(&"x".repeat(81)));
    }
}
