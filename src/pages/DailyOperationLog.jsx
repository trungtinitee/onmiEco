import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  CloudOff,
  CloudUpload,
  Copy,
  HelpCircle,
  Loader2,
  Pencil,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const STORAGE_KEY = 'dvn_operation_logs';
const GSHEET_URL_KEY = 'dvn_gsheet_url';

const APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    sheet.appendRow([
      data.date || '',
      data.flow || 0,
      data.pH || 0,
      data.DO || 0,
      data.SV30 || 0,
      data.PAC || 0,
      data.polymer || 0,
      data.notes || '',
      data.operator || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

function getNowLocalDateTime() {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function formatDateTimeDisplay(isoLocal) {
  if (!isoLocal) return '-';
  const parsed = new Date(isoLocal);
  if (Number.isNaN(parsed.getTime())) return isoLocal;
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  const hh = String(parsed.getHours()).padStart(2, '0');
  const min = String(parsed.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function isValidHttpUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function createDefaultForm(suggestedQ) {
  return {
    shiftDateTime: getNowLocalDateTime(),
    flowQ: Math.max(0, Number(suggestedQ) || 0),
    ph: 7.2,
    doMgL: 2.5,
    sv30: 300,
    pac: 0,
    polymer: 0,
    javen: 0,
    molasses: 0,
    operator: '',
    notes: '',
  };
}

function createLogId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeNonNegative(raw) {
  if (raw === '') return 0;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

export default function DailyOperationLog() {
  const { globalQ } = useAppContext();

  // --- Cấu hình URL Google Sheets động ---
  const [gsheetUrlInput, setGsheetUrlInput] = useState(() => {
    try {
      return window.localStorage.getItem(GSHEET_URL_KEY) || '';
    } catch {
      return '';
    }
  });
  const [savedGsheetUrl, setSavedGsheetUrl] = useState(() => {
    try {
      return window.localStorage.getItem(GSHEET_URL_KEY) || '';
    } catch {
      return '';
    }
  });
  const [syncSettingsOpen, setSyncSettingsOpen] = useState(() => {
    try {
      return !isValidHttpUrl(window.localStorage.getItem(GSHEET_URL_KEY) || '');
    } catch {
      return true;
    }
  });

  // --- Dữ liệu Nhật ký trong localStorage ---
  const [logs, setLogs] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) => ({
        ...item,
        isSynced: Boolean(item.isSynced),
      }));
    } catch {
      return [];
    }
  });

  const [form, setForm] = useState(() => createDefaultForm(globalQ));
  const [flowTouched, setFlowTouched] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const [toast, setToast] = useState(null); // { ok: boolean, message: string }
  const [guideOpen, setGuideOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Đóng Modal hướng dẫn bằng phím Escape
  useEffect(() => {
    if (!guideOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setGuideOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [guideOpen]);

  // Persist logs to localStorage whenever logs change
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch {
      // Ignore storage quota errors safely
    }
  }, [logs]);

  // Keep flowQ synced with globalQ suggestion when not editing & user hasn't manually changed it
  useEffect(() => {
    if (!editingId && !flowTouched) {
      setForm((prev) => ({
        ...prev,
        flowQ: Math.max(0, Number(globalQ) || 0),
      }));
    }
  }, [globalQ, editingId, flowTouched]);

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) =>
      String(b.shiftDateTime || '').localeCompare(String(a.shiftDateTime || ''))
    );
  }, [logs]);

  const unsyncedLogs = useMemo(
    () => logs.filter((item) => !item.isSynced),
    [logs]
  );

  const summary = useMemo(() => {
    if (logs.length === 0) {
      return { totalShifts: 0, avgQ: 0, alertCount: 0 };
    }
    const totalQ = logs.reduce((acc, item) => acc + (Number(item.flowQ) || 0), 0);
    const alertCount = logs.filter(
      (item) =>
        item.ph < 6.0 ||
        item.ph > 9.0 ||
        item.doMgL < 1.5 ||
        item.sv30 < 100 ||
        item.sv30 > 600
    ).length;
    return {
      totalShifts: logs.length,
      avgQ: totalQ / logs.length,
      alertCount,
    };
  }, [logs]);

  const showToast = (ok, message) => {
    setToast({ ok, message });
    window.setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 5500);
  };

  // --- Lưu cấu hình URL Google Apps Script ---
  const handleSaveSyncConfig = (e) => {
    e.preventDefault();
    const trimmed = gsheetUrlInput.trim();

    if (!trimmed) {
      try {
        window.localStorage.removeItem(GSHEET_URL_KEY);
      } catch {
        // Ignore
      }
      setSavedGsheetUrl('');
      showToast(
        false,
        'Vui lòng cấu hình URL Google Sheets trước khi đồng bộ.'
      );
      return;
    }

    if (!isValidHttpUrl(trimmed)) {
      showToast(
        false,
        'URL Google Apps Script không hợp lệ (cần bắt đầu bằng https:// hoặc http://).'
      );
      return;
    }

    try {
      window.localStorage.setItem(GSHEET_URL_KEY, trimmed);
    } catch {
      // Ignore storage errors
    }
    setGsheetUrlInput(trimmed);
    setSavedGsheetUrl(trimmed);
    setSyncSettingsOpen(false);
    showToast(true, 'Đã lưu cấu hình URL Google Sheets thành công.');
  };

  // --- Copy mã Google Apps Script vào Clipboard ---
  const handleCopyAppsScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_CODE);
      setCopiedCode(true);
      window.setTimeout(() => {
        setCopiedCode(false);
      }, 2000);
    } catch {
      showToast(
        false,
        'Trình duyệt chặn quyền Clipboard. Vui lòng bôi đen và sao chép thủ công đoạn mã.'
      );
    }
  };

  // --- Hàm gửi dữ liệu lên Google Sheets bằng fetch('POST') ---
  const submitToGoogleSheets = async (formData) => {
    let targetUrl = '';
    try {
      targetUrl = (window.localStorage.getItem(GSHEET_URL_KEY) || '').trim();
    } catch {
      targetUrl = savedGsheetUrl.trim();
    }

    if (!isValidHttpUrl(targetUrl)) {
      return {
        ok: false,
        missingConfig: true,
        error: 'Vui lòng cấu hình URL Google Sheets trước khi đồng bộ',
      };
    }

    const payload = {
      date: formData.shiftDateTime
        ? formatDateTimeDisplay(formData.shiftDateTime)
        : '',
      flow: formData.flowQ ?? '',
      pH: formData.ph ?? '',
      DO: formData.doMgL ?? '',
      SV30: formData.sv30 ?? '',
      PAC: formData.pac ?? '',
      polymer: formData.polymer ?? '',
      notes: formData.notes ?? '',
      operator: formData.operator ?? '',
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return { ok: true };
  };

  const handleNumberChange = (field) => (e) => {
    const val = sanitizeNonNegative(e.target.value);
    if (field === 'flowQ') setFlowTouched(true);
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleResetForm = () => {
    setEditingId(null);
    setFlowTouched(false);
    setForm(createDefaultForm(globalQ));
  };

  // --- Lưu / Cập nhật + Đồng bộ Google Sheets & Fallback Offline ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.shiftDateTime) {
      showToast(false, 'Vui lòng chọn Ngày/Giờ ca trực.');
      return;
    }

    if (!form.operator.trim()) {
      showToast(false, 'Vui lòng nhập tên Người vận hành trực ca.');
      return;
    }

    const normalizedEntry = {
      shiftDateTime: form.shiftDateTime,
      flowQ: Math.max(0, Number(form.flowQ) || 0),
      ph: Math.min(14, Math.max(0, Number(form.ph) || 0)),
      doMgL: Math.max(0, Number(form.doMgL) || 0),
      sv30: Math.max(0, Number(form.sv30) || 0),
      pac: Math.max(0, Number(form.pac) || 0),
      polymer: Math.max(0, Number(form.polymer) || 0),
      javen: Math.max(0, Number(form.javen) || 0),
      molasses: Math.max(0, Number(form.molasses) || 0),
      operator: form.operator.trim(),
      notes: form.notes.trim(),
    };

    const isUpdate = Boolean(editingId);
    const targetId = isUpdate ? editingId : createLogId();
    const nowIso = new Date().toISOString();

    const recordToSave = {
      id: targetId,
      ...normalizedEntry,
      isSynced: false,
      ...(isUpdate ? { updatedAt: nowIso } : { createdAt: nowIso }),
    };

    // 1. Luôn lưu LocalStorage trước (Fallback Offline đảm bảo 100% không mất dữ liệu)
    if (isUpdate) {
      setLogs((prev) =>
        prev.map((item) =>
          item.id === targetId ? { ...item, ...recordToSave } : item
        )
      );
    } else {
      setLogs((prev) => [recordToSave, ...prev]);
    }

    // 2. Kiểm tra URL Google Sheets trước khi fetch
    let storedUrl = '';
    try {
      storedUrl = (window.localStorage.getItem(GSHEET_URL_KEY) || '').trim();
    } catch {
      storedUrl = savedGsheetUrl.trim();
    }

    if (!isValidHttpUrl(storedUrl)) {
      setSyncSettingsOpen(true);
      showToast(
        false,
        'Vui lòng cấu hình URL Google Sheets trước khi đồng bộ (Dữ liệu đã được lưu Offline trên máy).'
      );
      if (isUpdate) {
        handleResetForm();
      } else {
        setFlowTouched(false);
        setForm((prev) => ({
          ...createDefaultForm(globalQ),
          operator: prev.operator,
        }));
      }
      return;
    }

    // 3. Gửi POST lên Google Sheets
    setIsSyncing(true);
    try {
      await submitToGoogleSheets({
        ...recordToSave,
        action: isUpdate ? 'update' : 'create',
      });

      setLogs((prev) =>
        prev.map((item) =>
          item.id === targetId
            ? { ...item, isSynced: true, lastSyncedAt: new Date().toISOString() }
            : item
        )
      );

      showToast(
        true,
        `Đã đồng bộ ${
          isUpdate ? 'cập nhật' : 'nhật ký mới'
        } ca trực ${formatDateTimeDisplay(normalizedEntry.shiftDateTime)} lên Google Sheets.`
      );
    } catch {
      showToast(
        false,
        'Lỗi đồng bộ Google Sheets (mất kết nối hoặc URL lỗi). Dữ liệu đã lưu ở chế độ Offline.'
      );
    } finally {
      setIsSyncing(false);
      if (isUpdate) {
        handleResetForm();
      } else {
        setFlowTouched(false);
        setForm((prev) => ({
          ...createDefaultForm(globalQ),
          operator: prev.operator,
        }));
      }
    }
  };

  // --- Đẩy toàn bộ các dòng isSynced: false lên Google Sheets ---
  const handleSyncOfflineLogs = async () => {
    if (unsyncedLogs.length === 0) {
      showToast(true, 'Tất cả dữ liệu nhật ký đã được đồng bộ.');
      return;
    }

    let storedUrl = '';
    try {
      storedUrl = (window.localStorage.getItem(GSHEET_URL_KEY) || '').trim();
    } catch {
      storedUrl = savedGsheetUrl.trim();
    }

    if (!isValidHttpUrl(storedUrl)) {
      setSyncSettingsOpen(true);
      showToast(false, 'Vui lòng cấu hình URL Google Sheets trước khi đồng bộ');
      return;
    }

    setIsSyncingOffline(true);
    let successCount = 0;
    let failCount = 0;
    const syncedIds = [];

    for (const entry of unsyncedLogs) {
      try {
        await submitToGoogleSheets({ ...entry, action: 'sync_offline' });
        syncedIds.push(entry.id);
        successCount += 1;
      } catch {
        failCount += 1;
      }
    }

    if (syncedIds.length > 0) {
      const syncedSet = new Set(syncedIds);
      const syncTimestamp = new Date().toISOString();
      setLogs((prev) =>
        prev.map((item) =>
          syncedSet.has(item.id)
            ? { ...item, isSynced: true, lastSyncedAt: syncTimestamp }
            : item
        )
      );
    }

    setIsSyncingOffline(false);

    if (failCount === 0) {
      showToast(
        true,
        `Đã đồng bộ thành công ${successCount} bản ghi Offline lên Google Sheets.`
      );
    } else {
      showToast(
        false,
        `Đồng bộ hoàn tất ${successCount} bản ghi, thất bại ${failCount} bản ghi. Vui lòng kiểm tra mạng hoặc URL Script.`
      );
    }
  };

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setFlowTouched(true);
    setForm({
      shiftDateTime: entry.shiftDateTime || getNowLocalDateTime(),
      flowQ: Number(entry.flowQ) || 0,
      ph: Number(entry.ph) || 0,
      doMgL: Number(entry.doMgL) || 0,
      sv30: Number(entry.sv30) || 0,
      pac: Number(entry.pac) || 0,
      polymer: Number(entry.polymer) || 0,
      javen: Number(entry.javen) || 0,
      molasses: Number(entry.molasses) || 0,
      operator: entry.operator || '',
      notes: entry.notes || '',
    });

    const formEl = document.getElementById('log-entry-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleDelete = (entry) => {
    const formattedDate = formatDateTimeDisplay(entry.shiftDateTime);
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa nhật ký ngày ${formattedDate} không?`
    );
    if (!confirmed) return;

    setLogs((prev) => prev.filter((item) => item.id !== entry.id));
    if (editingId === entry.id) {
      handleResetForm();
    }
    showToast(true, `Đã xóa nhật ký ca trực ngày ${formattedDate}.`);
  };

  const handlePrintLogs = () => {
    window.print();
  };

  const isUrlConfigured = isValidHttpUrl(savedGsheetUrl);

  return (
    <div className="space-y-6 print-log-sheet">
      {/* Thiết lập trang in A4 nằm ngang riêng cho Nhật ký vận hành */}
      <style>{`@media print { @page { size: landscape; margin: 10mm; } }`}</style>

      {/* Tiêu đề chỉ hiển thị khi In (Print-to-PDF / A4 Landscape) */}
      <div className="hidden print:block bg-white text-black pb-3 mb-4 border-b-2 border-black">
        <h1 className="text-center text-xl font-bold uppercase tracking-wide text-black">
          NHẬT KÝ VẬN HÀNH TRẠM XỬ LÝ NƯỚC THẢI
        </h1>
        <div className="mt-1.5 flex items-center justify-between text-xs text-black">
          <span>Tổng số ca ghi nhận: {sortedLogs.length} ca</span>
          <span>
            Ngày in: {new Date().toLocaleDateString('vi-VN')} · Lưu lượng thiết
            kế Q = {Number(globalQ || 0).toLocaleString('vi-VN')} m³/ngày
          </span>
        </div>
      </div>

      {/* 1. KHU VỰC CẤU HÌNH ĐỒNG BỘ GOOGLE SHEETS (Accordion, ẩn khi In) */}
      <section className="no-print print:hidden rounded-xl bg-slate-800 border border-slate-700/80 overflow-hidden">
        <button
          type="button"
          onClick={() => setSyncSettingsOpen((prev) => !prev)}
          aria-expanded={syncSettingsOpen}
          className="w-full min-h-[44px] px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-700/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Settings2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="text-sm font-semibold text-slate-100">
              Cấu hình Đồng bộ Google Sheets
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded border ${
                isUrlConfigured
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                  : 'border-red-500/40 bg-red-500/10 text-red-500'
              }`}
            >
              {isUrlConfigured ? 'Đã cấu hình URL' : 'Chưa cấu hình URL'}
            </span>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
              syncSettingsOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {syncSettingsOpen && (
          <form
            onSubmit={handleSaveSyncConfig}
            className="px-5 pb-5 pt-3 border-t border-slate-700/70 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label
                htmlFor="gsheet-url-input"
                className="block text-xs font-medium text-slate-300"
              >
                URL Web App Google Apps Script (nhận phương thức POST JSON)
              </label>

              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg border border-sky-400/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-semibold transition-colors self-start sm:self-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <HelpCircle className="h-4 w-4 shrink-0" />
                <span>Cách lấy Link Google Sheets</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="gsheet-url-input"
                type="url"
                value={gsheetUrlInput}
                onChange={(e) => setGsheetUrlInput(e.target.value)}
                placeholder="Nhập URL Google Apps Script..."
                className="flex-1 min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                <Save className="h-4 w-4 shrink-0" />
                <span>Lưu cấu hình</span>
              </button>
            </div>
            <p className="text-xs text-slate-400">
              URL được lưu cục bộ trên trình duyệt tại{' '}
              <code className="text-slate-300">localStorage</code> (key:{' '}
              <code className="text-emerald-400">dvn_gsheet_url</code>). Nếu mất
              mạng hoặc chưa gắn URL, dữ liệu vẫn lưu an toàn Offline để đồng bộ
              bù sau.
            </p>
          </form>
        )}
      </section>

      {/* Header trên màn hình (Ẩn khi in) */}
      <section className="no-print print:hidden flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-500">
            <BookOpenCheck className="h-4 w-4" />
            <span>Quản lý & Lưu trữ Nhật ký Trạm</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 text-balance">
            Nhật Ký Vận Hành Hằng Ngày
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Ghi nhận lưu lượng thực tế, chỉ tiêu đo nhanh (pH, DO, SV30), lượng
            hóa chất tiêu thụ và tự động đồng bộ lên Google Sheets kèm cơ chế
            dự phòng Offline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={isSyncingOffline || unsyncedLogs.length === 0}
            onClick={handleSyncOfflineLogs}
            className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg border font-semibold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              unsyncedLogs.length > 0
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                : 'border-slate-700 bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSyncingOffline ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            ) : (
              <RefreshCw className="h-4 w-4 shrink-0" />
            )}
            <span>
              {isSyncingOffline
                ? 'Đang đồng bộ Offline...'
                : `Đồng bộ dữ liệu Offline (${unsyncedLogs.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={handlePrintLogs}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Printer className="h-4 w-4 shrink-0" />
            <span>In Nhật Ký</span>
          </button>
        </div>
      </section>

      {/* KPI tổng hợp nhanh (Ẩn khi in) */}
      <section className="no-print print:hidden grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-4">
          <div className="text-xs text-slate-400">Tổng số ca đã ghi</div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-100 tabular-nums">
            {summary.totalShifts} ca
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
            Chờ đồng bộ Offline: {unsyncedLogs.length} ca
          </div>
        </div>
        <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-4">
          <div className="text-xs text-slate-400">
            Lưu lượng vận hành trung bình
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
            {summary.avgQ.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}{' '}
            m³/ng
          </div>
        </div>
        <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-4">
          <div className="text-xs text-slate-400">
            Ca có thông số ngoài ngưỡng
          </div>
          <div
            className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
              summary.alertCount > 0 ? 'text-red-500' : 'text-emerald-500'
            }`}
          >
            {summary.alertCount} ca
          </div>
        </div>
      </section>

      {/* Toast thông báo trạng thái Đồng bộ / CRUD */}
      {toast && (
        <div
          role="status"
          className={`no-print print:hidden rounded-xl border px-4 py-3 flex items-center justify-between gap-3 text-sm ${
            toast.ok
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
              : 'bg-red-500/10 border-red-500/40 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.ok ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Đóng thông báo"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-slate-800/60 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* FORM NHẬP LIỆU NHẬT KÝ (Ẩn hoàn toàn khi In) */}
      <section
        id="log-entry-form"
        className="no-print print:hidden rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              {editingId
                ? 'Chỉnh sửa nhật ký ca trực'
                : 'Ghi nhận nhật ký ca trực mới'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Lưu lượng gợi ý lấy tự động từ Q chung (
              {globalQ.toLocaleString('vi-VN')} m³/ngày) — tự động lưu Offline
              và gửi lên Google Sheets.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={handleResetForm}
              className="inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700 text-xs font-medium transition-colors"
            >
              <X className="h-4 w-4" />
              Hủy chỉnh sửa
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Grid 1 cột Mobile -> 2-3 cột Desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Ngày/Giờ ca trực */}
            <div>
              <label
                htmlFor="log-shift-dt"
                className="block text-sm font-medium text-slate-200 mb-2"
              >
                Ngày / Giờ ca trực
              </label>
              <input
                id="log-shift-dt"
                type="datetime-local"
                required
                value={form.shiftDateTime}
                onChange={(e) =>
                  setForm((p) => ({ ...p, shiftDateTime: e.target.value }))
                }
                className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 font-mono text-sm text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            {/* Lưu lượng vận hành Q */}
            <LogNumberInput
              id="log-flow-q"
              label="Lưu lượng vận hành Q"
              unit="m³/ngày"
              step={10}
              value={form.flowQ}
              onChange={handleNumberChange('flowQ')}
            />

            {/* Người vận hành */}
            <div>
              <label
                htmlFor="log-operator"
                className="block text-sm font-medium text-slate-200 mb-2"
              >
                Người vận hành trực ca
              </label>
              <input
                id="log-operator"
                type="text"
                required
                placeholder="VD: Nguyễn Văn A"
                value={form.operator}
                onChange={(e) =>
                  setForm((p) => ({ ...p, operator: e.target.value }))
                }
                className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            {/* Thông số đo nhanh */}
            <LogNumberInput
              id="log-ph"
              label="pH nước thải (6,0 – 9,0)"
              unit="pH"
              max={14}
              step={0.1}
              value={form.ph}
              onChange={handleNumberChange('ph')}
            />

            <LogNumberInput
              id="log-do"
              label="Oxy hòa tan DO (≥ 1,5)"
              unit="mg/L"
              step={0.1}
              value={form.doMgL}
              onChange={handleNumberChange('doMgL')}
            />

            <LogNumberInput
              id="log-sv30"
              label="Bùn lắng SV30 (100 – 600)"
              unit="mL/L"
              max={1000}
              step={10}
              value={form.sv30}
              onChange={handleNumberChange('sv30')}
            />

            {/* Hóa chất tiêu thụ */}
            <LogNumberInput
              id="log-pac"
              label="Hóa chất PAC tiêu thụ"
              unit="kg / L"
              step={0.5}
              value={form.pac}
              onChange={handleNumberChange('pac')}
            />

            <LogNumberInput
              id="log-polymer"
              label="Polymer (ép bùn / keo tụ)"
              unit="kg"
              step={0.1}
              value={form.polymer}
              onChange={handleNumberChange('polymer')}
            />

            <LogNumberInput
              id="log-javen"
              label="Javen NaOCl khử trùng"
              unit="Lít"
              step={0.5}
              value={form.javen}
              onChange={handleNumberChange('javen')}
            />

            <LogNumberInput
              id="log-molasses"
              label="Mật rỉ / Carbon bổ sung"
              unit="kg / L"
              step={1}
              value={form.molasses}
              onChange={handleNumberChange('molasses')}
            />

            {/* Sự cố / Ghi chú full width */}
            <div className="md:col-span-2 xl:col-span-3">
              <label
                htmlFor="log-notes"
                className="block text-sm font-medium text-slate-200 mb-2"
              >
                Sự cố / Ghi chú ca trực
              </label>
              <textarea
                id="log-notes"
                rows={3}
                placeholder="Ghi nhận tình trạng máy móc, độ đục nước sau lắng, sự cố bơm/máy thổi khí hoặc bàn giao ca..."
                value={form.notes}
                onChange={(e) =>
                  setForm((p) => ({ ...p, notes: e.target.value }))
                }
                className="w-full min-h-[96px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-700/60">
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleResetForm}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Làm mới form</span>
            </button>

            <button
              type="submit"
              disabled={isSyncing}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-700 disabled:text-slate-200 disabled:cursor-wait text-slate-950 font-semibold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <Save className="h-4 w-4 shrink-0" />
              )}
              <span>
                {isSyncing
                  ? 'Đang đồng bộ...'
                  : editingId
                  ? 'Cập nhật & Đồng bộ'
                  : 'Lưu nhật ký'}
              </span>
            </button>
          </div>
        </form>
      </section>

      {/* BẢNG DỮ LIỆU NHẬT KÝ (Hiển thị toàn bộ khi In nền trắng chữ đen) */}
      <section className="print-allow-break rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-4 print:bg-white print:text-black print:border-0 print:p-0 print:rounded-none">
        <div className="no-print print:hidden flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Bảng Theo Dõi Nhật Ký Vận Hành ({sortedLogs.length} bản ghi)
            </h2>
            <p className="text-xs text-slate-400">
              Nhấn &ldquo;Sửa&rdquo; để nạp lại dữ liệu lên form hoặc &ldquo;In
              Nhật Ký&rdquo; để xuất khổ giấy A4 nằm ngang.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto w-full rounded-lg border border-slate-700/80 print:overflow-visible print:border-black print:rounded-none">
          <table className="w-full min-w-[980px] text-left border-collapse text-sm print:min-w-0 print:w-full print:bg-white print:text-black">
            <thead>
              <tr className="bg-slate-900/90 text-xs font-medium text-slate-400 border-b border-slate-700/80 print:bg-white print:text-black print:border-black">
                <th className="py-3 px-3 border-r border-slate-700/60 print:border-black">
                  Ngày / Giờ ca
                </th>
                <th className="py-3 px-3 text-right border-r border-slate-700/60 print:border-black">
                  Q (m³/ng)
                </th>
                <th className="py-3 px-3 text-center border-r border-slate-700/60 print:border-black">
                  pH
                </th>
                <th className="py-3 px-3 text-center border-r border-slate-700/60 print:border-black">
                  DO (mg/L)
                </th>
                <th className="py-3 px-3 text-center border-r border-slate-700/60 print:border-black">
                  SV30 (mL/L)
                </th>
                <th className="py-3 px-3 border-r border-slate-700/60 print:border-black">
                  Hóa chất tiêu thụ
                </th>
                <th className="py-3 px-3 border-r border-slate-700/60 print:border-black">
                  Sự cố / Ghi chú
                </th>
                <th className="py-3 px-3 border-r border-slate-700/60 print:border-black">
                  Người trực
                </th>
                <th className="no-print print:hidden py-3 px-3 text-center border-r border-slate-700/60">
                  Đồng bộ
                </th>
                <th className="no-print print:hidden py-3 px-3 text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 print:divide-black">
              {sortedLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-8 px-4 text-center text-sm text-slate-400 print:text-black"
                  >
                    Chưa có bản ghi nhật ký nào. Hãy nhập thông số ở form phía
                    trên và bấm &ldquo;Lưu nhật ký&rdquo;.
                  </td>
                </tr>
              ) : (
                sortedLogs.map((row) => {
                  const isPhAlert = row.ph < 6.0 || row.ph > 9.0;
                  const isDoAlert = row.doMgL < 1.5;
                  const isSvAlert = row.sv30 < 100 || row.sv30 > 600;
                  const isRowEditing = editingId === row.id;

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-900/40 print:bg-white print:text-black ${
                        isRowEditing ? 'bg-emerald-950/30' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-mono text-xs text-slate-200 whitespace-nowrap border-r border-slate-700/50 print:text-black print:border-black">
                        {formatDateTimeDisplay(row.shiftDateTime)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums text-emerald-400 border-r border-slate-700/50 print:text-black print:border-black">
                        {Number(row.flowQ || 0).toLocaleString('vi-VN')}
                      </td>
                      <td
                        className={`py-3 px-3 text-center font-mono font-semibold tabular-nums border-r border-slate-700/50 print:text-black print:border-black ${
                          isPhAlert ? 'text-red-500' : 'text-emerald-500'
                        }`}
                      >
                        {Number(row.ph || 0).toFixed(1)}
                      </td>
                      <td
                        className={`py-3 px-3 text-center font-mono font-semibold tabular-nums border-r border-slate-700/50 print:text-black print:border-black ${
                          isDoAlert ? 'text-red-500' : 'text-emerald-500'
                        }`}
                      >
                        {Number(row.doMgL || 0).toFixed(1)}
                      </td>
                      <td
                        className={`py-3 px-3 text-center font-mono font-semibold tabular-nums border-r border-slate-700/50 print:text-black print:border-black ${
                          isSvAlert ? 'text-red-500' : 'text-emerald-500'
                        }`}
                      >
                        {Number(row.sv30 || 0).toFixed(0)}
                      </td>
                      <td className="py-3 px-3 text-xs font-mono text-slate-300 border-r border-slate-700/50 print:text-black print:border-black">
                        <div className="space-y-0.5 whitespace-nowrap">
                          <div>
                            PAC: {row.pac} · Poly: {row.polymer}
                          </div>
                          <div>
                            Javen: {row.javen} L · Mật rỉ: {row.molasses}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-300 max-w-xs border-r border-slate-700/50 print:text-black print:border-black">
                        {row.notes || 'Bình thường'}
                      </td>
                      <td className="py-3 px-3 text-sm font-medium text-slate-100 whitespace-nowrap border-r border-slate-700/50 print:text-black print:border-black">
                        {row.operator}
                      </td>
                      <td className="no-print print:hidden py-3 px-3 text-center whitespace-nowrap border-r border-slate-700/50">
                        {row.isSynced ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                            <CloudUpload className="h-3.5 w-3.5" />
                            Đã đồng bộ
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
                            <CloudOff className="h-3.5 w-3.5" />
                            Offline
                          </span>
                        )}
                      </td>
                      <td className="no-print print:hidden py-2 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(row)}
                            aria-label={`Sửa nhật ký ${formatDateTimeDisplay(
                              row.shiftDateTime
                            )}`}
                            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700 text-xs font-medium transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Sửa</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            aria-label={`Xóa nhật ký ${formatDateTimeDisplay(
                              row.shiftDateTime
                            )}`}
                            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg border border-red-500/40 text-red-500 hover:bg-red-500/15 text-xs font-medium transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Xóa</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL HƯỚNG DẪN LẤY LINK GOOGLE SHEETS (Ẩn khi in) */}
      {guideOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gsheet-guide-title"
          onClick={() => setGuideOpen(false)}
          className="no-print print:hidden fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-800 border border-slate-700 text-slate-200 shadow-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-700 bg-slate-900/60 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <HelpCircle className="h-5 w-5 text-sky-400 shrink-0" />
                <h2
                  id="gsheet-guide-title"
                  className="text-base sm:text-lg font-bold text-slate-100 truncate"
                >
                  Hướng dẫn tạo Link đồng bộ Google Sheets
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                aria-label="Đóng hướng dẫn"
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white text-xs font-semibold transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Đóng</span>
              </button>
            </div>

            {/* Modal Body (cuộn dọc trên thiết bị nhỏ) */}
            <div className="overflow-y-auto p-5 sm:p-6 space-y-5 text-sm leading-relaxed text-slate-200">
              {/* Bước 1 */}
              <div className="rounded-xl bg-slate-900/70 border border-slate-700/80 p-4 space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-sky-300">
                  BƯỚC 1: Tạo bảng tính Google Sheets &amp; đặt tên cột
                </h3>
                <p className="text-slate-300">
                  Tạo một file Google Sheets mới trên Google Drive. Tại{' '}
                  <strong className="text-slate-100">hàng 1</strong> (từ cột A đến
                  cột I), nhập lần lượt tên 9 cột tiêu đề theo đúng thứ tự sau:
                </p>
                <div className="rounded-lg bg-slate-950 border border-slate-700/80 px-3.5 py-2.5 font-mono text-xs text-emerald-300 overflow-x-auto">
                  Ngày giờ | Lưu lượng | pH | DO | SV30 | PAC | Polymer | Ghi
                  chú | Người trực
                </div>
              </div>

              {/* Bước 2 */}
              <div className="rounded-xl bg-slate-900/70 border border-slate-700/80 p-4 space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-sky-300">
                  BƯỚC 2: Mở trình chỉnh sửa Apps Script
                </h3>
                <p className="text-slate-300">
                  Trên thanh menu phía trên của file Google Sheets, chọn mục{' '}
                  <span className="font-semibold text-slate-100">
                    &ldquo;Tiện ích mở rộng&rdquo;
                  </span>{' '}
                  (Extensions) &rarr;{' '}
                  <span className="font-semibold text-slate-100">
                    &ldquo;Apps Script&rdquo;
                  </span>
                  .
                </p>
              </div>

              {/* Bước 3 */}
              <div className="rounded-xl bg-slate-900/70 border border-slate-700/80 p-4 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-sky-300">
                  BƯỚC 3: Xóa code cũ và dán đoạn mã nhận dữ liệu
                </h3>
                <p className="text-slate-300">
                  Xóa toàn bộ nội dung mặc định trong trình soạn thảo Apps Script,
                  bấm nút <strong className="text-slate-100">Copy Code</strong> bên
                  dưới rồi dán vào và bấm biểu tượng lưu (Ctrl + S):
                </p>

                <div className="relative rounded-xl bg-slate-950 border border-slate-700 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-slate-900 border-b border-slate-800">
                    <span className="font-mono text-xs text-slate-400">
                      Code.gs (Google Apps Script)
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAppsScript}
                      className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                        copiedCode
                          ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300'
                          : 'border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200'
                      }`}
                    >
                      {copiedCode ? (
                        <>
                          <Check className="h-3.5 w-3.5 shrink-0" />
                          <span>Đã copy!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 shrink-0" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-emerald-300">
                    <code>{APPS_SCRIPT_CODE}</code>
                  </pre>
                </div>
              </div>

              {/* Bước 4 */}
              <div className="rounded-xl bg-slate-900/70 border border-slate-700/80 p-4 space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-sky-300">
                  BƯỚC 4: Triển khai Web App &amp; lấy URL
                </h3>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li>
                    Bấm nút{' '}
                    <strong className="text-slate-100">
                      &ldquo;Triển khai&rdquo;
                    </strong>{' '}
                    (Deploy) ở góc trên bên phải &rarr; chọn{' '}
                    <strong className="text-slate-100">
                      &ldquo;Triển khai mới&rdquo;
                    </strong>{' '}
                    (New deployment).
                  </li>
                  <li>
                    Tại mục Chọn loại (Select type), bấm biểu tượng bánh răng và
                    chọn{' '}
                    <strong className="text-slate-100">
                      &ldquo;Ứng dụng web&rdquo;
                    </strong>{' '}
                    (Web app).
                  </li>
                  <li>
                    Tại mục{' '}
                    <strong className="text-slate-100">
                      &ldquo;Ai có quyền truy cập&rdquo;
                    </strong>{' '}
                    (Who has access), chọn{' '}
                    <strong className="text-emerald-300">
                      &ldquo;Bất kỳ ai&rdquo; (Anyone)
                    </strong>
                    .
                  </li>
                  <li>
                    Bấm <strong className="text-slate-100">Triển khai</strong>{' '}
                    (cấp quyền cho tài khoản Google của bạn nếu được hỏi), sau đó{' '}
                    <strong className="text-slate-100">copy URL kết quả</strong>{' '}
                    và dán vào ô cấu hình URL ở bên ngoài rồi bấm{' '}
                    <strong className="text-emerald-300">Lưu cấu hình</strong>.
                  </li>
                </ol>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end px-5 py-3.5 border-t border-slate-700 bg-slate-900/60 shrink-0">
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 font-semibold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <span>Đã hiểu, quay lại dán URL</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LogNumberInput({ id, label, unit, value, max, step, onChange }) {
  const displayVal =
    value === 0 || value === '' || value === null || Number.isNaN(Number(value))
      ? ''
      : value;

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-200 mb-2"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={id}
          type="number"
          min={0}
          max={max}
          step={step}
          value={displayVal}
          onChange={onChange}
          placeholder="0"
          className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 pr-20 py-2 font-mono text-sm font-medium text-slate-100 tabular-nums focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors"
        />
        <span className="absolute right-3 text-xs font-mono text-slate-400 pointer-events-none">
          {unit}
        </span>
      </div>
    </div>
  );
}
