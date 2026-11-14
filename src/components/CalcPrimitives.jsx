import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  Table,
} from 'lucide-react';

export function safeDiv(numerator, denominator, fallback = 0) {
  const num = Number(numerator);
  const den = Number(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
    return fallback;
  }
  const res = num / den;
  return Number.isFinite(res) ? res : fallback;
}

export function roundUpToStep(val, step = 0.1) {
  if (!Number.isFinite(val) || val <= 0) return step;
  return Number((Math.ceil(val / step) * step).toFixed(2));
}

export function sanitizeDecimalText(rawValue) {
  return String(rawValue ?? '')
    .replace(/[^0-9.]/g, '')
    .replace(/(\..*?)\..*/g, '$1');
}

function formatExternalNumberToString(val, zeroAsEmpty = true) {
  if (val === '' || val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  const num = Number(val);
  if (!Number.isFinite(num)) return '';
  if (zeroAsEmpty && num === 0) return '';
  return String(num);
}

export function DecimalInput({
  value,
  onValueChange,
  zeroAsEmpty = true,
  disabled = false,
  placeholder = '0',
  className = '',
  onBlur,
  ...rest
}) {
  const [textValue, setTextValue] = useState(() =>
    formatExternalNumberToString(value, zeroAsEmpty)
  );

  useEffect(() => {
    const extNum =
      value === '' || value === null || value === undefined
        ? 0
        : parseFloat(String(value));
    const safeExtNum = Number.isFinite(extNum) ? extNum : 0;

    setTextValue((prev) => {
      const prevNum =
        prev === '' || prev === '.' ? 0 : parseFloat(prev);
      const safePrevNum = Number.isFinite(prevNum) ? prevNum : 0;
      if (safePrevNum === safeExtNum) {
        return prev;
      }
      return formatExternalNumberToString(value, zeroAsEmpty);
    });
  }, [value, zeroAsEmpty]);

  const handleDecimalChange = (e) => {
    const validValue = e.target.value
      .replace(/[^0-9.]/g, '')
      .replace(/(\..*?)\..*/g, '$1');

    setTextValue(validValue);

    if (onValueChange) {
      if (validValue === '' || validValue === '.') {
        onValueChange(0);
      } else {
        const parsed = parseFloat(validValue);
        onValueChange(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
      }
    }
  };

  const handleBlur = (e) => {
    if (textValue === '.') {
      setTextValue('');
    }
    if (onBlur) onBlur(e);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={textValue}
      onChange={handleDecimalChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
}

export function NumberField({
  id,
  label,
  unit,
  value,
  disabled = false,
  onChange,
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-200 mb-2"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <DecimalInput
          id={id}
          disabled={disabled}
          value={value}
          onValueChange={onChange}
          placeholder="0"
          className={`w-full min-h-[44px] rounded-lg border px-3.5 pr-24 py-2 font-mono text-sm font-medium tabular-nums focus:outline-none transition-colors ${
            disabled
              ? 'bg-slate-900/50 border-slate-700/50 text-slate-400 cursor-not-allowed'
              : 'bg-slate-900 border-slate-700 text-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
          }`}
        />
        <span className="absolute right-3 text-xs font-mono text-slate-400 pointer-events-none">
          {unit}
        </span>
      </div>
    </div>
  );
}

export function StatusBanner({
  ok,
  titleOk,
  titleFail,
  message,
  summaryLabel = 'Thông số kiểm tra',
  summaryRight,
}) {
  return (
    <div
      role="status"
      className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:break-inside-avoid print:shadow-none ${
        ok
          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
          : 'bg-red-500/10 border-red-500/40 text-red-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {ok ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        )}
        <div>
          <div className="text-sm font-semibold">{ok ? titleOk : titleFail}</div>
          <p className="text-xs opacity-90 mt-1">{message}</p>
        </div>
      </div>

      {summaryRight !== undefined && summaryRight !== null && (
        <div className="sm:text-right shrink-0">
          <div className="text-xs opacity-80">{summaryLabel}</div>
          <div className="font-mono text-lg font-bold tabular-nums">
            {summaryRight}
          </div>
        </div>
      )}
    </div>
  );
}

export function ViewModeToggle({ viewMode, setViewMode, className = '' }) {
  return (
    <div
      role="group"
      aria-label="Chuyển đổi chế độ xem"
      className={`print:hidden flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 shrink-0 ${className}`}
    >
      <button
        type="button"
        onClick={() => setViewMode('table')}
        aria-pressed={viewMode === 'table'}
        aria-label="Xem dạng bảng"
        title="Xem dạng bảng"
        className={`flex items-center justify-center p-2 rounded-md transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
          viewMode === 'table'
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
        }`}
      >
        <Table className="h-4 w-4 pointer-events-none" />
      </button>
      <button
        type="button"
        onClick={() => setViewMode('card')}
        aria-pressed={viewMode === 'card'}
        aria-label="Xem dạng thẻ"
        title="Xem dạng thẻ"
        className={`flex items-center justify-center p-2 rounded-md transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
          viewMode === 'card'
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
        }`}
      >
        <LayoutGrid className="h-4 w-4 pointer-events-none" />
      </button>
    </div>
  );
}

export function CheckTable({ rows, title = 'Bảng kiểm tra thông số' }) {
  const [viewMode, setViewMode] = useState('table');

  return (
    <div className="space-y-3 print:break-inside-avoid">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-400 print:text-gray-700">
          {title}
        </span>
        <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
      </div>

      {viewMode === 'table' ? (
        <div className="overflow-x-auto w-full rounded-lg border border-slate-700/80 print:overflow-visible print:border-gray-300 print:bg-transparent">
          <table className="w-full min-w-[600px] text-left border-collapse text-sm print:min-w-0 print:w-full print:text-gray-900">
            <thead>
              <tr className="bg-slate-900/90 text-xs font-medium text-slate-400 border-b border-slate-700/80 print:bg-gray-100 print:text-gray-700 print:border-gray-300">
                <th className="py-3 px-4">Hạng mục kiểm tra</th>
                <th className="py-3 px-4 text-right">Ngưỡng chuẩn</th>
                <th className="py-3 px-4 text-right">Giá trị thực tế</th>
                <th className="py-3 px-4 text-right">Kết luận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 print:divide-gray-300">
              {rows.map((r) => (
                <tr
                  key={r.name}
                  className="hover:bg-slate-900/40 print:break-inside-avoid"
                >
                  <td className="py-3 px-4 text-slate-200 print:text-gray-900">
                    {r.name}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300 print:text-gray-800">
                    {r.standard}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono font-semibold tabular-nums ${
                      r.ok ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {r.actual}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-medium ${
                      r.ok ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {r.statusText}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => (
            <div
              key={r.name}
              className="bg-slate-800 p-4 rounded-lg border border-slate-700 shadow-sm space-y-2.5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid"
            >
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-700/70 print:border-gray-300">
                <h4 className="text-sm font-semibold text-slate-100 leading-snug print:text-gray-900">
                  {r.name}
                </h4>
                <span
                  className={`text-xs font-semibold shrink-0 ${
                    r.ok ? 'text-emerald-500' : 'text-red-500'
                  }`}
                >
                  {r.statusText}
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400 print:text-gray-600">
                    Ngưỡng chuẩn
                  </span>
                  <span className="text-slate-100 font-medium font-mono tabular-nums text-right print:text-gray-900">
                    {r.standard}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400 print:text-gray-600">
                    Giá trị thực tế
                  </span>
                  <span
                    className={`font-medium font-mono tabular-nums text-right ${
                      r.ok ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {r.actual}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
