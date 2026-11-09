import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChainTag } from "@/components/vault-bits"
import { useNow } from "@/hooks/use-now"
import { countdown, DELAY_MS, fmtAmount, useVault, usd } from "@/lib/vault"

export default function Page() {
  const v = useVault()
  const now = useNow()
  const left = v.frozen ? 0 : Math.max(0, v.dailyLimitUsd - v.spentTodayUsd)
  const queued = v.withdrawals.filter((w) => w.status === "queued")

  return (
    <BaseLayout
      title="Proof page"
      description="What anyone can check on their own phone. Read-only, straight from contract state."
    >
      <div className="px-4 lg:px-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardDescription>Most anyone can take from this vault right now</CardDescription>
            <CardAction>
              <Badge variant="outline">{v.frozen ? "Frozen" : "Active"}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="text-6xl font-medium tracking-tight tabular-nums md:text-7xl">{usd(left)}</div>
            <p className="mt-3 max-w-xl text-muted-foreground">
              {v.frozen
                ? "A guardian froze this vault. Nothing can be spent until a majority of guardians unfreeze it."
                : `Daily limit ${usd(v.dailyLimitUsd)}, ${usd(v.spentTodayUsd)} already spent. Resets in ${countdown(v.resetAt - now)}. Anything more waits 72 hours and any guardian can stop it.`}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 px-4 md:grid-cols-3 lg:px-6">
        <Card>
          <CardHeader>
            <CardDescription>Access keys on the vault</CardDescription>
            <CardTitle className="text-3xl font-medium">0</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Guardians who can stop a withdrawal</CardDescription>
            <CardTitle className="text-3xl font-medium">{v.guardians.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Queued withdrawals</CardDescription>
            <CardTitle className="text-3xl font-medium">{queued.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Queue</CardTitle>
            <CardDescription>Every pending withdrawal and the time left before it can execute</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {queued.length === 0 && <p className="text-muted-foreground">Nothing is queued.</p>}
            {queued.map((w) => {
              const p = Math.min(1, (now - w.createdAt) / DELAY_MS)
              return (
                <div key={w.id} className="grid gap-2 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <ChainTag chain={w.chain} />
                    <span className="tabular-nums">
                      {fmtAmount(w.chain, w.amount)} · {usd(w.usd)}
                    </span>
                    <span className="tabular-nums text-muted-foreground">unlocks in {countdown(w.unlockAt - now)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${p * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  )
}
