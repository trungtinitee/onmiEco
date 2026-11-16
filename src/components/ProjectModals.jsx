import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Check,
  FolderKanban,
  MapPin,
  Plus,
  Save,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

function formatShortDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
}

/**
 * Bộ Modal Quản lý Dự án:
 * - activeModal: null | 'switch' | 'info' | 'create'
 * - Render qua createPortal vào document.body để không bị Sidebar/Header overflow cắt khung.
 */
const ProjectModals = memo(function ProjectModals({
  activeModal,
  onOpenModal,
  onClose,
  deleteTarget = null,
  onClearDeleteTarget,
}) {
  const {
    projectList,
    currentProject,
    selectProject,
    createProject,
    updateProject,
    deleteProject,
  } = useAppContext();

  const [newProjectName, setNewProjectName] = useState('');
  const [createError, setCreateError] = useState('');
  const [internalDeleteTarget, setInternalDeleteTarget] = useState(null);
  const projectToDelete = deleteTarget || internalDeleteTarget;
  const clearDeleteTarget = useCallback(() => {
    setInternalDeleteTarget(null);
    onClearDeleteTarget?.();
  }, [onClearDeleteTarget]);

  const [infoForm, setInfoForm] = useState({
    name: '',
    investor: '',
    location: '',
    capacity: '',
    notes: '',
  });
  const [infoError, setInfoError] = useState('');

  const createInputRef = useRef(null);
  const infoNameInputRef = useRef(null);

  // Đồng bộ form khi mở Modal tương ứng
  useEffect(() => {
    if (activeModal === 'create') {
      setNewProjectName('');
      setCreateError('');
      window.setTimeout(() => createInputRef.current?.focus(), 20);
    } else if (activeModal === 'info') {
      setInfoForm({
        name: currentProject?.name || '',
        investor: currentProject?.investor || '',
        location: currentProject?.location || '',
        capacity: currentProject?.capacity || '',
        notes: currentProject?.notes || '',
      });
      setInfoError('');
      window.setTimeout(() => infoNameInputRef.current?.focus(), 20);
    }
  }, [activeModal, currentProject]);

  // Đóng Modal bằng phím Escape
  useEffect(() => {
    if (!activeModal && !projectToDelete) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (projectToDelete) {
          clearDeleteTarget();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, projectToDelete, clearDeleteTarget, onClose]);

  const handleSubmitCreate = useCallback(
    (e) => {
      e.preventDefault();
      const result = createProject(newProjectName);
      if (!result?.ok) {
        setCreateError(result?.message || 'Vui lòng nhập tên dự án hợp lệ.');
        return;
      }
      setNewProjectName('');
      setCreateError('');
      onClose();
    },
    [createProject, newProjectName, onClose]
  );

  const handleSubmitInfo = useCallback(
    (e) => {
      e.preventDefault();
      if (!currentProject?.id) return;
      const result = updateProject(currentProject.id, infoForm);
      if (!result?.ok) {
        setInfoError(result?.message || 'Tên dự án là bắt buộc.');
        return;
      }
      setInfoError('');
      onClose();
    },
    [currentProject?.id, infoForm, updateProject, onClose]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!projectToDelete) return;
    deleteProject(projectToDelete.id);
    clearDeleteTarget();
  }, [deleteProject, projectToDelete, clearDeleteTarget]);

  if (typeof document === 'undefined') return null;
  if (!activeModal && !projectToDelete) return null;

  const canDelete = projectList.length > 1;

  return createPortal(
    <>
      {/* 1. Modal Chọn / Đổi Dự án */}
      {activeModal === 'switch' && !projectToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="switch-project-title"
          className="print:hidden fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg max-h-[88dvh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <FolderKanban className="h-5 w-5 text-emerald-400 shrink-0" />
                <h2
                  id="switch-project-title"
                  className="text-base font-bold text-slate-100 truncate"
                >
                  Chọn Dự án làm việc
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                  {projectList.length} dự án
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng cửa sổ"
                className="relative z-20 cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5 pointer-events-none" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-slate-800/80 p-2">
              {projectList.map((project) => {
                const isActive = project.id === currentProject.id;
                return (
                  <div
                    key={project.id}
                    className={`flex items-center justify-between gap-2.5 rounded-xl px-3.5 py-3 transition-colors ${
                      isActive
                        ? 'bg-emerald-950/45 border border-emerald-500/35'
                        : 'hover:bg-slate-800/70 border border-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        selectProject(project.id);
                        onClose();
                      }}
                      className="relative z-20 cursor-pointer flex-1 min-w-0 flex items-start gap-3 text-left"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border shrink-0 pointer-events-none ${
                          isActive
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                            : 'border-slate-600 text-transparent'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5 pointer-events-none" />
                      </span>

                      <div className="min-w-0 flex-1 space-y-1 pointer-events-none">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-sm font-semibold truncate ${
                              isActive ? 'text-emerald-300' : 'text-slate-100'
                            }`}
                          >
                            {project.name}
                          </span>
                          {project.capacity && (
                            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-300">
                              {project.capacity}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
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
                          {project.createdAt && (
                            <span>Tạo: {formatShortDate(project.createdAt)}</span>
                          )}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={!canDelete}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canDelete) return;
                        setInternalDeleteTarget(project);
                      }}
                      aria-label={`Xóa dự án ${project.name}`}
                      title={
                        canDelete
                          ? `Xóa dự án "${project.name}"`
                          : 'Không thể xóa dự án cuối cùng'
                      }
                      className="relative z-20 cursor-pointer select-none shrink-0 inline-flex items-center justify-center min-h-[36px] min-w-[36px] p-1.5 rounded-lg bg-slate-800/90 hover:bg-red-950/80 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-slate-800/90 border border-slate-700 hover:border-red-500/50 text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 pointer-events-none" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2.5 px-5 py-3.5 bg-slate-950/70 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => onOpenModal?.('create')}
                className="relative z-20 cursor-pointer select-none inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm font-semibold text-white transition-colors"
              >
                <Plus className="h-4 w-4 pointer-events-none shrink-0" />
                <span className="pointer-events-none">Tạo dự án mới</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="relative z-20 cursor-pointer select-none min-h-[40px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-medium text-slate-300"
              >
                <span className="pointer-events-none">Đóng</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Thông tin Dự án */}
      {activeModal === 'info' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-info-title"
          className="print:hidden fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg max-h-[90dvh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
              <div>
                <h2
                  id="project-info-title"
                  className="text-base font-bold text-slate-100 flex items-center gap-2"
                >
                  <FolderKanban className="h-5 w-5 text-sky-400" />
                  <span>Thông tin Dự án</span>
                </h2>
                {currentProject?.createdAt && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ngày tạo: {formatShortDate(currentProject.createdAt)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng cửa sổ"
                className="relative z-20 cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5 pointer-events-none" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitInfo}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {infoError && (
                <div className="rounded-lg bg-red-950/60 border border-red-500/50 px-3 py-2 text-xs text-red-200">
                  {infoError}
                </div>
              )}

              <div>
                <label
                  htmlFor="project-info-name"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Tên dự án <span className="text-red-400">*</span>
                </label>
                <input
                  ref={infoNameInputRef}
                  id="project-info-name"
                  type="text"
                  required
                  value={infoForm.name}
                  onChange={(e) => {
                    setInfoForm((prev) => ({ ...prev, name: e.target.value }));
                    if (infoError) setInfoError('');
                  }}
                  placeholder="VD: Trạm XLNT KCN Long Thành"
                  className="w-full min-h-[42px] rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="project-info-investor"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Chủ đầu tư
                  </label>
                  <input
                    id="project-info-investor"
                    type="text"
                    value={infoForm.investor}
                    onChange={(e) =>
                      setInfoForm((prev) => ({
                        ...prev,
                        investor: e.target.value,
                      }))
                    }
                    placeholder="VD: Công ty CP Phát triển KCN..."
                    className="w-full min-h-[42px] rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div>
                  <label
                    htmlFor="project-info-capacity"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Công suất
                  </label>
                  <input
                    id="project-info-capacity"
                    type="text"
                    value={infoForm.capacity}
                    onChange={(e) =>
                      setInfoForm((prev) => ({
                        ...prev,
                        capacity: e.target.value,
                      }))
                    }
                    placeholder="VD: 2.500 m³/ngày đêm"
                    className="w-full min-h-[42px] rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="project-info-location"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Địa điểm
                </label>
                <input
                  id="project-info-location"
                  type="text"
                  value={infoForm.location}
                  onChange={(e) =>
                    setInfoForm((prev) => ({
                      ...prev,
                      location: e.target.value,
                    }))
                  }
                  placeholder="VD: Huyện Long Thành, Tỉnh Đồng Nai"
                  className="w-full min-h-[42px] rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div>
                <label
                  htmlFor="project-info-notes"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Ghi chú
                </label>
                <textarea
                  id="project-info-notes"
                  rows={3}
                  value={infoForm.notes}
                  onChange={(e) =>
                    setInfoForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Tiêu chuẩn xả thải áp dụng (QCVN 40:2011/BTNMT cột A), tiến độ, yêu cầu công nghệ..."
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 resize-y"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="relative z-20 cursor-pointer select-none min-h-[40px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-300"
                >
                  <span className="pointer-events-none">Đóng</span>
                </button>
                <button
                  type="submit"
                  className="relative z-20 cursor-pointer select-none inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white"
                >
                  <Save className="h-4 w-4 pointer-events-none shrink-0" />
                  <span className="pointer-events-none">Lưu thay đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal Tạo Dự án Mới */}
      {activeModal === 'create' && (
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
                onClick={onClose}
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
                  onClick={onClose}
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
        </div>
      )}

      {/* 4. Modal Xác nhận Xóa Dự án */}
      {projectToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-project-title"
          className="print:hidden fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
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
                onClick={clearDeleteTarget}
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
                  onClick={clearDeleteTarget}
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
        </div>
      )}
    </>,
    document.body
  );
});

export default ProjectModals;
