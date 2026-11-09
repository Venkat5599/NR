// Mock vault state for the dashboard. Nothing here talks to a chain yet: every
// number is sample data held in memory, and every action only changes this store.
import { create } from "zustand"

export const HOUR = 3600_000
export const DAY = 24 * HOUR
export const DELAY_MS = 72 * HOUR
export const RULE_DELAY_MS = 7 * DAY

export type Chain = "Bitcoin" | "Ethereum" | "Base" | "NEAR"
export const CHAINS: Chain[] = ["Bitcoin", "Ethereum", "Base", "NEAR"]
export const CHAIN_COLOR: Record<Chain, string> = {
  Bitcoin: "#f7931a",
  Ethereum: "#627eea",
  Base: "#0052ff",
  NEAR: "#111111",
}
export const PRICE_USD: Record<Chain, number> = {
  Bitcoin: 68_400,
  Ethereum: 2_480,
  Base: 2_480,
  NEAR: 3.1,
}
export const UNIT: Record<Chain, string> = { Bitcoin: "BTC", Ethereum: "ETH", Base: "ETH", NEAR: "NEAR" }

export type WithdrawalStatus = "queued" | "executed" | "cancelled" | "spent"
export interface Withdrawal {
  id: string
  chain: Chain
  amount: number
  usd: number
  to: string // saved address label
  createdAt: number
  unlockAt: number
  status: WithdrawalStatus
  by?: string
}
export interface Guardian {
  id: string
  name: string
  relation: string
  contact: string
  addedAt: number
  online: boolean
}
export interface SavedAddress {
  id: string
  label: string
  chain: Chain
  address: string
  savedAt: number
}
export type RuleKind = "raise-limit" | "lower-limit" | "add-guardian" | "remove-guardian" | "shorten-delay"
export interface RuleChange {
  id: string
  kind: RuleKind
  summary: string
  proposedAt: number
  appliesAt: number
  status: "pending" | "applied" | "cancelled"
}
export interface Holding {
  chain: Chain
  amount: number
}

const now = Date.now()
let seq = 100
const nextId = (p: string) => `${p}-${++seq}`

interface VaultState {
  dailyLimitUsd: number
  spentTodayUsd: number
  resetAt: number
  frozen: boolean
  unfreezeVotes: string[]
  holdings: Holding[]
  withdrawals: Withdrawal[]
  guardians: Guardian[]
  addresses: SavedAddress[]
  rules: RuleChange[]
  spendHistory: { day: string; spent: number }[]
  spend: (chain: Chain, amount: number, to: string) => { ok: boolean; reason?: string }
  request: (chain: Chain, amount: number, addressId: string) => { ok: boolean; queued?: boolean; reason?: string }
  cancel: (id: string, guardian: string) => void
  freeze: (guardian: string) => void
  voteUnfreeze: (guardian: string) => void
  saveAddress: (label: string, chain: Chain, address: string) => void
  proposeLimit: (usd: number) => { immediate: boolean }
  cancelRule: (id: string) => void
}

function history() {
  const out: { day: string; spent: number }[] = []
  const vals = [38, 112, 64, 190, 22, 75, 140, 56, 98, 31, 160, 47, 120, 84, 12, 176, 66, 143, 29, 101, 88, 54, 197, 70, 133, 45, 92, 150, 61, 62.4]
  for (let i = vals.length - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY)
    out.push({ day: d.toISOString().slice(0, 10), spent: vals[vals.length - 1 - i] })
  }
  return out
}

export const useVault = create<VaultState>((set, get) => ({
  dailyLimitUsd: 200,
  spentTodayUsd: 62.4,
  resetAt: now + 9 * HOUR + 14 * 60_000,
  frozen: false,
  unfreezeVotes: [],
  holdings: [
    { chain: "Bitcoin", amount: 0.8421 },
    { chain: "Ethereum", amount: 6.215 },
    { chain: "Base", amount: 1.37 },
    { chain: "NEAR", amount: 1840 },
  ],
  withdrawals: [
    { id: "w-1", chain: "Bitcoin", amount: 0.04, usd: 2736, to: "Cold storage", createdAt: now - 21 * HOUR, unlockAt: now + 51 * HOUR, status: "queued" },
    { id: "w-2", chain: "Base", amount: 0.0088, usd: 21.8, to: "Groceries card", createdAt: now - 2 * HOUR, unlockAt: now - 2 * HOUR, status: "spent" },
    { id: "w-3", chain: "Ethereum", amount: 1.2, usd: 2976, to: "Exchange deposit", createdAt: now - 4 * DAY, unlockAt: now - 1 * DAY, status: "executed" },
    { id: "w-4", chain: "Ethereum", amount: 3, usd: 7440, to: "Exchange deposit", createdAt: now - 9 * DAY, unlockAt: now - 6 * DAY, status: "cancelled", by: "Maya R." },
    { id: "w-5", chain: "NEAR", amount: 13, usd: 40.6, to: "Rent split", createdAt: now - 5 * HOUR, unlockAt: now - 5 * HOUR, status: "spent" },
  ],
  guardians: [
    { id: "g-1", name: "Maya R.", relation: "Sister", contact: "maya.near", addedAt: now - 120 * DAY, online: true },
    { id: "g-2", name: "Dev K.", relation: "Friend, other city", contact: "devk.near", addedAt: now - 64 * DAY, online: false },
    { id: "g-3", name: "Law office", relation: "Hardware key", contact: "counsel.near", addedAt: now - 30 * DAY, online: false },
  ],
  addresses: [
    { id: "a-1", label: "Cold storage", chain: "Bitcoin", address: "bc1q9x7f…k2m4", savedAt: now - 41 * DAY },
    { id: "a-2", label: "Exchange deposit", chain: "Ethereum", address: "0x8a4c…91e0", savedAt: now - 12 * DAY },
    { id: "a-3", label: "Groceries card", chain: "Base", address: "0x51d2…07ab", savedAt: now - 80 * DAY },
    { id: "a-4", label: "Rent split", chain: "NEAR", address: "flatmates.near", savedAt: now - 33 * DAY },
    { id: "a-5", label: "New hardware wallet", chain: "Bitcoin", address: "bc1qhw3t…p8d9", savedAt: now - 2 * DAY },
  ],
  rules: [
    { id: "r-1", kind: "raise-limit", summary: "Raise daily limit from $200 to $300", proposedAt: now - 3 * DAY, appliesAt: now + 4 * DAY, status: "pending" },
    { id: "r-2", kind: "add-guardian", summary: "Add guardian Law office", proposedAt: now - 30 * DAY, appliesAt: now - 30 * DAY, status: "applied" },
  ],
  spendHistory: history(),

  spend: (chain, amount, to) => {
    const s = get()
    if (s.frozen) return { ok: false, reason: "The vault is frozen." }
    const usd = amount * PRICE_USD[chain]
    if (s.spentTodayUsd + usd > s.dailyLimitUsd) return { ok: false, reason: "That is above today's remaining limit." }
    set({
      spentTodayUsd: +(s.spentTodayUsd + usd).toFixed(2),
      withdrawals: [{ id: nextId("w"), chain, amount, usd, to, createdAt: Date.now(), unlockAt: Date.now(), status: "spent" }, ...s.withdrawals],
      spendHistory: s.spendHistory.map((d, i, a) => (i === a.length - 1 ? { ...d, spent: +(d.spent + usd).toFixed(2) } : d)),
    })
    return { ok: true }
  },

  request: (chain, amount, addressId) => {
    const s = get()
    if (s.frozen) return { ok: false, reason: "The vault is frozen." }
    const addr = s.addresses.find((a) => a.id === addressId)
    if (!addr) return { ok: false, reason: "Pick a saved address." }
    const usd = amount * PRICE_USD[chain]
    const t = Date.now()
    if (s.spentTodayUsd + usd <= s.dailyLimitUsd) {
      get().spend(chain, amount, addr.label)
      return { ok: true, queued: false }
    }
    if (t - addr.savedAt < RULE_DELAY_MS) return { ok: false, reason: `${addr.label} was saved less than 7 days ago.` }
    set({
      withdrawals: [{ id: nextId("w"), chain, amount, usd, to: addr.label, createdAt: t, unlockAt: t + DELAY_MS, status: "queued" }, ...s.withdrawals],
    })
    return { ok: true, queued: true }
  },

  cancel: (id, guardian) =>
    set((s) => ({ withdrawals: s.withdrawals.map((w) => (w.id === id ? { ...w, status: "cancelled", by: guardian } : w)) })),

  freeze: () => set({ frozen: true, unfreezeVotes: [] }),

  voteUnfreeze: (guardian) =>
    set((s) => {
      const votes = s.unfreezeVotes.includes(guardian) ? s.unfreezeVotes : [...s.unfreezeVotes, guardian]
      const majority = Math.floor(s.guardians.length / 2) + 1
      return votes.length >= majority ? { frozen: false, unfreezeVotes: [] } : { unfreezeVotes: votes }
    }),

  saveAddress: (label, chain, address) =>
    set((s) => ({ addresses: [{ id: nextId("a"), label, chain, address, savedAt: Date.now() }, ...s.addresses] })),

  proposeLimit: (usd) => {
    const s = get()
    const t = Date.now()
    if (usd <= s.dailyLimitUsd) {
      set({
        dailyLimitUsd: usd,
        rules: [{ id: nextId("r"), kind: "lower-limit", summary: `Lower daily limit from $${s.dailyLimitUsd} to $${usd}`, proposedAt: t, appliesAt: t, status: "applied" }, ...s.rules],
      })
      return { immediate: true }
    }
    set({
      rules: [{ id: nextId("r"), kind: "raise-limit", summary: `Raise daily limit from $${s.dailyLimitUsd} to $${usd}`, proposedAt: t, appliesAt: t + RULE_DELAY_MS, status: "pending" }, ...s.rules],
    })
    return { immediate: false }
  },

  cancelRule: (id) => set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, status: "cancelled" } : r)) })),
}))

export const usd = (v: number) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmtAmount = (chain: Chain, v: number) =>
  `${v.toLocaleString("en-US", { maximumFractionDigits: chain === "NEAR" ? 2 : 4 })} ${UNIT[chain]}`

export function countdown(ms: number) {
  if (ms <= 0) return "0h 00m"
  const h = Math.floor(ms / HOUR)
  const m = Math.floor((ms % HOUR) / 60_000)
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`
  return `${h}h ${String(m).padStart(2, "0")}m`
}

export function ago(ms: number) {
  const d = Math.floor(ms / DAY)
  if (d >= 1) return `${d}d ago`
  const h = Math.floor(ms / HOUR)
  if (h >= 1) return `${h}h ago`
  return `${Math.max(1, Math.floor(ms / 60_000))}m ago`
}
