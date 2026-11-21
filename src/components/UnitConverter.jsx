import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Copy,
  Layers,
  Ruler,
  Search,
  X,
} from 'lucide-react';

const CONVERTER_GROUPS = [
  {
    id: 'flow',
    label: 'Lưu lượng',
    subtitle: 'm³/ngày, m³/h, L/s, L/phút, GPM',
    defaultFrom: 'm3_day',
    defaultTo: 'm3_h',
    defaultValue: '1000',
    units: [
      { id: 'm3_day', label: 'm³/ngày', factor: 1 },
      { id: 'm3_h', label: 'm³/h', factor: 24 },
      { id: 'l_s', label: 'L/s', factor: 86.4 },
      { id: 'l_min', label: 'L/phút', factor: 1.44 },
      { id: 'gpm', label: 'GPM (US)', factor: 5.45099296896 },
    ],
  },
  {
    id: 'pressure',
    label: 'Áp suất / Cột áp',
    subtitle: 'mH₂O, bar, kPa, MPa, psi, kgf/cm², mmH₂O',
    defaultFrom: 'bar',
    defaultTo: 'mh2o',
    defaultValue: '1',
    units: [
      { id: 'mh2o', label: 'mH₂O', factor: 9.80665 },
      { id: 'bar', label: 'bar', factor: 100 },
      { id: 'kpa', label: 'kPa', factor: 1 },
      { id: 'mpa', label: 'MPa', factor: 1000 },
      { id: 'psi', label: 'psi', factor: 6.89475729316836 },
      { id: 'kgf_cm2', label: 'kgf/cm²', factor: 98.0665 },
      { id: 'mmh2o', label: 'mmH₂O', factor: 0.00980665 },
    ],
  },
  {
    id: 'power',
    label: 'Công suất',
    subtitle: 'kW, HP (cơ), W, kVA (cosφ=0.8)',
    defaultFrom: 'kw',
    defaultTo: 'hp',
    defaultValue: '1.5',
    units: [
      { id: 'kw', label: 'kW', factor: 1000 },
      { id: 'hp', label: 'HP (cơ)', factor: 745.6998715822702 },
      { id: 'w', label: 'W', factor: 1 },
      { id: 'kva', label: 'kVA (cosφ=0.8)', factor: 800 },
    ],
  },
  {
    id: 'concentration',
    label: 'Nồng độ',
    subtitle: 'mg/L (ppm), g/m³, kg/m³, % (w/v)',
    defaultFrom: 'mg_l',
    defaultTo: 'percent',
    defaultValue: '500',
    units: [
      { id: 'mg_l', label: 'mg/L (ppm)', factor: 1 },
      { id: 'g_m3', label: 'g/m³', factor: 1 },
      { id: 'kg_m3', label: 'kg/m³', factor: 1000 },
      { id: 'percent', label: '% (w/v)', factor: 10000 },
    ],
  },
  {
    id: 'volume',
    label: 'Thể tích',
    subtitle: 'm³, Lít, mL',
    defaultFrom: 'm3',
    defaultTo: 'liter',
    defaultValue: '1',
    units: [
      { id: 'm3', label: 'm³', factor: 1000 },
      { id: 'liter', label: 'Lít', factor: 1 },
      { id: 'ml', label: 'mL', factor: 0.001 },
    ],
  },
  {
    id: 'length',
    label: 'Chiều dài',
    subtitle: 'm, mm, inch',
    defaultFrom: 'm',
    defaultTo: 'mm',
    defaultValue: '1',
    units: [
      { id: 'm', label: 'm', factor: 1 },
      { id: 'mm', label: 'mm', factor: 0.001 },
      { id: 'inch', label: 'inch', factor: 0.0254 },
    ],
  },
  {
    id: 'area',
    label: 'Diện tích',
    subtitle: 'm², cm², ha',
    defaultFrom: 'm2',
    defaultTo: 'ha',
    defaultValue: '1000',
    units: [
      { id: 'm2', label: 'm²', factor: 1 },
      { id: 'cm2', label: 'cm²', factor: 0.0001 },
      { id: 'ha', label: 'ha', factor: 10000 },
    ],
  },
];

const PIPE_SIZE_TABLE = [
  { dn: 'DN15', phi: 'Ø21', odMm: '21.3', inch: '1/2"', note: 'Ống nhánh, định lượng hóa chất' },
  { dn: 'DN20', phi: 'Ø27', odMm: '26.7', inch: '3/4"', note: 'Cấp nước sinh hoạt, rửa ngược nhỏ' },
  { dn: 'DN25', phi: 'Ø34', odMm: '33.4', inch: '1"', note: 'Đường ống châm hóa chất / cấp nước' },
  { dn: 'DN32', phi: 'Ø42', odMm: '42.2', inch: '1-1/4"', note: 'Đẩy bơm chìm mini / khí nén' },
  { dn: 'DN40', phi: 'Ø49', odMm: '48.3', inch: '1-1/2"', note: 'Bơm bùn tuần hoàn nhỏ / bơm cấp' },
  { dn: 'DN50', phi: 'Ø60', odMm: '60.3', inch: '2"', note: 'Bơm nước thải phổ biến, ống khí nhánh' },
  { dn: 'DN65', phi: 'Ø76', odMm: '75 / 76.1', inch: '2-1/2"', note: 'uPVC Ø75 · Thép Ø76.1' },
  { dn: 'DN80', phi: 'Ø90', odMm: '88.9 / 90', inch: '3"', note: 'uPVC/HDPE Ø90 · Thép Ø88.9' },
  { dn: 'DN100', phi: 'Ø114', odMm: '110 / 114.3', inch: '4"', note: 'uPVC Ø114 · HDPE Ø110 · Thép Ø114.3' },
  { dn: 'DN125', phi: 'Ø140', odMm: '140 / 141.3', inch: '5"', note: 'uPVC/HDPE Ø140 · Thép Ø141.3' },
  { dn: 'DN150', phi: 'Ø168', odMm: '160 / 168.3', inch: '6"', note: 'uPVC Ø168 · HDPE Ø160 · Thép Ø168.3' },
  { dn: 'DN200', phi: 'Ø220', odMm: '200 / 219.1 / 220', inch: '8"', note: 'uPVC Ø220 · HDPE Ø200 · Thép Ø219.1' },
  { dn: 'DN250', phi: 'Ø273', odMm: '250 / 273 / 280', inch: '10"', note: 'HDPE Ø250 · Thép Ø273 · uPVC Ø280' },
  { dn: 'DN300', phi: 'Ø315', odMm: '315 / 323.9', inch: '12"', note: 'uPVC/HDPE Ø315 · Thép Ø323.9' },
];

function sanitizeDecimalInput(raw) {
  return String(raw ?? '')
    .replace(/[^0-9.]/g, '')
    .replace(/(\..*?)\..*/g, '$1');
}

function formatConvertedNumber(num) {
  if (!Number.isFinite(num)) return '';
  const cleaned = Number(num.toPrecision(10));
  if (Object.is(cleaned, -0) || cleaned === 0) return '0';
  const abs = Math.abs(cleaned);
  if (abs >= 0.0001 && abs < 1e10) {
    return String(Number(cleaned.toFixed(6)));
  }
  return cleaned.toExponential(5).replace(/\.?0+e/, 'e');
}

function convertValue(rawText, fromUnit, toUnit) {
  if (rawText === '') return '';
  const num = rawText === '.' ? 0 : parseFloat(rawText);
  if (!Number.isFinite(num)) return '';
  const baseValue = num * fromUnit.factor;
  const converted = baseValue / toUnit.factor;
  return formatConvertedNumber(converted);
}

export const UnitConverterPanel = memo(function UnitConverterPanel() {
  const initialGroup = CONVERTER_GROUPS[0];
  const [subMode, setSubMode] = useState('units'); // 'units' | 'pipes'
  const [groupId, setGroupId] = useState(initialGroup.id);
  const [fromUnitId, setFromUnitId] = useState(initialGroup.defaultFrom);
  const [toUnitId, setToUnitId] = useState(initialGroup.defaultTo);
  const [sourceText, setSourceText] = useState(initialGroup.defaultValue);
  const [pipeFilter, setPipeFilter] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const copyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const activeGroup = useMemo(
    () => CONVERTER_GROUPS.find((g) => g.id === groupId) || CONVERTER_GROUPS[0],
    [groupId]
  );

  const fromUnit = useMemo(
    () =>
      activeGroup.units.find((u) => u.id === fromUnitId) || activeGroup.units[0],
    [activeGroup, fromUnitId]
  );

  const toUnit = useMemo(
    () =>
      activeGroup.units.find((u) => u.id === toUnitId) ||
      activeGroup.units[1] ||
      activeGroup.units[0],
    [activeGroup, toUnitId]
  );

  const targetText = useMemo(
    () => convertValue(sourceText, fromUnit, toUnit),
    [sourceText, fromUnit, toUnit]
  );

  const allConvertedRows = useMemo(
    () =>
      activeGroup.units
        .filter((u) => u.id !== fromUnit.id)
        .map((unit) => ({
          ...unit,
          converted: convertValue(sourceText, fromUnit, unit),
        })),
    [activeGroup.units, fromUnit, sourceText]
  );

  const filteredPipes = useMemo(() => {
    const q = pipeFilter.trim().toLowerCase();
    if (!q) return PIPE_SIZE_TABLE;
    return PIPE_SIZE_TABLE.filter(
      (row) =>
        row.dn.toLowerCase().includes(q) ||
        row.phi.toLowerCase().includes(q) ||
        row.odMm.toLowerCase().includes(q) ||
        row.inch.toLowerCase().includes(q) ||
        row.note.toLowerCase().includes(q)
    );
  }, [pipeFilter]);

  const handleGroupChange = useCallback((nextGroupId) => {
    const nextGroup =
      CONVERTER_GROUPS.find((g) => g.id === nextGroupId) || CONVERTER_GROUPS[0];
    setGroupId(nextGroup.id);
    setFromUnitId(nextGroup.defaultFrom);
    setToUnitId(nextGroup.defaultTo);
    setSourceText(nextGroup.defaultValue);
  }, []);

  const handleSourceChange = useCallback((e) => {
    setSourceText(sanitizeDecimalInput(e.target.value));
  }, []);

  const handleTargetChange = useCallback(
    (e) => {
      const valid = sanitizeDecimalInput(e.target.value);
      setSourceText(convertValue(valid, toUnit, fromUnit));
    },
    [toUnit, fromUnit]
  );

  const handleSwapPair = useCallback(() => {
    setFromUnitId(toUnit.id);
    setToUnitId(fromUnit.id);
  }, [fromUnit.id, toUnit.id]);

  const handlePromoteUnitAsSource = useCallback(
    (unitId) => {
      if (unitId === fromUnit.id) return;
      const prevFromId = fromUnit.id;
      setFromUnitId(unitId);
      setToUnitId(prevFromId);
    },
    [fromUnit.id]
  );

  const handleCopyText = useCallback(async (id, valueToCopy) => {
    if (!valueToCopy) return;
    try {
      await navigator.clipboard.writeText(String(valueToCopy));
      setCopiedId(id);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedId(null);
        copyTimerRef.current = null;
      }, 1500);
    } catch {
      // Ignore clipboard failures in restricted environments
    }
  }, []);

  const unitRatio = useMemo(
    () => formatConvertedNumber(fromUnit.factor / toUnit.factor),
    [fromUnit.factor, toUnit.factor]
  );

  return (
    <div className="space-y-4">
      {/* Sub-mode Switcher: Chuyển đổi Đơn vị | Quy đổi Ống DN/Phi/Inch */}
      <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-900/70 p-1 border border-slate-700/80">
        <button
          type="button"
          onClick={() => setSubMode('units')}
          className={`flex items-center justify-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
            subMode === 'units'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
          }`}
        >
          <Layers className="h-3.5 w-3.5 shrink-0" />
          <span>Nhóm đơn vị (7)</span>
        </button>

        <button
          type="button"
          onClick={() => setSubMode('pipes')}
          className={`flex items-center justify-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
            subMode === 'pipes'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
          }`}
        >
          <Ruler className="h-3.5 w-3.5 shrink-0" />
          <span>Quy đổi Ống (DN / Phi)</span>
        </button>
      </div>

      {subMode === 'units' ? (
        <div className="space-y-4">
          {/* Chọn nhóm đại lượng dạng nút chạm nhanh */}
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Nhóm đại lượng
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CONVERTER_GROUPS.map((group) => {
                const isSelected = group.id === groupId;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => handleGroupChange(group.id)}
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-xs'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                    }`}
                  >
                    {group.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cặp quy đổi 1-1 hai chiều kèm nút đảo chiều nhanh (Swap) */}
          <div className="rounded-xl bg-slate-800/70 border border-slate-700/80 p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
              {/* Khối Nguồn */}
              <div className="flex-1 space-y-1.5 min-w-0">
                <label
                  htmlFor="converter-left-input"
                  className="block text-xs font-medium text-slate-400"
                >
                  Giá trị &amp; Đơn vị nguồn
                </label>
                <input
                  id="converter-left-input"
                  type="text"
                  inputMode="decimal"
                  value={sourceText}
                  onChange={handleSourceChange}
                  placeholder="0"
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 font-mono text-base font-semibold text-slate-100 tabular-nums focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors"
                />
                <select
                  id="converter-from-unit"
                  aria-label="Đơn vị nguồn"
                  value={fromUnit.id}
                  onChange={(e) => setFromUnitId(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors cursor-pointer"
                >
                  {activeGroup.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nút đảo chiều nhanh (Swap) */}
              <div className="flex items-center justify-center sm:pb-4 shrink-0">
                <button
                  type="button"
                  onClick={handleSwapPair}
                  aria-label="Đảo chiều đơn vị nguồn và đích"
                  title="Đảo chiều nhanh (Swap)"
                  className="flex items-center justify-center min-h-[40px] min-w-[40px] rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 hover:bg-emerald-600/20 hover:border-emerald-500/50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <ArrowLeftRight className="h-4 w-4 rotate-90 sm:rotate-0 transition-transform" />
                </button>
              </div>

              {/* Khối Đích (Cặp 1-1) */}
              <div className="flex-1 space-y-1.5 min-w-0">
                <label
                  htmlFor="converter-right-input"
                  className="block text-xs font-medium text-slate-400"
                >
                  Quy đổi nhanh (1–1)
                </label>
                <div className="relative flex items-center">
                  <input
                    id="converter-right-input"
                    type="text"
                    inputMode="decimal"
                    value={targetText}
                    onChange={handleTargetChange}
                    placeholder="0"
                    className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 pl-3 pr-10 py-2 font-mono text-base font-semibold text-slate-100 tabular-nums focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyText('pair-target', targetText)}
                    disabled={!targetText}
                    title="Sao chép kết quả"
                    aria-label="Sao chép kết quả quy đổi"
                    className="absolute right-1.5 inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:text-emerald-400 hover:bg-slate-800 disabled:opacity-35 transition-colors cursor-pointer"
                  >
                    {copiedId === 'pair-target' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <select
                  aria-label="Đơn vị đích"
                  value={toUnit.id}
                  onChange={(e) => setToUnitId(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-sky-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors cursor-pointer"
                >
                  {activeGroup.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-700/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-400">Hệ số chuẩn:</span>
              <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                1 {fromUnit.label} = {unitRatio} {toUnit.label}
              </span>
            </div>
          </div>

          {/* Chế độ "Gõ 1 ra tất cả": Danh sách quy đổi đồng thời sang tất cả đơn vị còn lại */}
          <div className="rounded-xl bg-slate-800/70 border border-slate-700/80 overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-slate-700/70 bg-slate-900/60 flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Quy đổi đồng thời ({sourceText || '0'} {fromUnit.label})
              </span>
              <span className="text-[11px] text-slate-400">
                {allConvertedRows.length} đơn vị
              </span>
            </div>

            <div className="divide-y divide-slate-700/60">
              {allConvertedRows.map((row) => {
                const isCopied = copiedId === row.id;
                return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-slate-900/40 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => handlePromoteUnitAsSource(row.id)}
                      title={`Đặt ${row.label} làm đơn vị nguồn`}
                      className="text-left min-w-0 flex-1 group cursor-pointer"
                    >
                      <div className="text-xs font-medium text-slate-400 group-hover:text-emerald-400 transition-colors truncate">
                        {row.label}
                      </div>
                      <div className="font-mono text-sm sm:text-base font-bold text-slate-100 tabular-nums break-all">
                        {row.converted || '—'}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyText(row.id, row.converted)}
                      disabled={!row.converted}
                      title={`Sao chép giá trị (${row.label})`}
                      aria-label={`Sao chép ${row.converted} ${row.label}`}
                      className="inline-flex items-center gap-1 min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-900/70 border border-slate-700/80 text-xs font-medium text-slate-300 hover:border-emerald-500/60 hover:text-emerald-400 disabled:opacity-35 transition-colors shrink-0 cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* TAB RIÊNG: BẢNG TRA NHANH QUY ĐỔI ỐNG (DN / PHI / INCH) */
        <div className="space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={pipeFilter}
              onChange={(e) => setPipeFilter(e.target.value)}
              placeholder="Lọc nhanh theo DN, Phi hoặc Inch (VD: 100, 114, 4, 60)..."
              aria-label="Lọc nhanh kích cỡ ống"
              className="w-full min-h-[42px] rounded-lg bg-slate-900 border border-slate-700 pl-9 pr-9 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
            />
            {pipeFilter && (
              <button
                type="button"
                onClick={() => setPipeFilter('')}
                aria-label="Xóa bộ lọc cỡ ống"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="rounded-xl border border-slate-700/80 overflow-hidden bg-slate-800/70">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-700/80 text-slate-300">
                    <th className="px-3 py-2.5 font-bold">DN</th>
                    <th className="px-3 py-2.5 font-bold">Phi (Ø)</th>
                    <th className="px-3 py-2.5 font-bold">Inch</th>
                    <th className="px-3 py-2.5 font-bold hidden sm:table-cell">
                      OD thực tế (mm)
                    </th>
                    <th className="px-2 py-2.5 text-right font-bold">Copy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {filteredPipes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-slate-400"
                      >
                        Không tìm thấy cỡ ống phù hợp với &ldquo;{pipeFilter}&rdquo;.
                      </td>
                    </tr>
                  ) : (
                    filteredPipes.map((pipe) => {
                      const copyKey = `pipe-${pipe.dn}`;
                      const copyPayload = `${pipe.dn} (${pipe.phi} - ${pipe.inch})`;
                      const isCopied = copiedId === copyKey;
                      return (
                        <tr
                          key={pipe.dn}
                          className="hover:bg-slate-900/40 transition-colors"
                        >
                          <td className="px-3 py-2 font-mono font-bold text-emerald-400 whitespace-nowrap">
                            {pipe.dn}
                          </td>
                          <td className="px-3 py-2 font-mono font-semibold text-slate-100 whitespace-nowrap">
                            {pipe.phi}
                            <div className="sm:hidden text-[10px] font-normal text-slate-400">
                              OD: {pipe.odMm} mm
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono font-semibold text-sky-400 whitespace-nowrap">
                            {pipe.inch}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-300 hidden sm:table-cell">
                            <div>{pipe.odMm} mm</div>
                            <div className="font-sans text-[10px] text-slate-400 truncate max-w-[175px]">
                              {pipe.note}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleCopyText(copyKey, copyPayload)}
                              title={`Sao chép ${copyPayload}`}
                              aria-label={`Sao chép ${copyPayload}`}
                              className="inline-flex items-center justify-center min-h-[30px] min-w-[30px] px-2 rounded-md bg-slate-900/70 border border-slate-700/80 text-slate-300 hover:border-emerald-500/60 hover:text-emerald-400 transition-colors cursor-pointer"
                            >
                              {isCopied ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Ghi chú: Đường kính ngoài (OD) đối chiếu chuẩn phổ thông Việt Nam cho
            ống uPVC, HDPE và thép mạ kẽm/Inox (DN15 – DN300).
          </p>
        </div>
      )}
    </div>
  );
});

export default UnitConverterPanel;
