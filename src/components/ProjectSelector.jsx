import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  FolderKanban,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

function formatShortDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
}

const ProjectSelector = memo(function ProjectSelector() {
  const {
    projectList,
    currentProject,
    selectProject,
    createProject,
    deleteProject,
  } = useAppContext();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [createError, setCreateError] = useState('');
  const [projectToDelete, setProjectToDelete] = useState(null);

  const containerRef = useRef(null);
  const createInputRef = useRef(null);

  // Đóng dropdown khi click ra ngoài hoặc bấm Escape
  useEffect(() => {
    if (!dropdownOpen) return undefined;

    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  // Đóng các modal bằng phím Escape & tự động focus ô nhập tên dự án
  useEffect(() => {
    if (!createModalOpen && !projectToDelete) return undefined;

    if (createModalOpen) {
      window.setTimeout(() => createInputRef.current?.focus(), 20);
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setCreateModalOpen(false);
        setProjectToDelete(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createModalOpen, projectToDelete]);

  const handleOpenCreateModal = useCallback(() => {
    setDropdownOpen(false);
    setNewProjectName('');
    setCreateError('');
    setCreateModalOpen(true);
  }, []);

  const handleSubmitCreate = useCallback(
    (e) => {
      e.preventDefault();
      const result = createProject(newProjectName);
      if (!result?.ok) {
        setCreateError(result?.message || 'Vui lòng nhập tên dự án hợp lệ.');
        return;
      }
      setCreateModalOpen(false);
      setNewProjectName('');
      setCreateError('');
    },
    [createProject, newProjectName]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!projectToDelete) return;
    deleteProject(projectToDelete.id);
    setProjectToDelete(null);
  }, [deleteProject, projectToDelete]);

  const canDelete = projectList.length > 1;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setDropdownOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={dropdownOpen}
        aria-label={`Dự án đang chọn: ${currentProject.name}`}
        className="relative z-20 cursor-pointer select-none inline-flex items-center gap-1.5 sm:gap-2 min-h-[36px] max-w-[140px] sm:max-w-[210px] md:max-w-[250px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 hover:border-emerald-500/50 text-xs font-medium text-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <FolderKanban className="h-3.5 w-3.5 text-emerald-400 pointer-events-none shrink-0" />
        <span className="hidden lg:inline text-slate-400 pointer-events-none shrink-0">
          Dự án:
        </span>
        <span className="truncate font-semibold text-slate-100 pointer-events-none">
          {currentProject.name}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 pointer-events-none shrink-0 transition-transform duration-150 ${
            dropdownOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {dropdownOpen && (
        <div
          role="listbox"
          aria-label="Chọn dự án làm việc"
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/70 border-b border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Chuyển đổi dự án
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {projectList.length} dự án
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto overscroll-contain divide-y divide-slate-800/70">
            {projectList.map((project) => {
              const isActive = project.id === currentProject.id;
              return (
                <div
                  key={project.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 transition-colors ${
                    isActive ? 'bg-emerald-950/40' : 'hover:bg-slate-800/70'
                  }`}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      selectProject(project.id);
                      setDropdownOpen(false);
                    }}
                    className="relative z-20 cursor-pointer flex-1 min-w-0 flex items-start gap-2.5 text-left"
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border shrink-0 pointer-events-none ${
                        isActive
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : 'border-slate-600 text-transparent'
                      }`}
                    >
                      <Check className="h-3 w-3 pointer-events-none" />
                    </span>
                    <div className="min-w-0 flex-1 pointer-events-none">
                      <div
                        className={`text-sm font-semibold truncate ${
                          isActive ? 'text-emerald-300' : 'text-slate-100'
                        }`}
                      >
                        {project.name}
                      </div>
                      {project.createdAt && (
                        <div className="text-[11px] text-slate-400">
                          Tạo ngày: {formatShortDate(project.createdAt)}
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
                      setProjectToDelete(project);
                    }}
                    aria-label={`Xóa dự án ${project.name}`}
                    title={
                      canDelete
                        ? `Xóa dự án "${project.name}"`
                        : 'Không thể xóa dự án cuối cùng'
                    }
                    className="relative z-20 cursor-pointer select-none shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg bg-slate-800/80 hover:bg-red-950/80 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-slate-800/80 border border-slate-700 hover:border-red-500/50 text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5 pointer-events-none" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="p-2.5 bg-slate-950/70 border-t border-slate-800">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="relative z-20 cursor-pointer select-none w-full inline-flex items-center justify-center gap-2 min-h-[38px] px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors"
            >
              <Plus className="h-4 w-4 pointer-events-none shrink-0" />
              <span className="pointer-events-none">Tạo dự án mới</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Tạo Dự án Mới (Portal để không bị header sticky/backdrop-blur cắt khung) */}
      {createModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
            className="print:hidden fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
          >
            <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                <h2
                  id="create-project-title"
                  className="text-base font-bold text-slate-100 flex items-center gap-2"
                >
                  <FolderKanban className="h-5 w-5 text-emerald-400" />
                  <span>Tạo dự án mới</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  aria-label="Đóng cửa sổ"
                  className="relative z-20 cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="h-5 w-5 pointer-events-none" />
                </button>
              </div>

              <form onSubmit={handleSubmitCreate} className="p-5 space-y-4">
                <div>
                  <label
                    htmlFor="new-project-name"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Tên dự án <span className="text-red-400">*</span>
                  </label>
                  <input
                    ref={createInputRef}
                    id="new-project-name"
                    type="text"
                    required
                    value={newProjectName}
                    onChange={(e) => {
                      setNewProjectName(e.target.value);
                      if (createError) setCreateError('');
                    }}
                    placeholder="VD: Trạm XLNT KCN Long Thành - 5.000 m³/ng"
                    className="w-full min-h-[42px] rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  />
                  {createError && (
                    <p className="mt-1.5 text-xs text-red-400">{createError}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    Dự án mới sẽ được kích hoạt ngay với Danh mục Mua sắm (BOM)
                    và Nhật ký vận hành tách biệt hoàn toàn.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="relative z-20 cursor-pointer select-none min-h-[40px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-300"
                  >
                    <span className="pointer-events-none">Hủy</span>
                  </button>
                  <button
                    type="submit"
                    className="relative z-20 cursor-pointer select-none inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white"
                  >
                    <Plus className="h-4 w-4 pointer-events-none shrink-0" />
                    <span className="pointer-events-none">Tạo dự án</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Xác nhận Xóa Dự án */}
      {projectToDelete &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
            className="print:hidden fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
          >
            <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                <h2
                  id="delete-project-title"
                  className="text-base font-bold text-red-400 flex items-center gap-2"
                >
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span>Xác nhận xóa dự án</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setProjectToDelete(null)}
                  aria-label="Đóng cửa sổ"
                  className="relative z-20 cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="h-5 w-5 pointer-events-none" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-sm text-slate-300 leading-relaxed">
                  Bạn có chắc chắn muốn xóa dự án{' '}
                  <strong className="text-white">
                    &ldquo;{projectToDelete.name}&rdquo;
                  </strong>
                  ?
                </p>
                <div className="rounded-lg bg-red-950/40 border border-red-500/40 p-3 text-xs text-red-200 leading-relaxed">
                  Toàn bộ dữ liệu Danh mục Mua sắm (BOM) và Nhật ký vận hành của
                  dự án này sẽ bị xóa khỏi trình duyệt và không thể khôi phục.
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setProjectToDelete(null)}
                    className="relative z-20 cursor-pointer select-none min-h-[40px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-300"
                  >
                    <span className="pointer-events-none">Hủy</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="relative z-20 cursor-pointer select-none inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white"
                  >
                    <Trash2 className="h-4 w-4 pointer-events-none shrink-0" />
                    <span className="pointer-events-none">Xác nhận xóa</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
});

export default ProjectSelector;
