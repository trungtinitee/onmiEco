import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Check,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Package,
  PackageCheck,
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
  matchesMultiKeywordSearch,
} from './EquipmentDBManager';
import { useAppContext } from '../context/AppContext';

export const getProcurementStorageKey = (projectId) =>
  `omniEco_BOM_${projectId || 'default-project'}`;

const DEFAULT_UNIT_PROCESS = 'Hạng mục chung';
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

function createBomId() {
  return `BOM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeUnitProcess(raw) {
  const trimmed = String(raw || '').trim();
  return trimmed || DEFAULT_UNIT_PROCESS;
}

function getConsolidationKey(item) {
  const rawCode = String(item?.code || '').trim();
  const rawId = String(item?.id || '').trim();
  return (rawCode || rawId).toLowerCase();
}

function loadProcurementFromStorage(storageKey) {
  if (typeof window === 'undefined' || !storageKey) return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object' && item.id && item.name)
      .map((item, index) => ({
        bomId: String(item.bomId || `BOM-LEGACY-${index}-${item.id}`),
        id: String(item.id),
        code: item.code ? String(item.code).trim() : '',
        unitProcess: normalizeUnitProcess(item.unitProcess),
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

function saveProcurementToStorage(storageKey, list) {
  if (typeof window === 'undefined' || !storageKey) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(list));
  } catch {
    // Bỏ qua nếu bộ nhớ trình duyệt đầy
  }
}

function buildBomTotals(sourceItems) {
  return sourceItems.reduce(
    (acc, item) => {
      const qty = Number(item.quantity) || 0;
      const pw = Number(item.power) || 0;
      acc.totalUnits += qty;
      acc.totalPowerKw += qty * pw;
      return acc;
    },
    { totalUnits: 0, totalPowerKw: 0 }
  );
}

function buildConsolidatedBomItems(sourceItems) {
  const map = new Map();

  sourceItems.forEach((item) => {
    const key = getConsolidationKey(item);
    const qty = Number(item.quantity) || 0;
    const trimmedNote = String(item.note || '').trim();
    const unitProc = normalizeUnitProcess(item.unitProcess);

    if (!map.has(key)) {
      map.set(key, {
        consolidationKey: key,
        id: item.id,
        code: item.code || item.id,
        category: String(item.category || 'Khác'),
        name: item.name,
        specs: item.specs || '',
        power: Number(item.power) || 0,
        brand: item.brand || '',
        unit: item.unit || 'Cái',
        quantity: qty,
        notesList: trimmedNote ? [trimmedNote] : [],
        breakdownMap: new Map([[unitProc, qty]]),
      });
    } else {
      const existing = map.get(key);
      existing.quantity += qty;
      if (trimmedNote && !existing.notesList.includes(trimmedNote)) {
        existing.notesList.push(trimmedNote);
      }
      existing.breakdownMap.set(
        unitProc,
        (existing.breakdownMap.get(unitProc) || 0) + qty
      );
    }
  });

  return Array.from(map.values()).map((entry) => {
    const unitProcessBreakdown = Array.from(entry.breakdownMap.entries())
      .map(([unitProcess, qty]) => ({ unitProcess, quantity: qty }))
      .sort((a, b) => a.unitProcess.localeCompare(b.unitProcess, 'vi'));

    return {
      consolidationKey: entry.consolidationKey,
      id: entry.id,
      code: entry.code,
      category: entry.category,
      name: entry.name,
      specs: entry.specs,
      power: entry.power,
      brand: entry.brand,
      unit: entry.unit,
      quantity: entry.quantity,
      note: entry.notesList.join('; '),
      unitProcessBreakdown,
      unitProcessSummary: unitProcessBreakdown
        .map((b) => `${b.unitProcess} (${b.quantity})`)
        .join(', '),
    };
  });
}

function buildDetailedGroupedByProcess(filteredDetailedItems) {
  const groupsMap = new Map();
  filteredDetailedItems.forEach((item) => {
    const processName = normalizeUnitProcess(item.unitProcess);
    if (!groupsMap.has(processName)) {
      groupsMap.set(processName, []);
    }
    groupsMap.get(processName).push(item);
  });

  return Array.from(groupsMap.entries())
    .sort(([procA], [procB]) => procA.localeCompare(procB, 'vi'))
    .map(([unitProcess, groupItems]) => {
      const sortedGroupItems = [...groupItems].sort((a, b) => {
        const catDiff = (a.category || '').localeCompare(
          b.category || '',
          'vi'
        );
        if (catDiff !== 0) return catDiff;
        return (a.name || '').localeCompare(b.name || '', 'vi');
      });
      const groupUnits = sortedGroupItems.reduce(
        (sum, it) => sum + (Number(it.quantity) || 0),
        0
      );
      const groupPowerKw = sortedGroupItems.reduce(
        (sum, it) =>
          sum + (Number(it.quantity) || 0) * (Number(it.power) || 0),
        0
      );
      return {
        unitProcess,
        items: sortedGroupItems,
        groupUnits,
        groupPowerKw,
      };
    });
}

function buildConsolidatedGroupedByCategory(filteredConsolidatedItems) {
  const groupsMap = new Map();
  filteredConsolidatedItems.forEach((item) => {
    const categoryName = (item.category || 'Khác').trim() || 'Khác';
    if (!groupsMap.has(categoryName)) {
      groupsMap.set(categoryName, []);
    }
    groupsMap.get(categoryName).push(item);
  });

  return Array.from(groupsMap.entries())
    .sort(([catA], [catB]) => catA.localeCompare(catB, 'vi'))
    .map(([category, groupItems]) => {
      const sortedGroupItems = [...groupItems].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'vi')
      );
      const groupUnits = sortedGroupItems.reduce(
        (sum, it) => sum + (Number(it.quantity) || 0),
        0
      );
      const groupPowerKw = sortedGroupItems.reduce(
        (sum, it) =>
          sum + (Number(it.quantity) || 0) * (Number(it.power) || 0),
        0
      );
      return {
        category,
        items: sortedGroupItems,
        groupUnits,
        groupPowerKw,
      };
    });
}

function buildBomViewDataset(sourceItems, listSearch, listCategory) {
  const unitProcSet = new Set();
  sourceItems.forEach((item) => {
    const up = String(item.unitProcess || '').trim();
    if (up) unitProcSet.add(up);
  });

  const totals = buildBomTotals(sourceItems);
  const consolidatedAllItems = buildConsolidatedBomItems(sourceItems);

  const filteredDetailedItems = sourceItems.filter((item) => {
    if (listCategory !== 'Tất cả' && item.category !== listCategory) {
      return false;
    }
    const searchableItem = {
      ...item,
      note: [item.note, item.unitProcess, item.code].filter(Boolean).join(' '),
    };
    return matchesMultiKeywordSearch(searchableItem, listSearch);
  });

  const detailedGroupedByProcess = buildDetailedGroupedByProcess(
    filteredDetailedItems
  );

  const filteredConsolidatedItems = consolidatedAllItems.filter((item) => {
    if (listCategory !== 'Tất cả' && item.category !== listCategory) {
      return false;
    }
    const searchableItem = {
      ...item,
      note: [item.note, item.unitProcessSummary, item.code]
        .filter(Boolean)
        .join(' '),
    };
    return matchesMultiKeywordSearch(searchableItem, listSearch);
  });

  const consolidatedGroupedByCategory = buildConsolidatedGroupedByCategory(
    filteredConsolidatedItems
  );

  const detailedFilteredTotals = buildBomTotals(filteredDetailedItems);
  const consolidatedFilteredTotals = buildBomTotals(filteredConsolidatedItems);

  return {
    sourceCount: sourceItems.length,
    unitProcessCount: unitProcSet.size,
    totals,
    consolidatedAllItems,
    filteredDetailedItems,
    detailedGroupedByProcess,
    filteredConsolidatedItems,
    consolidatedGroupedByCategory,
    detailedFilteredTotals,
    consolidatedFilteredTotals,
    hasAnyDetailedPower: filteredDetailedItems.some(
      (item) => Number(item.power) > 0
    ),
    hasAnyConsolidatedPower: filteredConsolidatedItems.some(
      (item) => Number(item.power) > 0
    ),
  };
}

export default function ProcurementList() {
  const {
    currentProject,
    printOptions,
    selectedUnitProcesses,
    openPrintModal,
    registerPrintUnitProcesses,
  } = useAppContext();
  const bomStorageKey = getProcurementStorageKey(currentProject?.id);

  const [bomState, setBomState] = useState(() => ({
    key: bomStorageKey,
    items: loadProcurementFromStorage(bomStorageKey),
  }));
  const items = useMemo(
    () =>
      bomState.key === bomStorageKey
        ? bomState.items
        : loadProcurementFromStorage(bomStorageKey),
    [bomState, bomStorageKey]
  );
  const [catalog, setCatalog] = useState(() => loadEquipmentsFromStorage());

  // Chế độ hiển thị BOM: 'detailed' (Chi tiết theo công trình - Mặc định) | 'consolidated' (Tổng hợp mua sắm)
  const [bomMode, setBomMode] = useState('detailed');

  const [viewMode, setViewMode] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table'
  );
  const [modalViewMode, setModalViewMode] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table'
  );

  const [listSearch, setListSearch] = useState('');
  const [listCategory, setListCategory] = useState('Tất cả');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBomId, setEditingBomId] = useState(null);
  const [modalSearch, setModalSearch] = useState('');
  const [modalCategory, setModalCategory] = useState('Tất cả');
  const [pickedEquipment, setPickedEquipment] = useState(null);
  const [unitProcessInput, setUnitProcessInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('1');
  const [noteInput, setNoteInput] = useState('');
  const [modalError, setModalError] = useState('');

  // Tự động load lại dữ liệu BOM khi chuyển đổi dự án
  useEffect(() => {
    setBomState({
      key: bomStorageKey,
      items: loadProcurementFromStorage(bomStorageKey),
    });
    setIsModalOpen(false);
    setEditingBomId(null);
    setListSearch('');
    setListCategory('Tất cả');
  }, [bomStorageKey]);

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
      } else if (e.key === bomStorageKey) {
        setBomState({
          key: bomStorageKey,
          items: loadProcurementFromStorage(bomStorageKey),
        });
      }
    };
    const onCustomUpdate = () => refreshCatalog();

    window.addEventListener('storage', onStorage);
    window.addEventListener(EQUIPMENT_UPDATED_EVENT, onCustomUpdate);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(EQUIPMENT_UPDATED_EVENT, onCustomUpdate);
    };
  }, [refreshCatalog, bomStorageKey]);

  // Đóng modal bằng phím Escape
  useEffect(() => {
    if (!isModalOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
        setEditingBomId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen]);

  const updateItems = useCallback(
    (updater) => {
      setBomState((prev) => {
        const currentItems =
          prev.key === bomStorageKey
            ? prev.items
            : loadProcurementFromStorage(bomStorageKey);
        const next =
          typeof updater === 'function' ? updater(currentItems) : updater;
        saveProcurementToStorage(bomStorageKey, next);
        return { key: bomStorageKey, items: next };
      });
    },
    [bomStorageKey]
  );

  // Danh sách gợi ý Hạng mục / Công trình đã có trong BOM (unique & sorted)
  const unitProcessOptions = useMemo(() => {
    const uniqueSet = new Set();
    items.forEach((item) => {
      const up = normalizeUnitProcess(item.unitProcess);
      if (up) uniqueSet.add(up);
    });
    return Array.from(uniqueSet).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [items]);

  // Đồng bộ danh sách hạng mục công trình vào AppContext để Modal In ấn trích xuất
  useEffect(() => {
    registerPrintUnitProcesses(unitProcessOptions);
  }, [unitProcessOptions, registerPrintUnitProcesses]);

  useEffect(() => {
    return () => {
      registerPrintUnitProcesses([]);
    };
  }, [registerPrintUnitProcesses]);

  const selectedUnitProcessSet = useMemo(
    () => new Set(selectedUnitProcesses),
    [selectedUnitProcesses]
  );

  const isUnitProcessPrintFiltered = useMemo(
    () =>
      unitProcessOptions.length > 0 &&
      unitProcessOptions.some((proc) => !selectedUnitProcessSet.has(proc)),
    [unitProcessOptions, selectedUnitProcessSet]
  );

  const screenData = useMemo(
    () => buildBomViewDataset(items, listSearch, listCategory),
    [items, listSearch, listCategory]
  );

  const printFilteredItems = useMemo(() => {
    if (!isUnitProcessPrintFiltered) return items;
    return items.filter((item) =>
      selectedUnitProcessSet.has(normalizeUnitProcess(item.unitProcess))
    );
  }, [items, isUnitProcessPrintFiltered, selectedUnitProcessSet]);

  const printData = useMemo(
    () =>
      isUnitProcessPrintFiltered
        ? buildBomViewDataset(printFilteredItems, listSearch, listCategory)
        : screenData,
    [
      isUnitProcessPrintFiltered,
      printFilteredItems,
      listSearch,
      listCategory,
      screenData,
    ]
  );

  const { totals, consolidatedAllItems } = screenData;

  const listCategories = useMemo(() => {
    const set = new Set(items.map((item) => item.category).filter(Boolean));
    return ['Tất cả', ...Array.from(set)];
  }, [items]);

  const modalCategories = useMemo(() => {
    const set = new Set(catalog.map((c) => c.category).filter(Boolean));
    return ['Tất cả', ...Array.from(set)];
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      if (modalCategory !== 'Tất cả' && item.category !== modalCategory) {
        return false;
      }
      return matchesMultiKeywordSearch(item, modalSearch);
    });
  }, [catalog, modalSearch, modalCategory]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingBomId(null);
    setModalError('');
  }, []);

  const openAddModal = useCallback(() => {
    refreshCatalog();
    setEditingBomId(null);
    setModalSearch('');
    setModalCategory('Tất cả');
    setPickedEquipment(null);
    setUnitProcessInput('');
    setQuantityInput('1');
    setNoteInput('');
    setModalError('');
    setIsModalOpen(true);
  }, [refreshCatalog]);

  const openEditModal = useCallback(
    (bomItem) => {
      const latestCatalog = loadEquipmentsFromStorage();
      setCatalog(latestCatalog);

      const matched =
        latestCatalog.find((eq) => eq.id === bomItem.id) || {
          id: bomItem.id,
          code: bomItem.code || '',
          category: bomItem.category,
          name: bomItem.name,
          specs: bomItem.specs,
          power: bomItem.power,
          brand: bomItem.brand,
          unit: bomItem.unit || 'Cái',
        };

      setEditingBomId(bomItem.bomId);
      setModalSearch('');
      setModalCategory('Tất cả');
      setPickedEquipment(matched);
      setUnitProcessInput(bomItem.unitProcess || '');
      setQuantityInput(String(bomItem.quantity ?? 1));
      setNoteInput(bomItem.note || '');
      setModalError('');
      setIsModalOpen(true);
    },
    []
  );

  const handleSaveModal = useCallback(
    (e) => {
      e.preventDefault();
      if (!pickedEquipment) {
        setModalError('Vui lòng chọn một thiết bị trong danh sách bên trên.');
        return;
      }
      const trimmedUnitProcess = unitProcessInput.trim();
      if (!trimmedUnitProcess) {
        setModalError(
          'Vui lòng nhập Hạng mục / Công trình (Bắt buộc) cho thiết bị này.'
        );
        return;
      }
      const qty = parsePositiveInt(quantityInput, 0);
      if (qty <= 0) {
        setModalError('Số lượng cần mua phải lớn hơn 0.');
        return;
      }
      const trimmedNote = noteInput.trim();

      if (editingBomId) {
        updateItems((prev) =>
          prev.map((item) =>
            item.bomId === editingBomId
              ? {
                  ...item,
                  id: pickedEquipment.id,
                  code: pickedEquipment.code
                    ? String(pickedEquipment.code).trim()
                    : item.code || '',
                  unitProcess: trimmedUnitProcess,
                  category: pickedEquipment.category,
                  name: pickedEquipment.name,
                  specs: pickedEquipment.specs,
                  power: Number(pickedEquipment.power) || 0,
                  brand: pickedEquipment.brand,
                  unit: pickedEquipment.unit || 'Cái',
                  quantity: qty,
                  note: trimmedNote,
                }
              : item
          )
        );
      } else {
        updateItems((prev) => {
          const normalizedTargetProcess = trimmedUnitProcess.toLowerCase();
          const existingIdx = prev.findIndex(
            (i) =>
              i.id === pickedEquipment.id &&
              normalizeUnitProcess(i.unitProcess).toLowerCase() ===
                normalizedTargetProcess
          );
          if (existingIdx >= 0) {
            return prev.map((item, idx) =>
              idx === existingIdx
                ? {
                    ...item,
                    unitProcess: trimmedUnitProcess,
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
              bomId: createBomId(),
              id: pickedEquipment.id,
              code: pickedEquipment.code
                ? String(pickedEquipment.code).trim()
                : '',
              unitProcess: trimmedUnitProcess,
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
      }

      closeModal();
    },
    [
      pickedEquipment,
      unitProcessInput,
      quantityInput,
      noteInput,
      editingBomId,
      updateItems,
      closeModal,
    ]
  );

  const handleQuantityChange = useCallback(
    (bomId, rawValue) => {
      const sanitized = sanitizeIntInput(rawValue);
      const parsed = sanitized === '' ? 0 : parsePositiveInt(sanitized, 0);
      updateItems((prev) =>
        prev.map((item) =>
          item.bomId === bomId ? { ...item, quantity: parsed } : item
        )
      );
    },
    [updateItems]
  );

  const handleNoteChange = useCallback(
    (bomId, rawNote) => {
      updateItems((prev) =>
        prev.map((item) =>
          item.bomId === bomId ? { ...item, note: rawNote } : item
        )
      );
    },
    [updateItems]
  );

  const handleRemoveItem = useCallback(
    (bomId) => {
      updateItems((prev) => prev.filter((item) => item.bomId !== bomId));
    },
    [updateItems]
  );

  const handleExportExcel = useCallback(() => {
    if (items.length === 0) return;

    const dateStamp = new Date().toISOString().slice(0, 10);
    let csvLines = [];
    let filename = '';

    if (bomMode === 'detailed') {
      const headers = [
        'Hạng mục / Công trình',
        'Mã/Nhóm',
        'Tên thiết bị',
        'Thông số kỹ thuật',
        'Công suất (kW)',
        'Hãng SX',
        'ĐVT',
        'Số lượng',
        'Ghi chú',
      ];

      const sortedDetailed = [...items].sort((a, b) => {
        const procA = normalizeUnitProcess(a.unitProcess);
        const procB = normalizeUnitProcess(b.unitProcess);
        const procDiff = procA.localeCompare(procB, 'vi');
        if (procDiff !== 0) return procDiff;
        const catDiff = (a.category || 'Khác').localeCompare(
          b.category || 'Khác',
          'vi'
        );
        if (catDiff !== 0) return catDiff;
        return (a.name || '').localeCompare(b.name || '', 'vi');
      });

      const rows = sortedDetailed.map((item) => [
        normalizeUnitProcess(item.unitProcess),
        `${item.id} - ${item.category}`,
        item.name,
        item.specs || '',
        Number(item.power || 0).toFixed(2),
        item.brand || '',
        item.unit || 'Cái',
        Number(item.quantity) || 0,
        item.note || '',
      ]);

      const summaryRow = [
        'TỔNG CỘNG',
        `${unitProcessOptions.length} hạng mục`,
        `${items.length} dòng thiết bị`,
        '',
        totals.totalPowerKw.toFixed(2),
        '',
        '',
        totals.totalUnits,
        `Tổng công suất: ${totals.totalPowerKw.toFixed(2)} kW`,
      ];

      csvLines = [headers, ...rows, summaryRow].map((line) =>
        line.map(escapeCsvCell).join(',')
      );
      filename = `omnieco-bom-chi-tiet-cong-trinh-${dateStamp}.csv`;
    } else {
      const headers = [
        'Mã/Nhóm',
        'Tên thiết bị',
        'Thông số kỹ thuật',
        'Công suất (kW)',
        'Hãng SX',
        'ĐVT',
        'Số lượng',
        'Ghi chú',
      ];

      const sortedConsolidated = [...consolidatedAllItems].sort((a, b) => {
        const catA = (a.category || 'Khác').trim() || 'Khác';
        const catB = (b.category || 'Khác').trim() || 'Khác';
        const catDiff = catA.localeCompare(catB, 'vi');
        if (catDiff !== 0) return catDiff;
        return (a.name || '').localeCompare(b.name || '', 'vi');
      });

      const rows = sortedConsolidated.map((item) => [
        `${item.id} - ${item.category}`,
        item.name,
        item.specs || '',
        Number(item.power || 0).toFixed(2),
        item.brand || '',
        item.unit || 'Cái',
        Number(item.quantity) || 0,
        item.note || '',
      ]);

      const summaryRow = [
        'TỔNG CỘNG',
        `${consolidatedAllItems.length} chủng loại thiết bị tổng hợp`,
        '',
        totals.totalPowerKw.toFixed(2),
        '',
        '',
        totals.totalUnits,
        `Tổng công suất: ${totals.totalPowerKw.toFixed(2)} kW`,
      ];

      csvLines = [headers, ...rows, summaryRow].map((line) =>
        line.map(escapeCsvCell).join(',')
      );
      filename = `omnieco-bom-tong-hop-mua-sam-${dateStamp}.csv`;
    }

    const csvContent = `\uFEFF${csvLines.join('\r\n')}`;
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [bomMode, items, consolidatedAllItems, totals, unitProcessOptions.length]);

  const handlePrint = useCallback(() => {
    openPrintModal('Danh mục Thiết bị Cần Mua sắm (BOM)');
  }, [openPrintModal]);

  const showPrintProject = Boolean(printOptions?.showProjectInfo);
  const showPrintNotes = Boolean(printOptions?.showDetailedNotes);

  const renderSummaryKpis = (dataset) => {
    const activePower =
      bomMode === 'detailed'
        ? dataset.hasAnyDetailedPower
        : dataset.hasAnyConsolidatedPower;
    return (
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-4 print:bg-white print:border print:border-gray-300 print:shadow-none print:text-black">
          <div className="flex items-center justify-between text-xs text-slate-400 print:text-gray-700">
            <span>
              {bomMode === 'detailed'
                ? 'Số dòng bóc tách theo công trình'
                : 'Số chủng loại tổng hợp đặt mua'}
            </span>
            <Package className="h-4 w-4 text-emerald-400 print:text-black" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-100 tabular-nums print:text-black">
            {bomMode === 'detailed'
              ? dataset.sourceCount
              : dataset.consolidatedAllItems.length}{' '}
            <span className="text-xs font-sans font-normal text-slate-400 print:text-gray-700">
              {bomMode === 'detailed'
                ? `mục (${dataset.unitProcessCount} hạng mục)`
                : 'chủng loại'}
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-4 print:bg-white print:border print:border-gray-300 print:shadow-none print:text-black">
          <div className="flex items-center justify-between text-xs text-slate-400 print:text-gray-700">
            <span>Tổng số lượng đặt hàng</span>
            <ShoppingCart className="h-4 w-4 text-sky-400 print:text-black" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-100 tabular-nums print:text-black">
            {dataset.totals.totalUnits}{' '}
            <span className="text-xs font-sans font-normal text-slate-400 print:text-gray-700">
              đơn vị thiết bị
            </span>
          </div>
        </div>

        <div
          className={`rounded-xl bg-slate-800 border border-slate-700/80 p-4 print:bg-white print:border print:border-gray-300 print:shadow-none print:text-black ${
            !activePower ? 'print:hidden' : ''
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 print:text-gray-700">
            <span>Tổng công suất điện danh mục</span>
            <Zap className="h-4 w-4 text-amber-400 print:text-black" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-emerald-400 tabular-nums print:text-black">
            {dataset.totals.totalPowerKw.toFixed(2)}{' '}
            <span className="text-xs font-sans font-normal text-slate-400 print:text-gray-700">
              kW
            </span>
          </div>
        </div>
      </section>
    );
  };

  const renderBomListSection = (dataset, isPrintOnly = false) => {
    const hasResults =
      bomMode === 'detailed'
        ? dataset.filteredDetailedItems.length > 0
        : dataset.filteredConsolidatedItems.length > 0;
    const activeProcessesLabel = selectedUnitProcesses
      .filter((proc) => unitProcessOptions.includes(proc))
      .join(', ');

    return (
      <div
        className={
          isPrintOnly
            ? 'hidden print:block space-y-5'
            : isUnitProcessPrintFiltered
              ? 'print:hidden space-y-5'
              : 'space-y-5'
        }
      >
        {/* Print Mode Subtitle */}
        {dataset.sourceCount > 0 && (
          <div className="hidden print:block text-sm font-semibold text-black border-b border-gray-300 pb-2 space-y-0.5">
            <div>
              {bomMode === 'detailed'
                ? 'Chế độ: Chi tiết bóc tách theo từng Hạng mục / Công trình'
                : 'Chế độ: Tổng hợp mua sắm toàn dự án (Đã cộng dồn theo mã thiết bị)'}
            </div>
            {isUnitProcessPrintFiltered && activeProcessesLabel && (
              <div className="text-xs font-normal text-gray-800">
                Hạng mục đang in:{' '}
                <span className="font-semibold text-black">
                  {activeProcessesLabel}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Procurement BOM List (Detailed by UnitProcess OR Consolidated by Category) */}
        <section className="space-y-5 pb-24 print:pb-0 print:bg-white print:text-black">
          {dataset.sourceCount === 0 ? (
            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-10 text-center space-y-3 print:bg-white print:border-gray-300 print:text-black">
              <ShoppingCart className="h-10 w-10 text-slate-600 mx-auto print:hidden" />
              <h2 className="text-base font-semibold text-slate-200 print:text-black">
                {isPrintOnly
                  ? 'Không có hạng mục nào được chọn để in'
                  : 'Danh mục mua sắm (BOM) đang trống'}
              </h2>
              {!isPrintOnly && (
                <>
                  <p className="text-sm text-slate-400 max-w-md mx-auto print:text-gray-700">
                    Nhấn nút{' '}
                    <strong className="text-slate-200 print:text-black">
                      &ldquo;Thêm thiết bị&rdquo;
                    </strong>{' '}
                    để chọn máy móc từ Kho Thiết bị Cơ điện, gắn cho từng Hạng
                    mục / Công trình và nhập số lượng cần đặt.
                  </p>
                  <div className="print:hidden pt-1">
                    <button
                      type="button"
                      onClick={openAddModal}
                      className="relative z-20 cursor-pointer select-none inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white transition-colors"
                    >
                      <Plus className="h-4 w-4 pointer-events-none shrink-0" />
                      <span className="pointer-events-none">
                        Thêm thiết bị đầu tiên
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : !hasResults ? (
            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-10 text-center space-y-2 text-sm text-slate-400 print:bg-white print:border-gray-300 print:text-black">
              Không tìm thấy thiết bị nào trong danh mục mua sắm khớp với bộ lọc
              hiện tại.
            </div>
          ) : bomMode === 'detailed' ? (
            <>
              {dataset.detailedGroupedByProcess.map((group) => {
                const groupHasPower = group.items.some(
                  (item) => Number(item.power) > 0
                );
                return (
              <div
                key={group.unitProcess}
                className="rounded-xl bg-slate-800 border border-slate-700/80 overflow-visible print:bg-white print:border print:border-gray-300 print:shadow-none print:text-black print:overflow-visible"
              >
                {/* Unit Process Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3.5 bg-slate-900/95 border-b border-slate-700/80 rounded-t-xl print:bg-gray-100 print:border-gray-300 print:break-inside-avoid">
                  <h3 className="text-sm sm:text-base font-bold text-emerald-400 flex items-center gap-2 print:text-black">
                    <Building2 className="h-4 w-4 shrink-0 text-emerald-400 print:text-black" />
                    <span>{group.unitProcess}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 print:bg-white print:border-gray-400 print:text-black">
                      {group.items.length} vật tư
                    </span>
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono tabular-nums print:text-black">
                    <span>
                      SL:{' '}
                      <strong className="text-slate-200 print:text-black">
                        {group.groupUnits}
                      </strong>
                    </span>
                    <span
                      aria-hidden="true"
                      className={!groupHasPower ? 'print:hidden' : ''}
                    >
                      ·
                    </span>
                    <span className={!groupHasPower ? 'print:hidden' : ''}>
                      Tổng P:{' '}
                      <strong className="text-amber-300 print:text-black">
                        {group.groupPowerKw.toFixed(2)} kW
                      </strong>
                    </span>
                  </div>
                </div>

                {viewMode === 'table' ? (
                  <div className="overflow-x-auto print:overflow-visible print:bg-white print:text-black">
                    <table className="w-full text-left border-collapse text-sm print:text-black">
                      <thead>
                        <tr className="bg-slate-900/60 border-b border-slate-700 text-xs uppercase tracking-wider text-slate-400 print:bg-gray-50 print:text-black print:border-gray-300">
                          <th className="py-3 px-4 font-semibold whitespace-nowrap">
                            STT / Mã
                          </th>
                          <th className="py-3 px-4 font-semibold">
                            Thiết bị & Thông số kỹ thuật
                          </th>
                          <th className="py-3 px-4 font-semibold">Hãng SX</th>
                          <th
                            className={`py-3 px-4 font-semibold text-right whitespace-nowrap ${
                              !groupHasPower ? 'print:hidden' : ''
                            }`}
                          >
                            P đơn vị (kW)
                          </th>
                          <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">
                            Số lượng
                          </th>
                          <th
                            className={`py-3 px-4 font-semibold text-right whitespace-nowrap ${
                              !groupHasPower ? 'print:hidden' : ''
                            }`}
                          >
                            Tổng P (kW)
                          </th>
                          <th
                            className={`py-3 px-4 font-semibold min-w-[180px] ${
                              !showPrintNotes ? 'print:hidden' : ''
                            }`}
                          >
                            Ghi chú mua sắm
                          </th>
                          <th className="print:hidden py-3 px-4 font-semibold text-right whitespace-nowrap">
                            Thao tác
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/70 print:divide-gray-300">
                        {group.items.map((item, idx) => {
                          const rowPowerKw =
                            (Number(item.quantity) || 0) *
                            (Number(item.power) || 0);
                          return (
                            <tr
                              key={item.bomId}
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
                                <div
                                  className={`mt-0.5 text-xs text-slate-400 print:text-gray-700 ${
                                    !showPrintNotes ? 'print:hidden' : ''
                                  }`}
                                >
                                  {item.specs || 'Chưa có mô tả thông số'}
                                </div>
                              </td>

                              <td className="py-3 px-4 align-top text-xs text-slate-300 min-w-[120px] print:text-black">
                                {item.brand || '—'}
                              </td>

                              <td
                                className={`py-3 px-4 align-middle text-right font-mono text-slate-200 tabular-nums whitespace-nowrap print:text-black ${
                                  !groupHasPower ? 'print:hidden' : ''
                                }`}
                              >
                                {Number(item.power || 0).toFixed(2)}
                              </td>

                              <td className="py-3 px-4 align-middle text-center whitespace-nowrap">
                                <div className="print:hidden inline-flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    aria-label={`Số lượng cần mua ${item.name} (${item.unitProcess})`}
                                    value={String(item.quantity ?? 0)}
                                    onChange={(e) =>
                                      handleQuantityChange(
                                        item.bomId,
                                        e.target.value
                                      )
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

                              <td
                                className={`py-3 px-4 align-middle text-right font-mono font-bold text-amber-300 tabular-nums whitespace-nowrap print:text-black ${
                                  !groupHasPower ? 'print:hidden' : ''
                                }`}
                              >
                                {rowPowerKw.toFixed(2)} kW
                              </td>

                              <td
                                className={`py-3 px-4 align-middle ${
                                  !showPrintNotes ? 'print:hidden' : ''
                                }`}
                              >
                                <input
                                  type="text"
                                  value={item.note}
                                  onChange={(e) =>
                                    handleNoteChange(item.bomId, e.target.value)
                                  }
                                  placeholder="VD: Mua gấp, Chờ duyệt..."
                                  aria-label={`Ghi chú mua sắm ${item.name} (${item.unitProcess})`}
                                  className="print:hidden w-full rounded-md bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                                />
                                <span className="hidden print:inline text-xs text-black">
                                  {item.note || '—'}
                                </span>
                              </td>

                              <td className="print:hidden py-3 px-4 align-middle text-right whitespace-nowrap overflow-visible">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(item)}
                                    aria-label={`Sửa ${item.name}`}
                                    title="Chỉnh sửa hạng mục / số lượng / thiết bị"
                                    className="relative z-20 cursor-pointer select-none inline-flex items-center justify-center min-h-[36px] min-w-[36px] p-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 hover:border-sky-500/50 text-sky-400 transition-colors"
                                  >
                                    <Edit3 className="h-4 w-4 pointer-events-none" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(item.bomId)}
                                    aria-label={`Xóa ${item.name}`}
                                    title="Xóa khỏi danh mục"
                                    className="relative z-20 cursor-pointer select-none inline-flex items-center justify-center min-h-[36px] min-w-[36px] p-1.5 rounded-lg bg-slate-900 hover:bg-red-950/70 border border-slate-700 hover:border-red-500/50 text-red-400 transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4 pointer-events-none" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 sm:p-5 print:p-3 print:bg-white print:text-black">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2">
                      {group.items.map((item, idx) => {
                        const rowPowerKw =
                          (Number(item.quantity) || 0) *
                          (Number(item.power) || 0);
                        return (
                          <article
                            key={item.bomId}
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
                                  <h4 className="text-sm font-semibold text-slate-100 leading-snug print:text-black">
                                    {item.name}
                                  </h4>
                                </div>

                                <div className="print:hidden flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(item)}
                                    aria-label={`Sửa ${item.name}`}
                                    title="Chỉnh sửa thiết bị trong BOM"
                                    className="relative z-20 cursor-pointer select-none inline-flex items-center gap-1 min-h-[32px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-sky-500/50 text-xs font-medium text-sky-400 transition-colors"
                                  >
                                    <Edit3 className="h-3.5 w-3.5 pointer-events-none shrink-0" />
                                    <span className="pointer-events-none">
                                      Sửa
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(item.bomId)}
                                    aria-label={`Xóa ${item.name}`}
                                    title="Xóa khỏi danh mục mua sắm"
                                    className="relative z-20 cursor-pointer select-none inline-flex items-center gap-1 min-h-[32px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-red-950/70 border border-slate-700 hover:border-red-500/50 text-xs font-medium text-red-400 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 pointer-events-none shrink-0" />
                                    <span className="pointer-events-none">
                                      Xóa
                                    </span>
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1 text-xs text-slate-400 print:text-gray-800">
                                <div>
                                  <span className="text-slate-500 print:text-gray-600">
                                    Hạng mục:{' '}
                                  </span>
                                  <span className="text-emerald-300 font-medium print:text-black">
                                    {item.unitProcess}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500 print:text-gray-600">
                                    Hãng SX:{' '}
                                  </span>
                                  <span className="text-slate-300 print:text-black">
                                    {item.brand || '—'}
                                  </span>
                                </div>
                                <div className={!showPrintNotes ? 'print:hidden' : ''}>
                                  <span className="text-slate-500 print:text-gray-600">
                                    Thông số:{' '}
                                  </span>
                                  <span className="print:text-black">
                                    {item.specs || 'Chưa có mô tả thông số'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2 pt-0.5">
                                  <span className={!groupHasPower ? 'print:hidden' : ''}>
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
                                    htmlFor={`bom-qty-${item.bomId}`}
                                    className="block text-[11px] text-slate-400 mb-1 print:text-gray-700"
                                  >
                                    Số lượng
                                  </label>
                                  <input
                                    id={`bom-qty-${item.bomId}`}
                                    type="text"
                                    inputMode="numeric"
                                    aria-label={`Số lượng cần mua ${item.name}`}
                                    value={String(item.quantity ?? 0)}
                                    onChange={(e) =>
                                      handleQuantityChange(
                                        item.bomId,
                                        e.target.value
                                      )
                                    }
                                    className="print:hidden w-full text-center rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm font-mono font-semibold text-emerald-400 focus:outline-none focus:border-emerald-500"
                                  />
                                  <span className="hidden print:inline font-mono text-sm font-semibold text-black">
                                    {item.quantity} {item.unit}
                                  </span>
                                </div>

                                <div
                                  className={`col-span-2 ${
                                    !showPrintNotes ? 'print:hidden' : ''
                                  }`}
                                >
                                  <label
                                    htmlFor={`bom-note-${item.bomId}`}
                                    className="block text-[11px] text-slate-400 mb-1 print:text-gray-700"
                                  >
                                    Ghi chú mua sắm
                                  </label>
                                  <input
                                    id={`bom-note-${item.bomId}`}
                                    type="text"
                                    value={item.note}
                                    onChange={(e) =>
                                      handleNoteChange(
                                        item.bomId,
                                        e.target.value
                                      )
                                    }
                                    placeholder="VD: Mua gấp, Chờ duyệt..."
                                    className="print:hidden w-full rounded-md bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                                  />
                                  <span className="hidden print:inline text-xs text-black">
                                    {item.note || '—'}
                                  </span>
                                </div>
                              </div>

                              <div
                                className={`flex items-center justify-between text-xs pt-1 ${
                                  !groupHasPower ? 'print:hidden' : ''
                                }`}
                              >
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
                  </div>
                )}
              </div>
              );
            })}

            {/* Grand Total Summary (Detailed) */}
            <div className="rounded-xl bg-slate-900/90 border border-slate-700 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold print:bg-gray-100 print:border-gray-300 print:text-black print:break-inside-avoid">
              <span>
                Tổng cộng chi tiết theo công trình (
                {dataset.detailedGroupedByProcess.length} hạng mục ·{' '}
                {dataset.filteredDetailedItems.length} dòng vật tư ·{' '}
                {dataset.detailedFilteredTotals.totalUnits} thiết bị)
              </span>
              <span
                className={`font-mono text-sm font-bold text-emerald-400 tabular-nums print:text-black ${
                  !dataset.hasAnyDetailedPower ? 'print:hidden' : ''
                }`}
              >
                {dataset.detailedFilteredTotals.totalPowerKw.toFixed(2)} kW
              </span>
            </div>
          </>
        ) : (
          <>
            {/* Consolidated Mode Grouped by Category (Read-only) */}
            {dataset.consolidatedGroupedByCategory.map((group) => {
              const groupHasPower = group.items.some(
                (item) => Number(item.power) > 0
              );
              return (
              <div
                key={group.category}
                className="rounded-xl bg-slate-800 border border-slate-700/80 overflow-visible print:bg-white print:border print:border-gray-300 print:shadow-none print:text-black print:overflow-visible"
              >
                {/* Category Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3.5 bg-slate-900/95 border-b border-slate-700/80 rounded-t-xl print:bg-gray-100 print:border-gray-300 print:break-inside-avoid">
                  <h3 className="text-sm sm:text-base font-bold text-sky-400 flex items-center gap-2 print:text-black">
                    <Layers className="h-4 w-4 shrink-0 text-sky-400 print:text-black" />
                    <span>{group.category}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 print:bg-white print:border-gray-400 print:text-black">
                      {group.items.length} chủng loại
                    </span>
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono tabular-nums print:text-black">
                    <span>
                      Tổng SL:{' '}
                      <strong className="text-slate-200 print:text-black">
                        {group.groupUnits}
                      </strong>
                    </span>
                    <span
                      aria-hidden="true"
                      className={!groupHasPower ? 'print:hidden' : ''}
                    >
                      ·
                    </span>
                    <span className={!groupHasPower ? 'print:hidden' : ''}>
                      Tổng P:{' '}
                      <strong className="text-amber-300 print:text-black">
                        {group.groupPowerKw.toFixed(2)} kW
                      </strong>
                    </span>
                  </div>
                </div>

                {viewMode === 'table' ? (
                  <div className="overflow-x-auto print:overflow-visible print:bg-white print:text-black">
                    <table className="w-full text-left border-collapse text-sm print:text-black">
                      <thead>
                        <tr className="bg-slate-900/60 border-b border-slate-700 text-xs uppercase tracking-wider text-slate-400 print:bg-gray-50 print:text-black print:border-gray-300">
                          <th className="py-3 px-4 font-semibold whitespace-nowrap">
                            STT / Mã
                          </th>
                          <th className="py-3 px-4 font-semibold">
                            Thiết bị, Thông số & Phân bổ
                          </th>
                          <th className="py-3 px-4 font-semibold">Hãng SX</th>
                          <th
                            className={`py-3 px-4 font-semibold text-right whitespace-nowrap ${
                              !groupHasPower ? 'print:hidden' : ''
                            }`}
                          >
                            P đơn vị (kW)
                          </th>
                          <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">
                            Số lượng
                          </th>
                          <th
                            className={`py-3 px-4 font-semibold text-right whitespace-nowrap ${
                              !groupHasPower ? 'print:hidden' : ''
                            }`}
                          >
                            Tổng P (kW)
                          </th>
                          <th
                            className={`py-3 px-4 font-semibold min-w-[180px] ${
                              !showPrintNotes ? 'print:hidden' : ''
                            }`}
                          >
                            Ghi chú tổng hợp
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/70 print:divide-gray-300">
                        {group.items.map((item, idx) => {
                          const rowPowerKw =
                            (Number(item.quantity) || 0) *
                            (Number(item.power) || 0);
                          return (
                            <tr
                              key={item.consolidationKey}
                              className="hover:bg-slate-900/40 transition-colors print:bg-white print:hover:bg-white"
                            >
                              <td className="py-3 px-4 align-top whitespace-nowrap">
                                <div className="font-mono text-xs text-slate-400 print:text-black">
                                  #{idx + 1} · {item.id}
                                </div>
                                <span className="mt-1 inline-block rounded bg-slate-900 border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-sky-400 print:bg-white print:border-gray-400 print:text-black">
                                  {item.category}
                                </span>
                              </td>

                              <td className="py-3 px-4 align-top min-w-[230px]">
                                <div className="font-semibold text-slate-100 print:text-black">
                                  {item.name}
                                </div>
                                <div
                                  className={`mt-0.5 text-xs text-slate-400 print:text-gray-700 ${
                                    !showPrintNotes ? 'print:hidden' : ''
                                  }`}
                                >
                                  {item.specs || 'Chưa có mô tả thông số'}
                                </div>
                                {item.unitProcessSummary && (
                                  <div
                                    className={`mt-1 text-[11px] text-emerald-400/90 print:text-gray-700 ${
                                      !showPrintNotes ? 'print:hidden' : ''
                                    }`}
                                  >
                                    Phân bổ: {item.unitProcessSummary}
                                  </div>
                                )}
                              </td>

                              <td className="py-3 px-4 align-top text-xs text-slate-300 min-w-[120px] print:text-black">
                                {item.brand || '—'}
                              </td>

                              <td
                                className={`py-3 px-4 align-middle text-right font-mono text-slate-200 tabular-nums whitespace-nowrap print:text-black ${
                                  !groupHasPower ? 'print:hidden' : ''
                                }`}
                              >
                                {Number(item.power || 0).toFixed(2)}
                              </td>

                              <td className="py-3 px-4 align-middle text-center whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-900 border border-slate-700 px-2.5 py-1 font-mono text-sm font-bold text-emerald-400 tabular-nums print:bg-white print:border-gray-400 print:text-black">
                                  {item.quantity}
                                  <span className="text-xs font-sans font-normal text-slate-400 print:text-black">
                                    {item.unit}
                                  </span>
                                </span>
                              </td>

                              <td
                                className={`py-3 px-4 align-middle text-right font-mono font-bold text-amber-300 tabular-nums whitespace-nowrap print:text-black ${
                                  !groupHasPower ? 'print:hidden' : ''
                                }`}
                              >
                                {rowPowerKw.toFixed(2)} kW
                              </td>

                              <td
                                className={`py-3 px-4 align-middle text-xs text-slate-300 print:text-black ${
                                  !showPrintNotes ? 'print:hidden' : ''
                                }`}
                              >
                                {item.note || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 sm:p-5 print:p-3 print:bg-white print:text-black">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2">
                      {group.items.map((item, idx) => {
                        const rowPowerKw =
                          (Number(item.quantity) || 0) *
                          (Number(item.power) || 0);
                        return (
                          <article
                            key={item.consolidationKey}
                            className="rounded-xl bg-slate-900/80 border border-slate-700/80 shadow-lg p-4 flex flex-col justify-between gap-3.5 print:bg-white print:border-gray-300 print:shadow-none print:text-black print:break-inside-avoid"
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-mono text-[11px] text-slate-400 print:text-gray-700">
                                      #{idx + 1} · {item.id}
                                    </span>
                                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-400 print:bg-white print:border-gray-400 print:text-black">
                                      {item.category}
                                    </span>
                                  </div>
                                  <h4 className="text-sm font-semibold text-slate-100 leading-snug print:text-black">
                                    {item.name}
                                  </h4>
                                </div>

                                <span className="shrink-0 rounded-md bg-slate-800 border border-slate-700 px-2.5 py-1 font-mono text-sm font-bold text-emerald-400 tabular-nums print:bg-white print:border-gray-400 print:text-black">
                                  {item.quantity} {item.unit}
                                </span>
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
                                <div className={!showPrintNotes ? 'print:hidden' : ''}>
                                  <span className="text-slate-500 print:text-gray-600">
                                    Thông số:{' '}
                                  </span>
                                  <span className="print:text-black">
                                    {item.specs || 'Chưa có mô tả thông số'}
                                  </span>
                                </div>
                                {item.unitProcessSummary && (
                                  <div
                                    className={`text-[11px] text-emerald-400/90 print:text-gray-700 ${
                                      !showPrintNotes ? 'print:hidden' : ''
                                    }`}
                                  >
                                    <span className="text-slate-500 print:text-gray-600">
                                      Phân bổ công trình:{' '}
                                    </span>
                                    {item.unitProcessSummary}
                                  </div>
                                )}
                                <div className="flex items-center justify-between gap-2 pt-0.5">
                                  <span className={!groupHasPower ? 'print:hidden' : ''}>
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

                            <div
                              className={`pt-3 border-t border-slate-800 space-y-2 print:border-gray-300 ${
                                !showPrintNotes && !groupHasPower ? 'print:hidden' : ''
                              }`}
                            >
                              <div
                                className={`text-xs ${
                                  !showPrintNotes ? 'print:hidden' : ''
                                }`}
                              >
                                <span className="text-slate-500 print:text-gray-700">
                                  Ghi chú tổng hợp:{' '}
                                </span>
                                <span className="text-slate-300 print:text-black">
                                  {item.note || '—'}
                                </span>
                              </div>

                              <div
                                className={`flex items-center justify-between text-xs ${
                                  !groupHasPower ? 'print:hidden' : ''
                                }`}
                              >
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
                  </div>
                )}
              </div>
              );
            })}

            {/* Grand Total Summary (Consolidated) */}
            <div className="rounded-xl bg-slate-900/90 border border-slate-700 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold print:bg-gray-100 print:border-gray-300 print:text-black print:break-inside-avoid">
              <span>
                Tổng hợp toàn danh mục mua sắm (
                {dataset.consolidatedGroupedByCategory.length} nhóm vật tư ·{' '}
                {dataset.filteredConsolidatedItems.length} chủng loại ·{' '}
                {dataset.consolidatedFilteredTotals.totalUnits} thiết bị)
              </span>
              <span
                className={`font-mono text-sm font-bold text-emerald-400 tabular-nums print:text-black ${
                  !dataset.hasAnyConsolidatedPower ? 'print:hidden' : ''
                }`}
              >
                {dataset.consolidatedFilteredTotals.totalPowerKw.toFixed(2)} kW
              </span>
            </div>
          </>
        )}
      </section>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24 print:pb-0 print:bg-white print:text-black">
      {/* Header Banner */}
      <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 print:bg-white print:border print:border-gray-300 print:shadow-none print:text-black">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 print:text-black">
                <ShoppingCart className="h-4 w-4 shrink-0" />
                <span>Bóc tách Khối lượng & Tổng hợp Mua sắm (BOM)</span>
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 print:bg-white print:border-gray-400 print:text-black ${
                  !showPrintProject ? 'print:hidden' : ''
                }`}
              >
                Dự án: {currentProject?.name}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 print:text-black">
              Danh mục Thiết bị Cần Mua sắm (BOM)
            </h1>
            <p
              className={`text-sm text-slate-400 print:text-gray-700 max-w-2xl ${
                !showPrintNotes ? 'print:hidden' : ''
              }`}
            >
              Quản lý chi tiết thiết bị theo từng hạng mục công trình hoặc xem
              tổng hợp cộng dồn số lượng cho dự án hiện tại để đặt hàng và theo
              dõi công suất điện lắp đặt.
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

      {/* Summary KPIs (Screen; when print filter active, screen KPIs hide on print) */}
      <div className={isUnitProcessPrintFiltered ? 'print:hidden' : ''}>
        {renderSummaryKpis(screenData)}
      </div>

      {/* Print Summary KPIs when Unit Process filter is active */}
      {isUnitProcessPrintFiltered && (
        <div className="hidden print:block">{renderSummaryKpis(printData)}</div>
      )}

      {/* BOM Mode Tabs + Search, Filter & View Toggle Bar */}
      <section className="print:hidden rounded-xl bg-slate-800 border border-slate-700/80 p-4 space-y-3.5">
        {/* BOM Mode Toggle Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-700/70">
          <div
            role="tablist"
            aria-label="Chế độ hiển thị BOM"
            className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-900 border border-slate-700 p-1 w-full sm:w-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={bomMode === 'detailed'}
              onClick={() => setBomMode('detailed')}
              className={`relative z-20 cursor-pointer select-none flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                bomMode === 'detailed'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Building2 className="h-4 w-4 pointer-events-none shrink-0" />
              <span className="pointer-events-none">
                Chi tiết theo công trình
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={bomMode === 'consolidated'}
              onClick={() => setBomMode('consolidated')}
              className={`relative z-20 cursor-pointer select-none flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                bomMode === 'consolidated'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <PackageCheck className="h-4 w-4 pointer-events-none shrink-0" />
              <span className="pointer-events-none">Tổng hợp mua sắm</span>
            </button>
          </div>

          <p className="text-xs text-slate-400">
            {bomMode === 'detailed'
              ? 'Gom nhóm theo từng Hạng mục / Công trình (cho phép thêm, sửa, xóa độc lập).'
              : 'Chế độ tổng hợp (Chỉ đọc): Tự động cộng dồn số lượng thiết bị trùng mã theo Nhóm vật tư.'}
          </p>
        </div>

        {/* Search, Category Filter, Table/Grid Toggle & Export Excel */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative w-full flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Tìm nhiều từ khóa cách nhau bởi dấu ';' (VD: bơm; tsurumi; bể điều hòa)..."
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
            title={
              bomMode === 'detailed'
                ? 'Xuất Excel chi tiết theo từng hạng mục công trình (CSV UTF-8)'
                : 'Xuất Excel tổng hợp cộng dồn theo nhóm vật tư (CSV UTF-8)'
            }
            className="relative z-20 cursor-pointer select-none inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-500/50 text-sm font-semibold text-emerald-300 transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <FileSpreadsheet className="h-4 w-4 pointer-events-none shrink-0" />
            <span className="pointer-events-none">Xuất Excel</span>
          </button>
        </div>
      </section>

      {renderBomListSection(screenData, false)}
      {isUnitProcessPrintFiltered && renderBomListSection(printData, true)}

      {/* Modal Popup Thêm mới / Sửa Thiết bị trong BOM */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bom-selector-title"
          onClick={closeModal}
          className="print:hidden fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-4xl max-h-[85vh] sm:max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-800 shrink-0">
              <div className="min-w-0">
                <h2
                  id="bom-selector-title"
                  className="text-base font-bold text-slate-100 flex items-center gap-2 truncate"
                >
                  <Package className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span className="truncate">
                    {editingBomId
                      ? 'Cập nhật Thiết bị trong Danh mục Mua sắm (BOM)'
                      : 'Chọn Thiết bị vào Danh mục Mua sắm (BOM)'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  Dữ liệu lấy từ Kho Thiết bị chuẩn ({catalog.length} thiết bị
                  sẵn có)
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to="/kho-thiet-bi"
                  onClick={closeModal}
                  className="relative z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-emerald-400 transition-colors"
                >
                  <span className="pointer-events-none">Quản lý kho</span>
                  <ExternalLink className="h-3.5 w-3.5 pointer-events-none" />
                </Link>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Đóng cửa sổ"
                  className="relative z-20 cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="h-5 w-5 pointer-events-none" />
                </button>
              </div>
            </div>

            {/* Modal Search, Filter & View Toggle */}
            <div className="p-3.5 sm:p-5 space-y-2.5 sm:space-y-3 border-b border-slate-800 shrink-0">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative w-full flex-1">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    placeholder="Tìm nhiều từ khóa cách nhau bởi dấu ';' (VD: bơm; tsurumi; dn80)..."
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

                <div className="flex items-center gap-2">
                  <select
                    value={modalCategory}
                    onChange={(e) => setModalCategory(e.target.value)}
                    aria-label="Lọc nhóm thiết bị"
                    className="flex-1 sm:w-48 min-h-[40px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
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
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-800 border border-slate-700 p-1 shrink-0"
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
            </div>

            {/* Scrollable Catalog List */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
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
                              {isPicked
                                ? 'Đã chọn thiết bị này'
                                : 'Chọn thiết bị'}
                            </span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sticky Modal Footer: Unit Process, Quantity, Note & Submit */}
            <form
              onSubmit={handleSaveModal}
              className="sticky bottom-0 z-20 bg-slate-900/90 backdrop-blur border-t border-slate-800 p-3 sm:p-4 space-y-2.5 shrink-0"
            >
              {pickedEquipment && (
                <div className="rounded-lg bg-emerald-950/35 border border-emerald-500/30 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="text-slate-400">Thiết bị đang chọn: </span>
                    <strong className="text-emerald-300">
                      {pickedEquipment.name}
                    </strong>{' '}
                    <span className="font-mono text-slate-400">
                      ({pickedEquipment.id})
                    </span>
                  </div>
                  <span className="font-mono text-amber-300 font-semibold shrink-0">
                    {Number(pickedEquipment.power || 0).toFixed(2)} kW /{' '}
                    {pickedEquipment.unit || 'Cái'}
                  </span>
                </div>
              )}

              {modalError && (
                <div className="rounded-lg bg-red-950/60 border border-red-500/50 px-3 py-2 text-xs text-red-200">
                  {modalError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3 items-end">
                <div className="sm:col-span-4">
                  <label
                    htmlFor="bom-modal-unit-process"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Hạng mục / Công trình <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="bom-modal-unit-process"
                    type="text"
                    required
                    list="unit-process-list"
                    value={unitProcessInput}
                    onChange={(e) => {
                      setUnitProcessInput(e.target.value);
                      if (modalError) setModalError('');
                    }}
                    placeholder="VD: Bể Điều hòa, Bể Aerotank..."
                    className="w-full min-h-[40px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <datalist id="unit-process-list">
                    {unitProcessOptions.map((proc) => (
                      <option key={proc} value={proc} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-3 sm:contents gap-2.5">
                  <div className="col-span-1 sm:col-span-2">
                    <label
                      htmlFor="bom-modal-qty"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      Số lượng <span className="text-red-400">*</span>
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

                  <div className="col-span-2 sm:col-span-3">
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
                </div>

                <div className="sm:col-span-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="relative z-20 cursor-pointer select-none min-h-[40px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-300"
                  >
                    <span className="pointer-events-none">Đóng</span>
                  </button>
                  <button
                    type="submit"
                    disabled={!pickedEquipment}
                    className="relative z-20 cursor-pointer select-none min-h-[40px] px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-white whitespace-nowrap"
                  >
                    <span className="pointer-events-none">
                      {editingBomId ? 'Lưu thay đổi' : 'Thêm vào BOM'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="hidden sm:flex flex-wrap items-center gap-1.5">
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
