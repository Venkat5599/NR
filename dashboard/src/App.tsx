import { createHashRouter, RouterProvider } from "react-router-dom"
import { SidebarConfigProvider } from "@/contexts/sidebar-context"
import { Toaster } from "@/components/ui/toast"
import { RootFallback, RootLayout } from "@/components/router/root-layout"
import { routes } from "@/config/routes"

// Hash routes (/dashboard/#/withdrawals) work on any static host without rewrites.
const router = createHashRouter([
  { element: <RootLayout />, HydrateFallback: RootFallback, children: routes },
])

export default function App() {
  return (
    <div className="font-sans antialiased">
      <SidebarConfigProvider>
        <Toaster>
          <RouterProvider router={router} />
        </Toaster>
      </SidebarConfigProvider>
    </div>
  )
}
