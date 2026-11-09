import { Snowflake, ShieldCheck } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { useNow } from "@/hooks/use-now"
import { ago, useVault } from "@/lib/vault"

const APPROVALS: [string, string, string, string, string][] = [
  ["Spend within today's limit", "yes", "no", "no", "none"],
  ["Withdraw above the limit to a saved address", "yes", "can cancel", "no", "72h"],
  ["Save a new destination", "yes", "can cancel", "no", "7 days"],
  ["Raise limit, shorten delay, remove guardian", "yes", "can cancel", "no", "7 days"],
  ["Lower limit, add guardian, freeze", "yes", "freeze", "no", "none"],
  ["Unfreeze", "no", "no", "yes", "none"],
]

export default function Page() {
  const { guardians, frozen, unfreezeVotes, freeze, voteUnfreeze } = useVault()
  const now = useNow(30_000)
  const majority = Math.floor(guardians.length / 2) + 1

  return (
    <BaseLayout title="Guardians" description="People who can stop a withdrawal or freeze the vault. They can never spend.">
      {frozen && (
        <div className="px-4 lg:px-6">
          <Card className="border-sky-200 bg-sky-50/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Snowflake className="size-4 text-sky-600" /> The vault is frozen
              </CardTitle>
              <CardDescription>
                Nothing can be spent or sent. Unfreezing needs {majority} of {guardians.length} guardians ({unfreezeVotes.length} so far).
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}
      <div className="grid gap-4 px-4 md:grid-cols-3 lg:px-6">
        {guardians.map((g) => {
          const voted = unfreezeVotes.includes(g.name)
          return (
            <Card key={g.id}>
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-full border bg-muted text-sm font-medium">
                  {g.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </div>
                <CardTitle className="pt-2">{g.name}</CardTitle>
                <CardDescription>{g.relation}</CardDescription>
                <CardAction>
                  <Badge variant="outline" className={g.online ? "border-emerald-200 bg-emerald-50 text-emerald-800" : ""}>
                    {g.online ? "Online" : "Notified"}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account</span>
                  <span>{g.contact}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Guardian since</span>
                  <span>{ago(now - g.addedAt)}</span>
                </div>
              </CardContent>
              <CardFooter>
                {frozen ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={voted}
                    onClick={() => {
                      voteUnfreeze(g.name)
                      toast.add({ title: voted ? "Already voted" : `${g.name} voted to unfreeze`, type: "info" })
                    }}
                  >
                    {voted ? "Voted to unfreeze" : "Vote to unfreeze"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full text-sky-700"
                    onClick={() => {
                      freeze(g.name)
                      toast.add({ title: "Vault frozen", description: `${g.name} froze it. Nothing can move.`, type: "info" })
                    }}
                  >
                    <Snowflake data-icon="inline-start" /> Freeze vault
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>
      <div className="px-4 lg:px-6">
        <Card className="pb-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4" /> Who approves what
            </CardTitle>
            <CardDescription>Changes that make you safer apply at once. Everything else waits.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Action</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>One guardian</TableHead>
                  <TableHead>Guardian majority</TableHead>
                  <TableHead className="pr-6">Wait</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {APPROVALS.map((r) => (
                  <TableRow key={r[0]}>
                    <TableCell className="pl-6 font-medium">{r[0]}</TableCell>
                    {r.slice(1, 4).map((c, i) => (
                      <TableCell key={i} className={c === "no" ? "text-muted-foreground" : ""}>
                        {c}
                      </TableCell>
                    ))}
                    <TableCell className="pr-6">{r[4]}</TableCell>
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
