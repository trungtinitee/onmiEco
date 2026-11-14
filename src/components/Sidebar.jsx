import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  Activity,
  Cog,
  FlaskConical,
  GitFork,
  ShieldAlert,
  Droplets,
  X,
  Gauge,
  CloudCog,
  Trash2,
  Wrench,
  Zap,
  ClipboardList,
  BookOpenCheck,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const NAV_GROUPS = [
  {
    id: 'dashboard',
    heading: 'NHÓM CHUNG (DASHBOARD)',
    items: [
      {
        to: '/',
        label: 'Tổng quan & Lưu lượng',
        shortLabel: 'Tổng quan',
        icon: LayoutDashboard,
        end: true,
      },
    ],
  },
  {
    id: 'wastewater',
    heading: '💧 MẢNG XỬ LÝ NƯỚC THẢI',
    items: [
      {
        to: '/tien-xu-ly',
        label: 'Tiền xử lý (5 công đoạn)',
        shortLabel: 'Tiền xử lý',
        hint: 'Đã bao hàm Bể điều hòa, Song chắn rác, Lắng cát, Dầu mỡ & DAF',
        icon: Layers,
      },
      {
        to: '/hoa-ly',
        label: 'Hóa lý & Lọc áp lực',
        shortLabel: 'Hóa lý',
        icon: FlaskConical,
      },
      {
        to: '/sinh-hoc',
        label: 'Xử lý sinh học (6 công nghệ)',
        shortLabel: 'Sinh học',
        icon: Activity,
      },
      {
        to: '/bun-khu-trung',
        label: 'Lắng 2, Bùn & Khử trùng',
        shortLabel: 'Bùn & Khử trùng',
        icon: Cog,
      },
    ],
  },
  {
    id: 'water-supply',
    heading: '🚰 MẢNG XỬ LÝ NƯỚC CẤP',
    items: [
      {
        to: '/cap-nuoc',
        label: 'Cấp nước cơ bản (4 công đoạn)',
        shortLabel: 'Cấp nước',
        icon: GitFork,
      },
      {
        to: '/cap-nuoc-nang-cao',
        label: 'Cấp nước nâng cao & Y tế',
        shortLabel: 'Nước Y tế / RO',
        icon: ShieldAlert,
      },
    ],
  },
  {
    id: 'air-solid-waste',
    heading: '♻️ MẢNG KHÍ THẢI & RÁC THẢI',
    items: [
      {
        to: '/khi-thai',
        label: 'Xử lý khí thải (4 công đoạn)',
        shortLabel: 'Khí thải',
        icon: CloudCog,
      },
      {
        to: '/chat-thai-ran',
        label: 'Chất thải rắn & Lò đốt',
        shortLabel: 'Chất thải rắn',
        icon: Trash2,
      },
    ],
  },
  {
    id: 'mep-om',
    heading: '⚙️ CƠ ĐIỆN MEP & VẬN HÀNH (O&M)',
    items: [
      {
        to: '/mep-thuy-luc',
        label: 'Cơ điện MEP & Thủy lực ống',
        shortLabel: 'MEP & Ống',
        icon: Wrench,
      },
      {
        to: '/dien-may-thoi-khi',
        label: 'Điện động lực & Máy thổi khí',
        shortLabel: 'Điện & Thổi khí',
        icon: Zap,
      },
      {
        to: '/van-hanh',
        label: 'Sổ tay vận hành & Hóa chất',
        shortLabel: 'Vận hành',
        icon: ClipboardList,
      },
      {
        to: '/nhat-ky-van-hanh',
        label: 'Nhật ký vận hành',
        shortLabel: 'Nhật ký',
        icon: BookOpenCheck,
      },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export default function Sidebar({ isOpen, onClose }) {
  const { globalQ, hydraulics } = useAppContext();

  return (
    <>
      {/* Mobile backdrop overlay */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-xs transition-opacity duration-200 md:hidden ${
          isOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        aria-label="Điều hướng module kỹ thuật"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-900 border-r border-slate-800 transition-transform duration-200 ease-out md:static md:w-64 lg:w-72 md:translate-x-0 shrink-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header inside sidebar */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-slate-800 shrink-0">
          <NavLink
            to="/"
            onClick={onClose}
            className="flex items-center gap-2.5 min-h-[44px] text-slate-100 font-bold tracking-tight whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-slate-950">
              <Droplets className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <span className="text-base">EnviroCalc</span>
          </NavLink>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thanh điều hướng"
            className="flex md:hidden items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Grouped Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group, groupIdx) => (
            <div key={group.id} className={groupIdx === 0 ? '' : 'mt-5'}>
              <h2 className="px-3 mb-2 text-xs uppercase font-bold tracking-wider text-slate-400">
                {group.heading}
              </h2>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      title={item.hint || item.label}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 min-h-[44px] px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                          isActive
                            ? 'bg-emerald-900/50 text-emerald-500 border border-emerald-500/30'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100 border border-transparent'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Global flow summary pinned cleanly at bottom of sidebar */}
        <div className="p-4 border-t border-slate-800 shrink-0">
          <div className="rounded-lg bg-slate-800 border border-slate-700/80 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-emerald-500" />
                Lưu lượng chung (Q)
              </span>
              <span>m³/ngày</span>
            </div>
            <div className="mt-1.5 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
              {hydraulics.qDay.toLocaleString('vi-VN')}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
              <span>{hydraulics.qHour.toFixed(2)} m³/h</span>
              <span aria-hidden="true">·</span>
              <span>{hydraulics.qSecond.toFixed(2)} L/s</span>
            </div>
            {globalQ <= 0 && (
              <p className="mt-2 text-xs text-amber-400">
                Vui lòng nhập Q &gt; 0 để tính kích thước bể.
              </p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
