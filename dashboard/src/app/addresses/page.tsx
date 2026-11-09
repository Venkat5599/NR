import * as React from "react"
import { Plus } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { ChainTag } from "@/components/vault-bits"
import { useNow } from "@/hooks/use-now"
import { ago, CHAINS, countdown, RULE_DELAY_MS, useVault, type Chain } from "@/lib/vault"

function SaveAddressDialog() {
  const save = useVault((s) => s.saveAddress)
  const [open, setOpen] = React.useState(false)
  const [label, setLabel] = React.useState("")
  const [chain, setChain] = React.useState<Chain>("Bitcoin")
  const [address, setAddress] = React.useState("")
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" /> Save address
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save a destination</DialogTitle>
          <DialogDescription>
            A new address can receive spends within the daily limit right away. For anything larger it becomes usable after 7 days, and any guardian can remove it before then.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="lbl">Label</Label>
            <Input id="lbl" placeholder="Cold storage" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
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
            <Label htmlFor="adr">Address</Label>
            <Input id="adr" placeholder={chain === "NEAR" ? "name.near" : chain === "Bitcoin" ? "bc1q…" : "0x…"} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!label || !address}
            onClick={() => {
              save(label, chain, address)
              toast.add({ title: `${label} saved`, description: "Usable for large withdrawals in 7 days.", type: "success" })
              setOpen(false)
              setLabel("")
              setAddress("")
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Page() {
  const { addresses } = useVault()
  const now = useNow(30_000)
  return (
    <BaseLayout
      title="Saved addresses"
      description="Anything above the daily limit can only go to an address saved at least 7 days earlier."
      actions={<SaveAddressDialog />}
    >
      <div className="px-4 lg:px-6">
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Label</TableHead>
                  <TableHead>Chain</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Saved</TableHead>
                  <TableHead className="pr-6">Large withdrawals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addresses.map((a) => {
                  const age = now - a.savedAt
                  const ready = age >= RULE_DELAY_MS
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="pl-6 font-medium">{a.label}</TableCell>
                      <TableCell>
                        <ChainTag chain={a.chain} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.address}</TableCell>
                      <TableCell className="text-muted-foreground">{ago(age)}</TableCell>
                      <TableCell className="pr-6">
                        {ready ? (
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                            Allowed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                            In {countdown(RULE_DELAY_MS - age)}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  )
}
