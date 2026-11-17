import { memo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  FileText,
  FolderKanban,
  PenTool,
  Printer,
  X,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const PRINT_OPTION_ITEMS = [
  {
    key: 'showCompanyHeader',
    label: 'Hiển thị Tiêu đề / Logo Công ty',
    description:
      'Bao gồm logo omniEco và tên Công ty TNHH Tư vấn - Đầu tư Môi trường D-V-N.',
    icon: Building2,
    iconColor: 'text-emerald-400',
  },
  {
    key: 'showProjectInfo',
    label: 'Hiển thị Thông tin dự án',
    description:
      'Tên dự án, Chủ đầu tư, Địa điểm, Công suất thiết kế và ngày xuất báo cáo.',
    icon: FolderKanban,
    iconColor: 'text-sky-400',
  },
  {
    key: 'showDetailedNotes',
    label: 'Hiển thị Ghi chú / Diễn giải chi tiết',
    description:
      'Hiển thị cột ghi chú, thông số diễn giải chi tiết và ghi chú hồ sơ dự án.',
    icon: FileText,
    iconColor: 'text-amber-400',
  },
  {
    key: 'showSignatures',
    label: 'Hiển thị phần Chữ ký ở cuối trang',
    description:
      'Khung ký xác nhận của Kỹ sư lập và Đại diện Chủ đầu tư (CĐT) ở cuối bản in.',
    icon: PenTool,
    iconColor: 'text-violet-400',
  },
];

const PrintCustomizationModal = memo(function PrintCustomizationModal() {
  const {
    currentProject,
    printOptions,
    printModalState,
    setPrintOptions,
    closePrintModal,
    confirmAndPrint,
  } = useAppContext();

  const isOpen = Boolean(printModalState?.open);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closePrintModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closePrintModal]);

  const handleToggleOption = useCallback(
    (key) => {
      setPrintOptions((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    },
    [setPrintOptions]
  );

  if (typeof document === 'undefined' || !isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-customization-title"
      onClick={closePrintModal}
      className="no-print print:hidden fixed inset-0 z-[135] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
              <Printer className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <h2
                id="print-customization-title"
                className="text-base font-bold text-slate-100 truncate"
              >
                Tùy chọn In ấn
              </h2>
              <p className="text-xs text-slate-400 truncate">
                {printModalState?.documentTitle
                  ? `${printModalState.documentTitle} · ${currentProject?.name || 'Dự án mặc định'}`
                  : `Cấu hình bố cục bản in · ${currentProject?.name || 'Dự án mặc định'}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closePrintModal}
            aria-label="Đóng tùy chọn in ấn"
            className="relative z-20 cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
          >
            <X className="h-5 w-5 pointer-events-none" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            Chọn các thành phần hiển thị trên bản in khổ chuẩn A4. Các cột thao
            tác trên web sẽ tự động ẩn, và cột Công suất (kW) sẽ tự ẩn nếu danh
            sách chỉ gồm vật tư không có động cơ.
          </p>

          <div className="space-y-2.5">
            {PRINT_OPTION_ITEMS.map((opt) => {
              const Icon = opt.icon;
              const checked = Boolean(printOptions?.[opt.key]);
              return (
                <label
                  key={opt.key}
                  htmlFor={`print-opt-${opt.key}`}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors select-none ${
                    checked
                      ? 'bg-emerald-950/30 border-emerald-500/45 hover:border-emerald-500/70'
                      : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <input
                    id={`print-opt-${opt.key}`}
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleOption(opt.key)}
                    className="mt-0.5 h-4.5 w-4.5 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/40 focus:ring-offset-0 cursor-pointer shrink-0 accent-emerald-500"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 shrink-0 ${opt.iconColor}`} />
                      <span className="text-sm font-semibold text-slate-100">
                        {opt.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                      {opt.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 z-20 flex items-center justify-end gap-2.5 bg-slate-900/90 backdrop-blur border-t border-slate-800 p-3 sm:p-4 shrink-0">
          <button
            type="button"
            onClick={closePrintModal}
            className="relative z-20 cursor-pointer select-none min-h-[42px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-300"
          >
            <span className="pointer-events-none">Hủy</span>
          </button>
          <button
            type="button"
            onClick={confirmAndPrint}
            className="relative z-20 cursor-pointer select-none inline-flex items-center gap-2 min-h-[42px] px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white transition-colors"
          >
            <Printer className="h-4 w-4 pointer-events-none shrink-0" />
            <span className="pointer-events-none">Xác nhận In</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

export default PrintCustomizationModal;
