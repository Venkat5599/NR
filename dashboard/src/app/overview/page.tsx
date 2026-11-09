import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"
import { Link } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChainTag, RequestWithdrawalDialog, StatusBadge } from "@/components/vault-bits"
import { useNow } from "@/hooks/use-now"
import { ago, countdown, fmtAmount, PRICE_USD, useVault, usd } from "@/lib/vault"

const chartConfig = { spent: { label: "Spent", color: "var(--chart-1)" } } satisfies ChartConfig

export default function Page() {
  const v = useVault()
  const now = useNow()
  const left = Math.max(0, v.dailyLimitUsd - v.spentTodayUsd)
  const pct = Math.min(100, (v.spentTodayUsd / v.dailyLimitUsd) * 100)
  const queued = v.withdrawals.filter((w) => w.status === "queued")
  const total = v.holdings.reduce((s, h) => s + h.amount * PRICE_USD[h.chain], 0)

  return (
    <BaseLayout
      title="Overview"
      description="One daily limit across Bitcoin, Ethereum, Base and NEAR."
      actions={<RequestWithdrawalDialog />}
    >
      <div className="grid gap-4 px-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Daily limit</CardDescription>
            <CardTitle className="text-3xl font-medium tabular-nums">{usd(v.dailyLimitUsd)}</CardTitle>
            <CardAction>
              <Badge variant="outline">USD</Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">Raising it waits 7 days</CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Spent today</CardDescription>
            <CardTitle className="text-3xl font-medium tabular-nums">{usd(v.spentTodayUsd)}</CardTitle>
            <CardAction>
              <Badge variant="outline">{Math.round(pct)}%</Badge>
            </CardAction>
          </CardHeader>
          <CardFooter>
            <Progress value={pct} className="w-full" />
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Most anyone can take now</CardDescription>
            <CardTitle className="text-3xl font-medium tabular-nums">{usd(left)}</CardTitle>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">Resets in {countdown(v.resetAt - now)}</CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Queued withdrawals</CardDescription>
            <CardTitle className="text-3xl font-medium tabular-nums">{queued.length}</CardTitle>
            <CardAction>
              <Badge variant="outline">72h</Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">Any one guardian can cancel</CardFooter>
        </Card>
      </div>

      <div className="grid gap-4 px-4 lg:grid-cols-3 lg:px-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Spending against the limit</CardTitle>
            <CardDescription>Last 30 days, all chains combined</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
              <BarChart data={v.spendHistory} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                  tickFormatter={(d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                />
                <YAxis width={44} tickLine={false} axisLine={false} tickFormatter={(n: number) => `$${n}`} domain={[0, 240]} />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <ReferenceLine y={v.dailyLimitUsd} stroke="var(--destructive)" strokeDasharray="4 4" label={{ value: "Limit", position: "insideTopRight", fill: "var(--destructive)", fontSize: 11 }} />
                <Bar dataKey="spent" fill="var(--color-spent)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
            <CardDescription>Addresses the vault controls</CardDescription>
            <CardAction className="text-sm tabular-nums">{usd(total)}</CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
            {v.holdings.map((h) => (
              <div key={h.chain} className="flex items-center justify-between text-sm">
                <ChainTag chain={h.chain} />
                <div className="text-right">
                  <div className="tabular-nums">{fmtAmount(h.chain, h.amount)}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">{usd(h.amount * PRICE_USD[h.chain])}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Spends and withdrawals across every chain</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/withdrawals" />}>
                View all
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Chain</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {v.withdrawals.slice(0, 6).map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="pl-6">
                      <ChainTag chain={w.chain} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {fmtAmount(w.chain, w.amount)} <span className="text-muted-foreground">· {usd(w.usd)}</span>
                    </TableCell>
                    <TableCell>{w.to}</TableCell>
                    <TableCell>
                      <StatusBadge status={w.status} by={w.by} />
                    </TableCell>
                    <TableCell className="pr-6 text-right text-muted-foreground tabular-nums">
                      {w.status === "queued" ? `unlocks in ${countdown(w.unlockAt - now)}` : ago(now - w.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  )
}
