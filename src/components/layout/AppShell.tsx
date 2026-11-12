import { Library, ListMusic, Settings } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import type { ReactNode } from 'react'

import { TeamSwitcher } from '@/components/layout/TeamSwitcher'
import { OfflineBanner } from '@/components/shared/OfflineBanner'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/biblioteca', label: 'Biblioteca', icon: Library },
  { to: '/setlists', label: 'Setlists', icon: ListMusic },
  { to: '/config', label: 'Config', icon: Settings },
]

/**
 * Shell do app: cabeçalho com seletor de equipe, navegação inferior no
 * mobile / lateral no desktop, área de conteúdo responsiva (≥360px).
 */
export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Cabeçalho (mobile) / lateral (desktop) */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-base font-bold">Louve Fácil</span>
          <TeamSwitcher />
        </div>
        <OfflineBanner />
      </header>

      <aside className="hidden w-60 shrink-0 border-r md:flex md:h-dvh md:flex-col">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="text-lg font-bold">Louve Fácil</span>
        </div>
        <div className="px-3 pb-2">
          <TeamSwitcher />
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-4 pb-4">
          <OfflineBanner />
        </div>
      </aside>

      <main className="flex-1 pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 md:py-6">
          {children ?? <Outlet />}
        </div>
      </main>

      {/* Navegação inferior (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t bg-background/95 backdrop-blur md:hidden">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2 text-[11px] font-medium',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
