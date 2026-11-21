import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  FileText,
  FolderKanban,
  Layers,
  PenTool,
  Printer,
  X,
} from 'lucide-react';
import { DEFAULT_CONTRACTOR_NAME, useAppContext } from '../context/AppContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

const PRINT_OPTION_ITEMS = [
  {
    key: 'showCompanyHeader',
    label: 'Hiển thị Tiêu đề / Logo Công ty',
    description:
      'Bao gồm logo omniEco và tên Nhà thầu / Đơn vị thực hiện ở đầu trang in.',
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
    updateProject,
    printOptions,
    printModalState,
    availableUnitProcesses,
    selectedUnitProcesses,
    setSelectedUnitProcesses,
    setPrintOptions,
    closePrintModal,
    confirmAndPrint,
  } = useAppContext();

  const isOpen = Boolean(printModalState?.open);
  const [contractorInput, setContractorInput] = useState(
    DEFAULT_CONTRACTOR_NAME
  );
  const selectAllRef = useRef(null);

  const hasUnitProcessFilter = availableUnitProcesses.length > 0;
  const selectedUnitProcessSet = useMemo(
    () => new Set(selectedUnitProcesses),
    [selectedUnitProcesses]
  );
  const selectedCount = useMemo(
    () =>
      availableUnitProcesses.filter((proc) => selectedUnitProcessSet.has(proc))
        .length,
    [availableUnitProcesses, selectedUnitProcessSet]
  );
  const allProcessesSelected =
    hasUnitProcessFilter && selectedCount === availableUnitProcesses.length;
  const someProcessesSelected =
    hasUnitProcessFilter &&
    selectedCount > 0 &&
    selectedCount < availableUnitProcesses.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someProcessesSelected;
    }
  }, [someProcessesSelected]);

  useEffect(() => {
    if (!isOpen) return;
    setContractorInput(currentProject?.contractor || DEFAULT_CONTRACTOR_NAME);
  }, [isOpen, currentProject?.id, currentProject?.contractor]);

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

  const handleToggleSelectAllProcesses = useCallback(() => {
    if (allProcessesSelected) {
      setSelectedUnitProcesses([]);
    } else {
      setSelectedUnitProcesses(availableUnitProcesses);
    }
  }, [allProcessesSelected, availableUnitProcesses, setSelectedUnitProcesses]);

  const handleToggleUnitProcess = useCallback(
    (unitProcess) => {
      setSelectedUnitProcesses((prev) => {
        if (prev.includes(unitProcess)) {
          return prev.filter((item) => item !== unitProcess);
        }
        return [...prev, unitProcess];
      });
    },
    [setSelectedUnitProcesses]
  );

  const isPrintBlockedByEmptyProcess =
    hasUnitProcessFilter && selectedCount === 0;

  const handleConfirmPrint = useCallback(() => {
    if (isPrintBlockedByEmptyProcess) return;
    const resolvedContractor =
      contractorInput.trim() || DEFAULT_CONTRACTOR_NAME;
    if (
      currentProject?.id &&
      resolvedContractor !== (currentProject?.contractor || '')
    ) {
      updateProject(currentProject.id, {
        name: currentProject.name,
        contractor: resolvedContractor,
      });
    }
    confirmAndPrint();
  }, [
    isPrintBlockedByEmptyProcess,
    contractorInput,
    currentProject,
    updateProject,
    confirmAndPrint,
  ]);

  useBodyScrollLock(isOpen);

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
        className="w-full sm:max-w-lg max-h-[85dvh] sm:max-h-[90dvh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden"
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
          <div className="rounded-xl border border-slate-700/80 bg-slate-800/50 p-3.5 space-y-1.5">
            <label
              htmlFor="print-contractor-input"
              className="flex items-center gap-2 text-xs font-semibold text-slate-200"
            >
              <Building2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Tên Nhà thầu / Đơn vị thực hiện (áp dụng khi in)</span>
            </label>
            <input
              id="print-contractor-input"
              type="text"
              value={contractorInput}
              onChange={(e) => setContractorInput(e.target.value)}
              placeholder={DEFAULT_CONTRACTOR_NAME}
              disabled={!printOptions?.showCompanyHeader}
              className="w-full min-h-[40px] rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-[11px] text-slate-400">
              Tự động nạp từ Thông tin dự án hiện tại. Chỉnh sửa tại đây sẽ cập
              nhật trực tiếp vào hồ sơ dự án khi in.
            </p>
          </div>

          {hasUnitProcessFilter && (
            <div className="rounded-xl border border-slate-700/80 bg-slate-800/50 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Layers className="h-4 w-4 text-sky-400 shrink-0" />
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                    Chọn hạng mục cần in
                  </h3>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 shrink-0">
                  {selectedCount}/{availableUnitProcesses.length} hạng mục
                </span>
              </div>

              <label
                htmlFor="print-unit-process-select-all"
                className="flex items-center gap-2.5 rounded-lg bg-slate-900/80 border border-slate-700/80 px-3 py-2 cursor-pointer select-none hover:border-slate-600 transition-colors"
              >
                <input
                  ref={selectAllRef}
                  id="print-unit-process-select-all"
                  type="checkbox"
                  checked={allProcessesSelected}
                  onChange={handleToggleSelectAllProcesses}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/40 focus:ring-offset-0 cursor-pointer shrink-0 accent-emerald-500"
                />
                <span className="text-xs font-semibold text-slate-200">
                  Chọn tất cả
                </span>
              </label>

              <div className="max-h-44 overflow-y-auto overscroll-contain space-y-1.5 pr-1">
                {availableUnitProcesses.map((unitProcess, idx) => {
                  const isChecked = selectedUnitProcessSet.has(unitProcess);
                  return (
                    <label
                      key={unitProcess}
                      htmlFor={`print-unit-process-${idx}`}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer select-none transition-colors ${
                        isChecked
                          ? 'bg-emerald-950/25 border-emerald-500/40 hover:border-emerald-500/65'
                          : 'bg-slate-900/50 border-slate-700/60 hover:border-slate-600'
                      }`}
                    >
                      <input
                        id={`print-unit-process-${idx}`}
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleUnitProcess(unitProcess)}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/40 focus:ring-offset-0 cursor-pointer shrink-0 accent-emerald-500"
                      />
                      <span className="text-xs sm:text-sm text-slate-200 truncate">
                        {unitProcess}
                      </span>
                    </label>
                  );
                })}
              </div>

              {isPrintBlockedByEmptyProcess && (
                <p className="text-[11px] font-medium text-amber-400">
                  Vui lòng chọn ít nhất 1 hạng mục để xuất bản in.
                </p>
              )}
            </div>
          )}
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
            onClick={handleConfirmPrint}
            disabled={isPrintBlockedByEmptyProcess}
            className="relative z-20 cursor-pointer select-none inline-flex items-center gap-2 min-h-[42px] px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors"
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
