import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { LOGO_BASE64 } from '../constants/branding';
import { useAppContext } from '../context/AppContext';

const HeaderFlowBadge = memo(function HeaderFlowBadge() {
  const { globalQ } = useAppContext();

  return (
    <div className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
      Q ={' '}
      <span className="font-semibold text-emerald-400">
        {Number(globalQ || 0).toLocaleString('vi-VN')}
      </span>{' '}
      m³/ng
    </div>
  );
});

const Header = memo(function Header({
  currentRoute,
  sidebarOpen,
  onOpenSidebar,
}) {
  return (
    <header className="no-print print:hidden sticky top-0 z-30 h-14 bg-slate-900/95 backdrop-blur-xs border-b border-slate-800 px-3 sm:px-4 md:px-6 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Mở menu điều hướng"
          aria-expanded={sidebarOpen}
          className="flex md:hidden items-center justify-center min-h-[44px] min-w-[44px] -ml-1 rounded-lg text-slate-200 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shrink-0"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile Logo (visible when Sidebar is collapsed on screens < md) */}
        <Link
          to="/"
          aria-label="omniEco - Về trang chủ"
          className="flex md:hidden items-center min-h-[40px] rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shrink-0"
        >
          <img
            src={LOGO_BASE64}
            alt="omniEco Logo"
            className="h-7 sm:h-8 w-auto object-contain"
          />
        </Link>

        <div className="flex items-center gap-2 min-w-0 text-sm">
          <Link
            to="/"
            className="hidden md:inline font-semibold text-slate-300 hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
          >
            omniEco
          </Link>
          <span
            className="hidden md:inline text-slate-600"
            aria-hidden="true"
          >
            /
          </span>
          <span className="hidden sm:inline font-semibold text-slate-100 truncate">
            {currentRoute.label}
          </span>
        </div>
      </div>

      <HeaderFlowBadge />
    </header>
  );
});

export default Header;
