import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useSidebarConfig } from "@/hooks/use-sidebar-config"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

interface BaseLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
  actions?: React.ReactNode
}

export function BaseLayout({ children, title, description, actions }: BaseLayoutProps) {
  const { config } = useSidebarConfig()
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "3rem",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant={config.variant} collapsible={config.collapsible} side="left" />
      <SidebarInset>
        <SiteHeader />
        <div className="@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
          {title && (
            <div className="flex flex-wrap items-end justify-between gap-4 px-4 lg:px-6">
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
                {description && <p className="text-muted-foreground">{description}</p>}
              </div>
              {actions && <div className="flex gap-2">{actions}</div>}
            </div>
          )}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
