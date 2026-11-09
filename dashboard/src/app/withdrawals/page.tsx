import * as React from "react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/toast"
import { ChainTag, RequestWithdrawalDialog, StatusBadge } from "@/components/vault-bits"
import { useNow } from "@/hooks/use-now"
import { ago, countdown, DELAY_MS, fmtAmount, useVault, usd } from "@/lib/vault"

type Filter = "all" | "queued" | "done"

export default function Page() {
  const { withdrawals, guardians, cancel } = useVault()
  const now = useNow()
  const [filter, setFilter] = React.useState<Filter>("all")
  const [as, setAs] = React.useState(guardians[0].name)
  const rows = withdrawals.filter((w) =>
    filter === "all" ? true : filter === "queued" ? w.status === "queued" : w.status !== "queued"
  )

  return (
    <BaseLayout
      title="Withdrawals"
      description="Within the limit they go out at once. Above it they wait 72 hours, to saved addresses only."
      actions={<RequestWithdrawalDialog />}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 lg:px-6">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="queued">Queued</TabsTrigger>
            <TabsTrigger value="done">Settled</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Acting as guardian
          <Select items={Object.fromEntries(guardians.map((g) => [g.name, g.name]))} value={as} onValueChange={(v) => setAs(String(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {guardians.map((g) => (
                  <SelectItem key={g.id} value={g.name}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="px-4 lg:px-6">
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Chain</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead className="pr-6 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((w) => {
                  const progress = w.status === "queued" ? Math.min(1, (now - w.createdAt) / DELAY_MS) : 1
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="pl-6">
                        <ChainTag chain={w.chain} />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {fmtAmount(w.chain, w.amount)}
                        <div className="text-xs text-muted-foreground">{usd(w.usd)}</div>
                      </TableCell>
                      <TableCell>{w.to}</TableCell>
                      <TableCell>
                        <StatusBadge status={w.status} by={w.by} />
                      </TableCell>
                      <TableCell className="min-w-44">
                        {w.status === "queued" ? (
                          <div className="grid gap-1.5">
                            <span className="text-sm tabular-nums">Unlocks in {countdown(w.unlockAt - now)}</span>
                            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-amber-500" style={{ width: `${progress * 100}%` }} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">{ago(now - w.createdAt)}</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        {w.status === "queued" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            onClick={() => {
                              cancel(w.id, as)
                              toast.add({ title: "Withdrawal cancelled", description: `${as} stopped it. Nothing was signed.`, type: "error" })
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Nothing here.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  )
}
