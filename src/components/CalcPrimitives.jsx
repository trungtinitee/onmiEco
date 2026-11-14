import { AlertTriangle, CheckCircle2 } from 'lucide-react';

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

export function NumberField({
  id,
  label,
  unit,
  value,
  min = 0,
  max,
  step,
  disabled = false,
  allowNegative = false,
  onChange,
}) {
  const handleChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange(0);
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      onChange(0);
      return;
    }
    onChange(allowNegative ? parsed : Math.max(0, parsed));
  };

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
          min={allowNegative ? min : Math.max(0, Number(min) || 0)}
          max={max}
          step={step}
          disabled={disabled}
          value={displayVal}
          onChange={handleChange}
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
      className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
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

export function CheckTable({ rows }) {
  return (
    <div className="overflow-x-auto w-full rounded-lg border border-slate-700/80">
      <table className="w-full min-w-[600px] text-left border-collapse text-sm">
        <thead>
          <tr className="bg-slate-900/90 text-xs font-medium text-slate-400 border-b border-slate-700/80">
            <th className="py-3 px-4">Hạng mục kiểm tra</th>
            <th className="py-3 px-4 text-right">Ngưỡng chuẩn</th>
            <th className="py-3 px-4 text-right">Giá trị thực tế</th>
            <th className="py-3 px-4 text-right">Kết luận</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/60">
          {rows.map((r) => (
            <tr key={r.name} className="hover:bg-slate-900/40">
              <td className="py-3 px-4 text-slate-200">{r.name}</td>
              <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
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
  );
}
