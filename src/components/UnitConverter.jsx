import { memo, useCallback, useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';

const CONVERTER_GROUPS = [
  {
    id: 'flow',
    label: 'Lưu lượng (Flow)',
    defaultFrom: 'm3_day',
    defaultTo: 'm3_h',
    defaultValue: '1000',
    units: [
      { id: 'm3_day', label: 'm³/ngày', factor: 1 },
      { id: 'm3_h', label: 'm³/h', factor: 24 },
      { id: 'l_s', label: 'L/s', factor: 86.4 },
      { id: 'gpm', label: 'GPM (US)', factor: 5.45099296896 },
    ],
  },
  {
    id: 'pressure',
    label: 'Áp suất (Pressure)',
    defaultFrom: 'bar',
    defaultTo: 'mh2o',
    defaultValue: '1',
    units: [
      { id: 'bar', label: 'bar', factor: 100 },
      { id: 'atm', label: 'atm', factor: 101.325 },
      { id: 'mh2o', label: 'mH₂O (mét cột nước)', factor: 9.80665 },
      { id: 'kpa', label: 'kPa', factor: 1 },
      { id: 'psi', label: 'psi', factor: 6.89475729316836 },
    ],
  },
  {
    id: 'power',
    label: 'Công suất (Power)',
    defaultFrom: 'kw',
    defaultTo: 'hp',
    defaultValue: '1',
    units: [
      { id: 'kw', label: 'kW', factor: 1000 },
      { id: 'hp', label: 'HP (mã lực)', factor: 745.6998715822702 },
      { id: 'w', label: 'W', factor: 1 },
    ],
  },
  {
    id: 'volume',
    label: 'Thể tích (Volume)',
    defaultFrom: 'm3',
    defaultTo: 'liter',
    defaultValue: '1',
    units: [
      { id: 'm3', label: 'm³', factor: 1000 },
      { id: 'liter', label: 'Lít', factor: 1 },
      { id: 'gallon', label: 'Gallon (US)', factor: 3.785411784 },
    ],
  },
  {
    id: 'concentration',
    label: 'Nồng độ (Concentration)',
    defaultFrom: 'mg_l',
    defaultTo: 'percent',
    defaultValue: '1000',
    units: [
      { id: 'mg_l', label: 'mg/L', factor: 1 },
      { id: 'ppm', label: 'ppm', factor: 1 },
      { id: 'g_m3', label: 'g/m³', factor: 1 },
      { id: 'percent', label: '%', factor: 10000 },
    ],
  },
];

function sanitizeDecimalInput(raw) {
  return String(raw ?? '')
    .replace(/[^0-9.]/g, '')
    .replace(/(\..*?)\..*/g, '$1');
}

function formatConvertedNumber(num) {
  if (!Number.isFinite(num)) return '';
  if (num === 0) return '0';
  const abs = Math.abs(num);
  if (abs >= 0.0001 && abs < 1e9) {
    return String(Number(num.toFixed(6)));
  }
  return Number(num.toPrecision(6)).toString();
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
  const [groupId, setGroupId] = useState(initialGroup.id);
  const [fromUnitId, setFromUnitId] = useState(initialGroup.defaultFrom);
  const [toUnitId, setToUnitId] = useState(initialGroup.defaultTo);
  const [leftText, setLeftText] = useState(initialGroup.defaultValue);
  const [rightText, setRightText] = useState(() => {
    const fromU = initialGroup.units.find(
      (u) => u.id === initialGroup.defaultFrom
    );
    const toU = initialGroup.units.find((u) => u.id === initialGroup.defaultTo);
    return convertValue(initialGroup.defaultValue, fromU, toU);
  });

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

  const handleGroupChange = useCallback((nextGroupId) => {
    const nextGroup =
      CONVERTER_GROUPS.find((g) => g.id === nextGroupId) || CONVERTER_GROUPS[0];
    const nextFrom = nextGroup.units.find(
      (u) => u.id === nextGroup.defaultFrom
    );
    const nextTo = nextGroup.units.find((u) => u.id === nextGroup.defaultTo);
    setGroupId(nextGroup.id);
    setFromUnitId(nextFrom.id);
    setToUnitId(nextTo.id);
    setLeftText(nextGroup.defaultValue);
    setRightText(convertValue(nextGroup.defaultValue, nextFrom, nextTo));
  }, []);

  const handleLeftChange = useCallback(
    (e) => {
      const valid = sanitizeDecimalInput(e.target.value);
      setLeftText(valid);
      setRightText(convertValue(valid, fromUnit, toUnit));
    },
    [fromUnit, toUnit]
  );

  const handleRightChange = useCallback(
    (e) => {
      const valid = sanitizeDecimalInput(e.target.value);
      setRightText(valid);
      setLeftText(convertValue(valid, toUnit, fromUnit));
    },
    [fromUnit, toUnit]
  );

  const handleFromUnitChange = useCallback(
    (nextId) => {
      const nextFrom =
        activeGroup.units.find((u) => u.id === nextId) || activeGroup.units[0];
      setFromUnitId(nextFrom.id);
      setRightText(convertValue(leftText, nextFrom, toUnit));
    },
    [activeGroup, leftText, toUnit]
  );

  const handleToUnitChange = useCallback(
    (nextId) => {
      const nextTo =
        activeGroup.units.find((u) => u.id === nextId) || activeGroup.units[0];
      setToUnitId(nextTo.id);
      setRightText(convertValue(leftText, fromUnit, nextTo));
    },
    [activeGroup, leftText, fromUnit]
  );

  const handleSwapUnits = useCallback(() => {
    setFromUnitId(toUnit.id);
    setToUnitId(fromUnit.id);
    setRightText(convertValue(leftText, toUnit, fromUnit));
  }, [fromUnit, toUnit, leftText]);

  const unitRatio = useMemo(
    () => formatConvertedNumber(fromUnit.factor / toUnit.factor),
    [fromUnit.factor, toUnit.factor]
  );

  return (
    <div className="space-y-4">
      {/* Chọn nhóm đại lượng */}
      <div>
        <label
          htmlFor="converter-group"
          className="block text-sm font-medium text-slate-200 mb-2"
        >
          Nhóm đại lượng
        </label>
        <select
          id="converter-group"
          value={groupId}
          onChange={(e) => handleGroupChange(e.target.value)}
          className="w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-2 text-sm font-medium text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors cursor-pointer"
        >
          {CONVERTER_GROUPS.map((group) => (
            <option
              key={group.id}
              value={group.id}
              className="bg-slate-900 text-slate-100"
            >
              {group.label}
            </option>
          ))}
        </select>
      </div>

      {/* Hai khối nhập liệu hai chiều + nút đảo chiều ↔️ ở giữa */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
        {/* Khối bên trái */}
        <div className="flex-1 space-y-2 min-w-0">
          <label
            htmlFor="converter-left-input"
            className="block text-xs font-medium text-slate-400"
          >
            Giá trị nguồn
          </label>
          <input
            id="converter-left-input"
            type="text"
            inputMode="decimal"
            value={leftText}
            onChange={handleLeftChange}
            placeholder="0"
            className="w-full min-h-[46px] rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-2 font-mono text-base font-semibold text-white tabular-nums focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors"
          />
          <select
            aria-label="Đơn vị nguồn"
            value={fromUnit.id}
            onChange={(e) => handleFromUnitChange(e.target.value)}
            className="w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm font-medium text-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors cursor-pointer"
          >
            {activeGroup.units.map((u) => (
              <option
                key={u.id}
                value={u.id}
                className="bg-slate-900 text-slate-100"
              >
                {u.label}
              </option>
            ))}
          </select>
        </div>

        {/* Biểu tượng mũi tên ↔️ ở giữa (click để hoán đổi đơn vị) */}
        <div className="flex items-center justify-center sm:pb-5 shrink-0">
          <button
            type="button"
            onClick={handleSwapUnits}
            aria-label="Hoán đổi hai đơn vị"
            title="Hoán đổi hai đơn vị"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg bg-slate-800 border border-slate-700 text-emerald-400 hover:bg-slate-700 hover:text-emerald-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <ArrowLeftRight className="h-4 w-4 rotate-90 sm:rotate-0 transition-transform" />
          </button>
        </div>

        {/* Khối bên phải */}
        <div className="flex-1 space-y-2 min-w-0">
          <label
            htmlFor="converter-right-input"
            className="block text-xs font-medium text-slate-400"
          >
            Giá trị quy đổi
          </label>
          <input
            id="converter-right-input"
            type="text"
            inputMode="decimal"
            value={rightText}
            onChange={handleRightChange}
            placeholder="0"
            className="w-full min-h-[46px] rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-2 font-mono text-base font-semibold text-white tabular-nums focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors"
          />
          <select
            aria-label="Đơn vị đích"
            value={toUnit.id}
            onChange={(e) => handleToUnitChange(e.target.value)}
            className="w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm font-medium text-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors cursor-pointer"
          >
            {activeGroup.units.map((u) => (
              <option
                key={u.id}
                value={u.id}
                className="bg-slate-900 text-slate-100"
              >
                {u.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tỷ lệ quy đổi tham chiếu nhanh */}
      <div className="rounded-lg bg-slate-800/70 border border-slate-700/80 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-400">Hệ số quy đổi chuẩn:</span>
        <span className="font-mono font-semibold text-emerald-400 tabular-nums">
          1 {fromUnit.label} = {unitRatio} {toUnit.label}
        </span>
      </div>
    </div>
  );
});

export default UnitConverterPanel;
