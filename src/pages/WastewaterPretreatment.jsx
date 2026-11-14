import { useMemo, useState } from 'react';
import {
  Droplets,
  Filter,
  Layers,
  RotateCcw,
  Waves,
  Wind,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  NumberField as InputField,
  StatusBanner,
  roundUpToStep,
} from '../components/CalcPrimitives';

const TABS = [
  { id: 'screen', label: 'Song chắn rác', icon: Filter },
  { id: 'grit', label: 'Lắng cát', icon: Layers },
  { id: 'grease', label: 'Tách dầu mỡ', icon: Droplets },
  { id: 'equalization', label: 'Bể điều hòa', icon: Waves },
  { id: 'daf', label: 'Tuyển nổi DAF', icon: Wind },
];

const SHAPE_OPTIONS = [
  { value: 'Chữ nhật', label: 'Chữ nhật (L × W × H)' },
  { value: 'Vuông', label: 'Vuông (a × a × H)' },
  { value: 'Tròn', label: 'Tròn (Ø D × H)' },
];

const BAR_SHAPES = [
  { value: 2.42, label: 'Thanh chữ nhật sắc cạnh (β = 2,42)' },
  { value: 1.83, label: 'Thanh chữ nhật đầu tròn (β = 1,83)' },
  { value: 1.79, label: 'Thanh tiết diện tròn (β = 1,79)' },
  { value: 1.67, label: 'Thanh giọt nước (β = 1,67)' },
];

function interpolateDimensions(volume, depth, shape, ratioLtoW = 2.0) {
  const safeV = Math.max(0, Number(volume) || 0);
  const safeH = Math.max(0.5, Number(depth) || 1);
  const area = safeV / safeH;

  if (shape === 'Vuông') {
    const a = Math.sqrt(area);
    return {
      area,
      H: safeH,
      a,
      L: a,
      W: a,
      D: 0,
    };
  }

  if (shape === 'Tròn') {
    const D = Math.sqrt((4 * area) / Math.PI);
    return {
      area,
      H: safeH,
      D,
      a: 0,
      L: 0,
      W: 0,
    };
  }

  // Chữ nhật
  const ratio = Math.max(1, Number(ratioLtoW) || 2.0);
  const W = Math.sqrt(area / ratio);
  const L = W * ratio;
  return {
    area,
    H: safeH,
    L,
    W,
    a: 0,
    D: 0,
  };
}

function buildRecommendedOverride(theo, shape) {
  const H = roundUpToStep(theo.H, 0.1);
  if (shape === 'Vuông') {
    return {
      L: 0,
      W: 0,
      a: roundUpToStep(theo.a, 0.1),
      D: 0,
      H,
    };
  }
  if (shape === 'Tròn') {
    return {
      L: 0,
      W: 0,
      a: 0,
      D: roundUpToStep(theo.D, 0.1),
      H,
    };
  }
  return {
    L: roundUpToStep(theo.L, 0.1),
    W: roundUpToStep(theo.W, 0.1),
    a: 0,
    D: 0,
    H,
  };
}

function computeActualGeometry(override, shape) {
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

export default function WastewaterPretreatment() {
  const { globalQ, setGlobalQ, hydraulics } = useAppContext();
  const [activeTab, setActiveTab] = useState('screen');

  // --- Tab 1: Song chắn rác state ---
  const [screenParams, setScreenParams] = useState({
    vKhe: 0.8,
    bMm: 16,
    sMm: 8,
    angleDeg: 60,
    hWater: 0.5,
    beta: 2.42,
    clogFactor: 2.5,
  });
  const [screenOverride, setScreenOverride] = useState({
    widthB: 0.6,
    depthH: 0.5,
    channelL: 3.0,
  });

  // --- Volumetric Tabs State (grit, grease, equalization, daf) ---
  const [gritParams, setGritParams] = useState({
    retentionSec: 60,
    depthH: 1.5,
    ratioLW: 3.0,
    shape: 'Chữ nhật',
  });
  const [greaseParams, setGreaseParams] = useState({
    retentionMin: 20,
    depthH: 1.8,
    ratioLW: 2.0,
    shape: 'Chữ nhật',
  });
  const [eqParams, setEqParams] = useState({
    hrtHours: 6,
    depthH: 3.5,
    airRate: 0.6,
    ratioLW: 1.5,
    shape: 'Chữ nhật',
  });
  const [dafParams, setDafParams] = useState({
    retentionMin: 25,
    recyclePct: 30,
    depthH: 2.2,
    ssIn: 350,
    ratioLW: 2.0,
    shape: 'Chữ nhật',
  });

  // Per-tab custom override values (null = auto-derived from theoretical rounded up)
  const [overrides, setOverrides] = useState({
    grit: null,
    grease: null,
    equalization: null,
    daf: null,
  });

  // Hydraulic flows in m3/s
  const qMaxM3s = hydraulics.qMaxSecond / 1000;
  const qAvgM3s = hydraulics.qSecond / 1000;

  // --- Song chắn rác calculation ---
  const screenCalc = useMemo(() => {
    const bM = screenParams.bMm / 1000;
    const sM = screenParams.sMm / 1000;
    const denom = screenParams.vKhe * bM * screenParams.hWater;
    const nSlotsRaw = denom > 0 ? qMaxM3s / denom : 0;
    const nSlots = Math.max(1, Math.ceil(nSlotsRaw));
    const widthTheo = nSlots * bM + Math.max(0, nSlots - 1) * sM;
    const lengthTheo = Math.max(2.0, widthTheo * 3);

    // Reverse check from user override
    const pitch = bM + sM;
    const actualSlots =
      pitch > 0
        ? Math.max(1, Math.floor((screenOverride.widthB + sM) / pitch))
        : 1;
    const openArea = actualSlots * bM * screenOverride.depthH;
    const vActual = openArea > 0 ? qMaxM3s / openArea : 0;
    const alphaRad = (screenParams.angleDeg * Math.PI) / 180;
    const headLoss =
      bM > 0
        ? screenParams.beta *
          Math.pow(sM / bM, 4 / 3) *
          ((vActual * vActual) / (2 * 9.81)) *
          Math.sin(alphaRad) *
          screenParams.clogFactor
        : 0;

    const isWidthOk = screenOverride.widthB >= widthTheo;
    const isVelOk = vActual >= 0.4 && vActual <= 1.2;
    const isPass = hydraulics.qDay > 0 && isWidthOk && isVelOk;

    return {
      nSlotsRaw,
      nSlots,
      widthTheo,
      lengthTheo,
      actualSlots,
      openArea,
      vActual,
      headLoss,
      isWidthOk,
      isVelOk,
      isPass,
    };
  }, [qMaxM3s, hydraulics.qDay, screenParams, screenOverride]);

  // --- Helper for active volumetric tab calculation ---
  const getVolumetricTabConfig = (tabId) => {
    if (tabId === 'grit') {
      const vTheo = qMaxM3s * gritParams.retentionSec;
      const theo = interpolateDimensions(
        vTheo,
        gritParams.depthH,
        gritParams.shape,
        gritParams.ratioLW
      );
      return {
        tabId: 'grit',
        title: 'Bể lắng cát',
        standardNote: 'TCVN 7957:2008 · Tính theo lưu lượng cực đại Qmax,s',
        formulaText: `V_lt = Qmax,s × t = ${qMaxM3s.toFixed(4)} m³/s × ${gritParams.retentionSec} s = ${vTheo.toFixed(2)} m³`,
        params: gritParams,
        setParams: setGritParams,
        vTheo,
        theo,
        extraTheoLabel: 'Tải trọng bề mặt q₀',
        extraTheoValue:
          theo.area > 0
            ? `${(hydraulics.qMaxHour / theo.area).toFixed(2)} m³/m²·h`
            : '0 m³/m²·h',
        reverseCheckLabel: 'Thời gian lưu thực tế',
        getReverseCheckValue: (vActual) =>
          qMaxM3s > 0 ? `${(vActual / qMaxM3s).toFixed(1)} giây` : '0 giây',
      };
    }

    if (tabId === 'grease') {
      const vTheo = hydraulics.qMaxHour * (greaseParams.retentionMin / 60);
      const theo = interpolateDimensions(
        vTheo,
        greaseParams.depthH,
        greaseParams.shape,
        greaseParams.ratioLW
      );
      return {
        tabId: 'grease',
        title: 'Bể tách dầu mỡ',
        standardNote: 'Tính theo Qmax,h · Thời gian lưu nổi dầu mỡ 15–30 phút',
        formulaText: `V_lt = Qmax,h × (t / 60) = ${hydraulics.qMaxHour.toFixed(2)} × (${greaseParams.retentionMin}/60) = ${vTheo.toFixed(2)} m³`,
        params: greaseParams,
        setParams: setGreaseParams,
        vTheo,
        theo,
        extraTheoLabel: 'Tải trọng bề mặt',
        extraTheoValue:
          theo.area > 0
            ? `${(hydraulics.qMaxHour / theo.area).toFixed(2)} m³/m²·h`
            : '0 m³/m²·h',
        reverseCheckLabel: 'Thời gian lưu thực tế',
        getReverseCheckValue: (vActual) =>
          hydraulics.qMaxHour > 0
            ? `${((vActual / hydraulics.qMaxHour) * 60).toFixed(1)} phút`
            : '0 phút',
      };
    }

    if (tabId === 'equalization') {
      const vTheo = hydraulics.qHour * eqParams.hrtHours;
      const theo = interpolateDimensions(
        vTheo,
        eqParams.depthH,
        eqParams.shape,
        eqParams.ratioLW
      );
      return {
        tabId: 'equalization',
        title: 'Bể điều hòa lưu lượng & nồng độ',
        standardNote: 'Tính theo lưu lượng trung bình giờ Qtb,h · Sục khí chống lắng',
        formulaText: `V_lt = Qtb,h × HRT = ${hydraulics.qHour.toFixed(2)} m³/h × ${eqParams.hrtHours} h = ${vTheo.toFixed(2)} m³`,
        params: eqParams,
        setParams: setEqParams,
        vTheo,
        theo,
        extraTheoLabel: 'Khí sục chống lắng lý thuyết',
        extraTheoValue: `${(vTheo * eqParams.airRate).toFixed(1)} m³/giờ`,
        reverseCheckLabel: 'HRT thực tế · Khí sục thực tế',
        getReverseCheckValue: (vActual) =>
          `${hydraulics.qHour > 0 ? (vActual / hydraulics.qHour).toFixed(2) : '0.00'} h · ${(vActual * eqParams.airRate).toFixed(1)} m³/h`,
      };
    }

    // daf
    const qDafHour = hydraulics.qHour * (1 + dafParams.recyclePct / 100);
    const vTheo = qDafHour * (dafParams.retentionMin / 60);
    const theo = interpolateDimensions(
      vTheo,
      dafParams.depthH,
      dafParams.shape,
      dafParams.ratioLW
    );
    return {
      tabId: 'daf',
      title: 'Bể tuyển nổi áp lực DAF',
      standardNote: 'Tính theo tổng lưu lượng qua ngăn tuyển nổi (Q + Q_tuần hoàn)',
      formulaText: `Q_DAF = ${hydraulics.qHour.toFixed(2)} × (1 + ${dafParams.recyclePct}%) = ${qDafHour.toFixed(2)} m³/h · V_lt = ${vTheo.toFixed(2)} m³`,
      params: dafParams,
      setParams: setDafParams,
      vTheo,
      theo,
      extraTheoLabel: 'Tải trọng bề mặt tuyển nổi',
      extraTheoValue:
        theo.area > 0
          ? `${(qDafHour / theo.area).toFixed(2)} m³/m²·h`
          : '0 m³/m²·h',
      reverseCheckLabel: 'Thời gian lưu thực · Tải bề mặt thực',
      getReverseCheckValue: (vActual, areaActual) =>
        `${qDafHour > 0 ? ((vActual / qDafHour) * 60).toFixed(1) : '0.0'} phút · ${areaActual > 0 ? (qDafHour / areaActual).toFixed(2) : '0.00'} m³/m²·h`,
    };
  };

  const handleShapeChange = (tabId, nextShape) => {
    const current = getVolumetricTabConfig(tabId);
    current.setParams((prev) => ({ ...prev, shape: nextShape }));
    // Reset override for this tab so it initializes cleanly to the new shape's recommended rounded dimensions
    const nextTheo = interpolateDimensions(
      current.vTheo,
      current.params.depthH,
      nextShape,
      current.params.ratioLW
    );
    setOverrides((prev) => ({
      ...prev,
      [tabId]: buildRecommendedOverride(nextTheo, nextShape),
    }));
  };

  const handleSnapRecommended = (tabId) => {
    const current = getVolumetricTabConfig(tabId);
    setOverrides((prev) => ({
      ...prev,
      [tabId]: buildRecommendedOverride(current.theo, current.params.shape),
    }));
  };

  const updateOverrideField = (tabId, field, rawValue) => {
    const current = getVolumetricTabConfig(tabId);
    const activeOverride =
      overrides[tabId] ??
      buildRecommendedOverride(current.theo, current.params.shape);
    const parsed = rawValue === '' ? 0 : Math.max(0, Number(rawValue));
    setOverrides((prev) => ({
      ...prev,
      [tabId]: {
        ...activeOverride,
        [field]: Number.isNaN(parsed) ? 0 : parsed,
      },
    }));
  };

  const renderVolumetricSection = (tabId) => {
    const cfg = getVolumetricTabConfig(tabId);
    const { params, setParams, vTheo, theo } = cfg;
    const activeOverride =
      overrides[tabId] ?? buildRecommendedOverride(theo, params.shape);
    const actual = computeActualGeometry(activeOverride, params.shape);

    const diffVolume = actual.volume - vTheo;
    const diffPct = vTheo > 0 ? (diffVolume / vTheo) * 100 : 0;
    const isCompliant = hydraulics.qDay > 0 && vTheo > 0 && actual.volume >= vTheo;

    return (
      <div className="space-y-6">
        {/* 1. Design Inputs + Shape Selector (Responsive 1-3 col Grid) */}
        <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                1. Thông số thiết kế & Chọn hình dạng công trình
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{cfg.standardNote}</p>
            </div>
            <span className="font-mono text-xs text-emerald-400 tabular-nums">
              V lý thuyết = {vTheo.toFixed(2)} m³
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Shape Selector Dropdown */}
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
                onChange={(e) => handleShapeChange(tabId, e.target.value)}
                className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors"
              >
                {SHAPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tab-specific process inputs */}
            {tabId === 'grit' && (
              <InputField
                id="grit-retention"
                label="Thời gian lưu cát (t)"
                unit="giây"
                value={gritParams.retentionSec}
                min={20}
                max={300}
                step={5}
                onChange={(v) =>
                  setParams((p) => ({ ...p, retentionSec: v }))
                }
              />
            )}

            {tabId === 'grease' && (
              <InputField
                id="grease-retention"
                label="Thời gian lưu tách dầu (t)"
                unit="phút"
                value={greaseParams.retentionMin}
                min={5}
                max={60}
                step={1}
                onChange={(v) =>
                  setParams((p) => ({ ...p, retentionMin: v }))
                }
              />
            )}

            {tabId === 'equalization' && (
              <>
                <InputField
                  id="eq-hrt"
                  label="Thời gian lưu thủy lực (HRT)"
                  unit="giờ"
                  value={eqParams.hrtHours}
                  min={1}
                  max={24}
                  step={0.5}
                  onChange={(v) => setParams((p) => ({ ...p, hrtHours: v }))}
                />
                <InputField
                  id="eq-air"
                  label="Cường độ sục khí chống lắng"
                  unit="m³/m³·h"
                  value={eqParams.airRate}
                  min={0.1}
                  max={3}
                  step={0.1}
                  onChange={(v) => setParams((p) => ({ ...p, airRate: v }))}
                />
              </>
            )}

            {tabId === 'daf' && (
              <>
                <InputField
                  id="daf-retention"
                  label="Thời gian lưu ngăn tuyển nổi"
                  unit="phút"
                  value={dafParams.retentionMin}
                  min={10}
                  max={60}
                  step={1}
                  onChange={(v) =>
                    setParams((p) => ({ ...p, retentionMin: v }))
                  }
                />
                <InputField
                  id="daf-recycle"
                  label="Tỷ lệ tuần hoàn bão hòa khí (R)"
                  unit="%"
                  value={dafParams.recyclePct}
                  min={10}
                  max={100}
                  step={5}
                  onChange={(v) => setParams((p) => ({ ...p, recyclePct: v }))}
                />
              </>
            )}

            {/* Common Theoretical Depth H */}
            <InputField
              id={`${tabId}-depth-theo`}
              label="Chiều sâu công tác lý thuyết (H)"
              unit="m"
              value={params.depthH}
              min={0.8}
              max={7}
              step={0.1}
              onChange={(v) => setParams((p) => ({ ...p, depthH: v }))}
            />

            {/* Aspect Ratio L/W only when Chữ nhật */}
            {params.shape === 'Chữ nhật' && (
              <InputField
                id={`${tabId}-ratio-lw`}
                label="Tỷ lệ giả định Dài / Rộng (L/W)"
                unit="L/W"
                value={params.ratioLW}
                min={1}
                max={6}
                step={0.1}
                onChange={(v) => setParams((p) => ({ ...p, ratioLW: v }))}
              />
            )}
          </div>

          <div className="pt-3 border-t border-slate-700/70 text-xs font-mono text-slate-400">
            {cfg.formulaText}
          </div>
        </section>

        {/* 2. Theoretical Interpolated Sizing (Grid 1-3 cols) */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-100">
            2. Kích thước nội suy lý thuyết ({params.shape})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
              <div className="text-xs text-slate-400">
                Thể tích & Diện tích lý thuyết
              </div>
              <div className="mt-2 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
                {vTheo.toFixed(2)} m³
              </div>
              <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                F_lt = {theo.area.toFixed(2)} m² · H_lt = {theo.H.toFixed(2)} m
              </div>
            </div>

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
              <div className="text-xs text-slate-400">
                Kích thước hình học nội suy
              </div>
              {params.shape === 'Chữ nhật' && (
                <>
                  <div className="mt-2 font-mono text-xl font-semibold text-slate-100 tabular-nums">
                    {theo.L.toFixed(2)} × {theo.W.toFixed(2)} × {theo.H.toFixed(2)} m
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    L = {theo.L.toFixed(2)} m · W = {theo.W.toFixed(2)} m · H ={' '}
                    {theo.H.toFixed(2)} m
                  </div>
                </>
              )}
              {params.shape === 'Vuông' && (
                <>
                  <div className="mt-2 font-mono text-xl font-semibold text-slate-100 tabular-nums">
                    {theo.a.toFixed(2)} × {theo.a.toFixed(2)} × {theo.H.toFixed(2)} m
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Cạnh a = {theo.a.toFixed(2)} m · Cao H = {theo.H.toFixed(2)} m
                  </div>
                </>
              )}
              {params.shape === 'Tròn' && (
                <>
                  <div className="mt-2 font-mono text-xl font-semibold text-slate-100 tabular-nums">
                    Ø {theo.D.toFixed(2)} × {theo.H.toFixed(2)} m
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Đường kính D = {theo.D.toFixed(2)} m · Cao H ={' '}
                    {theo.H.toFixed(2)} m
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
              <div className="text-xs text-slate-400">{cfg.extraTheoLabel}</div>
              <div className="mt-2 font-mono text-xl font-semibold text-slate-100 tabular-nums">
                {cfg.extraTheoValue}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Kiểm tra chế độ thủy lực lý thuyết
              </div>
            </div>
          </div>
        </section>

        {/* 3. Dynamic Construction Override Form + 4. Reverse Verification */}
        <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                3. Kích thước chọn thi công & Kiểm tra ngược
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Nhập đè số chẵn thi công theo hình dạng{' '}
                <strong className="text-slate-200">{params.shape}</strong> để
                kiểm tra ngược thể tích thực tế (V_thực).
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleSnapRecommended(tabId)}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
              <span>Làm tròn theo lý thuyết</span>
            </button>
          </div>

          {/* Dynamic Override Inputs matching Shape */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {params.shape === 'Chữ nhật' && (
              <>
                <InputField
                  id={`${tabId}-ov-L`}
                  label="Chiều dài chọn (L)"
                  unit="m"
                  value={activeOverride.L}
                  min={0}
                  max={100}
                  step={0.1}
                  onChange={(v) => updateOverrideField(tabId, 'L', v)}
                />
                <InputField
                  id={`${tabId}-ov-W`}
                  label="Chiều rộng chọn (W)"
                  unit="m"
                  value={activeOverride.W}
                  min={0}
                  max={100}
                  step={0.1}
                  onChange={(v) => updateOverrideField(tabId, 'W', v)}
                />
                <InputField
                  id={`${tabId}-ov-H-rect`}
                  label="Chiều cao công tác chọn (H)"
                  unit="m"
                  value={activeOverride.H}
                  min={0}
                  max={20}
                  step={0.1}
                  onChange={(v) => updateOverrideField(tabId, 'H', v)}
                />
              </>
            )}

            {params.shape === 'Vuông' && (
              <>
                <InputField
                  id={`${tabId}-ov-a`}
                  label="Cạnh bể chọn (a)"
                  unit="m"
                  value={activeOverride.a}
                  min={0}
                  max={100}
                  step={0.1}
                  onChange={(v) => updateOverrideField(tabId, 'a', v)}
                />
                <InputField
                  id={`${tabId}-ov-H-sq`}
                  label="Chiều cao công tác chọn (H)"
                  unit="m"
                  value={activeOverride.H}
                  min={0}
                  max={20}
                  step={0.1}
                  onChange={(v) => updateOverrideField(tabId, 'H', v)}
                />
              </>
            )}

            {params.shape === 'Tròn' && (
              <>
                <InputField
                  id={`${tabId}-ov-D`}
                  label="Đường kính bể chọn (D)"
                  unit="m"
                  value={activeOverride.D}
                  min={0}
                  max={100}
                  step={0.1}
                  onChange={(v) => updateOverrideField(tabId, 'D', v)}
                />
                <InputField
                  id={`${tabId}-ov-H-cir`}
                  label="Chiều cao công tác chọn (H)"
                  unit="m"
                  value={activeOverride.H}
                  min={0}
                  max={20}
                  step={0.1}
                  onChange={(v) => updateOverrideField(tabId, 'H', v)}
                />
              </>
            )}
          </div>

          <StatusBanner
            ok={isCompliant}
            titleOk="ĐẠT CHUẨN THIẾT KẾ"
            titleFail="CẢNH BÁO: KHÔNG ĐẠT THỂ TÍCH LÝ THUYẾT"
            summaryLabel="V_thực / V_lý thuyết"
            message={
              hydraulics.qDay <= 0
                ? 'Vui lòng nhập lưu lượng globalQ > 0 để kiểm tra ngược.'
                : isCompliant
                ? `Thể tích thực tế (${actual.volume.toFixed(2)} m³) lớn hơn hoặc bằng thể tích lý thuyết (${vTheo.toFixed(2)} m³), dư +${diffVolume.toFixed(2)} m³ (+${diffPct.toFixed(1)}%).`
                : `Thể tích thực tế (${actual.volume.toFixed(2)} m³) nhỏ hơn thể tích lý thuyết (${vTheo.toFixed(2)} m³), thiếu ${Math.abs(diffVolume).toFixed(2)} m³ (${diffPct.toFixed(1)}%). Tăng kích thước chọn để đạt chuẩn.`
            }
            summaryRight={`${actual.volume.toFixed(2)} / ${vTheo.toFixed(2)} m³`}
          />

          {/* Comparison Table wrapped in overflow-x-auto */}
          <div className="overflow-x-auto w-full rounded-lg border border-slate-700/80">
            <table className="w-full min-w-[600px] text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900/90 text-xs font-medium text-slate-400 border-b border-slate-700/80">
                  <th className="py-3 px-4">Hạng mục kiểm tra</th>
                  <th className="py-3 px-4 text-right">Lý thuyết</th>
                  <th className="py-3 px-4 text-right">Chọn thi công</th>
                  <th className="py-3 px-4 text-right">Đánh giá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                <tr className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 text-slate-200">
                    Thể tích công tác (V)
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                    {vTheo.toFixed(2)} m³
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono font-semibold tabular-nums ${
                      isCompliant ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {actual.volume.toFixed(2)} m³
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-medium ${
                      isCompliant ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {isCompliant ? 'Đạt chuẩn' : 'Thiếu thể tích'}
                  </td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 text-slate-200">
                    Diện tích mặt bằng (F)
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                    {theo.area.toFixed(2)} m²
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-100">
                    {actual.area.toFixed(2)} m²
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400">
                    {actual.area >= theo.area ? 'Đủ diện tích' : 'Nhỏ hơn LT'}
                  </td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 text-slate-200">
                    {cfg.reverseCheckLabel}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                    {cfg.getReverseCheckValue(vTheo, theo.area)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-100">
                    {cfg.getReverseCheckValue(actual.volume, actual.area)}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400">
                    Kiểm tra ngược
                  </td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 text-slate-200">
                    Chiều cao xây dựng (kèm h_bv = 0,4 m)
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                    {(theo.H + 0.4).toFixed(2)} m
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-100">
                    {(actual.H + 0.4).toFixed(2)} m
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400">
                    Tổng chiều cao
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
      {/* Page Title & Global Flow Header */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 text-balance">
            Cụm Tiền Xử Lý Nước Thải
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Tính toán kích thước lý thuyết, chọn hình dạng thi công và kiểm tra
            ngược thể tích thực tế cho 5 công đoạn đầu nguồn.
          </p>
        </div>

        {/* Inline globalQ input synced with AppContext */}
        <div className="w-full lg:w-80 rounded-xl bg-slate-800 border border-slate-700/80 p-3.5">
          <label
            htmlFor="pretreatment-global-q"
            className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5"
          >
            <span>Lưu lượng chung (globalQ)</span>
            <span className="font-mono tabular-nums text-slate-300">
              Qmax = {hydraulics.qMaxHour.toFixed(1)} m³/h
            </span>
          </label>
          <div className="relative flex items-center">
            <input
              id="pretreatment-global-q"
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

      {/* 5 Interactive Tabs — scrollable on narrow mobile, min-h-[44px] touch target */}
      <div
        role="tablist"
        aria-label="Các công trình tiền xử lý"
        className="flex items-center gap-2 overflow-x-auto pb-1"
      >
        {TABS.map((tab) => {
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

      {/* Tab Content */}
      {activeTab === 'screen' ? (
        <div className="space-y-6">
          {/* Song chắn rác Inputs */}
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Thông số thủy lực mương đặt Song chắn rác
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tính toán theo Qmax,s = {qMaxM3s.toFixed(4)} m³/s (
                  {hydraulics.qMaxSecond.toFixed(2)} L/s)
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                Số khe tính = {screenCalc.nSlots} khe
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <InputField
                id="scr-v"
                label="Vận tốc qua khe (v_khe)"
                unit="m/s"
                value={screenParams.vKhe}
                min={0.4}
                max={1.2}
                step={0.05}
                onChange={(v) => setScreenParams((p) => ({ ...p, vKhe: v }))}
              />
              <InputField
                id="scr-b"
                label="Chiều rộng khe hở (b)"
                unit="mm"
                value={screenParams.bMm}
                min={5}
                max={50}
                step={1}
                onChange={(v) => setScreenParams((p) => ({ ...p, bMm: v }))}
              />
              <InputField
                id="scr-s"
                label="Bề dày thanh song (s)"
                unit="mm"
                value={screenParams.sMm}
                min={4}
                max={20}
                step={1}
                onChange={(v) => setScreenParams((p) => ({ ...p, sMm: v }))}
              />
              <InputField
                id="scr-h"
                label="Chiều sâu lớp nước (h₁)"
                unit="m"
                value={screenParams.hWater}
                min={0.2}
                max={2.5}
                step={0.05}
                onChange={(v) => setScreenParams((p) => ({ ...p, hWater: v }))}
              />
              <InputField
                id="scr-angle"
                label="Góc nghiêng đặt song (α)"
                unit="độ"
                value={screenParams.angleDeg}
                min={45}
                max={90}
                step={5}
                onChange={(v) =>
                  setScreenParams((p) => ({ ...p, angleDeg: v }))
                }
              />
              <div>
                <label
                  htmlFor="scr-beta"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Hình dạng tiết diện thanh (β)
                </label>
                <select
                  id="scr-beta"
                  value={screenParams.beta}
                  onChange={(e) =>
                    setScreenParams((p) => ({
                      ...p,
                      beta: Number(e.target.value),
                    }))
                  }
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                >
                  {BAR_SHAPES.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Song chắn rác Theoretical Results */}
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
              <div className="text-xs text-slate-400">
                Bề rộng mương lý thuyết (B_lt)
              </div>
              <div className="mt-2 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
                {screenCalc.widthTheo.toFixed(3)} m
              </div>
              <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
                n = {screenCalc.nSlots} khe ({screenCalc.nSlotsRaw.toFixed(2)})
              </div>
            </div>

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
              <div className="text-xs text-slate-400">
                Vận tốc qua khe thực tế (v_thực)
              </div>
              <div className="mt-2 font-mono text-xl font-semibold text-slate-100 tabular-nums">
                {screenCalc.vActual.toFixed(2)} m/s
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Khuyến nghị 0,6 – 1,0 m/s
              </div>
            </div>

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
              <div className="text-xs text-slate-400">
                Tổn thất áp lực qua song (h_r)
              </div>
              <div className="mt-2 font-mono text-xl font-semibold text-slate-100 tabular-nums">
                {(screenCalc.headLoss * 1000).toFixed(1)} mm
              </div>
              <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
                h_r = {screenCalc.headLoss.toFixed(4)} m (k_tắc ={' '}
                {screenParams.clogFactor})
              </div>
            </div>
          </section>

          {/* Song chắn rác Override & Table */}
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Chốt kích thước mương thi công & Kiểm tra ngược
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Nhập bề rộng mương chọn (B) và mực nước (h₁) để kiểm tra lại
                  vận tốc qua khe.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setScreenOverride({
                    widthB: roundUpToStep(screenCalc.widthTheo, 0.1),
                    depthH: screenParams.hWater,
                    channelL: roundUpToStep(screenCalc.lengthTheo, 0.5),
                  })
                }
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Làm tròn theo lý thuyết</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <InputField
                id="scr-ov-B"
                label="Bề rộng mương chọn (B)"
                unit="m"
                value={screenOverride.widthB}
                min={0}
                max={10}
                step={0.05}
                onChange={(v) =>
                  setScreenOverride((p) => ({ ...p, widthB: v }))
                }
              />
              <InputField
                id="scr-ov-h"
                label="Chiều sâu nước chọn (h₁)"
                unit="m"
                value={screenOverride.depthH}
                min={0}
                max={5}
                step={0.05}
                onChange={(v) =>
                  setScreenOverride((p) => ({ ...p, depthH: v }))
                }
              />
              <InputField
                id="scr-ov-L"
                label="Chiều dài mương công tác (L)"
                unit="m"
                value={screenOverride.channelL}
                min={0}
                max={20}
                step={0.1}
                onChange={(v) =>
                  setScreenOverride((p) => ({ ...p, channelL: v }))
                }
              />
            </div>

            <StatusBanner
              ok={screenCalc.isPass}
              titleOk="ĐẠT CHUẨN THỦY LỰC MƯƠNG SONG CHẮN RÁC"
              titleFail="CẢNH BÁO: KÍCH THƯỚC MƯƠNG CHƯA ĐẠT"
              summaryLabel="Vận tốc qua khe"
              message={
                !screenCalc.isWidthOk
                  ? `Bề rộng chọn (${screenOverride.widthB.toFixed(2)} m) nhỏ hơn bề rộng lý thuyết (${screenCalc.widthTheo.toFixed(3)} m).`
                  : !screenCalc.isVelOk
                  ? `Vận tốc thực tế qua khe (${screenCalc.vActual.toFixed(2)} m/s) nằm ngoài dải an toàn 0,4 – 1,2 m/s.`
                  : `Bề rộng mương ${screenOverride.widthB.toFixed(2)} m bố trí ${screenCalc.actualSlots} khe hở với vận tốc thực tế ${screenCalc.vActual.toFixed(2)} m/s đạt yêu cầu.`
              }
              summaryRight={`${screenCalc.vActual.toFixed(2)} m/s`}
            />

            <div className="overflow-x-auto w-full rounded-lg border border-slate-700/80">
              <table className="w-full min-w-[600px] text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-900/90 text-xs font-medium text-slate-400 border-b border-slate-700/80">
                    <th className="py-3 px-4">Thông số mương</th>
                    <th className="py-3 px-4 text-right">Lý thuyết</th>
                    <th className="py-3 px-4 text-right">Chọn thi công</th>
                    <th className="py-3 px-4 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  <tr className="hover:bg-slate-900/40">
                    <td className="py-3 px-4 text-slate-200">Bề rộng mương (B)</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                      {screenCalc.widthTheo.toFixed(3)} m
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-100">
                      {screenOverride.widthB.toFixed(2)} m
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-medium ${
                        screenCalc.isWidthOk
                          ? 'text-emerald-500'
                          : 'text-red-500'
                      }`}
                    >
                      {screenCalc.isWidthOk ? 'Đạt' : 'Chưa đủ rộng'}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-900/40">
                    <td className="py-3 px-4 text-slate-200">
                      Vận tốc qua khe (v)
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                      {screenParams.vKhe.toFixed(2)} m/s
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-100">
                      {screenCalc.vActual.toFixed(2)} m/s
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-medium ${
                        screenCalc.isVelOk ? 'text-emerald-500' : 'text-red-500'
                      }`}
                    >
                      {screenCalc.isVelOk ? 'Trong ngưỡng' : 'Ngoài ngưỡng'}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-900/40">
                    <td className="py-3 px-4 text-slate-200">
                      Tổn thất áp lực qua song (h_r)
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                      &le; 150 mm
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-100">
                      {(screenCalc.headLoss * 1000).toFixed(1)} mm
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-medium ${
                        screenCalc.headLoss * 1000 <= 150
                          ? 'text-emerald-500'
                          : 'text-amber-400'
                      }`}
                    >
                      {screenCalc.headLoss * 1000 <= 150
                        ? 'Bình thường'
                        : 'Cần vớt rác'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        renderVolumetricSection(activeTab)
      )}
    </div>
  );
}
