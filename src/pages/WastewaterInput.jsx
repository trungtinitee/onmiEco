import { useEffect, useState } from 'react';
import { AlertTriangle, FlaskConical, Gauge } from 'lucide-react';
import { FLOW_PRESETS, useAppContext } from '../context/AppContext';
import { DecimalInput, ViewModeToggle } from '../components/CalcPrimitives';

const POLLUTANT_FIELDS = [
  {
    key: 'bod5',
    id: 'ww-influent-bod5',
    label: 'BOD₅ đầu vào',
    hint: 'Nhu cầu oxy sinh hóa 5 ngày',
    placeholder: '250',
  },
  {
    key: 'cod',
    id: 'ww-influent-cod',
    label: 'COD đầu vào',
    hint: 'Nhu cầu oxy hóa học',
    placeholder: '500',
  },
  {
    key: 'ss',
    id: 'ww-influent-ss',
    label: 'Chất rắn lơ lửng (SS)',
    hint: 'Tổng chất rắn lơ lửng TSS',
    placeholder: '220',
  },
  {
    key: 'tn',
    id: 'ww-influent-tn',
    label: 'Tổng Nitơ (TN)',
    hint: 'TKN + NOₓ đầu vào',
    placeholder: '45',
  },
  {
    key: 'tp',
    id: 'ww-influent-tp',
    label: 'Tổng Phốt pho (TP)',
    hint: 'Phốt pho tổng đầu vào',
    placeholder: '8',
  },
];

export default function WastewaterInput() {
  const {
    globalQ,
    setGlobalQ,
    peakingFactor,
    setPeakingFactor,
    hydraulics,
    wastewaterPollutants,
    setWastewaterPollutants,
  } = useAppContext();

  const [peakingText, setPeakingText] = useState(() => String(peakingFactor));
  const [viewMode, setViewMode] = useState('table');

  useEffect(() => {
    setPeakingText((prev) => {
      const prevNum = parseFloat(prev);
      if (Number.isFinite(prevNum) && prevNum >= 1 && prevNum === peakingFactor) {
        return prev;
      }
      return prev === '' || prev === '0' || prev === '0.'
        ? prev
        : String(peakingFactor);
    });
  }, [peakingFactor]);

  const handlePeakingChange = (e) => {
    const validValue = e.target.value
      .replace(/[^0-9.]/g, '')
      .replace(/(\..*?)\..*/g, '$1');
    setPeakingText(validValue);
    const parsed = parseFloat(validValue);
    if (Number.isFinite(parsed) && parsed >= 1) {
      setPeakingFactor(Math.min(5, parsed));
    }
  };

  const handlePeakingBlur = () => {
    const parsed = parseFloat(peakingText);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setPeakingFactor(1);
      setPeakingText('1');
    } else if (parsed > 5) {
      setPeakingFactor(5);
      setPeakingText('5');
    }
  };

  const updatePollutant = (key, nextVal) => {
    setWastewaterPollutants((prev) => ({
      ...prev,
      [key]: Math.max(0, Number(nextVal) || 0),
    }));
  };

  const qDay = hydraulics.qDay;
  const bodLoadKgDay = (qDay * (Number(wastewaterPollutants.bod5) || 0)) / 1000;
  const codLoadKgDay = (qDay * (Number(wastewaterPollutants.cod) || 0)) / 1000;
  const ssLoadKgDay = (qDay * (Number(wastewaterPollutants.ss) || 0)) / 1000;
  const tnLoadKgDay = (qDay * (Number(wastewaterPollutants.tn) || 0)) / 1000;
  const tpLoadKgDay = (qDay * (Number(wastewaterPollutants.tp) || 0)) / 1000;

  const bodToCodRatio =
    wastewaterPollutants.cod > 0
      ? wastewaterPollutants.bod5 / wastewaterPollutants.cod
      : 0;

  return (
    <div className="space-y-8 pb-4 print:pb-0">
      {/* Page Title */}
      <section className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-500">
          <Gauge className="h-4 w-4" />
          <span>Thông số dùng chung toàn dây chuyền Nước thải</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 text-balance">
          Thông số đầu vào Hệ thống Xử lý Nước thải
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-3xl">
          Thiết lập lưu lượng thiết kế (Q), hệ số không điều hòa (Kₕ) và nồng độ
          các chỉ tiêu ô nhiễm đầu vào. Dữ liệu được lưu vào Global State để
          đồng bộ tự động cho Tiền xử lý, Hóa lý, Sinh học, Lắng bùn và MEP.
        </p>
      </section>

      {/* 1. Primary Flow & Peaking Factor Input Card */}
      <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-6 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              1. Lưu lượng thiết kế &amp; Hệ số vượt tải (Q, Kₕ)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Dùng chung cho toàn bộ các công đoạn xử lý nước thải và đường ống
              công nghệ.
            </p>
          </div>
          <span className="font-mono text-xs text-emerald-400 tabular-nums">
            Qmax,h = {hydraulics.qMaxHour.toFixed(2)} m³/h
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="ww-global-q-input"
              className="block text-sm font-medium text-slate-200 mb-2"
            >
              Lưu lượng thiết kế trung bình (Q) — m³/ngày
            </label>
            <div className="relative flex items-center">
              <DecimalInput
                id="ww-global-q-input"
                value={globalQ}
                onValueChange={setGlobalQ}
                placeholder="Nhập lưu lượng (VD: 1000)"
                className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-4 pr-24 py-2.5 font-mono text-base font-semibold text-slate-100 tabular-nums placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors"
              />
              <span className="absolute right-3.5 text-xs font-mono text-slate-400 pointer-events-none">
                m³/ngày
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="ww-peaking-factor-input"
              className="block text-sm font-medium text-slate-200 mb-2"
            >
              Hệ số không điều hòa giờ (Kₕ)
            </label>
            <div className="relative flex items-center">
              <input
                id="ww-peaking-factor-input"
                type="text"
                inputMode="decimal"
                value={peakingText}
                onChange={handlePeakingChange}
                onBlur={handlePeakingBlur}
                placeholder="1.5"
                className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-4 pr-16 py-2.5 font-mono text-base font-semibold text-slate-100 tabular-nums focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors"
              />
              <span className="absolute right-3.5 text-xs font-mono text-slate-400 pointer-events-none">
                lần
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 italic">
              Gợi ý: 1,5 – 3,0 tùy quy mô lưu lượng (TCVN 7957:2008)
            </p>
          </div>
        </div>

        {/* Presets Row */}
        <div className="print:hidden pt-4 border-t border-slate-700/70 space-y-2.5">
          <div className="text-xs font-medium text-slate-400">
            Mức lưu lượng tham khảo nhanh
          </div>
          <div className="flex flex-wrap gap-2.5">
            {FLOW_PRESETS.map((preset) => {
              const isSelected = Number(globalQ) === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setGlobalQ(preset.value)}
                  className={`inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 font-semibold'
                      : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-slate-500 hover:text-slate-100'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {globalQ <= 0 && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3.5 text-sm text-amber-200"
          >
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              Lưu lượng thiết kế đang bằng 0 m³/ngày. Hãy nhập giá trị dương
              hoặc chọn một mức lưu lượng mẫu ở trên để kích hoạt phép tính công
              trình.
            </div>
          </div>
        )}
      </section>

      {/* 2. Hydraulic Conversion Metrics (4-column KPI strip) */}
      <section aria-labelledby="ww-hydraulics-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="ww-hydraulics-heading"
            className="text-lg font-semibold text-slate-100"
          >
            2. Quy đổi lưu lượng thủy lực dây chuyền
          </h2>
          <span className="text-xs text-slate-400">
            Tính toán liên tục 24 giờ/ngày · Đường ống tự chảy v ={' '}
            {hydraulics.velocityTarget} m/s
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
            <div className="text-xs font-medium text-slate-400">
              Lưu lượng ngày (Qngày)
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
              {hydraulics.qDay.toLocaleString('vi-VN')}
            </div>
            <div className="mt-1 text-xs text-slate-400">m³/ngày đêm</div>
          </div>

          <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
            <div className="text-xs font-medium text-slate-400">
              Lưu lượng giờ TB (Qtb,h)
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
              {hydraulics.qHour.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
              m³/giờ · {hydraulics.qSecond.toFixed(2)} L/s
            </div>
          </div>

          <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
            <div className="text-xs font-medium text-slate-400">
              Lưu lượng giờ cực đại (Qmax,h)
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
              {hydraulics.qMaxHour.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
              m³/giờ · Kₕ = {peakingFactor.toFixed(2)}
            </div>
          </div>

          <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
            <div className="text-xs font-medium text-slate-400">
              Đường kính ống dẫn sơ bộ
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
              {hydraulics.pipeDiameterMm > 0
                ? `DN ${Math.ceil(hydraulics.pipeDiameterMm / 10) * 10}`
                : 'DN 0'}
            </div>
            <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
              D tính = {hydraulics.pipeDiameterMm.toFixed(1)} mm (Qmax,s ={' '}
              {hydraulics.qMaxSecond.toFixed(2)} L/s)
            </div>
          </div>
        </div>
      </section>

      {/* 3. Influent Wastewater Pollutants (BOD5, COD, SS, TN, TP) */}
      <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
          <div className="flex items-start gap-2.5">
            <FlaskConical className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                3. Thông số ô nhiễm đầu vào (mg/L)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Lưu trữ trong Global State để tính tải lượng ô nhiễm và đồng bộ
                cho các bước tính toán công nghệ phía sau.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs text-slate-300 tabular-nums">
            BOD₅ / COD = {bodToCodRatio.toFixed(2)}{' '}
            {bodToCodRatio >= 0.45 ? '(Dễ phân hủy sinh học)' : '(Khó phân hủy SH)'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {POLLUTANT_FIELDS.map((field) => {
            const val = wastewaterPollutants[field.key];
            const loadKg = (qDay * (Number(val) || 0)) / 1000;
            return (
              <div key={field.key}>
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <label
                    htmlFor={field.id}
                    className="block text-sm font-medium text-slate-200"
                  >
                    {field.label}
                  </label>
                  <span className="font-mono text-xs text-emerald-400 tabular-nums">
                    {loadKg.toFixed(1)} kg/ng
                  </span>
                </div>
                <div className="relative flex items-center">
                  <DecimalInput
                    id={field.id}
                    value={val}
                    onValueChange={(next) => updatePollutant(field.key, next)}
                    placeholder={field.placeholder}
                    className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 pr-16 py-2 font-mono text-sm font-semibold text-slate-100 tabular-nums focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors"
                  />
                  <span className="absolute right-3 text-xs font-mono text-slate-400 pointer-events-none">
                    mg/L
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{field.hint}</p>
              </div>
            );
          })}
        </div>

        {/* Summary Pollutant Mass Load Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-400">
              Tổng hợp tải lượng ô nhiễm đầu vào
            </span>
            <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>

          {(() => {
            const pollutantRows = [
              { name: 'BOD₅', c: wastewaterPollutants.bod5, load: bodLoadKgDay },
              { name: 'COD', c: wastewaterPollutants.cod, load: codLoadKgDay },
              {
                name: 'Chất rắn lơ lửng (SS)',
                c: wastewaterPollutants.ss,
                load: ssLoadKgDay,
              },
              {
                name: 'Tổng Nitơ (TN)',
                c: wastewaterPollutants.tn,
                load: tnLoadKgDay,
              },
              {
                name: 'Tổng Phốt pho (TP)',
                c: wastewaterPollutants.tp,
                load: tpLoadKgDay,
              },
            ];

            if (viewMode === 'card') {
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pollutantRows.map((row) => (
                    <div
                      key={row.name}
                      className="bg-slate-800 p-4 rounded-lg border border-slate-700 shadow-sm space-y-2.5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid"
                    >
                      <div className="pb-2 border-b border-slate-700/70">
                        <h3 className="text-sm font-semibold text-slate-100">
                          {row.name}
                        </h3>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">Nồng độ</span>
                          <span className="text-slate-100 font-medium font-mono tabular-nums">
                            {Number(row.c || 0).toLocaleString('vi-VN')} mg/L
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">Tải lượng ngày</span>
                          <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                            {row.load.toFixed(2)} kg/ngày
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">Tải lượng giờ</span>
                          <span className="text-slate-100 font-medium font-mono tabular-nums">
                            {(row.load / 24).toFixed(2)} kg/giờ
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            return (
              <div className="overflow-x-auto w-full rounded-lg border border-slate-700/80 print:overflow-visible print:border-gray-300 print:break-inside-avoid">
                <table className="w-full min-w-[540px] text-left border-collapse text-sm print:min-w-0 print:w-full print:text-gray-900">
                  <thead>
                    <tr className="bg-slate-900/90 text-xs font-medium text-slate-400 border-b border-slate-700/80 print:bg-gray-100 print:text-gray-700 print:border-gray-300">
                      <th className="py-2.5 px-4">Chỉ tiêu ô nhiễm</th>
                      <th className="py-2.5 px-4 text-right">Nồng độ (mg/L)</th>
                      <th className="py-2.5 px-4 text-right">
                        Tải lượng (kg/ngày)
                      </th>
                      <th className="py-2.5 px-4 text-right">
                        Tải lượng (kg/giờ)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {pollutantRows.map((row) => (
                      <tr key={row.name} className="hover:bg-slate-900/40">
                        <td className="py-2.5 px-4 text-slate-200 font-medium">
                          {row.name}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-300">
                          {Number(row.c || 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-400 font-semibold">
                          {row.load.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-300">
                          {(row.load / 24).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </section>
    </div>
  );
}
