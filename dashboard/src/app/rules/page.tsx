import * as React from "react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { useNow } from "@/hooks/use-now"
import { ago, countdown, useVault, usd } from "@/lib/vault"

function ChangeLimitDialog() {
  const { dailyLimitUsd, proposeLimit } = useVault()
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(String(dailyLimitUsd))
  const n = Number(value) || 0
  const lower = n <= dailyLimitUsd
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Change limit</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change daily limit</DialogTitle>
          <DialogDescription>Lowering applies at once. Raising waits 7 days, and any guardian can cancel it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="lim">New limit (USD)</Label>
          <Input id="lim" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <DialogFooter>
          <Button
            disabled={!n}
            onClick={() => {
              const r = proposeLimit(n)
              toast.add(
                r.immediate
                  ? { title: `Limit is now ${usd(n)}`, description: "Lower limits apply at once.", type: "success" }
                  : { title: "Raise scheduled", description: `${usd(n)} applies in 7 days unless cancelled.`, type: "warning" }
              )
              setOpen(false)
            }}
          >
            {lower ? "Apply now" : "Schedule for 7 days"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Page() {
  const { dailyLimitUsd, rules, cancelRule } = useVault()
  const now = useNow()
  return (
    <BaseLayout title="Limit and delays" description="Rules that weaken protection wait 7 days. Rules that strengthen it apply at once.">
      <div className="grid gap-4 px-4 md:grid-cols-3 lg:px-6">
        <Card>
          <CardHeader>
            <CardDescription>Daily limit, all chains</CardDescription>
            <CardTitle className="text-3xl font-medium tabular-nums">{usd(dailyLimitUsd)}</CardTitle>
          </CardHeader>
          <CardFooter>
            <ChangeLimitDialog />
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Withdrawal delay above the limit</CardDescription>
            <CardTitle className="text-3xl font-medium">72 hours</CardTitle>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">No address skips it, not even a recovery address</CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Delay on weakening a rule</CardDescription>
            <CardTitle className="text-3xl font-medium">7 days</CardTitle>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">Raise limit, shorten delay, save address, remove guardian</CardFooter>
        </Card>
      </div>
      <div className="px-4 lg:px-6">
        <Card className="pb-0">
          <CardHeader>
            <CardTitle>Rule changes</CardTitle>
            <CardDescription>Pending changes can be cancelled by you or any guardian</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Change</TableHead>
                  <TableHead>Proposed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-6 font-medium">{r.summary}</TableCell>
                    <TableCell className="text-muted-foreground">{ago(now - r.proposedAt)}</TableCell>
                    <TableCell>
                      {r.status === "pending" ? (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                          Applies in {countdown(r.appliesAt - now)}
                        </Badge>
                      ) : r.status === "applied" ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                          Applied
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                          Cancelled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      {r.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            cancelRule(r.id)
                            toast.add({ title: "Change cancelled", type: "info" })
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Phone key</CardTitle>
            <CardDescription>The key on your phone can call two methods and nothing else</CardDescription>
            <CardAction>
              <Badge variant="outline">Function-call key</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <div className="font-medium">Spend within today's limit</div>
              <div className="text-muted-foreground">Signed at once, summed across every chain</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="font-medium">Request a withdrawal</div>
              <div className="text-muted-foreground">Queued for 72 hours when above the limit</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  )
}
