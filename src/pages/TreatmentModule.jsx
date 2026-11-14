import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { NumberField, safeDiv } from '../components/CalcPrimitives';

const MODULE_CONFIG = {
  equalization: {
    title: 'Tính toán Bể điều hòa',
    subtitle:
      'Ổn định lưu lượng và nồng độ chất ô nhiễm trước khi dẫn vào cụm xử lý sinh học.',
    formulaNote: 'W = Q_tb,h × HRT · Lưu lượng khí sục chống lắng Q_khí = W × R_khí',
  },
  sedimentation: {
    title: 'Tính toán Bể lắng',
    subtitle:
      'Tách cặn lơ lửng và bùn hoạt tính dựa trên tải trọng bề mặt và thời gian lưu thủy lực.',
    formulaNote: 'F = Q_max,h / q₀ · W = F × H_lắng · t_lưu = W / Q_max,h',
  },
  aerotank: {
    title: 'Tính toán Bể sinh học Aerotank',
    subtitle:
      'Tính thể tích vùng hiếu khí theo tải trọng hữu cơ F/M và nhu cầu cấp oxy lý thuyết.',
    formulaNote: 'W = (Q_ngày × (S₀ − S)) / (F/M × X) · HRT = W / Q_tb,h',
  },
  disinfection: {
    title: 'Tính toán Bể tiếp xúc khử trùng',
    subtitle:
      'Xác định thể tích bể tiếp xúc theo lưu lượng cực đại và nhu cầu hóa chất khử trùng.',
    formulaNote: 'W = Q_max,h × (t_tiếp xúc / 60) · M_Clo = Q_ngày × D_Clo / 1000',
  },
};

export default function TreatmentModule({ moduleKey }) {
  const { globalQ, setGlobalQ, hydraulics } = useAppContext();
  const config = MODULE_CONFIG[moduleKey] || MODULE_CONFIG.equalization;

  const [params, setParams] = useState({
    eqHrt: 6,
    eqDepth: 3.5,
    airRate: 0.6,
    sedSurfaceLoad: 1.2,
    sedDepth: 3.2,
    bodIn: 250,
    bodOut: 20,
    fmRatio: 0.25,
    mlss: 3000,
    aeroDepth: 4.0,
    contactMin: 30,
    chlorineDose: 8,
    disDepth: 2.5,
  });

  const updateParam = (key) => (val) =>
    setParams((prev) => ({ ...prev, [key]: val }));

  const getCalculation = () => {
    if (moduleKey === 'equalization') {
      const volume = hydraulics.qHour * params.eqHrt;
      const area = safeDiv(volume, params.eqDepth);
      const width = Math.sqrt(area / 1.5);
      const length = width * 1.5;
      const airSupply = volume * params.airRate;

      return {
        inputs: (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberField
              id="eq-hrt"
              label="Thời gian lưu (HRT)"
              unit="giờ"
              value={params.eqHrt}
              min={1}
              max={24}
              step={0.5}
              onChange={updateParam('eqHrt')}
            />
            <NumberField
              id="eq-depth"
              label="Chiều sâu công tác (H)"
              unit="m"
              value={params.eqDepth}
              min={1.5}
              max={6}
              step={0.1}
              onChange={updateParam('eqDepth')}
            />
            <NumberField
              id="eq-air"
              label="Cường độ sục khí"
              unit="m³/m³·h"
              value={params.airRate}
              min={0.2}
              max={2}
              step={0.1}
              onChange={updateParam('airRate')}
            />
          </div>
        ),
        results: [
          {
            label: 'Thể tích bể cần thiết (W)',
            value: `${volume.toFixed(1)} m³`,
            highlight: true,
          },
          { label: 'Diện tích mặt bằng (F)', value: `${area.toFixed(1)} m²` },
          {
            label: 'Kích thước đề xuất (L × B × H)',
            value: `${length.toFixed(1)} × ${width.toFixed(1)} × ${params.eqDepth.toFixed(1)} m`,
          },
          {
            label: 'Lưu lượng khí khuấy trộn',
            value: `${airSupply.toFixed(1)} m³/giờ`,
          },
        ],
      };
    }

    if (moduleKey === 'sedimentation') {
      const area = safeDiv(hydraulics.qMaxHour, params.sedSurfaceLoad);
      const diameter = Math.sqrt((4 * area) / Math.PI);
      const volume = area * params.sedDepth;
      const hrt = safeDiv(volume, hydraulics.qMaxHour);

      return {
        inputs: (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NumberField
              id="sed-load"
              label="Tải trọng bề mặt (q₀)"
              unit="m³/m²·h"
              value={params.sedSurfaceLoad}
              min={0.4}
              max={3.0}
              step={0.1}
              onChange={updateParam('sedSurfaceLoad')}
            />
            <NumberField
              id="sed-depth"
              label="Chiều sâu vùng lắng (H)"
              unit="m"
              value={params.sedDepth}
              min={2.0}
              max={5.0}
              step={0.1}
              onChange={updateParam('sedDepth')}
            />
          </div>
        ),
        results: [
          {
            label: 'Diện tích bề mặt lắng (F)',
            value: `${area.toFixed(1)} m²`,
            highlight: true,
          },
          { label: 'Đường kính bể tròn (D)', value: `${diameter.toFixed(2)} m` },
          { label: 'Thể tích vùng lắng (W)', value: `${volume.toFixed(1)} m³` },
          { label: 'Thời gian lưu tại Qmax', value: `${hrt.toFixed(2)} giờ` },
        ],
      };
    }

    if (moduleKey === 'aerotank') {
      const deltaBod = Math.max(0, params.bodIn - params.bodOut);
      const volume = safeDiv(
        hydraulics.qDay * deltaBod,
        params.fmRatio * params.mlss
      );
      const hrt = safeDiv(volume, hydraulics.qHour);
      const area = safeDiv(volume, params.aeroDepth);
      const bodLoadKg = (hydraulics.qDay * deltaBod) / 1000;

      return {
        inputs: (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <NumberField
              id="aero-bod-in"
              label="BOD₅ đầu vào (S₀)"
              unit="mg/L"
              value={params.bodIn}
              min={20}
              max={3000}
              step={10}
              onChange={updateParam('bodIn')}
            />
            <NumberField
              id="aero-bod-out"
              label="BOD₅ đầu ra mục tiêu (S)"
              unit="mg/L"
              value={params.bodOut}
              min={5}
              max={200}
              step={5}
              onChange={updateParam('bodOut')}
            />
            <NumberField
              id="aero-fm"
              label="Tải trọng F/M"
              unit="kg/kg·ng"
              value={params.fmRatio}
              min={0.05}
              max={1.0}
              step={0.05}
              onChange={updateParam('fmRatio')}
            />
            <NumberField
              id="aero-mlss"
              label="Nồng độ bùn (MLSS)"
              unit="mg/L"
              value={params.mlss}
              min={1000}
              max={6000}
              step={100}
              onChange={updateParam('mlss')}
            />
            <NumberField
              id="aero-depth"
              label="Chiều sâu hữu ích (H)"
              unit="m"
              value={params.aeroDepth}
              min={2.5}
              max={6.5}
              step={0.1}
              onChange={updateParam('aeroDepth')}
            />
          </div>
        ),
        results: [
          {
            label: 'Thể tích bể Aerotank (W)',
            value: `${volume.toFixed(1)} m³`,
            highlight: true,
          },
          { label: 'Thời gian lưu thủy lực (HRT)', value: `${hrt.toFixed(2)} giờ` },
          { label: 'Diện tích mặt bằng (F)', value: `${area.toFixed(1)} m²` },
          {
            label: 'Tải lượng BOD₅ xử lý',
            value: `${bodLoadKg.toFixed(1)} kg/ngày`,
          },
        ],
      };
    }

    const volume = hydraulics.qMaxHour * (params.contactMin / 60);
    const area = safeDiv(volume, params.disDepth);
    const chlorineKgDay = (hydraulics.qDay * params.chlorineDose) / 1000;
    const naocl10KgDay = chlorineKgDay / 0.1;

    return {
      inputs: (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField
            id="dis-time"
            label="Thời gian tiếp xúc (t)"
            unit="phút"
            value={params.contactMin}
            min={15}
            max={90}
            step={5}
            onChange={updateParam('contactMin')}
          />
          <NumberField
            id="dis-dose"
            label="Liều lượng Clo hoạt tính"
            unit="mg/L"
            value={params.chlorineDose}
            min={1}
            max={30}
            step={0.5}
            onChange={updateParam('chlorineDose')}
          />
          <NumberField
            id="dis-depth"
            label="Chiều sâu bể (H)"
            unit="m"
            value={params.disDepth}
            min={1.5}
            max={4.5}
            step={0.1}
            onChange={updateParam('disDepth')}
          />
        </div>
      ),
      results: [
        {
          label: 'Thể tích bể tiếp xúc (W)',
          value: `${volume.toFixed(1)} m³`,
          highlight: true,
        },
        { label: 'Diện tích mặt bằng (F)', value: `${area.toFixed(1)} m²` },
        {
          label: 'Lượng Clo hoạt tính',
          value: `${chlorineKgDay.toFixed(2)} kg/ngày`,
        },
        {
          label: 'Dung dịch NaOCl 10%',
          value: `${naocl10KgDay.toFixed(1)} kg/ngày`,
        },
      ],
    };
  };

  const { inputs, results } = getCalculation();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
            {config.title}
          </h1>
          <p className="text-sm text-slate-400">{config.subtitle}</p>
        </div>

        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Về tổng quan</span>
        </Link>
      </div>

      {/* Synchronized Global Q Card */}
      <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex-1 max-w-sm">
            <label
              htmlFor="module-global-q"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Lưu lượng toàn hệ thống (globalQ)
            </label>
            <div className="relative flex items-center">
              <input
                id="module-global-q"
                type="number"
                min="0"
                step="10"
                value={globalQ === 0 ? '' : globalQ}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setGlobalQ(0);
                    return;
                  }
                  const parsed = Number(val);
                  setGlobalQ(Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
                }}
                placeholder="0"
                className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 pr-20 py-2 font-mono text-base font-semibold text-emerald-400 tabular-nums focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              />
              <span className="absolute right-3 text-xs font-mono text-slate-400 pointer-events-none">
                m³/ngày
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div>
              <div className="text-xs text-slate-400">Q trung bình giờ</div>
              <div className="font-mono font-semibold text-slate-100 tabular-nums">
                {hydraulics.qHour.toFixed(2)} m³/h
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Q cực đại giờ</div>
              <div className="font-mono font-semibold text-slate-100 tabular-nums">
                {hydraulics.qMaxHour.toFixed(2)} m³/h
              </div>
            </div>
          </div>
        </div>

        {globalQ <= 0 && (
          <div className="flex items-center gap-2.5 text-sm text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Nhập giá trị globalQ &gt; 0 để có kết quả kích thước công trình.
            </span>
          </div>
        )}
      </section>

      {/* Parameter Inputs Card */}
      <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
        <div className="text-xs font-mono text-slate-400 pb-3 border-b border-slate-700/70">
          {config.formulaNote}
        </div>
        {inputs}
      </section>

      {/* Calculation Results Strip */}
      <section aria-label="Kết quả tính toán" className="space-y-3">
        <h2 className="text-base font-semibold text-slate-100">
          Kết quả kích thước & thông số vận hành
        </h2>
        <ResultGrid items={results} />
      </section>
    </div>
  );
}

function ResultGrid({ items }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl bg-slate-800 border border-slate-700/80 p-5"
        >
          <div className="text-xs text-slate-400">{item.label}</div>
          <div
            className={`mt-2 font-mono text-xl font-semibold tabular-nums ${
              item.highlight ? 'text-emerald-400' : 'text-slate-100'
            }`}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
