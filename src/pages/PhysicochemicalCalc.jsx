import { useState } from 'react';
import {
  Droplets,
  Filter,
  FlaskConical,
  Layers,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  NumberField,
  StatusBanner,
  roundUpToStep,
} from '../components/CalcPrimitives';

const PHYSICO_TABS = [
  { id: 'coagulation', label: 'Keo tụ', icon: FlaskConical },
  { id: 'flocculation', label: 'Tạo bông', icon: Sparkles },
  { id: 'sedimentation', label: 'Lắng hóa lý', icon: Layers },
  { id: 'pressure_filter', label: 'Lọc áp lực', icon: Filter },
];

const TANK_SHAPES = [
  { value: 'Vuông', label: 'Vuông (a × a × H)' },
  { value: 'Tròn', label: 'Tròn (Ø D × H)' },
  { value: 'Chữ nhật', label: 'Chữ nhật (L × W × H)' },
];

const MARKET_DIAMETERS_M = [
  0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.5,
];

const STANDARD_MOTORS_KW = [
  0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3.0, 4.0, 5.5, 7.5, 11.0, 15.0, 18.5, 22.0,
];

const pickStandardMotorKw = (requiredKw) => {
  const found = STANDARD_MOTORS_KW.find((kw) => kw >= requiredKw);
  return found ?? roundUpToStep(requiredKw, 5);
};

// Độ nhớt động lực học của nước μ (Pa.s = N.s/m2) theo nhiệt độ T (°C)
function getDynamicViscosity(tempC) {
  const T = Math.max(5, Math.min(45, Number(tempC) || 20));
  return 0.00179 / (1 + 0.03368 * T + 0.000221 * T * T);
}

function interpolateTank(volume, depth, shape, ratioLW = 1.5) {
  const safeV = Math.max(0, Number(volume) || 0);
  const safeH = Math.max(0.5, Number(depth) || 1);
  const area = safeV / safeH;

  if (shape === 'Vuông') {
    const a = Math.sqrt(area);
    return { area, H: safeH, a, L: a, W: a, D: 0 };
  }
  if (shape === 'Tròn') {
    const D = Math.sqrt((4 * area) / Math.PI);
    return { area, H: safeH, D, a: 0, L: 0, W: 0 };
  }
  const ratio = Math.max(1, Number(ratioLW) || 1.5);
  const W = Math.sqrt(area / ratio);
  const L = W * ratio;
  return { area, H: safeH, L, W, a: 0, D: 0 };
}

function buildRecommendedOverride(theo, shape, motorKwTheo) {
  const H = roundUpToStep(theo.H, 0.1);
  const motorKw = pickStandardMotorKw(motorKwTheo);
  if (shape === 'Vuông') {
    return { a: roundUpToStep(theo.a, 0.1), L: 0, W: 0, D: 0, H, motorKw };
  }
  if (shape === 'Tròn') {
    return { D: roundUpToStep(theo.D, 0.1), a: 0, L: 0, W: 0, H, motorKw };
  }
  return {
    L: roundUpToStep(theo.L, 0.1),
    W: roundUpToStep(theo.W, 0.1),
    a: 0,
    D: 0,
    H,
    motorKw,
  };
}

function computeActualTank(override, shape) {
  const H = Math.max(0, Number(override.H) || 0);
  if (shape === 'Vuông') {
    const a = Math.max(0, Number(override.a) || 0);
    const area = a * a;
    return { area, volume: area * H, H, a };
  }
  if (shape === 'Tròn') {
    const D = Math.max(0, Number(override.D) || 0);
    const area = (Math.PI * D * D) / 4;
    return { area, volume: area * H, H, D };
  }
  const L = Math.max(0, Number(override.L) || 0);
  const W = Math.max(0, Number(override.W) || 0);
  const area = L * W;
  return { area, volume: area * H, H, L, W };
}

export default function PhysicochemicalCalc() {
  const { globalQ, setGlobalQ, hydraulics } = useAppContext();
  const [activeTab, setActiveTab] = useState('coagulation');

  // --- Shared Water Temperature & Efficiency ---
  const [waterTemp, setWaterTemp] = useState(25);
  const mu = getDynamicViscosity(waterTemp);

  // --- Tab 1: Keo tụ ---
  const [coag, setCoag] = useState({
    shape: 'Vuông',
    retentionSec: 45,
    gTarget: 750, // s^-1 (chuẩn 500 - 1000)
    motorEffPct: 75,
    depthH: 1.5,
    ratioLW: 1.2,
  });

  // --- Tab 2: Tạo bông ---
  const [floc, setFloc] = useState({
    shape: 'Chữ nhật',
    retentionMin: 25,
    gTarget: 45, // s^-1 (chuẩn 20 - 80)
    motorEffPct: 75,
    depthH: 3.0,
    ratioLW: 1.5,
  });

  // --- Tab 3: Lắng hóa lý ---
  const [sed, setSed] = useState({
    shape: 'Tròn',
    surfaceLoadTarget: 1.2, // m3/m2.h (max chuẩn 1.8)
    surfaceLoadMax: 1.8,
    hrtMin: 2.0, // giờ
    gTarget: 15, // s^-1 (vùng phân phối/gạt bùn tâm không vỡ bông)
    motorEffPct: 75,
    depthH: 3.5,
    ratioLW: 2.0,
  });

  // Override state for first 3 tanks
  const [tankOverrides, setTankOverrides] = useState({
    coagulation: null,
    flocculation: null,
    sedimentation: null,
  });

  // --- Tab 4: Lọc áp lực ---
  const [filter, setFilter] = useState({
    numTanks: 2,
    shape: 'Tròn', // Mặc định bồn Tròn
    filtrationRateTarget: 8.0, // m/h (chuẩn 5 - 12)
    filtrationRateMax: 12.0,
    backwashWaterRate: 12.0, // L/s.m2
    backwashAirRate: 15.0, // L/s.m2
    gravelHeight: 0.3, // Sỏi đỡ (1600 kg/m3)
    sandHeight: 0.7, // Cát thạch anh (1500 kg/m3)
    carbonHeight: 0.5, // Than hoạt tính (500 kg/m3)
    manganeseHeight: 0.0, // Quặng Mangan (1800 kg/m3) - tùy chọn thêm
  });
  const [filterDiameterOverrideM, setFilterDiameterOverrideM] = useState(null);

  const qMaxM3s = hydraulics.qMaxHour / 3600;

  // --- Helper for Mixing / Settling Tank Model ---
  const getMixTankModel = (tabId) => {
    if (tabId === 'coagulation') {
      const vTheo = qMaxM3s * coag.retentionSec;
      const theo = interpolateTank(vTheo, coag.depthH, coag.shape, coag.ratioLW);
      const eff = Math.max(0.1, coag.motorEffPct / 100);
      const motorKwTheo =
        (Math.pow(coag.gTarget, 2) * mu * vTheo) / (1000 * eff);

      return {
        tabId: 'coagulation',
        title: 'Bể Keo tụ (Khuấy nhanh)',
        subtitle:
          'Phân tán phèn / chất keo tụ tức thời ở Gradient vận tốc cao (G = 500–1.000 s⁻¹)',
        formulaText: `V_lt = Qmax,s × t = ${qMaxM3s.toFixed(4)} × ${coag.retentionSec}s = ${vTheo.toFixed(2)} m³ · P_đc = G²·μ·V / (1000·η)`,
        params: coag,
        setParams: setCoag,
        vTheo,
        theo,
        motorKwTheo,
        gMin: 500,
        gMax: 1000,
        checkExtra: (actual) => ({
          metricLabel: 'Thời gian lưu thực (t_thực)',
          metricTheo: `${coag.retentionSec} giây`,
          metricActual: `${qMaxM3s > 0 ? (actual.volume / qMaxM3s).toFixed(1) : '0.0'} giây`,
          extraOk: qMaxM3s > 0 ? actual.volume / qMaxM3s >= 20 : false,
          extraStatus:
            qMaxM3s > 0 && actual.volume / qMaxM3s >= 20
              ? 'Đạt (≥ 20 giây)'
              : 'Quá ngắn (< 20s)',
        }),
      };
    }

    if (tabId === 'flocculation') {
      const vTheo = hydraulics.qMaxHour * (floc.retentionMin / 60);
      const theo = interpolateTank(vTheo, floc.depthH, floc.shape, floc.ratioLW);
      const eff = Math.max(0.1, floc.motorEffPct / 100);
      const motorKwTheo =
        (Math.pow(floc.gTarget, 2) * mu * vTheo) / (1000 * eff);

      return {
        tabId: 'flocculation',
        title: 'Bể Tạo bông (Khuấy chậm)',
        subtitle:
          'Kết tụ hạt keo thành bông cặn lớn có khả năng lắng ở G = 20–80 s⁻¹',
        formulaText: `V_lt = Qmax,h × (t/60) = ${hydraulics.qMaxHour.toFixed(2)} × (${floc.retentionMin}/60) = ${vTheo.toFixed(2)} m³`,
        params: floc,
        setParams: setFloc,
        vTheo,
        theo,
        motorKwTheo,
        gMin: 20,
        gMax: 80,
        checkExtra: (actual) => {
          const tAct =
            hydraulics.qMaxHour > 0
              ? (actual.volume / hydraulics.qMaxHour) * 60
              : 0;
          return {
            metricLabel: 'Thời gian lưu thực (t_thực)',
            metricTheo: `${floc.retentionMin} phút`,
            metricActual: `${tAct.toFixed(1)} phút`,
            extraOk: tAct >= 15,
            extraStatus: tAct >= 15 ? 'Đạt (≥ 15 phút)' : 'Quá ngắn (< 15 phút)',
          };
        },
      };
    }

    // sedimentation
    const areaFromLoad =
      sed.surfaceLoadTarget > 0
        ? hydraulics.qMaxHour / sed.surfaceLoadTarget
        : 0;
    const volFromHrt = hydraulics.qMaxHour * sed.hrtMin;
    const vTheo = Math.max(areaFromLoad * sed.depthH, volFromHrt);
    const theo = interpolateTank(vTheo, sed.depthH, sed.shape, sed.ratioLW);
    const eff = Math.max(0.1, sed.motorEffPct / 100);
    // Công suất khuấy vùng trung tâm / gạt bùn tính theo G tại vùng khuấy tâm (lấy ~15% V vùng tâm hoặc tổng thể tích với G thấp)
    const motorKwTheo =
      (Math.pow(sed.gTarget, 2) * mu * vTheo) / (1000 * eff);

    return {
      tabId: 'sedimentation',
      title: 'Bể Lắng hóa lý',
      subtitle:
        'Tách bông cặn hóa lý theo tải trọng bề mặt q₀ và giữ G thấp tránh vỡ bông',
      formulaText: `F_lt = Qmax,h / q₀ = ${areaFromLoad.toFixed(2)} m² · V_lt = ${vTheo.toFixed(2)} m³`,
      params: sed,
      setParams: setSed,
      vTheo,
      theo,
      motorKwTheo,
      gMin: 5,
      gMax: 25,
      checkExtra: (actual) => {
        const q0Actual =
          actual.area > 0 ? hydraulics.qMaxHour / actual.area : 0;
        return {
          metricLabel: 'Tải trọng bề mặt thực (q₀)',
          metricTheo: `≤ ${sed.surfaceLoadMax.toFixed(2)} m³/m²·h`,
          metricActual: `${q0Actual.toFixed(2)} m³/m²·h`,
          extraOk: hydraulics.qDay > 0 && q0Actual <= sed.surfaceLoadMax,
          extraStatus:
            hydraulics.qDay > 0 && q0Actual <= sed.surfaceLoadMax
              ? 'Đạt tải trọng'
              : 'Vượt tải trọng bề mặt',
        };
      },
    };
  };

  // --- Pressure Filter Calculations ---
  const nFilterTanks = Math.max(1, Number(filter.numTanks) || 1);
  const qPerFilterHour = hydraulics.qMaxHour / nFilterTanks;
  const filterAreaTheo =
    filter.filtrationRateTarget > 0
      ? qPerFilterHour / filter.filtrationRateTarget
      : 0;
  const filterDiaTheo = Math.sqrt((4 * filterAreaTheo) / Math.PI);
  const recommendedMarketDia =
    MARKET_DIAMETERS_M.find((d) => d >= filterDiaTheo) ??
    roundUpToStep(filterDiaTheo, 0.2);

  const activeFilterDia =
    filterDiameterOverrideM !== null
      ? Math.max(0, Number(filterDiameterOverrideM) || 0)
      : recommendedMarketDia;
  const filterAreaActual = (Math.PI * activeFilterDia * activeFilterDia) / 4;
  const filterVelActual =
    filterAreaActual > 0 ? qPerFilterHour / filterAreaActual : 0;

  const isFilterVelOk =
    hydraulics.qDay > 0 &&
    filterVelActual > 0 &&
    filterVelActual <= filter.filtrationRateMax;
  const isFilterDiaOk =
    hydraulics.qDay > 0 && activeFilterDia >= filterDiaTheo;

  const backwashPumpLs = filterAreaActual * filter.backwashWaterRate;
  const backwashPumpM3h = backwashPumpLs * 3.6;
  const backwashAirLs = filterAreaActual * filter.backwashAirRate;
  const backwashAirM3min = backwashAirLs * 0.06;

  // Media Layer Breakdown (1 tank & Total N tanks)
  const mediaLayers = [
    {
      name: 'Sỏi đỡ (Đá lọc phân phối)',
      heightM: Math.max(0, Number(filter.gravelHeight) || 0),
      densityKgM3: 1600,
    },
    {
      name: 'Cát thạch anh lọc tinh',
      heightM: Math.max(0, Number(filter.sandHeight) || 0),
      densityKgM3: 1500,
    },
    {
      name: 'Than hoạt tính hấp phụ',
      heightM: Math.max(0, Number(filter.carbonHeight) || 0),
      densityKgM3: 500,
    },
    {
      name: 'Quặng Mangan (khử Fe/Mn)',
      heightM: Math.max(0, Number(filter.manganeseHeight) || 0),
      densityKgM3: 1800,
    },
  ].map((layer) => {
    const volOneTank = filterAreaActual * layer.heightM;
    const massOneTank = volOneTank * layer.densityKgM3;
    return {
      ...layer,
      volOneTank,
      massOneTank,
      volTotal: volOneTank * nFilterTanks,
      massTotal: massOneTank * nFilterTanks,
    };
  });

  const totalMediaHeight = mediaLayers.reduce((s, l) => s + l.heightM, 0);
  const totalMediaVolOne = mediaLayers.reduce((s, l) => s + l.volOneTank, 0);
  const totalMediaMassOne = mediaLayers.reduce((s, l) => s + l.massOneTank, 0);
  const totalMediaMassAll = mediaLayers.reduce((s, l) => s + l.massTotal, 0);

  const renderMixOrSedTab = (tabId) => {
    const m = getMixTankModel(tabId);
    const { params, setParams, vTheo, theo, motorKwTheo } = m;
    const activeOv =
      tankOverrides[tabId] ??
      buildRecommendedOverride(theo, params.shape, motorKwTheo);
    const actual = computeActualTank(activeOv, params.shape);

    const eff = Math.max(0.1, params.motorEffPct / 100);
    const motorKwActual = Math.max(0, Number(activeOv.motorKw) || 0);
    const gActual =
      actual.volume > 0
        ? Math.sqrt((motorKwActual * 1000 * eff) / (mu * actual.volume))
        : 0;

    const isVolOk = hydraulics.qDay > 0 && vTheo > 0 && actual.volume >= vTheo;
    const isGOk = gActual >= m.gMin && gActual <= m.gMax;
    const extra = m.checkExtra(actual);
    const isAllOk = isVolOk && isGOk && extra.extraOk;

    const handleShapeChange = (nextShape) => {
      setParams((p) => ({ ...p, shape: nextShape }));
      const nextTheo = interpolateTank(
        vTheo,
        params.depthH,
        nextShape,
        params.ratioLW
      );
      setTankOverrides((prev) => ({
        ...prev,
        [tabId]: buildRecommendedOverride(nextTheo, nextShape, motorKwTheo),
      }));
    };

    const handleSnap = () => {
      setTankOverrides((prev) => ({
        ...prev,
        [tabId]: buildRecommendedOverride(theo, params.shape, motorKwTheo),
      }));
    };

    const updateOv = (field, val) => {
      setTankOverrides((prev) => ({
        ...prev,
        [tabId]: {
          ...activeOv,
          [field]: val,
        },
      }));
    };

    return (
      <div className="space-y-6">
        {/* 1. Theoretical Parameters & Shape */}
        <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                1. {m.title} — Thông số thiết kế & Hình dạng
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{m.subtitle}</p>
            </div>
            <span className="font-mono text-xs text-emerald-400 tabular-nums">
              V_lt = {vTheo.toFixed(2)} m³ · N_lt = {motorKwTheo.toFixed(2)} kW
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor={`${tabId}-shape`}
                className="block text-sm font-medium text-slate-200 mb-2"
              >
                Hình dạng công trình
              </label>
              <select
                id={`${tabId}-shape`}
                value={params.shape}
                onChange={(e) => handleShapeChange(e.target.value)}
                className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              >
                {TANK_SHAPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {tabId === 'coagulation' && (
              <NumberField
                id="coag-ret"
                label="Thời gian khuấy nhanh (t)"
                unit="giây"
                value={coag.retentionSec}
                min={10}
                max={180}
                step={5}
                onChange={(v) => setCoag((p) => ({ ...p, retentionSec: v }))}
              />
            )}

            {tabId === 'flocculation' && (
              <NumberField
                id="floc-ret"
                label="Thời gian tạo bông (t)"
                unit="phút"
                value={floc.retentionMin}
                min={10}
                max={60}
                step={1}
                onChange={(v) => setFloc((p) => ({ ...p, retentionMin: v }))}
              />
            )}

            {tabId === 'sedimentation' && (
              <>
                <NumberField
                  id="sed-q0"
                  label="Tải trọng bề mặt thiết kế (q₀)"
                  unit="m³/m²·h"
                  value={sed.surfaceLoadTarget}
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  onChange={(v) =>
                    setSed((p) => ({ ...p, surfaceLoadTarget: v }))
                  }
                />
                <NumberField
                  id="sed-hrt"
                  label="Thời gian lưu tối thiểu (HRT)"
                  unit="giờ"
                  value={sed.hrtMin}
                  min={1}
                  max={5}
                  step={0.5}
                  onChange={(v) => setSed((p) => ({ ...p, hrtMin: v }))}
                />
              </>
            )}

            <NumberField
              id={`${tabId}-g`}
              label="Gradient vận tốc thiết kế (G)"
              unit="s⁻¹"
              value={params.gTarget}
              min={5}
              max={1200}
              step={tabId === 'coagulation' ? 25 : 5}
              onChange={(v) => setParams((p) => ({ ...p, gTarget: v }))}
            />

            <NumberField
              id={`${tabId}-temp`}
              label="Nhiệt độ nước thải (μ)"
              unit="°C"
              value={waterTemp}
              min={5}
              max={45}
              step={1}
              onChange={setWaterTemp}
            />

            <NumberField
              id={`${tabId}-eff`}
              label="Hiệu suất truyền động (η)"
              unit="%"
              value={params.motorEffPct}
              min={50}
              max={95}
              step={5}
              onChange={(v) => setParams((p) => ({ ...p, motorEffPct: v }))}
            />

            <NumberField
              id={`${tabId}-h`}
              label="Chiều sâu công tác lý thuyết (H)"
              unit="m"
              value={params.depthH}
              min={0.8}
              max={6.5}
              step={0.1}
              onChange={(v) => setParams((p) => ({ ...p, depthH: v }))}
            />

            {params.shape === 'Chữ nhật' && (
              <NumberField
                id={`${tabId}-ratio`}
                label="Tỷ lệ Dài / Rộng (L/W)"
                unit="L/W"
                value={params.ratioLW}
                min={1}
                max={5}
                step={0.1}
                onChange={(v) => setParams((p) => ({ ...p, ratioLW: v }))}
              />
            )}
          </div>

          <div className="pt-3 border-t border-slate-700/70 text-xs font-mono text-slate-400">
            {m.formulaText} · μ({waterTemp}°C) = {(mu * 1000).toFixed(3)} mPa·s
          </div>
        </section>

        {/* 2. Theoretical Dimensions & Motor Power */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
            <div className="text-xs text-slate-400">
              Kích thước nội suy lý thuyết ({params.shape})
            </div>
            {params.shape === 'Chữ nhật' && (
              <div className="mt-2 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
                {theo.L.toFixed(2)} × {theo.W.toFixed(2)} × {theo.H.toFixed(2)} m
              </div>
            )}
            {params.shape === 'Vuông' && (
              <div className="mt-2 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
                {theo.a.toFixed(2)} × {theo.a.toFixed(2)} × {theo.H.toFixed(2)} m
              </div>
            )}
            {params.shape === 'Tròn' && (
              <div className="mt-2 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
                Ø {theo.D.toFixed(2)} × {theo.H.toFixed(2)} m
              </div>
            )}
            <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
              V_lt = {vTheo.toFixed(2)} m³ · F_lt = {theo.area.toFixed(2)} m²
            </div>
          </div>

          <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
            <div className="text-xs text-slate-400">
              Công suất động cơ khuấy lý thuyết
            </div>
            <div className="mt-2 font-mono text-xl font-semibold text-slate-100 tabular-nums">
              {motorKwTheo.toFixed(2)} kW
            </div>
            <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
              Motor chuẩn gợi ý: {pickStandardMotorKw(motorKwTheo)} kW (η ={' '}
              {params.motorEffPct}%)
            </div>
          </div>

          <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
            <div className="text-xs text-slate-400">
              Gradient vận tốc thực tế (G_thực)
            </div>
            <div
              className={`mt-2 font-mono text-xl font-semibold tabular-nums ${
                isGOk ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {gActual.toFixed(0)} s⁻¹
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Dải chuẩn cho phép: {m.gMin} – {m.gMax} s⁻¹
            </div>
          </div>
        </section>

        {/* 3. Override & Reverse Verification */}
        <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                2. Kích thước chọn thi công & Kiểm tra ngược (V_thực · G thực)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Nhập đè kích thước chọn ({params.shape}) và công suất motor lắp
                đặt để kiểm tra ngược G thực tế.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSnap}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
              <span>Làm tròn theo lý thuyết</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {params.shape === 'Chữ nhật' && (
              <>
                <NumberField
                  id={`${tabId}-ov-L`}
                  label="Chiều dài chọn (L)"
                  unit="m"
                  value={activeOv.L}
                  min={0}
                  max={50}
                  step={0.1}
                  onChange={(v) => updateOv('L', v)}
                />
                <NumberField
                  id={`${tabId}-ov-W`}
                  label="Chiều rộng chọn (W)"
                  unit="m"
                  value={activeOv.W}
                  min={0}
                  max={50}
                  step={0.1}
                  onChange={(v) => updateOv('W', v)}
                />
              </>
            )}

            {params.shape === 'Vuông' && (
              <NumberField
                id={`${tabId}-ov-a`}
                label="Cạnh bể chọn (a)"
                unit="m"
                value={activeOv.a}
                min={0}
                max={50}
                step={0.1}
                onChange={(v) => updateOv('a', v)}
              />
            )}

            {params.shape === 'Tròn' && (
              <NumberField
                id={`${tabId}-ov-D`}
                label="Đường kính chọn (D)"
                unit="m"
                value={activeOv.D}
                min={0}
                max={50}
                step={0.1}
                onChange={(v) => updateOv('D', v)}
              />
            )}

            <NumberField
              id={`${tabId}-ov-H`}
              label="Chiều sâu công tác chọn (H)"
              unit="m"
              value={activeOv.H}
              min={0}
              max={15}
              step={0.1}
              onChange={(v) => updateOv('H', v)}
            />

            <NumberField
              id={`${tabId}-ov-kw`}
              label="Công suất motor chọn"
              unit="kW"
              value={activeOv.motorKw}
              min={0}
              max={100}
              step={0.1}
              onChange={(v) => updateOv('motorKw', v)}
            />
          </div>

          <StatusBanner
            ok={isAllOk}
            titleOk="ĐẠT CHUẨN HÌNH HỌC & GRADIENT VẬN TỐC (G)"
            titleFail="CẢNH BÁO ĐỎ: RỚT CHUẨN THIẾT KẾ"
            summaryLabel="V_thực · G thực"
            message={`${
              !isVolOk
                ? `V_thực (${actual.volume.toFixed(2)} m³) < V_lý thuyết (${vTheo.toFixed(2)} m³). `
                : `V_thực = ${actual.volume.toFixed(2)} m³ đạt yêu cầu. `
            }${
              !isGOk
                ? `G thực tế (${gActual.toFixed(0)} s⁻¹) nằm ngoài ngưỡng chuẩn ${m.gMin}–${m.gMax} s⁻¹. `
                : `G thực tế = ${gActual.toFixed(0)} s⁻¹ đạt chuẩn. `
            }${!extra.extraOk ? `${extra.metricLabel}: ${extra.extraStatus}.` : ''}`}
            summaryRight={`${actual.volume.toFixed(2)} m³ · ${gActual.toFixed(0)} s⁻¹`}
          />

          <div className="overflow-x-auto w-full rounded-lg border border-slate-700/80">
            <table className="w-full min-w-[600px] text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900/90 text-xs font-medium text-slate-400 border-b border-slate-700/80">
                  <th className="py-3 px-4">Thông số kiểm tra ngược</th>
                  <th className="py-3 px-4 text-right">Chuẩn / Lý thuyết</th>
                  <th className="py-3 px-4 text-right">Thực tế chọn</th>
                  <th className="py-3 px-4 text-right">Đánh giá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                <tr className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 text-slate-200">Thể tích bể (V)</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                    ≥ {vTheo.toFixed(2)} m³
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono font-semibold tabular-nums ${
                      isVolOk ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {actual.volume.toFixed(2)} m³
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-medium ${
                      isVolOk ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {isVolOk ? 'Đạt chuẩn' : 'Thiếu thể tích'}
                  </td>
                </tr>

                <tr className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 text-slate-200">
                    Gradient vận tốc (G)
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                    {m.gMin} – {m.gMax} s⁻¹
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono font-semibold tabular-nums ${
                      isGOk ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {gActual.toFixed(0)} s⁻¹
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-medium ${
                      isGOk ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {isGOk
                      ? 'Đạt chuẩn'
                      : gActual < m.gMin
                      ? 'G quá yếu'
                      : 'G quá lớn'}
                  </td>
                </tr>

                <tr className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 text-slate-200">
                    {extra.metricLabel}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                    {extra.metricTheo}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono font-semibold tabular-nums ${
                      extra.extraOk ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {extra.metricActual}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-medium ${
                      extra.extraOk ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {extra.extraStatus}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Global Flow */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 text-balance">
            Cụm Xử Lý Hóa Lý & Lọc Áp Lực
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Tính toán khuấy trộn keo tụ/tạo bông theo Gradient vận tốc G, lắng
            hóa lý và bóc tách vật liệu lọc cho bồn lọc áp lực.
          </p>
        </div>

        <div className="w-full lg:w-80 rounded-xl bg-slate-800 border border-slate-700/80 p-3.5">
          <label
            htmlFor="physico-global-q"
            className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5"
          >
            <span>Lưu lượng chung (globalQ)</span>
            <span className="font-mono tabular-nums text-slate-300">
              Qmax = {hydraulics.qMaxHour.toFixed(1)} m³/h
            </span>
          </label>
          <div className="relative flex items-center">
            <input
              id="physico-global-q"
              type="number"
              min="0"
              step="10"
              value={globalQ === 0 ? '' : globalQ}
              onChange={(e) =>
                setGlobalQ(
                  e.target.value === ''
                    ? 0
                    : Math.max(0, Number(e.target.value) || 0)
                )
              }
              className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 pr-20 py-2 font-mono text-base font-semibold text-emerald-400 tabular-nums focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
            />
            <span className="absolute right-3 text-xs font-mono text-slate-400 pointer-events-none">
              m³/ngày
            </span>
          </div>
        </div>
      </section>

      {/* 4 Tabs */}
      <div
        role="tablist"
        aria-label="Các công trình hóa lý"
        className="flex items-center gap-2 overflow-x-auto pb-1"
      >
        {PHYSICO_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'bg-slate-800 text-slate-300 border border-slate-700/80 hover:bg-slate-700 hover:text-slate-100'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      {activeTab !== 'pressure_filter' ? (
        renderMixOrSedTab(activeTab)
      ) : (
        <div className="space-y-6">
          {/* 1. Pressure Filter Design & Media Heights */}
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Bồn Lọc Áp Lực Đa Tầng (Mặc định bồn Tròn)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lưu lượng qua mỗi bồn: {qPerFilterHour.toFixed(2)} m³/h (tổng{' '}
                  {nFilterTanks} bồn song song)
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                D_lt = {filterDiaTheo.toFixed(2)} m (Ø
                {Math.round(filterDiaTheo * 1000)} mm)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="pf-shape"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Hình dạng bồn lọc áp lực
                </label>
                <select
                  id="pf-shape"
                  value={filter.shape}
                  onChange={(e) =>
                    setFilter((p) => ({ ...p, shape: e.target.value }))
                  }
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="Tròn">Bồn trụ Tròn (Mặc định)</option>
                </select>
              </div>

              <NumberField
                id="pf-num"
                label="Số lượng bồn lọc song song"
                unit="bồn"
                value={filter.numTanks}
                min={1}
                max={12}
                step={1}
                onChange={(v) =>
                  setFilter((p) => ({
                    ...p,
                    numTanks: Math.max(1, Math.round(v)),
                  }))
                }
              />

              <NumberField
                id="pf-vel"
                label="Tốc độ lọc thiết kế (v_lọc)"
                unit="m/h"
                value={filter.filtrationRateTarget}
                min={4}
                max={15}
                step={0.5}
                onChange={(v) =>
                  setFilter((p) => ({ ...p, filtrationRateTarget: v }))
                }
              />

              <NumberField
                id="pf-vel-max"
                label="Giới hạn tốc độ lọc tối đa"
                unit="m/h"
                value={filter.filtrationRateMax}
                min={6}
                max={18}
                step={0.5}
                onChange={(v) =>
                  setFilter((p) => ({ ...p, filtrationRateMax: v }))
                }
              />

              <NumberField
                id="pf-bw-water"
                label="Cường độ nước rửa lọc"
                unit="L/s·m²"
                value={filter.backwashWaterRate}
                min={6}
                max={20}
                step={0.5}
                onChange={(v) =>
                  setFilter((p) => ({ ...p, backwashWaterRate: v }))
                }
              />

              <NumberField
                id="pf-bw-air"
                label="Cường độ gió sục rửa lọc"
                unit="L/s·m²"
                value={filter.backwashAirRate}
                min={8}
                max={25}
                step={0.5}
                onChange={(v) =>
                  setFilter((p) => ({ ...p, backwashAirRate: v }))
                }
              />
            </div>

            {/* Mandatory Media Layer Heights */}
            <div className="pt-4 border-t border-slate-700/70 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-100">
                  Chiều cao từng lớp vật liệu lọc (m)
                </h3>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  Tổng chiều cao lớp lọc = {totalMediaHeight.toFixed(2)} m ·
                  Chiều cao thân bồn dự kiến ≈{' '}
                  {(totalMediaHeight + 1.0).toFixed(2)} m
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <NumberField
                  id="pf-h-gravel"
                  label="Sỏi đỡ (1.600 kg/m³)"
                  unit="m"
                  value={filter.gravelHeight}
                  min={0}
                  max={1.5}
                  step={0.05}
                  onChange={(v) => setFilter((p) => ({ ...p, gravelHeight: v }))}
                />
                <NumberField
                  id="pf-h-sand"
                  label="Cát thạch anh (1.500 kg/m³)"
                  unit="m"
                  value={filter.sandHeight}
                  min={0}
                  max={2.0}
                  step={0.05}
                  onChange={(v) => setFilter((p) => ({ ...p, sandHeight: v }))}
                />
                <NumberField
                  id="pf-h-carbon"
                  label="Than hoạt tính (500 kg/m³)"
                  unit="m"
                  value={filter.carbonHeight}
                  min={0}
                  max={2.0}
                  step={0.05}
                  onChange={(v) => setFilter((p) => ({ ...p, carbonHeight: v }))}
                />
                <NumberField
                  id="pf-h-mn"
                  label="Quặng Mangan (1.800 kg/m³)"
                  unit="m"
                  value={filter.manganeseHeight}
                  min={0}
                  max={1.5}
                  step={0.05}
                  onChange={(v) =>
                    setFilter((p) => ({ ...p, manganeseHeight: v }))
                  }
                />
              </div>
            </div>
          </section>

          {/* 2. Market Diameter Override & Pump/Blower Sizing */}
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Chọn Đường kính bồn thị trường & Kiểm tra ngược
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Đường kính lý thuyết: {filterDiaTheo.toFixed(2)} m (F_lt ={' '}
                  {filterAreaTheo.toFixed(2)} m²). Chốt đường kính bồn có sẵn để
                  tính ngược tốc độ lọc, vật liệu và bơm/quạt rửa lọc.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFilterDiameterOverrideM(recommendedMarketDia)}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Chọn Ø chuẩn ({recommendedMarketDia} m)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="pf-market-preset"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Chọn nhanh đường kính bồn tiêu chuẩn
                </label>
                <select
                  id="pf-market-preset"
                  value={
                    MARKET_DIAMETERS_M.includes(activeFilterDia)
                      ? activeFilterDia
                      : ''
                  }
                  onChange={(e) => {
                    if (e.target.value !== '') {
                      setFilterDiameterOverrideM(Number(e.target.value));
                    }
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="">-- Tùy chỉnh nhập tay --</option>
                  {MARKET_DIAMETERS_M.map((d) => (
                    <option key={d} value={d}>
                      Bồn Ø {Math.round(d * 1000)} mm ({d.toFixed(1)} m)
                    </option>
                  ))}
                </select>
              </div>

              <NumberField
                id="pf-ov-dia"
                label="Đường kính bồn chọn thực tế (D_chọn)"
                unit="m"
                value={activeFilterDia}
                min={0.2}
                max={6.0}
                step={0.1}
                onChange={(v) => setFilterDiameterOverrideM(v)}
              />
            </div>

            <StatusBanner
              ok={isFilterVelOk && isFilterDiaOk}
              titleOk="ĐẠT CHUẨN TỐC ĐỘ LỌC & ĐƯỜNG KÍNH BỒN"
              titleFail="CẢNH BÁO ĐỎ: RỚT CHUẨN LỌC ÁP LỰC"
              summaryLabel="Tốc độ lọc thực tế"
              message={
                isFilterVelOk && isFilterDiaOk
                  ? `Bồn Ø ${activeFilterDia.toFixed(2)} m (F_thực = ${filterAreaActual.toFixed(2)} m²) cho tốc độ lọc thực tế ${filterVelActual.toFixed(2)} m/h ≤ ${filter.filtrationRateMax} m/h.`
                  : `${!isFilterDiaOk ? `Đường kính chọn (${activeFilterDia.toFixed(2)} m) nhỏ hơn đường kính lý thuyết (${filterDiaTheo.toFixed(2)} m). ` : ''}${!isFilterVelOk ? `Tốc độ lọc thực tế (${filterVelActual.toFixed(2)} m/h) vượt giới hạn tối đa (${filter.filtrationRateMax} m/h).` : ''}`
              }
              summaryRight={`${filterVelActual.toFixed(2)} m/h`}
            />

            {/* Pump & Blower Sizing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="rounded-xl bg-slate-900 border border-slate-700/80 p-4">
                <div className="text-xs text-slate-400">
                  Lưu lượng Bơm rửa lọc (1 bồn)
                </div>
                <div className="mt-1.5 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
                  {backwashPumpM3h.toFixed(1)} m³/giờ
                </div>
                <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                  {backwashPumpLs.toFixed(1)} L/s ({filter.backwashWaterRate}{' '}
                  L/s·m² × {filterAreaActual.toFixed(2)} m²)
                </div>
              </div>

              <div className="rounded-xl bg-slate-900 border border-slate-700/80 p-4">
                <div className="text-xs text-slate-400">
                  Lưu lượng Quạt gió rửa lọc (1 bồn)
                </div>
                <div className="mt-1.5 font-mono text-xl font-semibold text-slate-100 tabular-nums">
                  {backwashAirM3min.toFixed(2)} m³/phút
                </div>
                <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                  {backwashAirLs.toFixed(1)} L/s ({filter.backwashAirRate}{' '}
                  L/s·m² × {filterAreaActual.toFixed(2)} m²)
                </div>
              </div>

              <div className="rounded-xl bg-slate-900 border border-slate-700/80 p-4">
                <div className="text-xs text-slate-400">
                  Tổng khối lượng vật liệu lọc ({nFilterTanks} bồn)
                </div>
                <div className="mt-1.5 font-mono text-xl font-semibold text-slate-100 tabular-nums">
                  {totalMediaMassAll.toLocaleString('vi-VN', {
                    maximumFractionDigits: 0,
                  })}{' '}
                  kg
                </div>
                <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                  1 bồn: {totalMediaVolOne.toFixed(2)} m³ ·{' '}
                  {totalMediaMassOne.toLocaleString('vi-VN', {
                    maximumFractionDigits: 0,
                  })}{' '}
                  kg
                </div>
              </div>
            </div>

            {/* 3. Bảng Bóc Tách Vật Liệu Lọc (overflow-x-auto) */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Droplets className="h-4 w-4 text-emerald-500" />
                <span>
                  Bảng bóc tách khối lượng vật liệu lọc thực tế (theo bồn Ø{' '}
                  {activeFilterDia.toFixed(2)} m)
                </span>
              </div>

              <div className="overflow-x-auto w-full rounded-lg border border-slate-700/80">
                <table className="w-full min-w-[680px] text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-900/90 text-xs font-medium text-slate-400 border-b border-slate-700/80">
                      <th className="py-3 px-4">Lớp vật liệu lọc</th>
                      <th className="py-3 px-4 text-right">Chiều cao (m)</th>
                      <th className="py-3 px-4 text-right">Tỷ trọng (kg/m³)</th>
                      <th className="py-3 px-4 text-right">Thể tích / 1 bồn</th>
                      <th className="py-3 px-4 text-right">Khối lượng / 1 bồn</th>
                      <th className="py-3 px-4 text-right">
                        Tổng ({nFilterTanks} bồn)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {mediaLayers.map((layer) => (
                      <tr key={layer.name} className="hover:bg-slate-900/40">
                        <td className="py-3 px-4 text-slate-200">
                          {layer.name}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                          {layer.heightM.toFixed(2)} m
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400">
                          {layer.densityKgM3.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-100">
                          {layer.volOneTank.toFixed(3)} m³
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-400">
                          {layer.massOneTank.toLocaleString('vi-VN', {
                            maximumFractionDigits: 0,
                          })}{' '}
                          kg
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-100">
                          {layer.massTotal.toLocaleString('vi-VN', {
                            maximumFractionDigits: 0,
                          })}{' '}
                          kg
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-900/70 font-semibold">
                      <td className="py-3 px-4 text-slate-100">
                        Tổng cộng vật liệu lọc
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                        {totalMediaHeight.toFixed(2)} m
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400">—</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-100">
                        {totalMediaVolOne.toFixed(3)} m³
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-400">
                        {totalMediaMassOne.toLocaleString('vi-VN', {
                          maximumFractionDigits: 0,
                        })}{' '}
                        kg
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-400">
                        {totalMediaMassAll.toLocaleString('vi-VN', {
                          maximumFractionDigits: 0,
                        })}{' '}
                        kg
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
