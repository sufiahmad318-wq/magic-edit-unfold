import { NavLink } from '@/lib/router-compat'
import { Home, FolderKanban, LayoutTemplate, Package, User } from 'lucide-react'
import clsx from 'clsx'

const items = [
  { to: '/',          label: 'Home',      icon: Home,           end: true  },
  { to: '/templates', label: 'Templates', icon: LayoutTemplate, end: false },
  { to: '/assets',    label: 'Assets',    icon: Package,        end: false },
  { to: '/projects',  label: 'Projects',  icon: FolderKanban,   end: false },
  { to: '/profile',   label: 'Profile',   icon: User,           end: false },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-xl px-2 pb-3">
        <div className="glass rounded-2xl flex items-stretch justify-between px-1 py-1.5 shadow-2xl shadow-black/50">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[10px] font-medium transition-all',
                  isActive ? 'text-white' : 'text-white/40 hover:text-white/70',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={clsx(
                      'flex items-center justify-center w-8 h-8 rounded-xl transition-all',
                      isActive && 'bg-gradient-to-br from-blue-500 to-violet-500 glow-violet',
                    )}
                  >
                    <Icon size={16} strokeWidth={2.25} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
