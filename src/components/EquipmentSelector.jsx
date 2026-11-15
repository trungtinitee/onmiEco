import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ExternalLink,
  LayoutGrid,
  List,
  Package,
  Plus,
  Search,
  Trash2,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  EQUIPMENT_STORAGE_KEY,
  EQUIPMENT_UPDATED_EVENT,
  loadEquipmentsFromStorage,
  matchesMultiKeywordSearch,
} from './EquipmentDBManager';

function sanitizeIntInput(raw) {
  return String(raw || '').replace(/[^0-9]/g, '');
}

function parseNonNegativeInt(raw, fallback = 0) {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function loadAssignedFromStorage(storageKey) {
  if (!storageKey || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function EquipmentSelector({
  moduleLabel = 'Hạng mục công trình',
  storageKey = '',
  value,
  onChange,
  compact = false,
}) {
  const isControlled = Array.isArray(value);

  const [internalSelected, setInternalSelected] = useState(() =>
    loadAssignedFromStorage(storageKey)
  );

  useEffect(() => {
    if (!isControlled) {
      setInternalSelected(loadAssignedFromStorage(storageKey));
    }
    setIsModalOpen(false);
    setPickedEquipment(null);
  }, [storageKey, isControlled]);

  const assignedList = isControlled ? value : internalSelected;

  const [catalog, setCatalog] = useState(() => loadEquipmentsFromStorage());
  const [viewMode, setViewMode] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table'
  ); // 'table' hoặc 'grid'
  const [assignedViewMode, setAssignedViewMode] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table'
  ); // 'table' hoặc 'grid'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Tất cả');
  const [pickedEquipment, setPickedEquipment] = useState(null);
  const [quantityInput, setQuantityInput] = useState('1');
  const [standbyInput, setStandbyInput] = useState('1');
  const [modalError, setModalError] = useState('');

  // Đồng bộ danh mục từ LocalStorage (khi tab khác hoặc DB Manager cập nhật)
  const refreshCatalog = useCallback(() => {
    setCatalog(loadEquipmentsFromStorage());
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === EQUIPMENT_STORAGE_KEY) refreshCatalog();
    };
    const onCustomUpdate = () => refreshCatalog();

    window.addEventListener('storage', onStorage);
    window.addEventListener(EQUIPMENT_UPDATED_EVENT, onCustomUpdate);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(EQUIPMENT_UPDATED_EVENT, onCustomUpdate);
    };
  }, [refreshCatalog]);

  const isMobileRef = useRef(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  // Tự động chuyển sang chế độ Thẻ (Grid) khi thu nhỏ màn hình xuống Mobile (< 768px)
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile && !isMobileRef.current) {
        setViewMode('grid');
        setAssignedViewMode('grid');
      }
      isMobileRef.current = isMobile;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Đóng modal bằng phím Escape
  useEffect(() => {
    if (!isModalOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen]);

  const totals = useMemo(() => {
    return assignedList.reduce(
      (acc, item) => {
        const qty = Number(item.quantity) || 0;
        const sb = Number(item.standby) || 0;
        const pw = Number(item.power) || 0;
        acc.totalOperatingKw += qty * pw;
        acc.totalInstalledKw += (qty + sb) * pw;
        acc.totalOperatingUnits += qty;
        acc.totalStandbyUnits += sb;
        return acc;
      },
      {
        totalOperatingKw: 0,
        totalInstalledKw: 0,
        totalOperatingUnits: 0,
        totalStandbyUnits: 0,
      }
    );
  }, [assignedList]);

  const commitList = useCallback(
    (nextList) => {
      if (!isControlled) {
        setInternalSelected(nextList);
      }
      if (storageKey && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(nextList));
        } catch {
          // Bỏ qua nếu bộ nhớ đầy
        }
      }
      const nextTotalOperatingKw = nextList.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.power) || 0),
        0
      );
      const nextTotalInstalledKw = nextList.reduce(
        (sum, item) =>
          sum +
          ((Number(item.quantity) || 0) + (Number(item.standby) || 0)) *
            (Number(item.power) || 0),
        0
      );
      onChange?.(nextList, {
        totalOperatingKw: nextTotalOperatingKw,
        totalInstalledKw: nextTotalInstalledKw,
      });
    },
    [isControlled, storageKey, onChange]
  );

  const openSelectorModal = useCallback(() => {
    refreshCatalog();
    setSearchQuery('');
    setCategoryFilter('Tất cả');
    setPickedEquipment(null);
    setQuantityInput('1');
    setStandbyInput('1');
    setModalError('');
    setIsModalOpen(true);
  }, [refreshCatalog]);

  const categories = useMemo(() => {
    const set = new Set(catalog.map((c) => c.category).filter(Boolean));
    return ['Tất cả', ...Array.from(set)];
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      if (categoryFilter !== 'Tất cả' && item.category !== categoryFilter) {
        return false;
      }
      return matchesMultiKeywordSearch(item, searchQuery);
    });
  }, [catalog, searchQuery, categoryFilter]);

  const handleConfirmAddEquipment = useCallback(
    (e) => {
      e.preventDefault();
      if (!pickedEquipment) {
        setModalError('Vui lòng chọn một thiết bị trong danh sách bên trên.');
        return;
      }
      const qty = parseNonNegativeInt(quantityInput, -1);
      const sb = parseNonNegativeInt(standbyInput, 0);
      if (qty < 0 || (qty === 0 && sb === 0)) {
        setModalError('Số lượng hoạt động và dự phòng không thể đồng thời bằng 0.');
        return;
      }

      const existingIdx = assignedList.findIndex(
        (item) => item.id === pickedEquipment.id
      );

      let nextList;
      if (existingIdx >= 0) {
        nextList = assignedList.map((item, idx) =>
          idx === existingIdx
            ? {
                ...item,
                category: pickedEquipment.category,
                name: pickedEquipment.name,
                specs: pickedEquipment.specs,
                power: Number(pickedEquipment.power) || 0,
                brand: pickedEquipment.brand,
                unit: pickedEquipment.unit,
                quantity: item.quantity + qty,
                standby: item.standby + sb,
              }
            : item
        );
      } else {
        nextList = [
          ...assignedList,
          {
            id: pickedEquipment.id,
            category: pickedEquipment.category,
            name: pickedEquipment.name,
            specs: pickedEquipment.specs,
            power: Number(pickedEquipment.power) || 0,
            brand: pickedEquipment.brand,
            unit: pickedEquipment.unit || 'Cái',
            quantity: qty,
            standby: sb,
          },
        ];
      }

      commitList(nextList);
      setIsModalOpen(false);
    },
    [pickedEquipment, quantityInput, standbyInput, assignedList, commitList]
  );

  const handleInlineCountChange = useCallback(
    (equipmentId, field, rawValue) => {
      const sanitized = sanitizeIntInput(rawValue);
      const parsed = sanitized === '' ? 0 : parseNonNegativeInt(sanitized, 0);
      const nextList = assignedList.map((item) =>
        item.id === equipmentId ? { ...item, [field]: parsed } : item
      );
      commitList(nextList);
    },
    [assignedList, commitList]
  );

  const handleRemoveAssigned = useCallback(
    (equipmentId) => {
      const nextList = assignedList.filter((item) => item.id !== equipmentId);
      commitList(nextList);
    },
    [assignedList, commitList]
  );

  return (
    <section
      className={`rounded-xl bg-slate-800 border border-slate-700/80 ${
        compact ? 'p-4 space-y-4' : 'p-5 sm:p-6 space-y-5'
      } print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid`}
    >
      {/* Header & Total Electrical Power Badge */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-700/70 print:border-gray-300">
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-emerald-400 shrink-0 print:text-emerald-700" />
            <h3 className="text-base sm:text-lg font-semibold text-slate-100 print:text-gray-900">
              Thiết bị Cơ điện gán cho {moduleLabel}
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 print:text-gray-600">
            Lấy trực tiếp từ Kho Thiết bị (LocalStorage). Tổng công suất điện = Σ
            (SL hoạt động × Công suất đơn vị).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tổng công suất điện */}
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-emerald-500/40 print:bg-transparent print:border-gray-400">
            <Zap className="h-4 w-4 text-amber-400 shrink-0 print:text-gray-800" />
            <div className="text-xs">
              <span className="text-slate-400 print:text-gray-600">
                Tổng công suất điện:{' '}
              </span>
              <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums print:text-gray-900">
                {totals.totalOperatingKw.toFixed(2)} kW
              </span>
              {totals.totalInstalledKw > totals.totalOperatingKw && (
                <span className="ml-1.5 text-[11px] text-slate-400 font-mono print:text-gray-600">
                  (Lắp đặt: {totals.totalInstalledKw.toFixed(2)} kW)
                </span>
              )}
            </div>
          </div>

          {/* Assigned View Toggle Buttons */}
          <div
            role="group"
            aria-label="Chuyển đổi chế độ xem thiết bị đã gán"
            className="print:hidden inline-flex items-center gap-1 rounded-lg bg-slate-900 border border-slate-700 p-1 shrink-0"
          >
            <button
              type="button"
              onClick={() => setAssignedViewMode('table')}
              aria-pressed={assignedViewMode === 'table'}
              title="Xem dạng Bảng (Table)"
              className={`relative z-20 cursor-pointer select-none inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                assignedViewMode === 'table'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <List className="h-4 w-4 pointer-events-none shrink-0" />
              <span className="pointer-events-none">Bảng</span>
            </button>
            <button
              type="button"
              onClick={() => setAssignedViewMode('grid')}
              aria-pressed={assignedViewMode === 'grid'}
              title="Xem dạng Thẻ lưới (Grid)"
              className={`relative z-20 cursor-pointer select-none inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                assignedViewMode === 'grid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <LayoutGrid className="h-4 w-4 pointer-events-none shrink-0" />
              <span className="pointer-events-none">Thẻ</span>
            </button>
          </div>

          <button
            type="button"
            onClick={openSelectorModal}
            className="print:hidden relative z-20 cursor-pointer select-none inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Plus className="h-4 w-4 pointer-events-none shrink-0" />
            <span className="pointer-events-none">Thêm thiết bị</span>
          </button>
        </div>
      </div>

      {/* Assigned Equipment List */}
      {assignedList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/50 p-6 text-center space-y-2 print:border-gray-300 print:bg-transparent">
          <Package className="h-8 w-8 text-slate-600 mx-auto print:hidden" />
          <p className="text-sm text-slate-300 print:text-gray-700">
            Chưa có thiết bị cơ điện nào được gán cho hạng mục này.
          </p>
          <p className="print:hidden text-xs text-slate-500">
            Nhấn nút <strong className="text-slate-300">&ldquo;Thêm thiết bị&rdquo;</strong>{' '}
            để chọn máy móc từ Kho Thiết bị và tính tổng công suất điện tự động.
          </p>
        </div>
      ) : assignedViewMode === 'table' ? (
        <div className="overflow-x-auto pb-20 print:pb-0 print:overflow-visible">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-700/80 text-xs uppercase tracking-wider text-slate-400 print:bg-gray-100 print:text-gray-700 print:border-gray-300">
                <th className="py-2.5 px-3 font-semibold">Thiết bị / Thông số</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                  Đơn giá P (kW)
                </th>
                <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap">
                  SL Hoạt động
                </th>
                <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap">
                  SL Dự phòng
                </th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                  Tổng P chạy (kW)
                </th>
                <th className="print:hidden py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                  Xóa
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 print:divide-gray-300">
              {assignedList.map((item) => {
                const rowOperatingKw =
                  (Number(item.quantity) || 0) * (Number(item.power) || 0);
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-900/40 print:hover:bg-transparent"
                  >
                    <td className="py-2.5 px-3 align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-100 print:text-gray-900">
                          {item.name}
                        </span>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-400 print:border-gray-300 print:text-gray-700 print:bg-transparent">
                          {item.category}
                        </span>
                      </div>
                      {(item.specs || item.brand) && (
                        <div className="mt-0.5 text-xs text-slate-400 print:text-gray-600">
                          {[item.specs, item.brand].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-3 align-middle text-right font-mono text-slate-300 tabular-nums whitespace-nowrap print:text-gray-800">
                      {Number(item.power || 0).toFixed(2)}
                    </td>

                    <td className="py-2.5 px-3 align-middle text-center whitespace-nowrap">
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`Số lượng hoạt động ${item.name}`}
                        value={String(item.quantity ?? 0)}
                        onChange={(e) =>
                          handleInlineCountChange(
                            item.id,
                            'quantity',
                            e.target.value
                          )
                        }
                        className="print:hidden w-16 text-center rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm font-mono font-semibold text-emerald-400 focus:outline-none focus:border-emerald-500"
                      />
                      <span className="hidden print:inline font-mono">
                        {item.quantity} {item.unit}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 align-middle text-center whitespace-nowrap">
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`Số lượng dự phòng ${item.name}`}
                        value={String(item.standby ?? 0)}
                        onChange={(e) =>
                          handleInlineCountChange(
                            item.id,
                            'standby',
                            e.target.value
                          )
                        }
                        className="print:hidden w-16 text-center rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                      <span className="hidden print:inline font-mono">
                        {item.standby} {item.unit}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 align-middle text-right font-mono font-bold text-amber-300 tabular-nums whitespace-nowrap print:text-gray-900">
                      {rowOperatingKw.toFixed(2)} kW
                    </td>

                    <td className="print:hidden py-2.5 px-3 align-middle text-right whitespace-nowrap overflow-visible">
                      <button
                        type="button"
                        onClick={() => handleRemoveAssigned(item.id)}
                        aria-label={`Gỡ bỏ ${item.name}`}
                        className="relative z-20 cursor-pointer select-none inline-flex items-center justify-center min-h-[36px] min-w-[36px] p-1.5 rounded-lg bg-slate-900 hover:bg-red-950/70 border border-slate-700 hover:border-red-500/50 text-red-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4 pointer-events-none" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900/70 border-t border-slate-700 text-xs font-semibold print:bg-gray-100 print:border-gray-300">
                <td className="py-2.5 px-3 text-slate-300 print:text-gray-800" colSpan={2}>
                  Tổng cộng ({assignedList.length} loại thiết bị ·{' '}
                  {totals.totalOperatingUnits} chạy + {totals.totalStandbyUnits} dự
                  phòng)
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-emerald-400 print:text-gray-900">
                  {totals.totalOperatingUnits}
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-slate-300 print:text-gray-700">
                  {totals.totalStandbyUnits}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-sm font-bold text-emerald-400 tabular-nums print:text-gray-900">
                  {totals.totalOperatingKw.toFixed(2)} kW
                </td>
                <td className="print:hidden" />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="space-y-4 pb-20 print:pb-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2">
            {assignedList.map((item) => {
              const rowOperatingKw =
                (Number(item.quantity) || 0) * (Number(item.power) || 0);
              return (
                <article
                  key={item.id}
                  className="rounded-xl bg-slate-900/80 border border-slate-700/80 shadow-lg p-4 flex flex-col justify-between gap-3.5 hover:border-emerald-500/40 transition-colors print:bg-transparent print:border-gray-300 print:shadow-none"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[11px] text-slate-400 print:text-gray-600">
                            {item.id}
                          </span>
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400 print:border-gray-300 print:text-gray-700 print:bg-transparent">
                            {item.category}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-100 leading-snug print:text-gray-900">
                          {item.name}
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveAssigned(item.id)}
                        aria-label={`Gỡ bỏ ${item.name}`}
                        title="Xóa thiết bị khỏi công trình"
                        className="print:hidden relative z-20 cursor-pointer select-none shrink-0 inline-flex items-center gap-1 min-h-[32px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-red-950/70 border border-slate-700 hover:border-red-500/50 text-xs font-medium text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 pointer-events-none shrink-0" />
                        <span className="pointer-events-none">Xóa</span>
                      </button>
                    </div>

                    <div className="space-y-1 text-xs text-slate-400 print:text-gray-700">
                      <div>
                        <span className="text-slate-500 print:text-gray-600">
                          Hãng:{' '}
                        </span>
                        <span className="text-slate-300 print:text-gray-900">
                          {item.brand || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 print:text-gray-600">
                          Thông số:{' '}
                        </span>
                        <span>{item.specs || 'Chưa có mô tả thông số'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span>
                          <span className="text-slate-500 print:text-gray-600">
                            P đơn vị:{' '}
                          </span>
                          <span className="font-mono font-semibold text-slate-200 print:text-gray-900">
                            {Number(item.power || 0).toFixed(2)} kW
                          </span>
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 print:text-gray-600">
                          ĐVT: {item.unit || 'Cái'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-2.5 print:border-gray-300">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label
                          htmlFor={`assigned-qty-${item.id}`}
                          className="block text-[11px] text-slate-400 mb-1 print:text-gray-600"
                        >
                          Hoạt động
                        </label>
                        <input
                          id={`assigned-qty-${item.id}`}
                          type="text"
                          inputMode="numeric"
                          aria-label={`Số lượng hoạt động ${item.name}`}
                          value={String(item.quantity ?? 0)}
                          onChange={(e) =>
                            handleInlineCountChange(
                              item.id,
                              'quantity',
                              e.target.value
                            )
                          }
                          className="print:hidden w-full text-center rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-sm font-mono font-semibold text-emerald-400 focus:outline-none focus:border-emerald-500"
                        />
                        <span className="hidden print:inline font-mono text-sm font-semibold">
                          {item.quantity} {item.unit}
                        </span>
                      </div>

                      <div>
                        <label
                          htmlFor={`assigned-sb-${item.id}`}
                          className="block text-[11px] text-slate-400 mb-1 print:text-gray-600"
                        >
                          Dự phòng
                        </label>
                        <input
                          id={`assigned-sb-${item.id}`}
                          type="text"
                          inputMode="numeric"
                          aria-label={`Số lượng dự phòng ${item.name}`}
                          value={String(item.standby ?? 0)}
                          onChange={(e) =>
                            handleInlineCountChange(
                              item.id,
                              'standby',
                              e.target.value
                            )
                          }
                          className="print:hidden w-full text-center rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-sm font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                        />
                        <span className="hidden print:inline font-mono text-sm">
                          {item.standby} {item.unit}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-400 print:text-gray-600">
                        Tổng P chạy:
                      </span>
                      <span className="font-mono text-sm font-bold text-amber-300 tabular-nums print:text-gray-900">
                        {rowOperatingKw.toFixed(2)} kW
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="rounded-lg bg-slate-900/70 border border-slate-700 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold print:bg-gray-100 print:border-gray-300">
            <span className="text-slate-300 print:text-gray-800">
              Tổng cộng ({assignedList.length} loại thiết bị ·{' '}
              {totals.totalOperatingUnits} chạy + {totals.totalStandbyUnits} dự
              phòng)
            </span>
            <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums print:text-gray-900">
              {totals.totalOperatingKw.toFixed(2)} kW
            </span>
          </div>
        </div>
      )}

      {/* Modal Popup Chọn Thiết bị từ LocalStorage */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="eq-selector-title"
          className="print:hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
        >
          <div className="w-full max-w-4xl max-h-[90dvh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 shrink-0">
              <div>
                <h3
                  id="eq-selector-title"
                  className="text-base font-bold text-slate-100 flex items-center gap-2"
                >
                  <Package className="h-5 w-5 text-emerald-400" />
                  <span>Chọn Thiết bị cho {moduleLabel}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Dữ liệu lấy từ Kho Thiết bị ({catalog.length} thiết bị sẵn có)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/kho-thiet-bi"
                  onClick={() => setIsModalOpen(false)}
                  className="relative z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-emerald-400 transition-colors"
                >
                  <span className="pointer-events-none">Quản lý kho</span>
                  <ExternalLink className="h-3.5 w-3.5 pointer-events-none" />
                </Link>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  aria-label="Đóng cửa sổ"
                  className="relative z-20 cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="h-5 w-5 pointer-events-none" />
                </button>
              </div>
            </div>

            {/* Filter & View Toggle Bar */}
            <div className="p-4 sm:p-5 space-y-3 border-b border-slate-800 shrink-0">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative w-full flex-1">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm nhiều từ khóa cách nhau bởi dấu ';' (VD: bơm; tsurumi; dn80)..."
                    aria-label="Tìm kiếm thiết bị trong kho"
                    className="w-full min-h-[40px] pl-10 pr-10 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Xóa từ khóa tìm kiếm"
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-20 cursor-pointer p-1 text-slate-400 hover:text-white"
                    >
                      <X className="h-4 w-4 pointer-events-none" />
                    </button>
                  )}
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Lọc nhóm thiết bị"
                  className="sm:w-48 min-h-[40px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                {/* View Toggle Buttons */}
                <div
                  role="group"
                  aria-label="Chuyển đổi chế độ xem danh sách thiết bị"
                  className="inline-flex items-center gap-1 self-start sm:self-auto rounded-lg bg-slate-800 border border-slate-700 p-1 shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    aria-pressed={viewMode === 'table'}
                    title="Xem dạng Bảng (Table)"
                    className={`relative z-20 cursor-pointer select-none inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      viewMode === 'table'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/70'
                    }`}
                  >
                    <List className="h-4 w-4 pointer-events-none shrink-0" />
                    <span className="pointer-events-none">Bảng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    aria-pressed={viewMode === 'grid'}
                    title="Xem dạng Thẻ lưới (Grid)"
                    className={`relative z-20 cursor-pointer select-none inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/70'
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4 pointer-events-none shrink-0" />
                    <span className="pointer-events-none">Thẻ</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Catalog Items (Table or Grid View) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-24">
              {filteredCatalog.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  Không tìm thấy thiết bị nào trong kho phù hợp từ khóa.
                </div>
              ) : viewMode === 'table' ? (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/30">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-800/80 border-b border-slate-700/80 text-xs uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          Mã / Nhóm
                        </th>
                        <th className="py-2.5 px-3 font-semibold">
                          Thiết bị & Thông số
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                          Công suất
                        </th>
                        <th className="py-2.5 px-3 font-semibold">Hãng SX</th>
                        <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                          Chọn
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredCatalog.map((item) => {
                        const isPicked = pickedEquipment?.id === item.id;
                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors ${
                              isPicked
                                ? 'bg-emerald-950/50'
                                : 'hover:bg-slate-800/50'
                            }`}
                          >
                            <td className="py-2.5 px-3 align-top whitespace-nowrap">
                              <div className="font-mono text-xs text-slate-400">
                                {item.id}
                              </div>
                              <span className="mt-1 inline-block rounded bg-slate-900 border border-slate-700 px-1.5 py-0.5 text-[11px] font-medium text-emerald-400">
                                {item.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 align-top min-w-[200px]">
                              <div className="font-semibold text-slate-100">
                                {item.name}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-400">
                                {item.specs || 'Chưa có mô tả thông số'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 align-middle text-right font-mono font-bold text-amber-300 tabular-nums whitespace-nowrap">
                              {Number(item.power || 0).toFixed(2)} kW
                              <div className="text-[11px] font-sans font-normal text-slate-400">
                                / {item.unit || 'Cái'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 align-middle text-xs text-slate-300 min-w-[120px]">
                              {item.brand || '—'}
                            </td>
                            <td className="py-2.5 px-3 align-middle text-right whitespace-nowrap overflow-visible">
                              <button
                                type="button"
                                onClick={() => {
                                  setPickedEquipment(item);
                                  setModalError('');
                                }}
                                className={`relative z-20 cursor-pointer select-none inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                  isPicked
                                    ? 'bg-emerald-600 border-emerald-500 text-white'
                                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-emerald-400'
                                }`}
                              >
                                {isPicked && (
                                  <Check className="h-3.5 w-3.5 pointer-events-none shrink-0" />
                                )}
                                <span className="pointer-events-none">
                                  {isPicked ? 'Đã chọn' : 'Chọn'}
                                </span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredCatalog.map((item) => {
                    const isPicked = pickedEquipment?.id === item.id;
                    return (
                      <article
                        key={item.id}
                        className={`rounded-xl border p-4 shadow-lg flex flex-col justify-between gap-3 transition-colors ${
                          isPicked
                            ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/40'
                            : 'bg-slate-800 border-slate-700/90 hover:border-emerald-500/40'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-xs text-slate-400">
                                {item.id}
                              </span>
                              <span className="rounded bg-slate-900 border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                                {item.category}
                              </span>
                            </div>
                            <div className="font-mono text-sm font-bold text-amber-300 tabular-nums whitespace-nowrap">
                              {Number(item.power || 0).toFixed(2)} kW
                            </div>
                          </div>

                          <h4 className="text-sm font-semibold text-slate-100 leading-snug">
                            {item.name}
                          </h4>

                          <div className="space-y-1 text-xs text-slate-400">
                            <div>
                              <span className="text-slate-500">Thông số: </span>
                              {item.specs || 'Chưa có mô tả thông số'}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">
                                <span className="text-slate-500">Hãng: </span>
                                {item.brand || '—'}
                              </span>
                              <span className="shrink-0 font-mono">
                                ĐVT: {item.unit || 'Cái'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-700/70 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setPickedEquipment(item);
                              setModalError('');
                            }}
                            className={`relative z-20 cursor-pointer select-none w-full inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              isPicked
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : 'bg-slate-900 hover:bg-emerald-600/20 border-slate-700 hover:border-emerald-500/60 text-emerald-400'
                            }`}
                          >
                            {isPicked ? (
                              <Check className="h-3.5 w-3.5 pointer-events-none shrink-0" />
                            ) : (
                              <Plus className="h-3.5 w-3.5 pointer-events-none shrink-0" />
                            )}
                            <span className="pointer-events-none">
                              {isPicked ? 'Đã chọn thiết bị này' : 'Chọn thiết bị'}
                            </span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer: Quantity / Standby Input + Submit */}
            <form
              onSubmit={handleConfirmAddEquipment}
              className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 space-y-3 shrink-0"
            >
              {modalError && (
                <div className="rounded-lg bg-red-950/60 border border-red-500/50 px-3 py-2 text-xs text-red-200">
                  {modalError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div className="grid grid-cols-2 gap-3 sm:w-80">
                  <div>
                    <label
                      htmlFor="sel-qty"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      SL hoạt động (Chạy)
                    </label>
                    <input
                      id="sel-qty"
                      type="text"
                      inputMode="numeric"
                      value={quantityInput}
                      onChange={(e) =>
                        setQuantityInput(sanitizeIntInput(e.target.value))
                      }
                      className="w-full min-h-[40px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm font-mono font-semibold text-emerald-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sel-standby"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      SL dự phòng (Standby)
                    </label>
                    <input
                      id="sel-standby"
                      type="text"
                      inputMode="numeric"
                      value={standbyInput}
                      onChange={(e) =>
                        setStandbyInput(sanitizeIntInput(e.target.value))
                      }
                      className="w-full min-h-[40px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  {pickedEquipment && (
                    <div className="text-xs text-slate-300 text-right">
                      <div className="text-slate-400">Công suất cộng thêm:</div>
                      <div className="font-mono font-bold text-amber-300">
                        {(
                          parseNonNegativeInt(quantityInput, 0) *
                          (Number(pickedEquipment.power) || 0)
                        ).toFixed(2)}{' '}
                        kW
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="relative z-20 cursor-pointer select-none min-h-[40px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-300"
                    >
                      <span className="pointer-events-none">Đóng</span>
                    </button>
                    <button
                      type="submit"
                      disabled={!pickedEquipment}
                      className="relative z-20 cursor-pointer select-none min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-white"
                    >
                      <span className="pointer-events-none">
                        Gắn vào công trình
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
