import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Download,
  Edit3,
  FileJson,
  Filter,
  LayoutGrid,
  List,
  Package,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { safeSetItem } from '../utils/storage';

export const EQUIPMENT_STORAGE_KEY = 'omnieco_equipments';
export const EQUIPMENT_UPDATED_EVENT = 'omnieco:equipments-updated';

export const EQUIPMENT_CATEGORIES = [
  'Bơm',
  'Máy thổi khí',
  'Khuấy trộn',
  'Van',
  'Phân phối khí & Lọc',
  'Đo lường & Điều khiển',
  'Khác',
];

export const DEFAULT_EQUIPMENTS = [
  {
    id: 'EQ-PUMP-01',
    category: 'Bơm',
    name: 'Bơm chìm nước thải Tsurumi 80B21.5',
    specs: 'Q = 30 m³/h, H = 12 m, DN80, cánh cắt',
    power: 1.5,
    brand: 'Tsurumi / Nhật Bản',
    unit: 'Cái',
  },
  {
    id: 'EQ-PUMP-02',
    category: 'Bơm',
    name: 'Bơm tuần hoàn bùn RAS Ebara 100DL53.7',
    specs: 'Q = 65 m³/h, H = 9 m, DN100',
    power: 3.7,
    brand: 'Ebara / Nhật Bản',
    unit: 'Cái',
  },
  {
    id: 'EQ-PUMP-03',
    category: 'Bơm',
    name: 'Bơm định lượng hóa chất Prominent Gamma/X',
    specs: 'Q = 0 - 45 L/h, P = 4 bar, đầu PTFE',
    power: 0.04,
    brand: 'ProMinent / Đức',
    unit: 'Cái',
  },
  {
    id: 'EQ-BLOW-01',
    category: 'Máy thổi khí',
    name: 'Máy thổi khí Roots Longtech LT-080',
    specs: 'Q_khí = 4.5 m³/phút, P = 5.0 mH2O, DN80',
    power: 7.5,
    brand: 'Longtech / Đài Loan',
    unit: 'Bộ',
  },
  {
    id: 'EQ-BLOW-02',
    category: 'Máy thổi khí',
    name: 'Máy thổi khí Roots ShinMaywa ARS100',
    specs: 'Q_khí = 8.2 m³/phút, P = 5.5 mH2O, DN100',
    power: 15.0,
    brand: 'ShinMaywa / Nhật Bản',
    unit: 'Bộ',
  },
  {
    id: 'EQ-MIX-01',
    category: 'Khuấy trộn',
    name: 'Máy khuấy chìm Anoxic Sulzer XRW 210',
    specs: 'Đường kính cánh 210 mm, 940 vòng/phút, Inox 316',
    power: 1.5,
    brand: 'Sulzer / Thụy Sĩ',
    unit: 'Cái',
  },
  {
    id: 'EQ-MIX-02',
    category: 'Khuấy trộn',
    name: 'Motor khuấy hóa chất trục đứng Tunglee',
    specs: 'Tốc độ 60 vòng/phút, trục & cánh SS304 phủ Composite',
    power: 0.75,
    brand: 'Tunglee / Đài Loan',
    unit: 'Bộ',
  },
  {
    id: 'EQ-VALVE-01',
    category: 'Van',
    name: 'Van bướm tay gạt Kitz DN100',
    specs: 'PN16, thân gang dẻo, đĩa Inox 304, gioăng EPDM',
    power: 0,
    brand: 'Kitz / Nhật Bản',
    unit: 'Cái',
  },
  {
    id: 'EQ-VALVE-02',
    category: 'Van',
    name: 'Van điện từ điều khiển khí nén SMC DN50',
    specs: '24VDC / 220VAC, áp suất làm việc 0 - 10 bar',
    power: 0.02,
    brand: 'SMC / Nhật Bản',
    unit: 'Cái',
  },
  {
    id: 'EQ-DIFF-01',
    category: 'Phân phối khí & Lọc',
    name: 'Đĩa phân phối khí tinh EDI FlexAir 9"',
    specs: 'Q_khí = 2 - 7 m³/h, màng EPDM chống bám bẩn',
    power: 0,
    brand: 'EDI / Mỹ',
    unit: 'Đĩa',
  },
];

function sanitizeEquipmentRecord(raw, fallbackIndex = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim();
  if (!name) return null;
  const parsedPower = Number.parseFloat(String(raw.power ?? '0').replace(',', '.'));
  const power = Number.isFinite(parsedPower) && parsedPower >= 0 ? parsedPower : 0;

  return {
    id:
      String(raw.id || '').trim() ||
      `EQ-${Date.now().toString(36).toUpperCase()}-${fallbackIndex + 1}`,
    category: String(raw.category || 'Khác').trim() || 'Khác',
    name,
    specs: String(raw.specs || '').trim(),
    power,
    brand: String(raw.brand || '').trim(),
    unit: String(raw.unit || 'Cái').trim() || 'Cái',
  };
}

export function loadEquipmentsFromStorage() {
  if (typeof window === 'undefined') return DEFAULT_EQUIPMENTS;
  try {
    const raw = window.localStorage.getItem(EQUIPMENT_STORAGE_KEY);
    if (raw === null) {
      safeSetItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(DEFAULT_EQUIPMENTS));
      return DEFAULT_EQUIPMENTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_EQUIPMENTS;
    return parsed
      .map((item, idx) => sanitizeEquipmentRecord(item, idx))
      .filter(Boolean);
  } catch {
    return DEFAULT_EQUIPMENTS;
  }
}

export function saveEquipmentsToStorage(list) {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = Array.isArray(list)
      ? list.map((item, idx) => sanitizeEquipmentRecord(item, idx)).filter(Boolean)
      : [];
    safeSetItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(sanitized));
    window.dispatchEvent(
      new CustomEvent(EQUIPMENT_UPDATED_EVENT, { detail: sanitized })
    );
  } catch {
    // Bỏ qua nếu bộ nhớ trình duyệt bị giới hạn
  }
}

function sanitizeDecimalInput(raw) {
  const cleaned = raw.replace(',', '.').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join('')}`;
}

export function matchesMultiKeywordSearch(item, query) {
  const keywords = String(query || '')
    .split(';')
    .map((kw) => kw.trim().toLowerCase())
    .filter(Boolean);
  if (keywords.length === 0) return true;

  const combinedText = [
    item?.name,
    item?.id,
    item?.code,
    item?.specs,
    item?.brand,
    item?.category,
    item?.note,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return keywords.every((kw) => combinedText.includes(kw));
}

const EMPTY_FORM = {
  id: '',
  category: '',
  name: '',
  specs: '',
  power: '0',
  brand: '',
  unit: 'Cái',
};

export default function EquipmentDBManager() {
  const [equipments, setEquipments] = useState(() => loadEquipmentsFromStorage());
  const [viewMode, setViewMode] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table'
  ); // 'table' hoặc 'grid'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [pendingImportList, setPendingImportList] = useState(null);
  const [importFileName, setImportFileName] = useState('');

  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const isMobileRef = useRef(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  // Tự động chuyển sang chế độ Thẻ (Grid) khi thu nhỏ màn hình xuống Mobile (< 768px)
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile && !isMobileRef.current) {
        setViewMode('grid');
      }
      isMobileRef.current = isMobile;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showToast = useCallback((ok, text) => {
    setToast({ ok, text, ts: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Đồng bộ nếu LocalStorage thay đổi từ tab khác hoặc component khác
  useEffect(() => {
    const handleStorageSync = (event) => {
      if (event.key === EQUIPMENT_STORAGE_KEY) {
        setEquipments(loadEquipmentsFromStorage());
      }
    };
    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);

  useBodyScrollLock(
    Boolean(isFormOpen || deleteTarget || confirmResetOpen || pendingImportList)
  );

  // Đóng modal bằng phím Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (isFormOpen) setIsFormOpen(false);
      else if (deleteTarget) setDeleteTarget(null);
      else if (pendingImportList) setPendingImportList(null);
      else if (confirmResetOpen) setConfirmResetOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormOpen, deleteTarget, pendingImportList, confirmResetOpen]);

  const updateAndPersist = useCallback((updater) => {
    setEquipments((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveEquipmentsToStorage(next);
      return next;
    });
  }, []);

  const availableCategories = useMemo(() => {
    const set = new Set(EQUIPMENT_CATEGORIES);
    equipments.forEach((item) => {
      const cat = String(item.category || '').trim();
      if (cat) set.add(cat);
    });
    return Array.from(set);
  }, [equipments]);

  const filteredEquipments = useMemo(() => {
    return equipments.filter((item) => {
      const matchCat =
        selectedCategory === 'Tất cả' || item.category === selectedCategory;
      if (!matchCat) return false;
      return matchesMultiKeywordSearch(item, searchQuery);
    });
  }, [equipments, searchQuery, selectedCategory]);

  const hasFilteredPower = useMemo(
    () => filteredEquipments.some((item) => Number(item.power) > 0),
    [filteredEquipments]
  );

  const stats = useMemo(() => {
    const totalCount = equipments.length;
    const poweredCount = equipments.filter((e) => e.power > 0).length;
    const totalPowerKw = equipments.reduce((sum, e) => sum + (e.power || 0), 0);
    return { totalCount, poweredCount, totalPowerKw };
  }, [equipments]);

  const openCreateModal = useCallback(() => {
    setEditingId(null);
    setFormState({
      ...EMPTY_FORM,
      id: `EQ-${String(equipments.length + 1).padStart(3, '0')}`,
    });
    setFormError('');
    setIsFormOpen(true);
  }, [equipments.length]);

  const openEditModal = useCallback((item) => {
    setEditingId(item.id);
    setFormState({
      id: item.id,
      category: item.category || 'Bơm',
      name: item.name || '',
      specs: item.specs || '',
      power: String(item.power ?? 0),
      brand: item.brand || '',
      unit: item.unit || 'Cái',
    });
    setFormError('');
    setIsFormOpen(true);
  }, []);

  const handleSaveForm = useCallback(
    (e) => {
      e.preventDefault();
      const trimmedName = formState.name.trim();
      if (!trimmedName) {
        setFormError('Vui lòng nhập Tên / Mã hiệu thiết bị.');
        return;
      }
      const parsedPower = Number.parseFloat(formState.power || '0');
      if (!Number.isFinite(parsedPower) || parsedPower < 0) {
        setFormError('Công suất điện (kW) phải là số không âm hợp lệ.');
        return;
      }

      const finalId =
        formState.id.trim() ||
        `EQ-${Date.now().toString(36).toUpperCase()}`;

      const duplicateId = equipments.some(
        (item) => item.id === finalId && item.id !== editingId
      );
      if (duplicateId) {
        setFormError(
          `Mã thiết bị "${finalId}" đã tồn tại. Vui lòng chọn mã khác.`
        );
        return;
      }

      const payload = {
        id: finalId,
        category: formState.category.trim() || 'Khác',
        name: trimmedName,
        specs: formState.specs.trim(),
        power: parsedPower,
        brand: formState.brand.trim(),
        unit: formState.unit.trim() || 'Cái',
      };

      if (editingId) {
        updateAndPersist((prev) =>
          prev.map((item) => (item.id === editingId ? payload : item))
        );
        showToast(true, `Đã cập nhật thiết bị "${payload.name}".`);
      } else {
        updateAndPersist((prev) => [payload, ...prev]);
        showToast(true, `Đã thêm mới thiết bị "${payload.name}" vào kho.`);
      }

      setIsFormOpen(false);
    },
    [formState, editingId, equipments, updateAndPersist, showToast]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    updateAndPersist((prev) =>
      prev.filter((item) => item.id !== deleteTarget.id)
    );
    showToast(true, `Đã xóa thiết bị "${deleteTarget.name}".`);
    setDeleteTarget(null);
  }, [deleteTarget, updateAndPersist, showToast]);

  const handleConfirmResetDefaults = useCallback(() => {
    updateAndPersist(DEFAULT_EQUIPMENTS);
    setConfirmResetOpen(false);
    showToast(true, 'Đã khôi phục danh mục thiết bị cơ điện mặc định.');
  }, [updateAndPersist, showToast]);

  const handleExportJson = useCallback(() => {
    const jsonString = JSON.stringify(equipments, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `omnieco-equipments-${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(
      true,
      `Đã xuất ${equipments.length} thiết bị ra file JSON thành công.`
    );
  }, [equipments, showToast]);

  const handleTriggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(String(event.target?.result || ''));
          const rawArray = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.equipments)
            ? parsed.equipments
            : null;

          if (!rawArray) {
            showToast(
              false,
              'File JSON không đúng định dạng mảng thiết bị omniEco.'
            );
            return;
          }

          const cleaned = rawArray
            .map((item, idx) => sanitizeEquipmentRecord(item, idx))
            .filter(Boolean);

          if (cleaned.length === 0) {
            showToast(false, 'Không tìm thấy thiết bị hợp lệ trong file JSON.');
            return;
          }

          setImportFileName(file.name);
          setPendingImportList(cleaned);
        } catch {
          showToast(false, 'Lỗi đọc file JSON. Vui lòng kiểm tra cú pháp file.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [showToast]
  );

  const applyImportMode = useCallback(
    (mode) => {
      if (!pendingImportList) return;
      if (mode === 'overwrite') {
        updateAndPersist(pendingImportList);
        showToast(
          true,
          `Đã ghi đè kho dữ liệu với ${pendingImportList.length} thiết bị từ ${importFileName}.`
        );
      } else {
        let addedCount = 0;
        updateAndPersist((prev) => {
          const existingIds = new Set(prev.map((item) => item.id));
          const normalizedToAdd = pendingImportList.map((item, idx) => {
            let nextId = item.id;
            while (existingIds.has(nextId)) {
              nextId = `${item.id}-IMP-${idx + 1}-${Date.now()
                .toString(36)
                .slice(-3)
                .toUpperCase()}`;
            }
            existingIds.add(nextId);
            addedCount += 1;
            return { ...item, id: nextId };
          });
          return [...prev, ...normalizedToAdd];
        });
        showToast(
          true,
          `Đã nối thêm ${addedCount} thiết bị mới vào kho dữ liệu hiện tại.`
        );
      }
      setPendingImportList(null);
      setImportFileName('');
    },
    [pendingImportList, importFileName, updateAndPersist, showToast]
  );

  return (
    <div className="space-y-6 pb-24 print:pb-0">
      {/* Header Banner */}
      <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 print:text-emerald-700">
              <Package className="h-4 w-4 shrink-0" />
              <span>Cơ sở dữ liệu Thiết bị Cơ điện (MEP Database)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 print:text-gray-900">
              Kho Dữ liệu Thiết bị Cơ điện
            </h1>
            <p className="text-sm text-slate-400 print:text-gray-600 max-w-2xl">
              Quản lý danh mục bơm, máy thổi khí, máy khuấy, van và thiết bị đo
              lường. Dữ liệu được lưu tự động trên LocalStorage (key:{' '}
              <code className="font-mono text-emerald-400 print:text-emerald-700">
                omnieco_equipments
              </code>
              ) để gán trực tiếp vào từng hạng mục công trình.
            </p>
          </div>

          <div className="print:hidden flex flex-wrap items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFileChange}
              className="hidden"
              aria-hidden="true"
            />

            <button
              type="button"
              onClick={openCreateModal}
              className="relative z-20 cursor-pointer select-none inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Plus className="h-4 w-4 pointer-events-none shrink-0" />
              <span className="pointer-events-none">Thêm mới</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="relative z-20 cursor-pointer select-none inline-flex items-center justify-center gap-2 min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Download className="h-4 w-4 text-emerald-400 pointer-events-none shrink-0" />
              <span className="pointer-events-none">Export JSON</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerImport}
              className="relative z-20 cursor-pointer select-none inline-flex items-center justify-center gap-2 min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Upload className="h-4 w-4 text-sky-400 pointer-events-none shrink-0" />
              <span className="pointer-events-none">Import JSON</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              title="Khôi phục bộ dữ liệu mẫu ban đầu"
              className="relative z-20 cursor-pointer select-none inline-flex items-center justify-center gap-2 min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <RotateCcw className="h-4 w-4 text-slate-400 pointer-events-none shrink-0" />
              <span className="pointer-events-none">Mẫu chuẩn</span>
            </button>
          </div>
        </div>

        {/* Toast feedback */}
        {toast && (
          <div
            role="status"
            className={`print:hidden mt-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm ${
              toast.ok
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/60 border-red-500/40 text-red-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{toast.text}</span>
            </span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Đóng thông báo"
              className="relative z-20 cursor-pointer p-1 text-slate-300 hover:text-white"
            >
              <X className="h-4 w-4 pointer-events-none" />
            </button>
          </div>
        )}
      </section>

      {/* Summary KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-4 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
          <div className="flex items-center justify-between text-xs text-slate-400 print:text-gray-600">
            <span>Tổng thiết bị trong kho</span>
            <Package className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-100 tabular-nums print:text-gray-900">
            {stats.totalCount}{' '}
            <span className="text-xs font-sans font-normal text-slate-400">
              mã hiệu
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-4 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
          <div className="flex items-center justify-between text-xs text-slate-400 print:text-gray-600">
            <span>Thiết bị dùng điện</span>
            <Cpu className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-100 tabular-nums print:text-gray-900">
            {stats.poweredCount}{' '}
            <span className="text-xs font-sans font-normal text-slate-400">
              / {stats.totalCount} thiết bị
            </span>
          </div>
        </div>

        <div
          className={`rounded-xl bg-slate-800 border border-slate-700/80 p-4 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 ${
            !hasFilteredPower ? 'print:hidden' : ''
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 print:text-gray-600">
            <span>Tổng công suất định mức kho</span>
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-emerald-400 tabular-nums print:text-emerald-700">
            {stats.totalPowerKw.toFixed(2)}{' '}
            <span className="text-xs font-sans font-normal text-slate-400">
              kW
            </span>
          </div>
        </div>
      </section>

      {/* Search & Category Filter Bar */}
      <section className="print:hidden rounded-xl bg-slate-800 border border-slate-700/80 p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative w-full flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm nhiều từ khóa cách nhau bởi dấu ';' (VD: bơm; tsurumi; dn80)..."
              aria-label="Tìm kiếm thiết bị"
              className="w-full min-h-[44px] pl-10 pr-10 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
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

          <div className="flex items-center gap-2 md:w-64">
            <Filter className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Lọc theo phân loại thiết bị"
              className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
            >
              <option value="Tất cả">Tất cả nhóm ({equipments.length})</option>
              {availableCategories.map((cat) => {
                const count = equipments.filter((e) => e.category === cat).length;
                return (
                  <option key={cat} value={cat}>
                    {cat} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* View Mode Toggle (Table / Grid) */}
          <div
            role="group"
            aria-label="Chuyển đổi chế độ hiển thị danh sách"
            className="inline-flex items-center gap-1 self-start md:self-auto rounded-lg bg-slate-900 border border-slate-700 p-1 shrink-0"
          >
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              title="Xem dạng Bảng (Table)"
              className={`relative z-20 cursor-pointer select-none inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <List className="h-4 w-4 pointer-events-none shrink-0" />
              <span className="pointer-events-none">Bảng</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              title="Xem dạng Lưới thẻ (Grid)"
              className={`relative z-20 cursor-pointer select-none inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <LayoutGrid className="h-4 w-4 pointer-events-none shrink-0" />
              <span className="pointer-events-none">Thẻ</span>
            </button>
          </div>
        </div>

        {/* Category quick filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {['Tất cả', ...availableCategories].map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`relative z-20 cursor-pointer select-none px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isActive
                    ? 'bg-emerald-600/20 border-emerald-500/60 text-emerald-300'
                    : 'bg-slate-900/70 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <span className="pointer-events-none">{cat}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Equipment Table */}
      <section className="rounded-xl bg-slate-800 border border-slate-700/80 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/80 rounded-t-xl print:border-gray-300">
          <h2 className="text-sm font-semibold text-slate-200 print:text-gray-900">
            Danh mục Thiết bị ({filteredEquipments.length})
          </h2>
          <span
            className={`text-xs text-slate-400 print:text-gray-600 ${
              !hasFilteredPower ? 'print:hidden' : ''
            }`}
          >
            Đơn vị công suất: kW
          </span>
        </div>

        {filteredEquipments.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Package className="h-10 w-10 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-300 font-medium">
              Không tìm thấy thiết bị phù hợp với bộ lọc hiện tại.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('Tất cả');
              }}
              className="relative z-20 cursor-pointer select-none inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-emerald-400 hover:bg-slate-700"
            >
              <span className="pointer-events-none">Xóa bộ lọc tìm kiếm</span>
            </button>
          </div>
        ) : (
          <div className="pb-24 rounded-b-xl print:pb-0">
            {viewMode === 'table' ? (
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-slate-700/80 text-xs uppercase tracking-wider text-slate-400 print:bg-gray-100 print:text-gray-700 print:border-gray-300">
                      <th className="py-3 px-4 font-semibold whitespace-nowrap">
                        Mã / Nhóm
                      </th>
                      <th className="py-3 px-4 font-semibold">Tên / Mã hiệu</th>
                      <th className="py-3 px-4 font-semibold">Thông số kỹ thuật</th>
                      <th
                        className={`py-3 px-4 font-semibold text-right whitespace-nowrap ${
                          !hasFilteredPower ? 'print:hidden' : ''
                        }`}
                      >
                        Công suất
                      </th>
                      <th className="py-3 px-4 font-semibold">Hãng SX / Xuất xứ</th>
                      <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">
                        ĐVT
                      </th>
                      <th className="print:hidden py-3 px-4 font-semibold text-right whitespace-nowrap">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 print:divide-gray-300">
                    {filteredEquipments.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-900/50 transition-colors print:hover:bg-transparent"
                      >
                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <div className="font-mono text-xs text-slate-400 print:text-gray-600">
                            {item.id}
                          </div>
                          <span className="mt-1 inline-block rounded-md bg-slate-900 border border-slate-700 px-2 py-0.5 text-xs font-medium text-emerald-400 print:border-gray-300 print:text-gray-800 print:bg-transparent">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-top font-semibold text-slate-100 min-w-[200px] print:text-gray-900">
                          {item.name}
                        </td>
                        <td className="py-3 px-4 align-top text-slate-300 min-w-[220px] print:text-gray-700">
                          {item.specs || (
                            <span className="text-slate-500 italic">
                              Chưa cập nhật
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-3 px-4 align-top text-right font-mono font-semibold text-amber-300 tabular-nums whitespace-nowrap print:text-gray-900 ${
                            !hasFilteredPower ? 'print:hidden' : ''
                          }`}
                        >
                          {Number(item.power || 0).toFixed(2)} kW
                        </td>
                        <td className="py-3 px-4 align-top text-slate-300 min-w-[140px] print:text-gray-700">
                          {item.brand || '—'}
                        </td>
                        <td className="py-3 px-4 align-top text-center text-slate-300 whitespace-nowrap print:text-gray-700">
                          {item.unit}
                        </td>
                        <td className="print:hidden py-3 px-4 align-middle text-right whitespace-nowrap overflow-visible">
                          <div className="inline-flex items-center justify-end gap-1.5 overflow-visible">
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              aria-label={`Sửa thiết bị ${item.name}`}
                              className="relative z-20 cursor-pointer select-none inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-sky-300 transition-colors"
                            >
                              <Edit3 className="h-3.5 w-3.5 pointer-events-none shrink-0" />
                              <span className="pointer-events-none">Sửa</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              aria-label={`Xóa thiết bị ${item.name}`}
                              className="relative z-20 cursor-pointer select-none inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-red-950/70 border border-slate-700 hover:border-red-500/50 text-xs font-medium text-red-400 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5 pointer-events-none shrink-0" />
                              <span className="pointer-events-none">Xóa</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 sm:p-5 bg-slate-900/50 rounded-b-xl print:bg-transparent">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2">
                  {filteredEquipments.map((item) => (
                    <article
                      key={item.id}
                      className="bg-slate-800 p-4 rounded-lg border border-slate-700/90 shadow-lg flex flex-col justify-between gap-3 hover:border-emerald-500/40 transition-colors print:bg-transparent print:border-gray-300 print:shadow-none print:break-inside-avoid"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs text-slate-400 print:text-gray-600">
                              {item.id}
                            </span>
                            <span className="rounded-md bg-slate-900 border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-emerald-400 print:border-gray-300 print:text-gray-800 print:bg-transparent">
                              {item.category}
                            </span>
                          </div>
                          <div
                            className={`font-mono text-sm font-bold text-amber-300 tabular-nums whitespace-nowrap print:text-gray-900 ${
                              !hasFilteredPower ? 'print:hidden' : ''
                            }`}
                          >
                            {Number(item.power || 0).toFixed(2)} kW
                          </div>
                        </div>

                        <h3 className="text-base font-semibold text-slate-100 leading-snug print:text-gray-900">
                          {item.name}
                        </h3>

                        <div className="space-y-1.5 text-xs">
                          <div className="text-slate-300 print:text-gray-700">
                            <span className="text-slate-400 print:text-gray-600">
                              Thông số:{' '}
                            </span>
                            {item.specs || (
                              <span className="text-slate-500 italic">
                                Chưa cập nhật
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2 text-slate-300 print:text-gray-700">
                            <span className="truncate">
                              <span className="text-slate-400 print:text-gray-600">
                                Hãng SX:{' '}
                              </span>
                              {item.brand || '—'}
                            </span>
                            <span className="shrink-0 font-mono text-slate-400 print:text-gray-600">
                              ĐVT: {item.unit || 'Cái'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="print:hidden pt-3 border-t border-slate-700/70 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          aria-label={`Sửa thiết bị ${item.name}`}
                          className="relative z-20 cursor-pointer select-none inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-sky-300 transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5 pointer-events-none shrink-0" />
                          <span className="pointer-events-none">Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          aria-label={`Xóa thiết bị ${item.name}`}
                          className="relative z-20 cursor-pointer select-none inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-red-950/70 border border-slate-700 hover:border-red-500/50 text-xs font-medium text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5 pointer-events-none shrink-0" />
                          <span className="pointer-events-none">Xóa</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Modal Thêm / Sửa Thiết bị */}
      {isFormOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="eq-form-title"
          onClick={() => setIsFormOpen(false)}
          className="print:hidden fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-xl max-h-[85dvh] sm:max-h-[90dvh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-800 shrink-0">
              <h3
                id="eq-form-title"
                className="text-base font-bold text-slate-100 flex items-center gap-2"
              >
                <Package className="h-5 w-5 text-emerald-400" />
                <span>
                  {editingId ? 'Chỉnh sửa Thiết bị' : 'Thêm Thiết bị Mới'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                aria-label="Đóng cửa sổ"
                className="relative z-20 cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5 pointer-events-none" />
              </button>
            </div>

            <form
              onSubmit={handleSaveForm}
              className="flex-1 min-h-0 flex flex-col"
            >
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
                {formError && (
                  <div className="rounded-lg bg-red-950/60 border border-red-500/50 px-3.5 py-2.5 text-xs text-red-200">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="eq-id"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Mã thiết bị (ID)
                    </label>
                    <input
                      id="eq-id"
                      type="text"
                      value={formState.id}
                      onChange={(e) =>
                        setFormState((p) => ({ ...p, id: e.target.value }))
                      }
                      placeholder="VD: EQ-PUMP-04"
                      className="w-full min-h-[42px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="eq-category"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Phân loại (Category)
                    </label>
                    <input
                      id="eq-category"
                      type="text"
                      list="category-options"
                      value={formState.category}
                      onChange={(e) =>
                        setFormState((p) => ({ ...p, category: e.target.value }))
                      }
                      placeholder="Chọn có sẵn hoặc nhập nhóm mới..."
                      className="w-full min-h-[42px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <datalist id="category-options">
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="eq-name"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Tên / Mã hiệu thiết bị <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="eq-name"
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="VD: Bơm chìm nước thải Tsurumi 80B21.5"
                    className="w-full min-h-[42px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="eq-specs"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Thông số kỹ thuật (Lưu lượng, cột áp, kích thước...)
                  </label>
                  <input
                    id="eq-specs"
                    type="text"
                    value={formState.specs}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, specs: e.target.value }))
                    }
                    placeholder="VD: Q = 30 m³/h, H = 12 m, DN80"
                    className="w-full min-h-[42px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="eq-power"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Công suất (kW)
                    </label>
                    <input
                      id="eq-power"
                      type="text"
                      inputMode="decimal"
                      value={formState.power}
                      onChange={(e) =>
                        setFormState((p) => ({
                          ...p,
                          power: sanitizeDecimalInput(e.target.value),
                        }))
                      }
                      placeholder="1.5"
                      className="w-full min-h-[42px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm font-mono text-amber-300 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="eq-unit"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Đơn vị tính
                    </label>
                    <input
                      id="eq-unit"
                      type="text"
                      value={formState.unit}
                      onChange={(e) =>
                        setFormState((p) => ({ ...p, unit: e.target.value }))
                      }
                      placeholder="Cái / Bộ / Đĩa"
                      className="w-full min-h-[42px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="eq-brand"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Hãng SX / Xuất xứ
                    </label>
                    <input
                      id="eq-brand"
                      type="text"
                      value={formState.brand}
                      onChange={(e) =>
                        setFormState((p) => ({ ...p, brand: e.target.value }))
                      }
                      placeholder="VD: Tsurumi / Nhật Bản"
                      className="w-full min-h-[42px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 z-20 bg-slate-900/90 backdrop-blur border-t border-slate-800 p-3 sm:p-4 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="relative z-20 cursor-pointer select-none min-h-[42px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-300"
                >
                  <span className="pointer-events-none">Hủy</span>
                </button>
                <button
                  type="submit"
                  className="relative z-20 cursor-pointer select-none min-h-[42px] px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white"
                >
                  <span className="pointer-events-none">
                    {editingId ? 'Lưu thay đổi' : 'Thêm vào kho'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Xóa */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteTarget(null)}
          className="print:hidden fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md max-h-[85dvh] sm:max-h-[90dvh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-800 shrink-0">
              <h3 className="text-base font-bold text-slate-100">
                Xác nhận xóa thiết bị
              </h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                aria-label="Đóng cửa sổ"
                className="relative z-20 cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5 pointer-events-none" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
              <p className="text-sm text-slate-300 leading-relaxed">
                Bạn có chắc chắn muốn xóa thiết bị{' '}
                <strong className="text-white">{deleteTarget.name}</strong> (
                <span className="font-mono text-xs text-slate-400">
                  {deleteTarget.id}
                </span>
                ) khỏi kho dữ liệu không?
              </p>
            </div>
            <div className="sticky bottom-0 z-20 bg-slate-900/90 backdrop-blur border-t border-slate-800 p-3 sm:p-4 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="relative z-20 cursor-pointer select-none min-h-[40px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-300"
              >
                <span className="pointer-events-none">Hủy</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="relative z-20 cursor-pointer select-none min-h-[40px] px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white"
              >
                <span className="pointer-events-none">Xóa thiết bị</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chọn chế độ Import JSON (Ghi đè / Nối thêm) */}
      {pendingImportList && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPendingImportList(null)}
          className="print:hidden fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg max-h-[85dvh] sm:max-h-[90dvh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileJson className="h-5 w-5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-100 truncate">
                    Tùy chọn Import Danh mục Thiết bị
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    File: <span className="text-slate-200">{importFileName}</span>{' '}
                    ({pendingImportList.length} thiết bị hợp lệ)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingImportList(null)}
                aria-label="Đóng"
                className="relative z-20 cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
              >
                <X className="h-4 w-4 pointer-events-none" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
              <p className="text-sm text-slate-300">
                Chọn cách nhập dữ liệu vào kho thiết bị hiện tại (đang có{' '}
                <strong>{equipments.length}</strong> thiết bị):
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => applyImportMode('append')}
                  className="relative z-20 cursor-pointer select-none text-left rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-emerald-500/40 p-3.5 transition-colors"
                >
                  <div className="pointer-events-none text-sm font-semibold text-emerald-400">
                    Nối thêm vào kho hiện tại
                  </div>
                  <div className="pointer-events-none mt-1 text-xs text-slate-400">
                    Giữ nguyên dữ liệu cũ, tự động đổi mã nếu bị trùng ID.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyImportMode('overwrite')}
                  className="relative z-20 cursor-pointer select-none text-left rounded-xl bg-slate-800 hover:bg-red-950/40 border border-amber-500/40 p-3.5 transition-colors"
                >
                  <div className="pointer-events-none text-sm font-semibold text-amber-400">
                    Ghi đè toàn bộ kho
                  </div>
                  <div className="pointer-events-none mt-1 text-xs text-slate-400">
                    Thay thế hoàn toàn danh sách hiện tại bằng file JSON mới.
                  </div>
                </button>
              </div>
            </div>

            <div className="sticky bottom-0 z-20 bg-slate-900/90 backdrop-blur border-t border-slate-800 p-3 sm:p-4 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setPendingImportList(null)}
                className="relative z-20 cursor-pointer select-none min-h-[40px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-medium text-slate-300"
              >
                <span className="pointer-events-none">Hủy Import</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Khôi phục Mẫu */}
      {confirmResetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmResetOpen(false)}
          className="print:hidden fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md max-h-[85dvh] sm:max-h-[90dvh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-800 shrink-0">
              <h3 className="text-base font-bold text-slate-100">
                Khôi phục danh mục mẫu chuẩn?
              </h3>
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                aria-label="Đóng cửa sổ"
                className="relative z-20 cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5 pointer-events-none" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
              <p className="text-sm text-slate-300 leading-relaxed">
                Thao tác này sẽ đặt lại kho thiết bị về{' '}
                <strong>{DEFAULT_EQUIPMENTS.length}</strong> thiết bị cơ điện mẫu
                của omniEco. Nếu bạn muốn giữ dữ liệu hiện tại, hãy Export JSON
                trước.
              </p>
            </div>
            <div className="sticky bottom-0 z-20 bg-slate-900/90 backdrop-blur border-t border-slate-800 p-3 sm:p-4 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="relative z-20 cursor-pointer select-none min-h-[40px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-300"
              >
                <span className="pointer-events-none">Hủy</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmResetDefaults}
                className="relative z-20 cursor-pointer select-none min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white"
              >
                <span className="pointer-events-none">Khôi phục</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
