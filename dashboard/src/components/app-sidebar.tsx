import * as React from "react"
import { Gauge, ArrowUpRight, ShieldCheck, BookmarkCheck, Timer, Eye, Snowflake } from "lucide-react"
import { Link } from "react-router-dom"
import { Logo } from "@/components/logo"
import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useVault, usd } from "@/lib/vault"

const groups = [
  {
    label: "Vault",
    items: [
      { title: "Overview", url: "/overview", icon: Gauge },
      { title: "Withdrawals", url: "/withdrawals", icon: ArrowUpRight },
      { title: "Guardians", url: "/guardians", icon: ShieldCheck },
      { title: "Saved addresses", url: "/addresses", icon: BookmarkCheck },
    ],
  },
  {
    label: "Rules",
    items: [
      { title: "Limit and delays", url: "/rules", icon: Timer },
      { title: "Proof page", url: "/proof", icon: Eye },
    ],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { frozen, dailyLimitUsd, spentTodayUsd } = useVault()
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/overview" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Logo size={18} />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Lunar</span>
                <span className="truncate text-xs text-muted-foreground">Personal vault</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <NavMain key={g.label} label={g.label} items={g.items} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="rounded-lg border bg-background p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium">
              {frozen ? (
                <>
                  <Snowflake className="size-3.5 text-sky-600" /> Frozen
                </>
              ) : (
                <>
                  <span className="size-2 rounded-full bg-emerald-500" /> Vault active
                </>
              )}
            </span>
            <span className="text-muted-foreground">0 access keys</span>
          </div>
          <div className="mt-2 flex justify-between text-muted-foreground">
            <span>Left today</span>
            <span className="tabular-nums text-foreground">{usd(Math.max(0, dailyLimitUsd - spentTodayUsd))}</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
