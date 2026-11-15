import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  LayoutGrid,
  List,
  Package,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  EQUIPMENT_STORAGE_KEY,
  EQUIPMENT_UPDATED_EVENT,
  loadEquipmentsFromStorage,
} from './EquipmentDBManager';

export const PROCUREMENT_STORAGE_KEY = 'omnieco_project_procurement';

const QUICK_NOTES = ['Mua gấp', 'Chờ duyệt', 'Đang hỏi giá', 'Đã đặt hàng'];

function sanitizeIntInput(raw) {
  return String(raw || '').replace(/[^0-9]/g, '');
}

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parsePositiveInt(raw, fallback = 1) {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function loadProcurementFromStorage() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PROCUREMENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object' && item.id && item.name)
      .map((item) => ({
        id: String(item.id),
        category: String(item.category || 'Khác'),
        name: String(item.name),
        specs: String(item.specs || ''),
        power: Number(item.power) || 0,
        brand: String(item.brand || ''),
        unit: String(item.unit || 'Cái'),
        quantity: parsePositiveInt(item.quantity, 1),
        note: String(item.note || ''),
      }));
  } catch {
    return [];
  }
}

function saveProcurementToStorage(list) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROCUREMENT_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Bỏ qua nếu bộ nhớ trình duyệt đầy
  }
}

export default function ProcurementList() {
  const [items, setItems] = useState(() => loadProcurementFromStorage());
  const [catalog, setCatalog] = useState(() => loadEquipmentsFromStorage());

  const [viewMode, setViewMode] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table'
  );
  const [modalViewMode, setModalViewMode] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table'
  );

  const [listSearch, setListSearch] = useState('');
  const [listCategory, setListCategory] = useState('Tất cả');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalCategory, setModalCategory] = useState('Tất cả');
  const [pickedEquipment, setPickedEquipment] = useState(null);
  const [quantityInput, setQuantityInput] = useState('1');
  const [noteInput, setNoteInput] = useState('');
  const [modalError, setModalError] = useState('');

  const isMobileRef = useRef(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  // Tự động chuyển sang chế độ Thẻ (Grid) khi thu nhỏ màn hình xuống Mobile (< 768px)
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile && !isMobileRef.current) {
        setViewMode('grid');
        setModalViewMode('grid');
      }
      isMobileRef.current = isMobile;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Đồng bộ Master Database & danh sách BOM giữa các tab/component
  const refreshCatalog = useCallback(() => {
    setCatalog(loadEquipmentsFromStorage());
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === EQUIPMENT_STORAGE_KEY) {
        refreshCatalog();
      } else if (e.key === PROCUREMENT_STORAGE_KEY) {
        setItems(loadProcurementFromStorage());
      }
    };
    const onCustomUpdate = () => refreshCatalog();

    window.addEventListener('storage', onStorage);
    window.addEventListener(EQUIPMENT_UPDATED_EVENT, onCustomUpdate);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(EQUIPMENT_UPDATED_EVENT, onCustomUpdate);
    };
  }, [refreshCatalog]);

  // Đóng modal bằng phím Escape
  useEffect(() => {
    if (!isModalOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen]);

  const updateItems = useCallback((updater) => {
    setItems((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveProcurementToStorage(next);
      return next;
    });
  }, []);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const qty = Number(item.quantity) || 0;
        const pw = Number(item.power) || 0;
        acc.totalUnits += qty;
        acc.totalPowerKw += qty * pw;
        return acc;
      },
      { totalUnits: 0, totalPowerKw: 0 }
    );
  }, [items]);

  const listCategories = useMemo(() => {
    const set = new Set(items.map((item) => item.category).filter(Boolean));
    return ['Tất cả', ...Array.from(set)];
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return items.filter((item) => {
      if (listCategory !== 'Tất cả' && item.category !== listCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.specs.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.note.toLowerCase().includes(q)
      );
    });
  }, [items, listSearch, listCategory]);

  const modalCategories = useMemo(() => {
    const set = new Set(catalog.map((c) => c.category).filter(Boolean));
    return ['Tất cả', ...Array.from(set)];
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    const q = modalSearch.trim().toLowerCase();
    return catalog.filter((item) => {
      if (modalCategory !== 'Tất cả' && item.category !== modalCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.specs.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
      );
    });
  }, [catalog, modalSearch, modalCategory]);

  const openAddModal = useCallback(() => {
    refreshCatalog();
    setModalSearch('');
    setModalCategory('Tất cả');
    setPickedEquipment(null);
    setQuantityInput('1');
    setNoteInput('');
    setModalError('');
    setIsModalOpen(true);
  }, [refreshCatalog]);

  const handleConfirmAdd = useCallback(
    (e) => {
      e.preventDefault();
      if (!pickedEquipment) {
        setModalError('Vui lòng chọn một thiết bị trong danh sách bên trên.');
        return;
      }
      const qty = parsePositiveInt(quantityInput, 0);
      if (qty <= 0) {
        setModalError('Số lượng cần mua phải lớn hơn 0.');
        return;
      }
      const trimmedNote = noteInput.trim();

      updateItems((prev) => {
        const existingIdx = prev.findIndex((i) => i.id === pickedEquipment.id);
        if (existingIdx >= 0) {
          return prev.map((item, idx) =>
            idx === existingIdx
              ? {
                  ...item,
                  category: pickedEquipment.category,
                  name: pickedEquipment.name,
                  specs: pickedEquipment.specs,
                  power: Number(pickedEquipment.power) || 0,
                  brand: pickedEquipment.brand,
                  unit: pickedEquipment.unit || 'Cái',
                  quantity: (Number(item.quantity) || 0) + qty,
                  note: trimmedNote || item.note,
                }
              : item
          );
        }
        return [
          ...prev,
          {
            id: pickedEquipment.id,
            category: pickedEquipment.category,
            name: pickedEquipment.name,
            specs: pickedEquipment.specs,
            power: Number(pickedEquipment.power) || 0,
            brand: pickedEquipment.brand,
            unit: pickedEquipment.unit || 'Cái',
            quantity: qty,
            note: trimmedNote,
          },
        ];
      });

      setIsModalOpen(false);
    },
    [pickedEquipment, quantityInput, noteInput, updateItems]
  );

  const handleQuantityChange = useCallback(
    (equipmentId, rawValue) => {
      const sanitized = sanitizeIntInput(rawValue);
      const parsed = sanitized === '' ? 0 : parsePositiveInt(sanitized, 0);
      updateItems((prev) =>
        prev.map((item) =>
          item.id === equipmentId ? { ...item, quantity: parsed } : item
        )
      );
    },
    [updateItems]
  );

  const handleNoteChange = useCallback(
    (equipmentId, rawNote) => {
      updateItems((prev) =>
        prev.map((item) =>
          item.id === equipmentId ? { ...item, note: rawNote } : item
        )
      );
    },
    [updateItems]
  );

  const handleRemoveItem = useCallback(
    (equipmentId) => {
      updateItems((prev) => prev.filter((item) => item.id !== equipmentId));
    },
    [updateItems]
  );

  const handleExportExcel = useCallback(() => {
    if (items.length === 0) return;

    const headers = [
      'Mã/Nhóm',
      'Tên thiết bị',
      'Thông số kỹ thuật',
      'Công suất (kW)',
      'Hãng SX',
      'ĐVT',
      'Số lượng (Hoạt động/Dự phòng)',
      'Ghi chú',
    ];

    const rows = items.map((item) => [
      `${item.id} - ${item.category}`,
      item.name,
      item.specs || '',
      Number(item.power || 0).toFixed(2),
      item.brand || '',
      item.unit || 'Cái',
      `${Number(item.quantity) || 0} / ${Number(item.standby) || 0}`,
      item.note || '',
    ]);

    const summaryRow = [
      'TỔNG CỘNG',
      `${items.length} chủng loại thiết bị`,
      '',
      totals.totalPowerKw.toFixed(2),
      '',
      '',
      `${totals.totalUnits} / 0`,
      `Tổng công suất: ${totals.totalPowerKw.toFixed(2)} kW`,
    ];

    const csvLines = [headers, ...rows, summaryRow].map((line) =>
      line.map(escapeCsvCell).join(',')
    );
    const csvContent = `\uFEFF${csvLines.join('\r\n')}`;

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `omnieco-danh-muc-mua-sam-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [items, totals]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="space-y-6 pb-24 print:pb-0 print:bg-white print:text-black">
      {/* Header Banner */}
      <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 print:bg-white print:border print:border-gray-300 print:shadow-none print:text-black">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 print:text-black">
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span>Tổng hợp Vật tư & Thiết bị Dự án (BOM)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 print:text-black">
              Danh mục Thiết bị Cần Mua sắm (BOM)
            </h1>
            <p className="text-sm text-slate-400 print:text-gray-700 max-w-2xl">
              Lập bảng tổng hợp thiết bị cơ điện cần đặt mua cho toàn dự án từ Kho
              Thiết bị chuẩn, theo dõi số lượng, tình trạng duyệt và tổng công suất
              điện lắp đặt.
            </p>
          </div>

          <div className="print:hidden flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openAddModal}
              className="relative z-20 cursor-pointer select-none inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Plus className="h-4 w-4 pointer-events-none shrink-0" />
              <span className="pointer-events-none">Thêm thiết bị</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={items.length === 0}
              className="relative z-20 cursor-pointer select-none inline-flex items-center justify-center gap-2 min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-sm font-medium text-slate-200 transition-colors"
            >
              <Printer className="h-4 w-4 text-sky-400 pointer-events-none shrink-0" />
              <span className="pointer-events-none">In danh mục</span>
            </button>
          </div>
        </div>
      </section>

      {/* Summary KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-4 print:bg-white print:border print:border-gray-300 print:shadow-none print:text-black">
          <div className="flex items-center justify-between text-xs text-slate-400 print:text-gray-700">
            <span>Số mã thiết bị cần mua</span>
            <Package className="h-4 w-4 text-emerald-400 print:text-black" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-100 tabular-nums print:text-black">
            {items.length}{' '}
            <span className="text-xs font-sans font-normal text-slate-400 print:text-gray-700">
              chủng loại
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-4 print:bg-white print:border print:border-gray-300 print:shadow-none print:text-black">
          <div className="flex items-center justify-between text-xs text-slate-400 print:text-gray-700">
            <span>Tổng số lượng đặt hàng</span>
            <ShoppingCart className="h-4 w-4 text-sky-400 print:text-black" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-100 tabular-nums print:text-black">
            {totals.totalUnits}{' '}
            <span className="text-xs font-sans font-normal text-slate-400 print:text-gray-700">
              đơn vị thiết bị
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-4 print:bg-white print:border print:border-gray-300 print:shadow-none print:text-black">
          <div className="flex items-center justify-between text-xs text-slate-400 print:text-gray-700">
            <span>Tổng công suất điện danh mục</span>
            <Zap className="h-4 w-4 text-amber-400 print:text-black" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-emerald-400 tabular-nums print:text-black">
            {totals.totalPowerKw.toFixed(2)}{' '}
            <span className="text-xs font-sans font-normal text-slate-400 print:text-gray-700">
              kW
            </span>
          </div>
        </div>
      </section>

      {/* Search, Filter & View Toggle Bar */}
      <section className="print:hidden rounded-xl bg-slate-800 border border-slate-700/80 p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative w-full flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Tìm theo tên thiết bị, mã hiệu, thông số, hãng hoặc ghi chú..."
              aria-label="Tìm kiếm trong danh mục mua sắm"
              className="w-full min-h-[44px] pl-10 pr-10 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
            />
            {listSearch && (
              <button
                type="button"
                onClick={() => setListSearch('')}
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
              value={listCategory}
              onChange={(e) => setListCategory(e.target.value)}
              aria-label="Lọc theo nhóm thiết bị"
              className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
            >
              {listCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'Tất cả' ? `Tất cả nhóm (${items.length})` : cat}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle Buttons */}
          <div
            role="group"
            aria-label="Chuyển đổi chế độ hiển thị danh mục mua sắm"
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
              title="Xem dạng Thẻ lưới (Grid)"
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

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={items.length === 0}
            title="Xuất danh mục mua sắm ra file CSV mở bằng Excel (UTF-8)"
            className="relative z-20 cursor-pointer select-none inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-500/50 text-sm font-semibold text-emerald-300 transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <FileSpreadsheet className="h-4 w-4 pointer-events-none shrink-0" />
            <span className="pointer-events-none">Xuất Excel</span>
          </button>
        </div>
      </section>

      {/* Procurement BOM List (Table or Grid) */}
      <section className="rounded-xl bg-slate-800 border border-slate-700/80 overflow-visible print:bg-white print:border print:border-gray-300 print:shadow-none print:text-black print:overflow-visible">
        {items.length === 0 ? (
          <div className="p-10 text-center space-y-3 print:bg-white print:text-black">
            <ShoppingCart className="h-10 w-10 text-slate-600 mx-auto print:hidden" />
            <h2 className="text-base font-semibold text-slate-200 print:text-black">
              Danh mục mua sắm (BOM) đang trống
            </h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto print:text-gray-700">
              Nhấn nút{' '}
              <strong className="text-slate-200 print:text-black">
                &ldquo;Thêm thiết bị&rdquo;
              </strong>{' '}
              để chọn máy móc từ Kho Thiết bị Cơ điện, nhập số lượng cần đặt và ghi
              chú tiến độ mua sắm.
            </p>
            <div className="print:hidden pt-1">
              <button
                type="button"
                onClick={openAddModal}
                className="relative z-20 cursor-pointer select-none inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white transition-colors"
              >
                <Plus className="h-4 w-4 pointer-events-none shrink-0" />
                <span className="pointer-events-none">Thêm thiết bị đầu tiên</span>
              </button>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center space-y-2 text-sm text-slate-400 print:text-black">
            Không tìm thấy thiết bị nào trong danh mục mua sắm khớp với bộ lọc hiện
            tại.
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto pb-24 print:pb-0 print:overflow-visible print:bg-white print:text-black">
            <table className="w-full text-left border-collapse text-sm print:text-black">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-700 text-xs uppercase tracking-wider text-slate-400 print:bg-gray-100 print:text-black print:border-gray-300">
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">
                    STT / Mã
                  </th>
                  <th className="py-3 px-4 font-semibold">
                    Thiết bị & Thông số kỹ thuật
                  </th>
                  <th className="py-3 px-4 font-semibold">Hãng SX</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">
                    P đơn vị (kW)
                  </th>
                  <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">
                    SL Cần mua
                  </th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">
                    Tổng P (kW)
                  </th>
                  <th className="py-3 px-4 font-semibold min-w-[180px]">
                    Ghi chú mua sắm
                  </th>
                  <th className="print:hidden py-3 px-4 font-semibold text-right whitespace-nowrap">
                    Xóa
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/70 print:divide-gray-300">
                {filteredItems.map((item, idx) => {
                  const rowPowerKw =
                    (Number(item.quantity) || 0) * (Number(item.power) || 0);
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-900/40 transition-colors print:bg-white print:hover:bg-white"
                    >
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <div className="font-mono text-xs text-slate-400 print:text-black">
                          #{idx + 1} · {item.id}
                        </div>
                        <span className="mt-1 inline-block rounded bg-slate-900 border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-emerald-400 print:bg-white print:border-gray-400 print:text-black">
                          {item.category}
                        </span>
                      </td>

                      <td className="py-3 px-4 align-top min-w-[220px]">
                        <div className="font-semibold text-slate-100 print:text-black">
                          {item.name}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400 print:text-gray-700">
                          {item.specs || 'Chưa có mô tả thông số'}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top text-xs text-slate-300 min-w-[120px] print:text-black">
                        {item.brand || '—'}
                      </td>

                      <td className="py-3 px-4 align-middle text-right font-mono text-slate-200 tabular-nums whitespace-nowrap print:text-black">
                        {Number(item.power || 0).toFixed(2)}
                      </td>

                      <td className="py-3 px-4 align-middle text-center whitespace-nowrap">
                        <div className="print:hidden inline-flex items-center gap-1.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            aria-label={`Số lượng cần mua ${item.name}`}
                            value={String(item.quantity ?? 0)}
                            onChange={(e) =>
                              handleQuantityChange(item.id, e.target.value)
                            }
                            className="w-16 text-center rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm font-mono font-semibold text-emerald-400 focus:outline-none focus:border-emerald-500"
                          />
                          <span className="text-xs text-slate-400">
                            {item.unit}
                          </span>
                        </div>
                        <span className="hidden print:inline font-mono text-black">
                          {item.quantity} {item.unit}
                        </span>
                      </td>

                      <td className="py-3 px-4 align-middle text-right font-mono font-bold text-amber-300 tabular-nums whitespace-nowrap print:text-black">
                        {rowPowerKw.toFixed(2)} kW
                      </td>

                      <td className="py-3 px-4 align-middle">
                        <input
                          type="text"
                          value={item.note}
                          onChange={(e) =>
                            handleNoteChange(item.id, e.target.value)
                          }
                          placeholder="VD: Mua gấp, Chờ duyệt..."
                          aria-label={`Ghi chú mua sắm ${item.name}`}
                          className="print:hidden w-full rounded-md bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                        <span className="hidden print:inline text-xs text-black">
                          {item.note || '—'}
                        </span>
                      </td>

                      <td className="print:hidden py-3 px-4 align-middle text-right whitespace-nowrap overflow-visible">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label={`Xóa ${item.name}`}
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
                <tr className="bg-slate-900/70 border-t border-slate-700 text-xs font-semibold print:bg-gray-100 print:border-gray-300 print:text-black">
                  <td className="py-3 px-4 text-slate-300 print:text-black" colSpan={4}>
                    Tổng cộng toàn danh mục mua sắm ({items.length} chủng loại)
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-emerald-400 print:text-black">
                    {totals.totalUnits}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm font-bold text-emerald-400 tabular-nums print:text-black">
                    {totals.totalPowerKw.toFixed(2)} kW
                  </td>
                  <td className="py-3 px-4" />
                  <td className="print:hidden" />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-4 sm:p-5 pb-24 space-y-4 print:p-0 print:pb-0 print:bg-white print:text-black">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2">
              {filteredItems.map((item, idx) => {
                const rowPowerKw =
                  (Number(item.quantity) || 0) * (Number(item.power) || 0);
                return (
                  <article
                    key={item.id}
                    className="rounded-xl bg-slate-900/80 border border-slate-700/80 shadow-lg p-4 flex flex-col justify-between gap-3.5 hover:border-emerald-500/40 transition-colors print:bg-white print:border-gray-300 print:shadow-none print:text-black print:break-inside-avoid"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px] text-slate-400 print:text-gray-700">
                              #{idx + 1} · {item.id}
                            </span>
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400 print:bg-white print:border-gray-400 print:text-black">
                              {item.category}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-slate-100 leading-snug print:text-black">
                            {item.name}
                          </h3>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label={`Xóa ${item.name}`}
                          title="Xóa khỏi danh mục mua sắm"
                          className="print:hidden relative z-20 cursor-pointer select-none shrink-0 inline-flex items-center gap-1 min-h-[32px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-red-950/70 border border-slate-700 hover:border-red-500/50 text-xs font-medium text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5 pointer-events-none shrink-0" />
                          <span className="pointer-events-none">Xóa</span>
                        </button>
                      </div>

                      <div className="space-y-1 text-xs text-slate-400 print:text-gray-800">
                        <div>
                          <span className="text-slate-500 print:text-gray-600">
                            Hãng SX:{' '}
                          </span>
                          <span className="text-slate-300 print:text-black">
                            {item.brand || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 print:text-gray-600">
                            Thông số:{' '}
                          </span>
                          <span className="print:text-black">
                            {item.specs || 'Chưa có mô tả thông số'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span>
                            <span className="text-slate-500 print:text-gray-600">
                              P đơn vị:{' '}
                            </span>
                            <span className="font-mono font-semibold text-slate-200 print:text-black">
                              {Number(item.power || 0).toFixed(2)} kW
                            </span>
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 print:text-gray-700">
                            ĐVT: {item.unit || 'Cái'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 space-y-2.5 print:border-gray-300">
                      <div className="grid grid-cols-3 gap-2.5 items-end">
                        <div>
                          <label
                            htmlFor={`bom-qty-${item.id}`}
                            className="block text-[11px] text-slate-400 mb-1 print:text-gray-700"
                          >
                            SL Cần mua
                          </label>
                          <input
                            id={`bom-qty-${item.id}`}
                            type="text"
                            inputMode="numeric"
                            aria-label={`Số lượng cần mua ${item.name}`}
                            value={String(item.quantity ?? 0)}
                            onChange={(e) =>
                              handleQuantityChange(item.id, e.target.value)
                            }
                            className="print:hidden w-full text-center rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm font-mono font-semibold text-emerald-400 focus:outline-none focus:border-emerald-500"
                          />
                          <span className="hidden print:inline font-mono text-sm font-semibold text-black">
                            {item.quantity} {item.unit}
                          </span>
                        </div>

                        <div className="col-span-2">
                          <label
                            htmlFor={`bom-note-${item.id}`}
                            className="block text-[11px] text-slate-400 mb-1 print:text-gray-700"
                          >
                            Ghi chú mua sắm
                          </label>
                          <input
                            id={`bom-note-${item.id}`}
                            type="text"
                            value={item.note}
                            onChange={(e) =>
                              handleNoteChange(item.id, e.target.value)
                            }
                            placeholder="VD: Mua gấp, Chờ duyệt..."
                            className="print:hidden w-full rounded-md bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                          <span className="hidden print:inline text-xs text-black">
                            {item.note || '—'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-400 print:text-gray-700">
                          Tổng công suất mục này:
                        </span>
                        <span className="font-mono text-sm font-bold text-amber-300 tabular-nums print:text-black">
                          {rowPowerKw.toFixed(2)} kW
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="rounded-lg bg-slate-900/70 border border-slate-700 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold print:bg-gray-100 print:border-gray-300 print:text-black">
              <span>
                Tổng cộng danh mục mua sắm ({items.length} chủng loại ·{' '}
                {totals.totalUnits} thiết bị)
              </span>
              <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums print:text-black">
                {totals.totalPowerKw.toFixed(2)} kW
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Modal Popup Chọn Thiết bị từ Master Database */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bom-selector-title"
          className="print:hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
        >
          <div className="w-full max-w-4xl max-h-[90dvh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 shrink-0">
              <div>
                <h2
                  id="bom-selector-title"
                  className="text-base font-bold text-slate-100 flex items-center gap-2"
                >
                  <Package className="h-5 w-5 text-emerald-400" />
                  <span>Chọn Thiết bị vào Danh mục Mua sắm (BOM)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Dữ liệu lấy từ Kho Thiết bị chuẩn ({catalog.length} thiết bị sẵn
                  có)
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

            {/* Modal Search, Filter & View Toggle */}
            <div className="p-4 sm:p-5 space-y-3 border-b border-slate-800 shrink-0">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative w-full flex-1">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    placeholder="Tìm tên thiết bị, mã hiệu, thông số, hãng..."
                    aria-label="Tìm thiết bị trong kho"
                    className="w-full min-h-[40px] pl-10 pr-10 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  {modalSearch && (
                    <button
                      type="button"
                      onClick={() => setModalSearch('')}
                      aria-label="Xóa từ khóa tìm kiếm"
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-20 cursor-pointer p-1 text-slate-400 hover:text-white"
                    >
                      <X className="h-4 w-4 pointer-events-none" />
                    </button>
                  )}
                </div>

                <select
                  value={modalCategory}
                  onChange={(e) => setModalCategory(e.target.value)}
                  aria-label="Lọc nhóm thiết bị"
                  className="sm:w-48 min-h-[40px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {modalCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                {/* Modal View Toggle Buttons */}
                <div
                  role="group"
                  aria-label="Chuyển đổi chế độ xem kho thiết bị"
                  className="inline-flex items-center gap-1 self-start sm:self-auto rounded-lg bg-slate-800 border border-slate-700 p-1 shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => setModalViewMode('table')}
                    aria-pressed={modalViewMode === 'table'}
                    title="Xem dạng Bảng (Table)"
                    className={`relative z-20 cursor-pointer select-none inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      modalViewMode === 'table'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/70'
                    }`}
                  >
                    <List className="h-4 w-4 pointer-events-none shrink-0" />
                    <span className="pointer-events-none">Bảng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalViewMode('grid')}
                    aria-pressed={modalViewMode === 'grid'}
                    title="Xem dạng Thẻ lưới (Grid)"
                    className={`relative z-20 cursor-pointer select-none inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      modalViewMode === 'grid'
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

            {/* Scrollable Catalog List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-24">
              {filteredCatalog.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  Không tìm thấy thiết bị nào trong kho phù hợp từ khóa.
                </div>
              ) : modalViewMode === 'table' ? (
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

                          <h3 className="text-sm font-semibold text-slate-100 leading-snug">
                            {item.name}
                          </h3>

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

            {/* Modal Footer: Quantity, Note & Submit */}
            <form
              onSubmit={handleConfirmAdd}
              className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/70 space-y-3 shrink-0"
            >
              {modalError && (
                <div className="rounded-lg bg-red-950/60 border border-red-500/50 px-3 py-2 text-xs text-red-200">
                  {modalError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-3">
                  <label
                    htmlFor="bom-modal-qty"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Số lượng cần mua
                  </label>
                  <input
                    id="bom-modal-qty"
                    type="text"
                    inputMode="numeric"
                    value={quantityInput}
                    onChange={(e) =>
                      setQuantityInput(sanitizeIntInput(e.target.value))
                    }
                    className="w-full min-h-[40px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm font-mono font-semibold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label
                    htmlFor="bom-modal-note"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Ghi chú (tùy chọn)
                  </label>
                  <input
                    id="bom-modal-note"
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="VD: Mua gấp, Chờ duyệt..."
                    className="w-full min-h-[40px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="relative z-20 cursor-pointer select-none min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-300"
                  >
                    <span className="pointer-events-none">Đóng</span>
                  </button>
                  <button
                    type="submit"
                    disabled={!pickedEquipment}
                    className="relative z-20 cursor-pointer select-none min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-white"
                  >
                    <span className="pointer-events-none">Thêm vào BOM</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 mr-1">
                  Gợi ý nhanh:
                </span>
                {QUICK_NOTES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNoteInput(preset)}
                    className="relative z-20 cursor-pointer select-none px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 transition-colors"
                  >
                    <span className="pointer-events-none">{preset}</span>
                  </button>
                ))}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
