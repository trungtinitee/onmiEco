import { useState } from 'react';
import {
  FlaskConical,
  Layers,
  RotateCcw,
  Sparkles,
  Wind,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  CheckTable,
  DecimalInput,
  NumberField,
  StatusBanner,
  roundUpToStep,
} from '../components/CalcPrimitives';
import EquipmentSelector from '../components/EquipmentSelector';

const PHYSICO_EQUIPMENT_LABELS = {
  coagulation: 'Bể Keo tụ',
  flocculation: 'Bể Tạo bông',
  sedimentation: 'Bể Lắng hóa lý',
  daf: 'Bể Tuyển nổi DAF',
};

const PHYSICO_TABS = [
  { id: 'coagulation', label: 'Keo tụ', icon: FlaskConical },
  { id: 'flocculation', label: 'Tạo bông', icon: Sparkles },
  { id: 'sedimentation', label: 'Lắng hóa lý', icon: Layers },
  { id: 'daf', label: 'Tuyển nổi DAF', icon: Wind },
];

const TANK_SHAPES = [
  { value: 'Vuông', label: 'Vuông (a × a × H)' },
  { value: 'Tròn', label: 'Tròn (Ø D × H)' },
  { value: 'Chữ nhật', label: 'Chữ nhật (L × W × H)' },
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

  // --- Tab 4: Tuyển nổi áp lực DAF ---
  const [dafParams, setDafParams] = useState({
    shape: 'Chữ nhật',
    retentionMin: 25,
    recyclePct: 30,
    surfaceLoadMax: 8.0, // m3/m2.h (chuẩn 5 - 10)
    saturatorPressureBar: 5.0,
    depthH: 2.2,
    ratioLW: 2.0,
  });
  const [dafOverride, setDafOverride] = useState(null);

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

  // --- DAF Calculations ---
  const qDafRecycleHour = hydraulics.qHour * (dafParams.recyclePct / 100);
  const qDafTotalHour = hydraulics.qHour + qDafRecycleHour;
  const dafVolTheo = qDafTotalHour * (dafParams.retentionMin / 60);
  const dafTheo = interpolateTank(
    dafVolTheo,
    dafParams.depthH,
    dafParams.shape,
    dafParams.ratioLW
  );
  const activeDafOv =
    dafOverride ?? buildRecommendedOverride(dafTheo, dafParams.shape, 0);
  const dafActual = computeActualTank(activeDafOv, dafParams.shape);
  const dafRetentionActual =
    qDafTotalHour > 0 ? (dafActual.volume / qDafTotalHour) * 60 : 0;
  const dafSurfaceLoadTheo =
    dafTheo.area > 0 ? qDafTotalHour / dafTheo.area : 0;
  const dafSurfaceLoadActual =
    dafActual.area > 0 ? qDafTotalHour / dafActual.area : 0;
  const isDafVolOk =
    hydraulics.qDay > 0 && dafVolTheo > 0 && dafActual.volume >= dafVolTheo;
  const isDafLoadOk =
    hydraulics.qDay > 0 && dafSurfaceLoadActual <= dafParams.surfaceLoadMax;
  const isDafAllOk = isDafVolOk && isDafLoadOk;

  const handleDafShapeChange = (nextShape) => {
    setDafParams((p) => ({ ...p, shape: nextShape }));
    const nextTheo = interpolateTank(
      dafVolTheo,
      dafParams.depthH,
      nextShape,
      dafParams.ratioLW
    );
    setDafOverride(buildRecommendedOverride(nextTheo, nextShape, 0));
  };

  const updateDafOv = (field, val) => {
    setDafOverride({
      ...activeDafOv,
      [field]: val,
    });
  };

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
        <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
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
                helperText="Gợi ý: 30 – 120 giây (khuấy trộn nhanh)"
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
                helperText="Gợi ý: 15 – 30 phút (khuấy chậm tạo bông)"
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
                  helperText="Gợi ý: 1,5 – 2,5 m³/m²·h (lắng hóa lý)"
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
              helperText={
                tabId === 'coagulation'
                  ? 'Gợi ý: 300 – 1.000 s⁻¹ (TCVN 7957 / Metcalf & Eddy)'
                  : tabId === 'flocculation'
                  ? 'Gợi ý: 20 – 70 s⁻¹ (tránh vỡ bông cặn)'
                  : 'Gợi ý: 5 – 25 s⁻¹ (vùng tâm bể lắng)'
              }
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
          <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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

          <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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

          <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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
        <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
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
              className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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

          <CheckTable
            title="Bảng kiểm tra ngược thiết kế"
            rows={[
              {
                name: 'Thể tích bể (V)',
                standard: `≥ ${vTheo.toFixed(2)} m³`,
                actual: `${actual.volume.toFixed(2)} m³`,
                ok: isVolOk,
                statusText: isVolOk ? 'Đạt chuẩn' : 'Thiếu thể tích',
              },
              {
                name: 'Gradient vận tốc (G)',
                standard: `${m.gMin} – ${m.gMax} s⁻¹`,
                actual: `${gActual.toFixed(0)} s⁻¹`,
                ok: isGOk,
                statusText: isGOk
                  ? 'Đạt chuẩn'
                  : gActual < m.gMin
                  ? 'G quá yếu'
                  : 'G quá lớn',
              },
              {
                name: extra.metricLabel,
                standard: extra.metricTheo,
                actual: extra.metricActual,
                ok: extra.extraOk,
                statusText: extra.extraStatus,
              },
            ]}
          />
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
            Cụm Xử Lý Hóa Lý (Xử Lý Bậc 1)
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Tính toán khuấy trộn keo tụ/tạo bông theo Gradient vận tốc G, lắng
            hóa lý và tuyển nổi áp lực DAF tách dầu mỡ, cặn lơ lửng.
          </p>
        </div>

        <div className="w-full lg:w-80 rounded-xl bg-slate-800 border border-slate-700/80 p-3.5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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
            <DecimalInput
              id="physico-global-q"
              value={globalQ}
              onValueChange={setGlobalQ}
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
        className="print:hidden flex items-center gap-2 overflow-x-auto pb-1"
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
              className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'bg-slate-800 text-slate-300 border border-slate-700/80 hover:bg-slate-700 hover:text-slate-100'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 pointer-events-none" />
              <span className="pointer-events-none">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      {activeTab !== 'daf' ? (
        renderMixOrSedTab(activeTab)
      ) : (
        <div className="space-y-6">
          {/* 1. DAF Design Parameters & Shape */}
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Bể Tuyển Nổi Áp Lực DAF — Thông số thiết kế &amp; Hình dạng
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tính theo tổng lưu lượng qua ngăn tuyển nổi (Q_tb + Q_tuần hoàn
                  bão hòa khí)
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                Q_DAF = {qDafTotalHour.toFixed(2)} m³/h · V_lt ={' '}
                {dafVolTheo.toFixed(2)} m³
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="daf-shape"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Hình dạng công trình
                </label>
                <select
                  id="daf-shape"
                  value={dafParams.shape}
                  onChange={(e) => handleDafShapeChange(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                >
                  {TANK_SHAPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <NumberField
                id="daf-retention"
                label="Thời gian lưu ngăn tuyển nổi (t)"
                unit="phút"
                value={dafParams.retentionMin}
                min={10}
                max={60}
                step={1}
                onChange={(v) =>
                  setDafParams((p) => ({ ...p, retentionMin: v }))
                }
                helperText="Gợi ý: 10 – 30 phút"
              />

              <NumberField
                id="daf-recycle"
                label="Tỷ lệ tuần hoàn bão hòa khí (R)"
                unit="%"
                value={dafParams.recyclePct}
                min={10}
                max={100}
                step={5}
                onChange={(v) => setDafParams((p) => ({ ...p, recyclePct: v }))}
              />

              <NumberField
                id="daf-slr-max"
                label="Giới hạn tải trọng bề mặt (q₀,max)"
                unit="m³/m²·h"
                value={dafParams.surfaceLoadMax}
                min={3}
                max={15}
                step={0.5}
                onChange={(v) =>
                  setDafParams((p) => ({ ...p, surfaceLoadMax: v }))
                }
                helperText="Gợi ý: 2,0 – 5,0 m³/m²·h (tải chuẩn 5 – 10 m³/m²·h tùy bùn cặn)"
              />

              <NumberField
                id="daf-pressure"
                label="Áp suất bồn bão hòa khí"
                unit="bar"
                value={dafParams.saturatorPressureBar}
                min={3}
                max={7}
                step={0.5}
                onChange={(v) =>
                  setDafParams((p) => ({ ...p, saturatorPressureBar: v }))
                }
              />

              <NumberField
                id="daf-h"
                label="Chiều sâu công tác lý thuyết (H)"
                unit="m"
                value={dafParams.depthH}
                min={1.2}
                max={4.5}
                step={0.1}
                onChange={(v) => setDafParams((p) => ({ ...p, depthH: v }))}
              />

              {dafParams.shape === 'Chữ nhật' && (
                <NumberField
                  id="daf-ratio"
                  label="Tỷ lệ Dài / Rộng (L/W)"
                  unit="L/W"
                  value={dafParams.ratioLW}
                  min={1}
                  max={5}
                  step={0.1}
                  onChange={(v) => setDafParams((p) => ({ ...p, ratioLW: v }))}
                />
              )}
            </div>

            <div className="pt-3 border-t border-slate-700/70 text-xs font-mono text-slate-400">
              Q_DAF = {hydraulics.qHour.toFixed(2)} × (1 + {dafParams.recyclePct}
              %) = {qDafTotalHour.toFixed(2)} m³/h · V_lt = Q_DAF × (
              {dafParams.retentionMin}/60) = {dafVolTheo.toFixed(2)} m³
            </div>
          </section>

          {/* 2. Theoretical KPI Cards */}
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
              <div className="text-xs text-slate-400">
                Kích thước nội suy lý thuyết ({dafParams.shape})
              </div>
              {dafParams.shape === 'Chữ nhật' && (
                <div className="mt-2 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
                  {dafTheo.L.toFixed(2)} × {dafTheo.W.toFixed(2)} ×{' '}
                  {dafTheo.H.toFixed(2)} m
                </div>
              )}
              {dafParams.shape === 'Vuông' && (
                <div className="mt-2 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
                  {dafTheo.a.toFixed(2)} × {dafTheo.a.toFixed(2)} ×{' '}
                  {dafTheo.H.toFixed(2)} m
                </div>
              )}
              {dafParams.shape === 'Tròn' && (
                <div className="mt-2 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
                  Ø {dafTheo.D.toFixed(2)} × {dafTheo.H.toFixed(2)} m
                </div>
              )}
              <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                V_lt = {dafVolTheo.toFixed(2)} m³ · F_lt ={' '}
                {dafTheo.area.toFixed(2)} m²
              </div>
            </div>

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
              <div className="text-xs text-slate-400">
                Lưu lượng bơm tuần hoàn bão hòa khí
              </div>
              <div className="mt-2 font-mono text-xl font-semibold text-slate-100 tabular-nums">
                {qDafRecycleHour.toFixed(2)} m³/giờ
              </div>
              <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                Áp suất làm việc {dafParams.saturatorPressureBar.toFixed(1)} bar
                ({dafParams.recyclePct}% Q)
              </div>
            </div>

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
              <div className="text-xs text-slate-400">
                Tải trọng bề mặt tuyển nổi thực
              </div>
              <div
                className={`mt-2 font-mono text-xl font-semibold tabular-nums ${
                  isDafLoadOk ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {dafSurfaceLoadActual.toFixed(2)} m³/m²·h
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Giới hạn chuẩn ≤ {dafParams.surfaceLoadMax.toFixed(1)} m³/m²·h
              </div>
            </div>
          </section>

          {/* 3. Override & Reverse Verification */}
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Chốt kích thước thi công &amp; Kiểm tra ngược DAF
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Nhập đè kích thước chọn ({dafParams.shape}) để kiểm tra ngược
                  thể tích thực, thời gian lưu và tải trọng bề mặt tuyển nổi.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDafOverride(
                    buildRecommendedOverride(dafTheo, dafParams.shape, 0)
                  )
                }
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Làm tròn theo lý thuyết</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {dafParams.shape === 'Chữ nhật' && (
                <>
                  <NumberField
                    id="daf-ov-L"
                    label="Chiều dài chọn (L)"
                    unit="m"
                    value={activeDafOv.L}
                    min={0}
                    max={50}
                    step={0.1}
                    onChange={(v) => updateDafOv('L', v)}
                  />
                  <NumberField
                    id="daf-ov-W"
                    label="Chiều rộng chọn (W)"
                    unit="m"
                    value={activeDafOv.W}
                    min={0}
                    max={50}
                    step={0.1}
                    onChange={(v) => updateDafOv('W', v)}
                  />
                </>
              )}

              {dafParams.shape === 'Vuông' && (
                <NumberField
                  id="daf-ov-a"
                  label="Cạnh bể chọn (a)"
                  unit="m"
                  value={activeDafOv.a}
                  min={0}
                  max={50}
                  step={0.1}
                  onChange={(v) => updateDafOv('a', v)}
                />
              )}

              {dafParams.shape === 'Tròn' && (
                <NumberField
                  id="daf-ov-D"
                  label="Đường kính chọn (D)"
                  unit="m"
                  value={activeDafOv.D}
                  min={0}
                  max={50}
                  step={0.1}
                  onChange={(v) => updateDafOv('D', v)}
                />
              )}

              <NumberField
                id="daf-ov-H"
                label="Chiều sâu công tác chọn (H)"
                unit="m"
                value={activeDafOv.H}
                min={0}
                max={15}
                step={0.1}
                onChange={(v) => updateDafOv('H', v)}
              />
            </div>

            <StatusBanner
              ok={isDafAllOk}
              titleOk="ĐẠT CHUẨN HÌNH HỌC & TẢI TRỌNG TUYỂN NỔI DAF"
              titleFail="CẢNH BÁO ĐỎ: RỚT CHUẨN THIẾT KẾ DAF"
              summaryLabel="V_thực · Tải bề mặt"
              message={`${
                !isDafVolOk
                  ? `V_thực (${dafActual.volume.toFixed(2)} m³) < V_lý thuyết (${dafVolTheo.toFixed(2)} m³). `
                  : `V_thực = ${dafActual.volume.toFixed(2)} m³ đạt chuẩn. `
              }${
                !isDafLoadOk
                  ? `Tải trọng bề mặt (${dafSurfaceLoadActual.toFixed(2)} m³/m²·h) vượt giới hạn ≤ ${dafParams.surfaceLoadMax.toFixed(1)} m³/m²·h.`
                  : `Tải trọng bề mặt = ${dafSurfaceLoadActual.toFixed(2)} m³/m²·h đạt chuẩn.`
              }`}
              summaryRight={`${dafActual.volume.toFixed(2)} m³ · ${dafSurfaceLoadActual.toFixed(2)} m³/m²·h`}
            />

            <CheckTable
              title="Thông số kiểm tra ngược DAF"
              rows={[
                {
                  name: 'Thể tích ngăn tuyển nổi (V)',
                  standard: `≥ ${dafVolTheo.toFixed(2)} m³`,
                  actual: `${dafActual.volume.toFixed(2)} m³`,
                  ok: isDafVolOk,
                  statusText: isDafVolOk ? 'Đạt chuẩn' : 'Thiếu thể tích',
                },
                {
                  name: 'Thời gian lưu thực tế (t_thực)',
                  standard: `≥ ${dafParams.retentionMin.toFixed(1)} phút`,
                  actual: `${dafRetentionActual.toFixed(1)} phút`,
                  ok: dafRetentionActual >= dafParams.retentionMin,
                  statusText:
                    dafRetentionActual >= dafParams.retentionMin
                      ? 'Đạt thời gian lưu'
                      : 'Ngắn hơn thiết kế',
                },
                {
                  name: 'Tải trọng bề mặt (q₀)',
                  standard: `≤ ${dafParams.surfaceLoadMax.toFixed(2)} m³/m²·h (LT: ${dafSurfaceLoadTheo.toFixed(2)})`,
                  actual: `${dafSurfaceLoadActual.toFixed(2)} m³/m²·h`,
                  ok: isDafLoadOk,
                  statusText: isDafLoadOk ? 'Đạt tải trọng' : 'Vượt tải bề mặt',
                },
                {
                  name: 'Diện tích mặt bằng (F)',
                  standard: `${dafTheo.area.toFixed(2)} m²`,
                  actual: `${dafActual.area.toFixed(2)} m²`,
                  ok: dafActual.area >= dafTheo.area,
                  statusText:
                    dafActual.area >= dafTheo.area
                      ? 'Đủ diện tích'
                      : 'Nhỏ hơn LT',
                },
              ]}
            />
          </section>
        </div>
      )}

      <EquipmentSelector
        key={`omnieco_equipments_physicochemical_${activeTab}`}
        moduleLabel={PHYSICO_EQUIPMENT_LABELS[activeTab] || 'Công trình Hóa lý'}
        storageKey={`omnieco_equipments_physicochemical_${activeTab}`}
      />
    </div>
  );
}
