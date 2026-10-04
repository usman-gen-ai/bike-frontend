import { NavLink, useNavigate } from 'react-router-dom'
import { ArrowRightOnRectangleIcon, FilmIcon, Squares2X2Icon } from '@heroicons/react/24/outline'
import { auth } from '@lib/api'
import { cn } from '@lib/utils'

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-semibold transition-colors',
    isActive ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white hover:bg-white/10'
  )

/** Fixed top bar shared by every admin page. Pages must leave pt-14 for it. */
export const AppHeader = () => {
  const navigate = useNavigate()

  const logout = async () => {
    await auth.logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 bg-[#0b1020]/95 backdrop-blur border-b border-white/10">
      <div className="h-full max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff7a59] to-[#ff5a36] grid place-items-center text-base shrink-0">🏍️</div>
          <span className="font-display font-extrabold text-white tracking-tight hidden sm:block">Bike Admin</span>

          <nav className="flex items-center gap-1 sm:ml-4">
            <NavLink to="/" end className={tab}>
              <Squares2X2Icon className="w-4 h-4" /> Models
            </NavLink>
            <NavLink to="/video-studio" className={tab}>
              <FilmIcon className="w-4 h-4" /> Video Tool
            </NavLink>
          </nav>
        </div>

        <button
          onClick={logout}
          title="Sign out"
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
