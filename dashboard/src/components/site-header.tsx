import { useLocation } from "react-router-dom"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const TITLES: Record<string, string> = {
  "/overview": "Overview",
  "/withdrawals": "Withdrawals",
  "/guardians": "Guardians",
  "/addresses": "Saved addresses",
  "/rules": "Limit and delays",
  "/proof": "Proof page",
}

export function SiteHeader() {
  const { pathname } = useLocation()
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-vertical:h-4 data-vertical:self-center" />
        <span className="text-sm text-muted-foreground">Vault</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">{TITLES[pathname] ?? "Overview"}</span>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="hidden sm:inline-flex" title="Sample data; nothing here reads a chain yet">
            Mock data
          </Badge>
          <Button variant="ghost" size="sm" nativeButton={false} render={<a href="/" />}>
            Back to site
          </Button>
        </div>
      </div>
    </header>
  )
}
