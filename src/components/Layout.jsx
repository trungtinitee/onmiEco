import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Download,
  Menu,
  Printer,
  RotateCcw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import Sidebar, { NAV_ITEMS } from './Sidebar';
import { useAppContext } from '../context/AppContext';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [toast, setToast] = useState(null); // { ok, message }
  const fileInputRef = useRef(null);

  const {
    globalQ,
    resetDefaults,
    exportProjectJson,
    importProjectJson,
    triggerBiologyFocus,
  } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();

  const currentRoute =
    NAV_ITEMS.find((item) => item.to === location.pathname) || NAV_ITEMS[0];

  const showNotice = (ok, message) => {
    setToast({ ok, message });
    window.setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const handleResetDefaults = () => {
    resetDefaults();
    showNotice(true, 'Đã khôi phục thông số mặc định (Q = 1.000 m³/ngày).');
  };

  const handleExportJson = () => {
    exportProjectJson();
    showNotice(true, 'Đã tải xuống file thiết kế JSON.');
  };

  const handleImportFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      const result = importProjectJson(content);
      showNotice(result.ok, result.message);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePrintPdf = () => {
    window.print();
  };

  // Lọc nhanh danh sách module theo thanh tìm kiếm
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredNavItems = normalizedQuery
    ? NAV_ITEMS.filter(
        (item) =>
          item.label.toLowerCase().includes(normalizedQuery) ||
          item.shortLabel.toLowerCase().includes(normalizedQuery)
      )
    : [];

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    // LỆNH GỌI ẨN (Secret Keyword): Gõ "hay ở đâu" -> Tự động focus vào tab Sinh học
    const normalized = val.trim().toLowerCase();
    if (normalized.includes('hay ở đâu') || normalized === 'hay o dau') {
      setSearchQuery('');
      setSearchFocused(false);
      triggerBiologyFocus();
      navigate('/sinh-hoc');
      showNotice(
        true,
        'Đã kích hoạt lệnh gọi ẩn: Chuyển & focus vào phân hệ Sinh học.'
      );
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (filteredNavItems.length > 0) {
      navigate(filteredNavItems[0].to);
      setSearchQuery('');
      setSearchFocused(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-900 text-slate-200">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-xs border-b border-slate-800 px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Left: Hamburger + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Mở menu điều hướng"
              aria-expanded={sidebarOpen}
              className="flex md:hidden items-center justify-center min-h-[44px] min-w-[44px] -ml-1 rounded-lg text-slate-200 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0 text-sm">
              <Link
                to="/"
                className="hidden sm:inline text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                EnviroCalc
              </Link>
              <span
                className="hidden sm:inline text-slate-600"
                aria-hidden="true"
              >
                /
              </span>
              <span className="font-semibold text-slate-100 truncate">
                {currentRoute.label}
              </span>
            </div>
          </div>

          {/* Center/Right: Search Bar + Actions */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            {/* Search bar with Secret Keyword */}
            <form
              onSubmit={handleSearchSubmit}
              className="relative flex-1 sm:flex-initial sm:w-64"
            >
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => setSearchFocused(true)}
                onBlur={() =>
                  window.setTimeout(() => setSearchFocused(false), 180)
                }
                aria-label="Tìm nhanh công trình hoặc gõ lệnh ẩn"
                placeholder="Tìm công trình..."
                className="w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              />

              {searchFocused && filteredNavItems.length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 rounded-lg bg-slate-800 border border-slate-700 shadow-xl py-1 z-50 max-h-64 overflow-y-auto">
                  {filteredNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.to}
                        type="button"
                        onMouseDown={() => {
                          navigate(item.to);
                          setSearchQuery('');
                          setSearchFocused(false);
                        }}
                        className="w-full min-h-[44px] px-3 py-2 flex items-center gap-2.5 text-left text-xs text-slate-200 hover:bg-slate-700/70 transition-colors"
                      >
                        <Icon className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </form>

            {/* Hidden File Input for Import JSON */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFileChange}
              className="hidden"
              aria-hidden="true"
            />

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportJson}
                title="Xuất file cấu hình thiết kế JSON"
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <Download className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">Export JSON</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Nhập file cấu hình thiết kế JSON"
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <Upload className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">Import JSON</span>
              </button>

              <button
                type="button"
                onClick={handlePrintPdf}
                title="In báo cáo kỹ thuật (Print to PDF)"
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <Printer className="h-3.5 w-3.5 shrink-0" />
                <span>Xuất báo cáo</span>
              </button>

              <button
                type="button"
                onClick={handleResetDefaults}
                title="Đặt lại thông số mặc định"
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="hidden xl:inline">Mặc định</span>
              </button>
            </div>
          </div>
        </header>

        {/* Inline Toast Banner (No window.alert) */}
        {toast && (
          <div className="no-print px-4 md:px-8 pt-4">
            <div
              role="status"
              className={`mx-auto max-w-6xl rounded-lg border px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-medium ${
                toast.ok
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                  : 'bg-red-500/15 border-red-500/40 text-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="Đóng thông báo"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded hover:bg-slate-800/60 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main Content Viewport — 100% width on mobile */}
        <main className="flex-1 w-full px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-6xl">
            {/* Formal Print-to-PDF Report Header (only visible in @media print for calc pages) */}
            {location.pathname !== '/nhat-ky-van-hanh' && (
              <div className="print-only">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <div className="text-base font-bold uppercase tracking-wide">
                      Báo Cáo Tính Toán Thiết Kế Kỹ Thuật Môi Trường — EnviroCalc
                    </div>
                    <div className="text-xs mt-1">
                      Hạng mục: <strong>{currentRoute.label}</strong> · Lưu lượng
                      chung Q = {Number(globalQ || 0).toLocaleString('vi-VN')}{' '}
                      m³/ngày
                    </div>
                  </div>
                  <div className="text-xs font-mono">
                    Ngày xuất: {new Date().toLocaleDateString('vi-VN')}
                  </div>
                </div>
              </div>
            )}

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
