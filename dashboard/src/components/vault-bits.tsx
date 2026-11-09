import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/toast"
import {
  CHAIN_COLOR,
  CHAINS,
  PRICE_USD,
  RULE_DELAY_MS,
  UNIT,
  useVault,
  usd,
  type Chain,
  type WithdrawalStatus,
} from "@/lib/vault"

export function ChainTag({ chain }: { chain: Chain }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-flex size-5 items-center justify-center rounded-md text-[10px] font-medium text-white"
        style={{ background: CHAIN_COLOR[chain] }}
      >
        {chain[0]}
      </span>
      {chain}
    </span>
  )
}

const STATUS: Record<WithdrawalStatus, { label: string; cls: string }> = {
  queued: { label: "Queued", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  executed: { label: "Sent", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  spent: { label: "Within limit", cls: "border-zinc-200 bg-zinc-50 text-zinc-700" },
  cancelled: { label: "Cancelled", cls: "border-red-200 bg-red-50 text-red-700" },
}

export function StatusBadge({ status, by }: { status: WithdrawalStatus; by?: string }) {
  const s = STATUS[status]
  return (
    <Badge variant="outline" className={s.cls}>
      {status === "cancelled" && by ? `Cancelled by ${by}` : s.label}
    </Badge>
  )
}

/** Request money: within today's limit it is signed at once, above it the request is queued for 72h. */
export function RequestWithdrawalDialog({ trigger }: { trigger?: React.ReactElement }) {
  const { addresses, request, dailyLimitUsd, spentTodayUsd, frozen } = useVault()
  const [open, setOpen] = React.useState(false)
  const [chain, setChain] = React.useState<Chain>("Ethereum")
  const [amount, setAmount] = React.useState("0.05")
  const [addressId, setAddressId] = React.useState<string>("")
  const options = addresses.filter((a) => a.chain === chain)
  const value = Number(amount) || 0
  const valueUsd = value * PRICE_USD[chain]
  const left = Math.max(0, dailyLimitUsd - spentTodayUsd)
  const within = valueUsd <= left

  React.useEffect(() => {
    setAddressId(options[0]?.id ?? "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain])

  function submit() {
    const r = request(chain, value, addressId)
    if (!r.ok) {
      toast.add({ title: "Request refused", description: r.reason, type: "error" })
      return
    }
    toast.add(
      r.queued
        ? { title: "Queued for 72 hours", description: "Above today's limit. Your guardians were notified.", type: "warning" }
        : { title: `Sent ${usd(valueUsd)}`, description: "Within today's limit, signed at once.", type: "success" }
    )
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button disabled={frozen} />}>Request withdrawal</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request withdrawal</DialogTitle>
          <DialogDescription>
            Up to {usd(left)} goes out now. Anything bigger waits 72 hours and any guardian can stop it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Chain</Label>
            <Select items={Object.fromEntries(CHAINS.map((c) => [c, c]))} value={chain} onValueChange={(v) => setChain(v as Chain)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {CHAINS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="amt">Amount ({UNIT[chain]})</Label>
            <Input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="text-sm text-muted-foreground">
              About {usd(valueUsd)}.{" "}
              {within ? "Fits today's limit." : "Above today's limit: this will be queued for 72 hours."}
            </p>
          </div>
          <div className="grid gap-2">
            <Label>To a saved address</Label>
            <Select
              items={Object.fromEntries(options.map((a) => [a.id, `${a.label} · ${a.address}`]))}
              value={addressId}
              onValueChange={(v) => setAddressId(String(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No saved address on this chain" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {options.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label} · {a.address}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {!within && options.find((a) => a.id === addressId && Date.now() - a.savedAt < RULE_DELAY_MS) && (
              <p className="text-sm text-destructive">This address is less than 7 days old, so it can only take amounts within the limit.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!value || !addressId}>
            {within ? "Send now" : "Queue for 72h"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
