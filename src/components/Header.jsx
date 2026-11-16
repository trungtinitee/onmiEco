import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  FolderKanban,
  MapPin,
  Menu,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { LOGO_BASE64 } from '../constants/branding';
import { useAppContext } from '../context/AppContext';
import ProjectModals from './ProjectModals';

const HeaderProjectDropdown = memo(function HeaderProjectDropdown() {
  const location = useLocation();
  const { projectList, currentProject, selectProject } = useAppContext();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // null | 'info' | 'create'
  const [deleteTarget, setDeleteTarget] = useState(null);
  const dropdownRef = useRef(null);

  const handleCloseModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const handleClearDeleteTarget = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  // Đóng dropdown khi click ra ngoài hoặc nhấn Escape
  useEffect(() => {
    if (!dropdownOpen) return undefined;
    const handlePointerDown = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  // Đóng dropdown khi điều hướng sang route khác
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  const canDelete = projectList.length > 1;

  return (
    <>
      <div ref={dropdownRef} className="relative min-w-0 shrink-0">
        <button
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          aria-expanded={dropdownOpen}
          aria-haspopup="menu"
          title={currentProject.name}
          className={`inline-flex items-center gap-1.5 sm:gap-2 min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs sm:text-sm text-slate-100 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            dropdownOpen
              ? 'bg-slate-800 border-emerald-500/60'
              : 'bg-slate-800/40 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
          }`}
        >
          <FolderKanban className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400 shrink-0" />
          <span className="font-semibold truncate max-w-[130px] sm:max-w-[200px] md:max-w-xs">
            {currentProject.name}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
              dropdownOpen ? 'rotate-180 text-emerald-400' : ''
            }`}
          />
        </button>

        {dropdownOpen && (
          <div
            role="menu"
            aria-label="Quản lý dự án"
            className="absolute right-0 top-full mt-2 z-50 w-[min(90vw,320px)] sm:w-80 origin-top-right rounded-xl bg-slate-900 border border-slate-700/90 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800 bg-slate-950/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Danh sách dự án
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {projectList.length} dự án
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto overscroll-contain divide-y divide-slate-800/70 p-1.5">
              {projectList.map((project) => {
                const isActive = project.id === currentProject.id;
                return (
                  <div
                    key={project.id}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition-colors ${
                      isActive
                        ? 'bg-emerald-950/45 border border-emerald-500/35'
                        : 'hover:bg-slate-800/70 border border-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        selectProject(project.id);
                        setDropdownOpen(false);
                      }}
                      className="flex-1 min-w-0 flex items-start gap-2.5 text-left cursor-pointer"
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border shrink-0 ${
                          isActive
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                            : 'border-slate-600 text-transparent'
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </span>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs sm:text-sm font-semibold truncate ${
                              isActive ? 'text-emerald-300' : 'text-slate-100'
                            }`}
                          >
                            {project.name}
                          </span>
                          {project.capacity && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-300 shrink-0">
                              {project.capacity}
                            </span>
                          )}
                        </div>

                        {(project.investor || project.location) && (
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-400">
                            {project.investor && (
                              <span className="inline-flex items-center gap-1 truncate max-w-full">
                                <UserCheck className="h-3 w-3 text-slate-500 shrink-0" />
                                <span className="truncate">{project.investor}</span>
                              </span>
                            )}
                            {project.location && (
                              <span className="inline-flex items-center gap-1 truncate max-w-full">
                                <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
                                <span className="truncate">{project.location}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={!canDelete}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canDelete) return;
                        setDropdownOpen(false);
                        setDeleteTarget(project);
                      }}
                      aria-label={`Xóa dự án ${project.name}`}
                      title={
                        canDelete
                          ? `Xóa dự án "${project.name}"`
                          : 'Không thể xóa dự án cuối cùng'
                      }
                      className="shrink-0 inline-flex items-center justify-center min-h-[32px] min-w-[32px] p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/60 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="p-2 bg-slate-950/75 border-t border-slate-800 space-y-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setDropdownOpen(false);
                  setActiveModal('info');
                }}
                className="w-full flex items-center gap-2 min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs sm:text-sm font-medium text-slate-200 hover:text-sky-300 transition-colors cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                <span>Thông tin dự án</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setDropdownOpen(false);
                  setActiveModal('create');
                }}
                className="w-full flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm font-semibold text-white transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>Tạo dự án mới</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <ProjectModals
        activeModal={activeModal}
        onOpenModal={setActiveModal}
        onClose={handleCloseModal}
        deleteTarget={deleteTarget}
        onClearDeleteTarget={handleClearDeleteTarget}
      />
    </>
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
            className="h-6 sm:h-8 w-auto object-contain"
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

      <HeaderProjectDropdown />
    </header>
  );
});

export default Header;
