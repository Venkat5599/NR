import type { ComponentType } from "react"
import { Navigate, type RouteObject } from "react-router-dom"

function page(load: () => Promise<{ default: ComponentType }>) {
  return async () => ({ Component: (await load()).default })
}

export const routes: RouteObject[] = [
  { path: "/", element: <Navigate to="/overview" replace /> },
  { path: "/overview", lazy: page(() => import("@/app/overview/page")) },
  { path: "/withdrawals", lazy: page(() => import("@/app/withdrawals/page")) },
  { path: "/guardians", lazy: page(() => import("@/app/guardians/page")) },
  { path: "/addresses", lazy: page(() => import("@/app/addresses/page")) },
  { path: "/rules", lazy: page(() => import("@/app/rules/page")) },
  { path: "/proof", lazy: page(() => import("@/app/proof/page")) },
  { path: "*", element: <Navigate to="/overview" replace /> },
]
