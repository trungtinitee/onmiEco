import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BookOpenCheck,
  ChevronDown,
  ClipboardList,
  CloudCog,
  Cog,
  Download,
  Droplets,
  FlaskConical,
  Gauge,
  GitFork,
  Home,
  Layers,
  Package,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  Trash2,
  Upload,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { LOGO_BASE64 } from '../constants/branding';

export const DASHBOARD_ITEM = {
  to: '/',
  label: 'Trang chủ',
  shortLabel: 'Trang chủ',
  icon: Home,
  end: true,
};

export const ACCORDION_GROUPS = [
  {
    id: 'wastewater',
    group: 'MẢNG XỬ LÝ NƯỚC THẢI',
    icon: Droplets,
    items: [
      {
        to: '/thong-so-dau-vao',
        label: 'Thông số đầu vào (Q, Kh...)',
        shortLabel: 'Thông số đầu vào',
        hint: 'Lưu lượng Q, Hệ số Kh & Nồng độ ô nhiễm BOD5, COD, SS, TN, TP',
        icon: Gauge,
      },
      {
        to: '/tien-xu-ly',
        label: 'Tiền xử lý (Song chắn, Lắng cát, Điều hòa)',
        shortLabel: 'Tiền xử lý',
        hint: 'Song chắn rác, Lắng cát, Tách dầu mỡ & Bể điều hòa',
        icon: Layers,
      },
      {
        to: '/hoa-ly',
        label: 'Xử lý Hóa lý (Bậc 1)',
        shortLabel: 'Hóa lý (Bậc 1)',
        hint: 'Keo tụ, Tạo bông, Lắng hóa lý & Tuyển nổi DAF',
        icon: FlaskConical,
      },
      {
        to: '/sinh-hoc',
        label: 'Sinh học & Lắng 2 (Bậc 2)',
        shortLabel: 'Sinh học & Lắng 2',
        hint: 'UASB, Anoxic, Aerotank, SBR, MBBR, MBR & Bể Lắng 2 (MLSS / RAS)',
        icon: Activity,
      },
      {
        to: '/hoan-thien-khu-trung',
        label: 'Hoàn thiện & Khử trùng (Bậc 3)',
        shortLabel: 'Hoàn thiện (Bậc 3)',
        hint: 'Bồn Lọc áp lực đa tầng & Khử trùng Clo / UV / Ozone',
        icon: ShieldCheck,
      },
      {
        to: '/xu-ly-bun',
        label: 'Quản lý Bùn cặn (Tuyến bùn)',
        shortLabel: 'Quản lý Bùn',
        hint: 'Nén bùn đứng, Máy ép bùn & Sân phơi bùn',
        icon: Cog,
      },
    ],
  },
  {
    id: 'water-supply',
    group: 'MẢNG XỬ LÝ NƯỚC CẤP',
    icon: GitFork,
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
    group: 'MẢNG KHÍ THẢI & RÁC THẢI',
    icon: CloudCog,
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
    group: 'CƠ ĐIỆN MEP & VẬN HÀNH (O&M)',
    icon: Wrench,
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
      {
        to: '/chan-doan-sinh-hoc',
        label: 'Chẩn đoán Bể Sinh học',
        shortLabel: 'Chẩn đoán',
        hint: 'Tra cứu hiện tượng bọt, bùn, mùi, nước sau lắng & checklist xử lý',
        icon: Stethoscope,
      },
      {
        to: '/kho-thiet-bi',
        label: 'Kho Thiết bị Cơ điện',
        shortLabel: 'Kho Thiết bị',
        hint: 'Quản lý danh mục bơm, máy thổi khí, khuấy trộn, van & Import/Export JSON',
        icon: Package,
      },
      {
        to: '/mua-sam',
        label: 'Danh mục Mua sắm (BOM)',
        shortLabel: 'Mua sắm (BOM)',
        hint: 'Tổng hợp thiết bị cần mua sắm toàn dự án, số lượng, ghi chú & tổng công suất',
        icon: ShoppingCart,
      },
    ],
  },
];

// Giữ tương thích với Layout/Header đang import NAV_GROUPS & NAV_ITEMS
export const NAV_GROUPS = [
  {
    id: 'dashboard',
    heading: 'NHÓM CHUNG (DASHBOARD)',
    items: [DASHBOARD_ITEM],
  },
  ...ACCORDION_GROUPS.map((g) => ({
    id: g.id,
    heading: g.group,
    items: g.items,
  })),
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

function findGroupIdByPath(pathname) {
  const matched = ACCORDION_GROUPS.find((group) =>
    group.items.some((item) => item.to === pathname)
  );
  return matched ? matched.id : null;
}

const Sidebar = memo(function Sidebar({ isOpen, onClose, onNotify }) {
  const location = useLocation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroup, setExpandedGroup] = useState(
    () => findGroupIdByPath(location.pathname) || 'wastewater'
  );

  const {
    globalQ,
    hydraulics,
    resetDefaults,
    exportProjectJson,
    importProjectJson,
    triggerBiologyFocus,
  } = useAppContext();

  // Tự động mở đúng nhóm khi người dùng điều hướng sang một route mới
  useEffect(() => {
    const activeGroupId = findGroupIdByPath(location.pathname);
    if (activeGroupId) {
      setExpandedGroup(activeGroupId);
    }
  }, [location.pathname]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const visibleGroups = useMemo(() => {
    if (!isSearching) return ACCORDION_GROUPS;
    return ACCORDION_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(normalizedQuery) ||
          item.shortLabel.toLowerCase().includes(normalizedQuery) ||
          (item.hint && item.hint.toLowerCase().includes(normalizedQuery))
      ),
    })).filter((group) => group.items.length > 0);
  }, [isSearching, normalizedQuery]);

  const dashboardMatchesSearch =
    !isSearching ||
    DASHBOARD_ITEM.label.toLowerCase().includes(normalizedQuery) ||
    DASHBOARD_ITEM.shortLabel.toLowerCase().includes(normalizedQuery);

  const firstMatchedItem = useMemo(() => {
    if (isSearching && dashboardMatchesSearch) return DASHBOARD_ITEM;
    return visibleGroups[0]?.items[0] || null;
  }, [isSearching, dashboardMatchesSearch, visibleGroups]);

  const handleToggleGroup = useCallback((groupId) => {
    setExpandedGroup((prev) => (prev === groupId ? null : groupId));
  }, []);

  const handleSearchChange = useCallback(
    (e) => {
      const val = e.target.value;
      setSearchQuery(val);

      // LỆNH GỌI ẨN (Secret Keyword): Gõ "hay ở đâu" -> Tự động focus vào tab Sinh học
      const normalized = val.trim().toLowerCase();
      if (normalized.includes('hay ở đâu') || normalized === 'hay o dau') {
        setSearchQuery('');
        triggerBiologyFocus();
        navigate('/sinh-hoc');
        onClose?.();
        onNotify?.(
          true,
          'Đã kích hoạt lệnh gọi ẩn: Chuyển & focus vào phân hệ Sinh học.'
        );
      }
    },
    [triggerBiologyFocus, navigate, onClose, onNotify]
  );

  const handleSearchSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (firstMatchedItem) {
        navigate(firstMatchedItem.to);
        setSearchQuery('');
        onClose?.();
      }
    },
    [firstMatchedItem, navigate, onClose]
  );

  const handleExportJson = useCallback(() => {
    exportProjectJson();
    onNotify?.(true, 'Đã tải xuống file thiết kế JSON.');
    onClose?.();
  }, [exportProjectJson, onNotify, onClose]);

  const handleImportFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = String(event.target?.result || '');
        const result = importProjectJson(content);
        onNotify?.(result.ok, result.message);
        onClose?.();
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [importProjectJson, onNotify, onClose]
  );

  const handleResetDefaults = useCallback(() => {
    resetDefaults();
    onNotify?.(true, 'Đã khôi phục thông số mặc định (Q = 1.000 m³/ngày).');
    onClose?.();
  }, [resetDefaults, onNotify, onClose]);

  const handleNavClick = useCallback(() => {
    setSearchQuery('');
    onClose?.();
  }, [onClose]);

  const handleTriggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const activePathGroupId = useMemo(
    () => findGroupIdByPath(location.pathname),
    [location.pathname]
  );

  const DashboardIcon = DASHBOARD_ITEM.icon;
  const utilitiesExpanded = expandedGroup === 'utilities';

  return (
    <>
      {/* Mobile backdrop overlay */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`no-print print:hidden fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-xs transition-opacity duration-200 md:hidden ${
          isOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        aria-label="Điều hướng module kỹ thuật"
        className={`no-print print:hidden fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-900 border-r border-slate-800 transition-transform duration-200 ease-out md:static md:w-64 lg:w-72 md:translate-x-0 shrink-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header inside sidebar */}
        <div className="flex items-center justify-between px-4 pt-4 pb-4 border-b border-slate-800 shrink-0">
          <NavLink
            to="/"
            onClick={onClose}
            aria-label="omniEco - Trang chủ"
            className="flex items-center ml-2 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg"
          >
            <img
              src={LOGO_BASE64}
              alt="omniEco Logo"
              className="h-11 w-auto object-contain"
            />
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

        {/* Search Bar at Top of Sidebar */}
        <div className="px-3 pt-4 pb-3 border-b border-slate-800/80 shrink-0">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={handleSearchChange}
              aria-label="Tìm nhanh công trình hoặc gõ lệnh ẩn"
              placeholder="Tìm công trình..."
              className="w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
            />
          </form>
        </div>

        {/* Navigation: Standalone Dashboard + Accordion Groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {/* Nút Trang chủ độc lập ở trên cùng */}
          {dashboardMatchesSearch && (
            <NavLink
              to={DASHBOARD_ITEM.to}
              end={DASHBOARD_ITEM.end}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `flex items-center gap-3 min-h-[44px] px-3.5 py-2.5 rounded-r-lg rounded-l-sm text-sm font-semibold transition-all duration-200 border-l-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  isActive
                    ? 'bg-emerald-900/50 text-emerald-400 border-emerald-500 shadow-xs'
                    : 'border-transparent text-slate-200 hover:bg-slate-800/80 hover:text-white'
                }`
              }
            >
              <DashboardIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{DASHBOARD_ITEM.label}</span>
            </NavLink>
          )}

          {/* Danh sách các nhóm Accordion */}
          {visibleGroups.length === 0 && !dashboardMatchesSearch ? (
            <div className="px-3 py-5 text-xs text-slate-400 text-center">
              Không tìm thấy công trình phù hợp với &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            <div className="space-y-1.5 pt-1">
              {visibleGroups.map((group) => {
                const GroupIcon = group.icon;
                const isExpanded = isSearching || expandedGroup === group.id;
                const hasActiveChild = activePathGroupId === group.id;

                return (
                  <div
                    key={group.id}
                    className="rounded-lg border border-slate-800/60 bg-slate-900/60"
                  >
                    {/* Group Header Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleGroup(group.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`sidebar-group-${group.id}`}
                      className={`group w-full flex items-center justify-between gap-2 min-h-[44px] px-3 py-2.5 rounded-lg text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                        isExpanded
                          ? 'bg-slate-800/70 text-slate-100'
                          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <GroupIcon
                          className={`h-4 w-4 shrink-0 transition-colors duration-200 ${
                            isExpanded || hasActiveChild
                              ? 'text-emerald-400'
                              : 'text-slate-400 group-hover:text-emerald-400'
                          }`}
                        />
                        <span
                          className={`text-xs font-bold uppercase tracking-wider truncate transition-colors duration-200 ${
                            isExpanded || hasActiveChild
                              ? 'text-slate-100'
                              : 'text-slate-400 group-hover:text-slate-100'
                          }`}
                        >
                          {group.group}
                        </span>
                      </span>

                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
                          isExpanded
                            ? 'rotate-180 text-emerald-400'
                            : 'rotate-0 text-slate-500 group-hover:text-slate-200'
                        }`}
                      />
                    </button>

                    {/* Sub-menu Accordion Body with smooth CSS Grid transition */}
                    <div
                      id={`sidebar-group-${group.id}`}
                      className={`grid transition-all duration-300 ease-in-out ${
                        isExpanded
                          ? 'grid-rows-[1fr] opacity-100'
                          : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="py-1.5 pr-1.5 space-y-1">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            return (
                              <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                title={item.hint || item.label}
                                tabIndex={isExpanded ? 0 : -1}
                                onClick={handleNavClick}
                                className={({ isActive }) =>
                                  `flex items-center gap-2.5 min-h-[42px] pl-8 pr-3 py-2 rounded-r-lg text-sm font-medium transition-colors duration-200 border-l-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                                    isActive
                                      ? 'bg-emerald-900/50 text-emerald-400 border-emerald-500'
                                      : 'border-transparent text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Nhóm Tiện ích Cấu hình (Accordion để tiết kiệm không gian dọc) */}
          <div className="pt-2 border-t border-slate-800">
            {/* Hidden File Input for Import JSON */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFileChange}
              className="hidden"
              aria-hidden="true"
            />

            <div className="rounded-lg border border-slate-800/60 bg-slate-900/60">
              <button
                type="button"
                onClick={() => handleToggleGroup('utilities')}
                aria-expanded={utilitiesExpanded}
                aria-controls="sidebar-group-utilities"
                className={`group w-full flex items-center justify-between gap-2 min-h-[44px] px-3 py-2.5 rounded-lg text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  utilitiesExpanded
                    ? 'bg-slate-800/70 text-slate-100'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Settings
                    className={`h-4 w-4 shrink-0 transition-colors duration-200 ${
                      utilitiesExpanded
                        ? 'text-emerald-400'
                        : 'text-slate-400 group-hover:text-emerald-400'
                    }`}
                  />
                  <span
                    className={`text-xs font-bold uppercase tracking-wider truncate transition-colors duration-200 ${
                      utilitiesExpanded
                        ? 'text-slate-100'
                        : 'text-slate-400 group-hover:text-slate-100'
                    }`}
                  >
                    TIỆN ÍCH CẤU HÌNH
                  </span>
                </span>

                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
                    utilitiesExpanded
                      ? 'rotate-180 text-emerald-400'
                      : 'rotate-0 text-slate-500 group-hover:text-slate-200'
                  }`}
                />
              </button>

              <div
                id="sidebar-group-utilities"
                className={`grid transition-all duration-300 ease-in-out ${
                  utilitiesExpanded
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="py-1.5 pr-1.5 space-y-1">
                    <button
                      type="button"
                      tabIndex={utilitiesExpanded ? 0 : -1}
                      onClick={handleExportJson}
                      title="Xuất file cấu hình thiết kế JSON"
                      className="w-full flex items-center gap-2.5 min-h-[42px] pl-8 pr-3 py-2 rounded-r-lg text-sm font-medium text-slate-300 hover:bg-slate-800/80 hover:text-slate-100 border-l-4 border-transparent transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <Download className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span className="truncate">Export JSON</span>
                    </button>

                    <button
                      type="button"
                      tabIndex={utilitiesExpanded ? 0 : -1}
                      onClick={handleTriggerFileInput}
                      title="Nhập file cấu hình thiết kế JSON"
                      className="w-full flex items-center gap-2.5 min-h-[42px] pl-8 pr-3 py-2 rounded-r-lg text-sm font-medium text-slate-300 hover:bg-slate-800/80 hover:text-slate-100 border-l-4 border-transparent transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <Upload className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span className="truncate">Import JSON</span>
                    </button>

                    <button
                      type="button"
                      tabIndex={utilitiesExpanded ? 0 : -1}
                      onClick={handleResetDefaults}
                      title="Đặt lại thông số mặc định"
                      className="w-full flex items-center gap-2.5 min-h-[42px] pl-8 pr-3 py-2 rounded-r-lg text-sm font-medium text-slate-300 hover:bg-slate-800/80 hover:text-slate-100 border-l-4 border-transparent transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <RotateCcw className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="truncate">Khôi phục mặc định</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
});

export default Sidebar;
