import { useState } from 'react';
import {
  Cog,
  Droplets,
  Filter,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  CheckTable as ReverseCheckTable,
  NumberField as NumberInput,
  StatusBanner as ReverseAlertBanner,
  roundUpToStep,
} from '../components/CalcPrimitives';

const SLUDGE_TABS = [
  { id: 'clarifier', label: 'Lắng 2', icon: Filter },
  { id: 'thickener', label: 'Nén bùn đứng', icon: Layers },
  { id: 'dewatering', label: 'Máy ép bùn', icon: Cog },
  { id: 'disinfection', label: 'Khử trùng', icon: Droplets },
];

const TANK_SHAPES = [
  { value: 'Tròn', label: 'Tròn (Ø D × H)' },
  { value: 'Vuông', label: 'Vuông (a × a × H)' },
];

function interpolateTank(area, depth, shape) {
  const safeA = Math.max(0, Number(area) || 0);
  const safeH = Math.max(0.5, Number(depth) || 1);
  if (shape === 'Vuông') {
    const a = Math.sqrt(safeA);
    return { area: safeA, H: safeH, a, D: 0, volume: safeA * safeH };
  }
  const D = Math.sqrt((4 * safeA) / Math.PI);
  return { area: safeA, H: safeH, D, a: 0, volume: safeA * safeH };
}

function buildRecommendedTank(theo, shape) {
  const H = roundUpToStep(theo.H, 0.1);
  if (shape === 'Vuông') {
    return { a: roundUpToStep(theo.a, 0.1), D: 0, H };
  }
  return { D: roundUpToStep(theo.D, 0.1), a: 0, H };
}

function computeActualTank(override, shape) {
  const H = Math.max(0, Number(override.H) || 0);
  if (shape === 'Vuông') {
    const a = Math.max(0, Number(override.a) || 0);
    const area = a * a;
    const weirLength = 4 * a;
    return { area, volume: area * H, weirLength, a, D: 0, H };
  }
  const D = Math.max(0, Number(override.D) || 0);
  const area = (Math.PI * D * D) / 4;
  const weirLength = Math.PI * D;
  return { area, volume: area * H, weirLength, D, a: 0, H };
}

export default function WastewaterSludge() {
  const { globalQ, setGlobalQ, hydraulics } = useAppContext();
  const [activeTab, setActiveTab] = useState('clarifier');

  // --- Tab 1: Bể lắng 2 ---
  const [clarifier, setClarifier] = useState({
    numTanks: 1,
    shape: 'Tròn',
    surfaceLoadTarget: 1.0, // m3/m2.h (max chuẩn 1.5)
    surfaceLoadMax: 1.5,
    weirLoadMax: 250, // m3/m.ngày
    hrtMin: 2.0, // giờ
    depthH: 3.5, // m
    weirRings: 1,
  });
  const [clarifierOverride, setClarifierOverride] = useState(null);

  // --- Tab 2: Nén bùn đứng ---
  const [thickener, setThickener] = useState({
    shape: 'Tròn',
    sludgeFlowPct: 2.0, // % so với globalQ
    ssInMgL: 8000, // mg/L (0.8%)
    ssOutMgL: 30000, // mg/L (3.0%)
    slrMax: 35, // kg SS / m2.ngày
    hlrMax: 15, // m3 / m2.ngày
    weirLoadMax: 120, // m3 / m.ngày
    hrtMin: 12, // giờ
    depthH: 3.5, // m
  });
  const [thickenerOverride, setThickenerOverride] = useState(null);

  // --- Tab 3: Máy ép bùn Khung bản / Trục vít ---
  const [dewatering, setDewatering] = useState({
    machineType: 'Khung bản',
    operateHours: 8, // giờ/ngày
    cakeMoisturePct: 75, // % độ ẩm bùn bánh
    polymerDoseKgTon: 4.0, // kg/tấn DS
    polymerConcPct: 0.1, // % dung dịch pha
    plateFluxKgM2h: 12, // kg DS / m2.h (Khung bản)
    screwFlowRateM3h: 5, // m3 / h mỗi máy (Trục vít)
  });

  // --- Tab 4: Khử trùng ---
  const [disinfection, setDisinfection] = useState({
    method: 'Clo / Javen',
    chlorineDoseMgL: 8, // mg/L
    javenPct: 10, // % NaOCl hoạt tính
    contactMinutes: 30, // phút
    tankDepthH: 2.5, // m
    uvDoseMjCm2: 40, // mJ/cm2
    uvSpecificWattPerM3h: 25, // W / (m3/h)
    uvLampWatt: 150, // W / bóng
    ozoneDoseMgL: 5, // mg/L
    ozoneKwhPerKg: 15, // kWh / kg O3
  });

  // --- Computed Values: Lắng 2 ---
  const nClarifiers = Math.max(1, Number(clarifier.numTanks) || 1);
  const qMaxPerClarifierH = hydraulics.qMaxHour / nClarifiers;
  const qMaxPerClarifierDay = qMaxPerClarifierH * 24;
  const clarAreaFromLoad =
    clarifier.surfaceLoadTarget > 0
      ? qMaxPerClarifierH / clarifier.surfaceLoadTarget
      : 0;
  const clarVolFromHrt = qMaxPerClarifierH * clarifier.hrtMin;
  const clarAreaFromHrt =
    clarifier.depthH > 0 ? clarVolFromHrt / clarifier.depthH : 0;
  const clarAreaTheo = Math.max(clarAreaFromLoad, clarAreaFromHrt);
  const clarTheo = interpolateTank(
    clarAreaTheo,
    clarifier.depthH,
    clarifier.shape
  );
  const activeClarOverride =
    clarifierOverride ?? buildRecommendedTank(clarTheo, clarifier.shape);
  const clarActual = computeActualTank(activeClarOverride, clarifier.shape);
  const clarWeirLen = clarActual.weirLength * Math.max(1, clarifier.weirRings);
  const clarSurfaceLoadActual =
    clarActual.area > 0 ? qMaxPerClarifierH / clarActual.area : 0;
  const clarHrtActual =
    qMaxPerClarifierH > 0 ? clarActual.volume / qMaxPerClarifierH : 0;
  const clarWeirLoadActual =
    clarWeirLen > 0 ? qMaxPerClarifierDay / clarWeirLen : 0;

  const isClarSlrOk =
    hydraulics.qDay > 0 && clarSurfaceLoadActual <= clarifier.surfaceLoadMax;
  const isClarHrtOk =
    hydraulics.qDay > 0 && clarHrtActual >= clarifier.hrtMin;
  const isClarWeirOk =
    hydraulics.qDay > 0 && clarWeirLoadActual <= clarifier.weirLoadMax;
  const isClarAllOk = isClarSlrOk && isClarHrtOk && isClarWeirOk;

  // --- Computed Values: Nén bùn đứng ---
  const qSludgeDay = hydraulics.qDay * (thickener.sludgeFlowPct / 100);
  const qSludgeHour = qSludgeDay / 24;
  const sludgeDryKgDay = (qSludgeDay * thickener.ssInMgL) / 1000;
  const qThickenedDay =
    thickener.ssOutMgL > 0
      ? qSludgeDay * (thickener.ssInMgL / thickener.ssOutMgL)
      : 0;
  const qSupernatantDay = Math.max(0, qSludgeDay - qThickenedDay);

  const thickAreaFromSlr =
    thickener.slrMax > 0 ? sludgeDryKgDay / thickener.slrMax : 0;
  const thickAreaFromHlr =
    thickener.hlrMax > 0 ? qSludgeDay / thickener.hlrMax : 0;
  const thickAreaFromHrt =
    thickener.depthH > 0 ? (qSludgeHour * thickener.hrtMin) / thickener.depthH : 0;
  const thickAreaTheo = Math.max(
    thickAreaFromSlr,
    thickAreaFromHlr,
    thickAreaFromHrt
  );
  const thickTheo = interpolateTank(
    thickAreaTheo,
    thickener.depthH,
    thickener.shape
  );
  const activeThickOverride =
    thickenerOverride ?? buildRecommendedTank(thickTheo, thickener.shape);
  const thickActual = computeActualTank(activeThickOverride, thickener.shape);

  const thickSlrActual =
    thickActual.area > 0 ? sludgeDryKgDay / thickActual.area : 0;
  const thickHlrActual =
    thickActual.area > 0 ? qSludgeDay / thickActual.area : 0;
  const thickHrtActual = qSludgeHour > 0 ? thickActual.volume / qSludgeHour : 0;
  const thickWeirLoadActual =
    thickActual.weirLength > 0 ? qSupernatantDay / thickActual.weirLength : 0;

  const isThickSlrOk =
    hydraulics.qDay > 0 && thickSlrActual <= thickener.slrMax;
  const isThickHlrOk =
    hydraulics.qDay > 0 && thickHlrActual <= thickener.hlrMax;
  const isThickHrtOk =
    hydraulics.qDay > 0 && thickHrtActual >= thickener.hrtMin;
  const isThickWeirOk =
    hydraulics.qDay > 0 && thickWeirLoadActual <= thickener.weirLoadMax;
  const isThickAllOk =
    isThickSlrOk && isThickHlrOk && isThickHrtOk && isThickWeirOk;

  // --- Computed Values: Máy ép bùn ---
  const drySolidsTonDay = sludgeDryKgDay / 1000;
  const qSludgePressHour =
    dewatering.operateHours > 0 ? qThickenedDay / dewatering.operateHours : 0;
  const polymerPureKgDay = drySolidsTonDay * dewatering.polymerDoseKgTon;
  const polymerPureGHour =
    dewatering.operateHours > 0
      ? (polymerPureKgDay * 1000) / dewatering.operateHours
      : 0;
  // Dung dịch pha nồng độ C (%) -> 1 kg polymer nguyên chất cần (100 / C) lít nước pha
  const polymerSolutionLDay =
    dewatering.polymerConcPct > 0
      ? polymerPureKgDay * (100 / dewatering.polymerConcPct)
      : 0;
  const polymerSolutionLHour =
    dewatering.operateHours > 0
      ? polymerSolutionLDay / dewatering.operateHours
      : 0;
  const safeCakeMoisturePct = Math.min(
    95,
    Math.max(0, Number(dewatering.cakeMoisturePct) || 0)
  );
  const dryFractionCake = Math.max(0.05, (100 - safeCakeMoisturePct) / 100);
  const sludgeCakeKgDay = sludgeDryKgDay / dryFractionCake;
  const filterPressAreaM2 =
    dewatering.operateHours > 0 && dewatering.plateFluxKgM2h > 0
      ? sludgeDryKgDay / (dewatering.operateHours * dewatering.plateFluxKgM2h)
      : 0;
  const screwPressUnits =
    dewatering.screwFlowRateM3h > 0
      ? Math.max(1, Math.ceil(qSludgePressHour / dewatering.screwFlowRateM3h))
      : 1;

  // --- Computed Values: Khử trùng ---
  // Clo / Javen
  const chlorineKgDay = (hydraulics.qDay * disinfection.chlorineDoseMgL) / 1000;
  const chlorineKgHourMax =
    (hydraulics.qMaxHour * disinfection.chlorineDoseMgL) / 1000;
  const javenDensity = 1.15; // kg/L cho NaOCl ~10%
  const javenKgDay =
    disinfection.javenPct > 0
      ? chlorineKgDay / (disinfection.javenPct / 100)
      : 0;
  const javenLDay = javenKgDay / javenDensity;
  const javenLHourMax =
    disinfection.javenPct > 0
      ? chlorineKgHourMax / (disinfection.javenPct / 100) / javenDensity
      : 0;
  const contactTankVol =
    hydraulics.qMaxHour * (disinfection.contactMinutes / 60);
  const contactTankArea =
    disinfection.tankDepthH > 0 ? contactTankVol / disinfection.tankDepthH : 0;

  // UV
  const uvPowerWattMax =
    hydraulics.qMaxHour * disinfection.uvSpecificWattPerM3h;
  const uvPowerKwMax = uvPowerWattMax / 1000;
  const uvLampCount =
    disinfection.uvLampWatt > 0
      ? Math.max(1, Math.ceil(uvPowerWattMax / disinfection.uvLampWatt))
      : 1;
  const uvEnergyKwhDay =
    (hydraulics.qHour * disinfection.uvSpecificWattPerM3h * 24) / 1000;

  // Ozone
  const ozoneKgDay = (hydraulics.qDay * disinfection.ozoneDoseMgL) / 1000;
  const ozoneGHourMax = hydraulics.qMaxHour * disinfection.ozoneDoseMgL;
  const ozonePowerKw = (ozoneKgDay / 24) * disinfection.ozoneKwhPerKg;

  const handleClarifierShapeChange = (nextShape) => {
    setClarifier((p) => ({ ...p, shape: nextShape }));
    const nextTheo = interpolateTank(clarAreaTheo, clarifier.depthH, nextShape);
    setClarifierOverride(buildRecommendedTank(nextTheo, nextShape));
  };

  const handleThickenerShapeChange = (nextShape) => {
    setThickener((p) => ({ ...p, shape: nextShape }));
    const nextTheo = interpolateTank(thickAreaTheo, thickener.depthH, nextShape);
    setThickenerOverride(buildRecommendedTank(nextTheo, nextShape));
  };

  return (
    <div className="space-y-6">
      {/* Header & Synchronized globalQ */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 text-balance">
            Lắng Thứ Cấp, Xử Lý Bùn & Khử Trùng
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Tính toán hình học bể lắng 2, nén bùn đứng, kiểm tra ngược tải trọng
            máng tràn/bề mặt/HRT và định lượng hóa chất ép bùn, khử trùng.
          </p>
        </div>

        <div className="w-full lg:w-80 rounded-xl bg-slate-800 border border-slate-700/80 p-3.5">
          <label
            htmlFor="sludge-global-q"
            className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5"
          >
            <span>Lưu lượng chung (globalQ)</span>
            <span className="font-mono tabular-nums text-slate-300">
              Qmax = {hydraulics.qMaxHour.toFixed(1)} m³/h
            </span>
          </label>
          <div className="relative flex items-center">
            <input
              id="sludge-global-q"
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
        aria-label="Công trình lắng, bùn và khử trùng"
        className="flex items-center gap-2 overflow-x-auto pb-1"
      >
        {SLUDGE_TABS.map((tab) => {
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

      {/* TAB 1: LẮNG 2 */}
      {activeTab === 'clarifier' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Thông số thiết kế Bể lắng đợt 2 & Hình dạng
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tính theo Qmax,h = {hydraulics.qMaxHour.toFixed(2)} m³/h (chia
                  cho {nClarifiers} bể)
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                F_lt = {clarTheo.area.toFixed(2)} m²/bể
              </span>
            </div>

            <div className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="clar-shape"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Hình dạng bể lắng
                </label>
                <select
                  id="clar-shape"
                  value={clarifier.shape}
                  onChange={(e) => handleClarifierShapeChange(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                >
                  {TANK_SHAPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <NumberInput
                id="clar-num"
                label="Số đơn nguyên bể lắng"
                unit="bể"
                value={clarifier.numTanks}
                min={1}
                max={8}
                step={1}
                onChange={(v) =>
                  setClarifier((p) => ({
                    ...p,
                    numTanks: Math.max(1, Math.round(v)),
                  }))
                }
              />

              <NumberInput
                id="clar-slr"
                label="Tải trọng bề mặt thiết kế (q₀)"
                unit="m³/m²·h"
                value={clarifier.surfaceLoadTarget}
                min={0.4}
                max={2.0}
                step={0.1}
                onChange={(v) =>
                  setClarifier((p) => ({ ...p, surfaceLoadTarget: v }))
                }
              />

              <NumberInput
                id="clar-slr-max"
                label="Giới hạn tải trọng bề mặt tối đa"
                unit="m³/m²·h"
                value={clarifier.surfaceLoadMax}
                min={0.5}
                max={3.0}
                step={0.1}
                onChange={(v) =>
                  setClarifier((p) => ({ ...p, surfaceLoadMax: v }))
                }
              />

              <NumberInput
                id="clar-weir-max"
                label="Giới hạn tải trọng máng tràn"
                unit="m³/m·ng"
                value={clarifier.weirLoadMax}
                min={80}
                max={500}
                step={10}
                onChange={(v) =>
                  setClarifier((p) => ({ ...p, weirLoadMax: v }))
                }
              />

              <NumberInput
                id="clar-hrt-min"
                label="Thời gian lưu tối thiểu (HRT_min)"
                unit="giờ"
                value={clarifier.hrtMin}
                min={1.0}
                max={6.0}
                step={0.5}
                onChange={(v) => setClarifier((p) => ({ ...p, hrtMin: v }))}
              />

              <NumberInput
                id="clar-depth"
                label="Chiều sâu vùng lắng lý thuyết (H)"
                unit="m"
                value={clarifier.depthH}
                min={2.0}
                max={6.0}
                step={0.1}
                onChange={(v) => setClarifier((p) => ({ ...p, depthH: v }))}
              />

              <NumberInput
                id="clar-weir-rings"
                label="Số chu vi máng tràn thu nước"
                unit="vòng"
                value={clarifier.weirRings}
                min={1}
                max={2}
                step={1}
                onChange={(v) =>
                  setClarifier((p) => ({
                    ...p,
                    weirRings: Math.max(1, Math.round(v)),
                  }))
                }
              />
            </div>
          </section>

          {/* Theoretical Interpolated Clarifier */}
          <section className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
              <div className="text-xs text-slate-400">
                Kích thước nội suy lý thuyết ({clarifier.shape})
              </div>
              <div className="mt-2 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
                {clarifier.shape === 'Tròn'
                  ? `Ø ${clarTheo.D.toFixed(2)} × ${clarTheo.H.toFixed(2)} m`
                  : `${clarTheo.a.toFixed(2)} × ${clarTheo.a.toFixed(2)} × ${clarTheo.H.toFixed(2)} m`}
              </div>
              <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                F_lt = {clarTheo.area.toFixed(2)} m² · V_lt ={' '}
                {clarTheo.volume.toFixed(2)} m³
              </div>
            </div>

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
              <div className="text-xs text-slate-400">
                Tải trọng bề mặt thực tế
              </div>
              <div
                className={`mt-2 font-mono text-xl font-semibold tabular-nums ${
                  isClarSlrOk ? 'text-slate-100' : 'text-red-400'
                }`}
              >
                {clarSurfaceLoadActual.toFixed(2)} m³/m²·h
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Chuẩn tối đa ≤ {clarifier.surfaceLoadMax} m³/m²·h
              </div>
            </div>

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
              <div className="text-xs text-slate-400">
                Tải trọng máng tràn thực tế
              </div>
              <div
                className={`mt-2 font-mono text-xl font-semibold tabular-nums ${
                  isClarWeirOk ? 'text-slate-100' : 'text-red-400'
                }`}
              >
                {clarWeirLoadActual.toFixed(1)} m³/m·ng
              </div>
              <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
                L_máng = {clarWeirLen.toFixed(1)} m (≤ {clarifier.weirLoadMax})
              </div>
            </div>
          </section>

          {/* Override & Reverse Check */}
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Chốt kích thước thi công & Kiểm tra ngược Bể lắng 2
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Nhập kích thước chẵn ({clarifier.shape}) để kiểm tra ngược tải
                  trọng bề mặt, máng tràn và HRT.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setClarifierOverride(
                    buildRecommendedTank(clarTheo, clarifier.shape)
                  )
                }
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Làm tròn theo lý thuyết</span>
              </button>
            </div>

            <div className="flex flex-col md:grid md:grid-cols-2 gap-4">
              {clarifier.shape === 'Tròn' ? (
                <NumberInput
                  id="clar-ov-D"
                  label="Đường kính bể chọn (D)"
                  unit="m"
                  value={activeClarOverride.D}
                  min={0}
                  max={100}
                  step={0.1}
                  onChange={(v) =>
                    setClarifierOverride({ ...activeClarOverride, D: v })
                  }
                />
              ) : (
                <NumberInput
                  id="clar-ov-a"
                  label="Cạnh bể vuông chọn (a)"
                  unit="m"
                  value={activeClarOverride.a}
                  min={0}
                  max={100}
                  step={0.1}
                  onChange={(v) =>
                    setClarifierOverride({ ...activeClarOverride, a: v })
                  }
                />
              )}

              <NumberInput
                id="clar-ov-H"
                label="Chiều sâu vùng lắng chọn (H)"
                unit="m"
                value={activeClarOverride.H}
                min={0}
                max={15}
                step={0.1}
                onChange={(v) =>
                  setClarifierOverride({ ...activeClarOverride, H: v })
                }
              />
            </div>

            <ReverseAlertBanner
              ok={isClarAllOk}
              titleOk="ĐẠT CHUẨN BỂ LẮNG ĐỢT 2"
              titleFail="CẢNH BÁO ĐỎ: VƯỢT NGƯỠNG THIẾT KẾ BỂ LẮNG 2"
              summaryLabel="Thể tích · HRT thực"
              message={
                isClarAllOk
                  ? `Tải trọng bề mặt (${clarSurfaceLoadActual.toFixed(2)} m³/m²·h), máng tràn (${clarWeirLoadActual.toFixed(1)} m³/m·ng) và HRT (${clarHrtActual.toFixed(2)}h) đều đạt chuẩn.`
                  : `${!isClarSlrOk ? `Vượt tải trọng bề mặt (${clarSurfaceLoadActual.toFixed(2)} > ${clarifier.surfaceLoadMax} m³/m²·h). ` : ''}${!isClarWeirOk ? `Vượt tải trọng máng tràn (${clarWeirLoadActual.toFixed(1)} > ${clarifier.weirLoadMax} m³/m·ng). ` : ''}${!isClarHrtOk ? `Thiếu thời gian lưu (${clarHrtActual.toFixed(2)} < ${clarifier.hrtMin} giờ).` : ''}`
              }
              summaryRight={`${clarActual.volume.toFixed(1)} m³ · ${clarHrtActual.toFixed(2)} h`}
            />

            <ReverseCheckTable
              rows={[
                {
                  name: 'Tải trọng bề mặt tại Qmax (q₀)',
                  standard: `≤ ${clarifier.surfaceLoadMax.toFixed(2)} m³/m²·h`,
                  actual: `${clarSurfaceLoadActual.toFixed(2)} m³/m²·h`,
                  ok: isClarSlrOk,
                  statusText: isClarSlrOk ? 'Đạt chuẩn' : 'Vượt tải trọng',
                },
                {
                  name: 'Tải trọng máng tràn (q_weir)',
                  standard: `≤ ${clarifier.weirLoadMax.toFixed(0)} m³/m·ngày`,
                  actual: `${clarWeirLoadActual.toFixed(1)} m³/m·ngày`,
                  ok: isClarWeirOk,
                  statusText: isClarWeirOk ? 'Đạt chuẩn' : 'Vượt tải máng tràn',
                },
                {
                  name: 'Thời gian lưu thủy lực (HRT)',
                  standard: `≥ ${clarifier.hrtMin.toFixed(2)} giờ`,
                  actual: `${clarHrtActual.toFixed(2)} giờ`,
                  ok: isClarHrtOk,
                  statusText: isClarHrtOk ? 'Đạt chuẩn' : 'Thiếu thời gian lưu',
                },
                {
                  name: 'Thể tích vùng lắng thực tế (1 bể)',
                  standard: `≥ ${clarTheo.volume.toFixed(1)} m³`,
                  actual: `${clarActual.volume.toFixed(1)} m³`,
                  ok: clarActual.volume >= clarTheo.volume,
                  statusText:
                    clarActual.volume >= clarTheo.volume
                      ? 'Đủ thể tích'
                      : 'Nhỏ hơn lý thuyết',
                },
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 2: NÉN BÙN ĐỨNG */}
      {activeTab === 'thickener' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Thông số Bể nén bùn trọng lực & Hình dạng
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lưu lượng bùn dư = {qSludgeDay.toFixed(1)} m³/ngày ({sludgeDryKgDay.toFixed(1)}{' '}
                  kg SS/ngày) → Sau nén: {qThickenedDay.toFixed(1)} m³/ngày
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                F_lt = {thickTheo.area.toFixed(2)} m²
              </span>
            </div>

            <div className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="thick-shape"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Hình dạng bể nén bùn
                </label>
                <select
                  id="thick-shape"
                  value={thickener.shape}
                  onChange={(e) => handleThickenerShapeChange(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                >
                  {TANK_SHAPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <NumberInput
                id="thick-pct"
                label="Tỷ lệ lưu lượng bùn dư / Q"
                unit="% Q"
                value={thickener.sludgeFlowPct}
                min={0.5}
                max={10}
                step={0.1}
                onChange={(v) =>
                  setThickener((p) => ({ ...p, sludgeFlowPct: v }))
                }
              />

              <NumberInput
                id="thick-ss-in"
                label="Nồng độ bùn đầu vào"
                unit="mg/L"
                value={thickener.ssInMgL}
                min={2000}
                max={20000}
                step={500}
                onChange={(v) => setThickener((p) => ({ ...p, ssInMgL: v }))}
              />

              <NumberInput
                id="thick-ss-out"
                label="Nồng độ bùn sau nén mục tiêu"
                unit="mg/L"
                value={thickener.ssOutMgL}
                min={15000}
                max={60000}
                step={1000}
                onChange={(v) => setThickener((p) => ({ ...p, ssOutMgL: v }))}
              />

              <NumberInput
                id="thick-slr-max"
                label="Tải trọng chất rắn tối đa (SLR)"
                unit="kg/m²·ng"
                value={thickener.slrMax}
                min={15}
                max={80}
                step={1}
                onChange={(v) => setThickener((p) => ({ ...p, slrMax: v }))}
              />

              <NumberInput
                id="thick-hlr-max"
                label="Tải trọng thủy lực tối đa (HLR)"
                unit="m³/m²·ng"
                value={thickener.hlrMax}
                min={5}
                max={30}
                step={1}
                onChange={(v) => setThickener((p) => ({ ...p, hlrMax: v }))}
              />

              <NumberInput
                id="thick-weir-max"
                label="Giới hạn tải trọng máng tràn"
                unit="m³/m·ng"
                value={thickener.weirLoadMax}
                min={40}
                max={300}
                step={10}
                onChange={(v) =>
                  setThickener((p) => ({ ...p, weirLoadMax: v }))
                }
              />

              <NumberInput
                id="thick-hrt-min"
                label="Thời gian lưu bùn tối thiểu"
                unit="giờ"
                value={thickener.hrtMin}
                min={4}
                max={24}
                step={1}
                onChange={(v) => setThickener((p) => ({ ...p, hrtMin: v }))}
              />

              <NumberInput
                id="thick-depth"
                label="Chiều cao vùng nén lý thuyết (H)"
                unit="m"
                value={thickener.depthH}
                min={2.5}
                max={6.0}
                step={0.1}
                onChange={(v) => setThickener((p) => ({ ...p, depthH: v }))}
              />
            </div>
          </section>

          <section className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
              <div className="text-xs text-slate-400">
                Kích thước nội suy lý thuyết ({thickener.shape})
              </div>
              <div className="mt-2 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
                {thickener.shape === 'Tròn'
                  ? `Ø ${thickTheo.D.toFixed(2)} × ${thickTheo.H.toFixed(2)} m`
                  : `${thickTheo.a.toFixed(2)} × ${thickTheo.a.toFixed(2)} × ${thickTheo.H.toFixed(2)} m`}
              </div>
              <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                F_lt = {thickTheo.area.toFixed(2)} m² · V_lt ={' '}
                {thickTheo.volume.toFixed(2)} m³
              </div>
            </div>

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
              <div className="text-xs text-slate-400">
                Tải trọng chất rắn thực (SLR)
              </div>
              <div
                className={`mt-2 font-mono text-xl font-semibold tabular-nums ${
                  isThickSlrOk ? 'text-slate-100' : 'text-red-400'
                }`}
              >
                {thickSlrActual.toFixed(1)} kg/m²·ng
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Giới hạn chuẩn ≤ {thickener.slrMax} kg/m²·ng
              </div>
            </div>

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
              <div className="text-xs text-slate-400">
                Lưu lượng bùn đặc sau nén
              </div>
              <div className="mt-2 font-mono text-xl font-semibold text-slate-100 tabular-nums">
                {qThickenedDay.toFixed(2)} m³/ngày
              </div>
              <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
                Nước tách: {qSupernatantDay.toFixed(2)} m³/ngày
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Chốt kích thước thi công & Kiểm tra ngược Nén bùn đứng
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kiểm tra lại tải trọng bề mặt thủy lực, tải trọng chất rắn,
                  máng tràn và HRT thực tế.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setThickenerOverride(
                    buildRecommendedTank(thickTheo, thickener.shape)
                  )
                }
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Làm tròn theo lý thuyết</span>
              </button>
            </div>

            <div className="flex flex-col md:grid md:grid-cols-2 gap-4">
              {thickener.shape === 'Tròn' ? (
                <NumberInput
                  id="thick-ov-D"
                  label="Đường kính bể chọn (D)"
                  unit="m"
                  value={activeThickOverride.D}
                  min={0}
                  max={50}
                  step={0.1}
                  onChange={(v) =>
                    setThickenerOverride({ ...activeThickOverride, D: v })
                  }
                />
              ) : (
                <NumberInput
                  id="thick-ov-a"
                  label="Cạnh bể vuông chọn (a)"
                  unit="m"
                  value={activeThickOverride.a}
                  min={0}
                  max={50}
                  step={0.1}
                  onChange={(v) =>
                    setThickenerOverride({ ...activeThickOverride, a: v })
                  }
                />
              )}
              <NumberInput
                id="thick-ov-H"
                label="Chiều cao vùng nén chọn (H)"
                unit="m"
                value={activeThickOverride.H}
                min={0}
                max={12}
                step={0.1}
                onChange={(v) =>
                  setThickenerOverride({ ...activeThickOverride, H: v })
                }
              />
            </div>

            <ReverseAlertBanner
              ok={isThickAllOk}
              titleOk="ĐẠT CHUẨN BỂ NÉN BÙN ĐỨNG"
              titleFail="CẢNH BÁO ĐỎ: VƯỢT NGƯỠNG BỂ NÉN BÙN"
              summaryLabel="Thể tích · HRT thực"
              message={
                isThickAllOk
                  ? `SLR thực (${thickSlrActual.toFixed(1)} kg/m²·ng), HLR (${thickHlrActual.toFixed(1)} m³/m²·ng), máng tràn (${thickWeirLoadActual.toFixed(1)} m³/m·ng) và HRT (${thickHrtActual.toFixed(1)}h) đạt yêu cầu.`
                  : `${!isThickSlrOk ? `Vượt tải chất rắn (${thickSlrActual.toFixed(1)} > ${thickener.slrMax} kg/m²·ng). ` : ''}${!isThickHlrOk ? `Vượt tải thủy lực (${thickHlrActual.toFixed(1)} > ${thickener.hlrMax} m³/m²·ng). ` : ''}${!isThickWeirOk ? `Vượt tải máng tràn (${thickWeirLoadActual.toFixed(1)} > ${thickener.weirLoadMax} m³/m·ng). ` : ''}${!isThickHrtOk ? `Thiếu HRT (${thickHrtActual.toFixed(1)} < ${thickener.hrtMin} giờ).` : ''}`
              }
              summaryRight={`${thickActual.volume.toFixed(1)} m³ · ${thickHrtActual.toFixed(1)} h`}
            />

            <ReverseCheckTable
              rows={[
                {
                  name: 'Tải trọng chất rắn bề mặt (SLR)',
                  standard: `≤ ${thickener.slrMax} kg/m²·ngày`,
                  actual: `${thickSlrActual.toFixed(1)} kg/m²·ngày`,
                  ok: isThickSlrOk,
                  statusText: isThickSlrOk ? 'Đạt chuẩn' : 'Vượt tải chất rắn',
                },
                {
                  name: 'Tải trọng thủy lực bề mặt (HLR)',
                  standard: `≤ ${thickener.hlrMax} m³/m²·ngày`,
                  actual: `${thickHlrActual.toFixed(1)} m³/m²·ngày`,
                  ok: isThickHlrOk,
                  statusText: isThickHlrOk ? 'Đạt chuẩn' : 'Vượt tải thủy lực',
                },
                {
                  name: 'Tải trọng máng tràn nước tách',
                  standard: `≤ ${thickener.weirLoadMax} m³/m·ngày`,
                  actual: `${thickWeirLoadActual.toFixed(1)} m³/m·ngày`,
                  ok: isThickWeirOk,
                  statusText: isThickWeirOk ? 'Đạt chuẩn' : 'Vượt tải máng tràn',
                },
                {
                  name: 'Thời gian lưu bùn (HRT)',
                  standard: `≥ ${thickener.hrtMin} giờ`,
                  actual: `${thickHrtActual.toFixed(1)} giờ`,
                  ok: isThickHrtOk,
                  statusText: isThickHrtOk ? 'Đạt chuẩn' : 'Thiếu thời gian lưu',
                },
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 3: MÁY ÉP BÙN KHUNG BẢN / TRỤC VÍT */}
      {activeTab === 'dewatering' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  Máy ép bùn Khung bản / Trục vít & Định lượng Polymer
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tính toán theo lượng bùn sau nén từ Q ={' '}
                  {hydraulics.qDay.toLocaleString('vi-VN')} m³/ngày (
                  {sludgeDryKgDay.toFixed(1)} kg chất khô DS/ngày)
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                Q_bùn ép = {qSludgePressHour.toFixed(2)} m³/giờ
              </span>
            </div>

            <div className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="dew-type"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Loại máy ép bùn
                </label>
                <select
                  id="dew-type"
                  value={dewatering.machineType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setDewatering((p) => ({
                      ...p,
                      machineType: nextType,
                      cakeMoisturePct: nextType === 'Khung bản' ? 75 : 80,
                      polymerDoseKgTon: nextType === 'Khung bản' ? 4.0 : 6.0,
                    }));
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="Khung bản">Máy ép bùn Khung bản</option>
                  <option value="Trục vít">Máy ép bùn Trục vít đa đĩa</option>
                </select>
              </div>

              <NumberInput
                id="dew-hours"
                label="Thời gian chạy máy ép / ngày"
                unit="giờ/ng"
                value={dewatering.operateHours}
                min={1}
                max={24}
                step={1}
                onChange={(v) =>
                  setDewatering((p) => ({ ...p, operateHours: v }))
                }
              />

              <NumberInput
                id="dew-moisture"
                label="Độ ẩm bánh bùn sau ép"
                unit="%"
                value={dewatering.cakeMoisturePct}
                min={60}
                max={88}
                step={1}
                onChange={(v) =>
                  setDewatering((p) => ({ ...p, cakeMoisturePct: v }))
                }
              />

              <NumberInput
                id="dew-poly-dose"
                label="Liều lượng Polymer (PAM)"
                unit="kg/tấn DS"
                value={dewatering.polymerDoseKgTon}
                min={1}
                max={15}
                step={0.5}
                onChange={(v) =>
                  setDewatering((p) => ({ ...p, polymerDoseKgTon: v }))
                }
              />

              <NumberInput
                id="dew-poly-conc"
                label="Nồng độ dung dịch Polymer pha"
                unit="%"
                value={dewatering.polymerConcPct}
                min={0.05}
                max={0.5}
                step={0.05}
                onChange={(v) =>
                  setDewatering((p) => ({ ...p, polymerConcPct: v }))
                }
              />

              {dewatering.machineType === 'Khung bản' ? (
                <NumberInput
                  id="dew-plate-flux"
                  label="Năng suất lọc bản ép"
                  unit="kg DS/m²·h"
                  value={dewatering.plateFluxKgM2h}
                  min={4}
                  max={25}
                  step={1}
                  onChange={(v) =>
                    setDewatering((p) => ({ ...p, plateFluxKgM2h: v }))
                  }
                />
              ) : (
                <NumberInput
                  id="dew-screw-cap"
                  label="Công suất 1 máy trục vít"
                  unit="m³/giờ"
                  value={dewatering.screwFlowRateM3h}
                  min={1}
                  max={30}
                  step={0.5}
                  onChange={(v) =>
                    setDewatering((p) => ({ ...p, screwFlowRateM3h: v }))
                  }
                />
              )}
            </div>
          </section>

          <section className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
              <div className="text-xs text-slate-400">
                Lượng Polymer nguyên chất cần thiết
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
                {polymerPureKgDay.toFixed(2)} kg/ngày
              </div>
              <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                {polymerPureGHour.toFixed(1)} g/giờ trong ca chạy máy
              </div>
            </div>

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
              <div className="text-xs text-slate-400">
                Lưu lượng dung dịch Polymer {dewatering.polymerConcPct}%
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
                {polymerSolutionLHour.toFixed(1)} L/giờ
              </div>
              <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                Tổng {polymerSolutionLDay.toFixed(0)} L/ngày
              </div>
            </div>

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
              <div className="text-xs text-slate-400">
                {dewatering.machineType === 'Khung bản'
                  ? 'Diện tích bản lọc cần thiết'
                  : 'Số lượng máy ép trục vít'}
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
                {dewatering.machineType === 'Khung bản'
                  ? `${filterPressAreaM2.toFixed(1)} m²`
                  : `${screwPressUnits} máy`}
              </div>
              <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                Bánh bùn sau ép: {sludgeCakeKgDay.toFixed(1)} kg/ngày (ẩm{' '}
                {dewatering.cakeMoisturePct}%)
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: KHỬ TRÙNG (CLO/JAVEN, UV, OZONE) */}
      {activeTab === 'disinfection' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  Tính toán Khử trùng Nước thải đầu ra
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tính lượng Clo/Javen hoặc công suất thiết bị UV/Ozone theo
                  lưu lượng Q thực tế ({hydraulics.qDay.toLocaleString('vi-VN')}{' '}
                  m³/ngày · Qmax = {hydraulics.qMaxHour.toFixed(2)} m³/h)
                </p>
              </div>
            </div>

            <div className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="dis-method"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Phương pháp khử trùng
                </label>
                <select
                  id="dis-method"
                  value={disinfection.method}
                  onChange={(e) =>
                    setDisinfection((p) => ({ ...p, method: e.target.value }))
                  }
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="Clo / Javen">Clo khí / Nước Javen (NaOCl)</option>
                  <option value="UV">Đèn tia cực tím (UV)</option>
                  <option value="Ozone">Khí Ozone (O₃)</option>
                </select>
              </div>

              {disinfection.method === 'Clo / Javen' && (
                <>
                  <NumberInput
                    id="dis-cl-dose"
                    label="Liều lượng Clo hoạt tính"
                    unit="mg/L"
                    value={disinfection.chlorineDoseMgL}
                    min={1}
                    max={30}
                    step={0.5}
                    onChange={(v) =>
                      setDisinfection((p) => ({ ...p, chlorineDoseMgL: v }))
                    }
                  />
                  <NumberInput
                    id="dis-javen-pct"
                    label="Nồng độ Javen thương phẩm"
                    unit="% NaOCl"
                    value={disinfection.javenPct}
                    min={5}
                    max={15}
                    step={1}
                    onChange={(v) =>
                      setDisinfection((p) => ({ ...p, javenPct: v }))
                    }
                  />
                  <NumberInput
                    id="dis-contact-min"
                    label="Thời gian tiếp xúc (t)"
                    unit="phút"
                    value={disinfection.contactMinutes}
                    min={15}
                    max={60}
                    step={5}
                    onChange={(v) =>
                      setDisinfection((p) => ({ ...p, contactMinutes: v }))
                    }
                  />
                  <NumberInput
                    id="dis-tank-h"
                    label="Chiều sâu bể tiếp xúc (H)"
                    unit="m"
                    value={disinfection.tankDepthH}
                    min={1.5}
                    max={4.5}
                    step={0.1}
                    onChange={(v) =>
                      setDisinfection((p) => ({ ...p, tankDepthH: v }))
                    }
                  />
                </>
              )}

              {disinfection.method === 'UV' && (
                <>
                  <NumberInput
                    id="dis-uv-dose"
                    label="Liều bức xạ UV thiết kế"
                    unit="mJ/cm²"
                    value={disinfection.uvDoseMjCm2}
                    min={20}
                    max={100}
                    step={5}
                    onChange={(v) =>
                      setDisinfection((p) => ({ ...p, uvDoseMjCm2: v }))
                    }
                  />
                  <NumberInput
                    id="dis-uv-spec"
                    label="Suất công suất đèn UV"
                    unit="W/(m³/h)"
                    value={disinfection.uvSpecificWattPerM3h}
                    min={10}
                    max={80}
                    step={1}
                    onChange={(v) =>
                      setDisinfection((p) => ({
                        ...p,
                        uvSpecificWattPerM3h: v,
                      }))
                    }
                  />
                  <NumberInput
                    id="dis-uv-lamp"
                    label="Công suất 1 bóng đèn UV"
                    unit="W/bóng"
                    value={disinfection.uvLampWatt}
                    min={40}
                    max={500}
                    step={10}
                    onChange={(v) =>
                      setDisinfection((p) => ({ ...p, uvLampWatt: v }))
                    }
                  />
                </>
              )}

              {disinfection.method === 'Ozone' && (
                <>
                  <NumberInput
                    id="dis-o3-dose"
                    label="Liều lượng Ozone (O₃)"
                    unit="mg/L"
                    value={disinfection.ozoneDoseMgL}
                    min={1}
                    max={25}
                    step={0.5}
                    onChange={(v) =>
                      setDisinfection((p) => ({ ...p, ozoneDoseMgL: v }))
                    }
                  />
                  <NumberInput
                    id="dis-o3-kwh"
                    label="Suất tiêu hao điện tạo O₃"
                    unit="kWh/kg"
                    value={disinfection.ozoneKwhPerKg}
                    min={8}
                    max={25}
                    step={1}
                    onChange={(v) =>
                      setDisinfection((p) => ({ ...p, ozoneKwhPerKg: v }))
                    }
                  />
                </>
              )}
            </div>
          </section>

          {/* Disinfection Results */}
          <section className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {disinfection.method === 'Clo / Javen' && (
              <>
                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
                  <div className="text-xs text-slate-400">
                    Lượng Clo hoạt tính tiêu thụ
                  </div>
                  <div className="mt-2 font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
                    {chlorineKgDay.toFixed(2)} kg/ngày
                  </div>
                  <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                    Cực đại: {chlorineKgHourMax.toFixed(3)} kg/giờ
                  </div>
                </div>

                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
                  <div className="text-xs text-slate-400">
                    Lưu lượng Javen {disinfection.javenPct}% cần châm
                  </div>
                  <div className="mt-2 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
                    {javenLDay.toFixed(1)} L/ngày
                  </div>
                  <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                    Bơm định lượng max: {javenLHourMax.toFixed(2)} L/giờ
                  </div>
                </div>

                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
                  <div className="text-xs text-slate-400">
                    Thể tích bể tiếp xúc khử trùng
                  </div>
                  <div className="mt-2 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
                    {contactTankVol.toFixed(1)} m³
                  </div>
                  <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                    F = {contactTankArea.toFixed(1)} m² · H ={' '}
                    {disinfection.tankDepthH} m
                  </div>
                </div>
              </>
            )}

            {disinfection.method === 'UV' && (
              <>
                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
                  <div className="text-xs text-slate-400">
                    Công suất hệ thống UV (theo Qmax)
                  </div>
                  <div className="mt-2 font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
                    {uvPowerKwMax.toFixed(2)} kW
                  </div>
                  <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                    {uvPowerWattMax.toFixed(0)} W · Liều {disinfection.uvDoseMjCm2}{' '}
                    mJ/cm²
                  </div>
                </div>

                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
                  <div className="text-xs text-slate-400">
                    Số lượng bóng đèn UV dự kiến
                  </div>
                  <div className="mt-2 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
                    {uvLampCount} bóng
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Công suất {disinfection.uvLampWatt} W/bóng
                  </div>
                </div>

                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
                  <div className="text-xs text-slate-400">
                    Điện năng tiêu thụ trung bình
                  </div>
                  <div className="mt-2 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
                    {uvEnergyKwhDay.toFixed(1)} kWh/ngày
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Vận hành liên tục 24 giờ/ngày
                  </div>
                </div>
              </>
            )}

            {disinfection.method === 'Ozone' && (
              <>
                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
                  <div className="text-xs text-slate-400">
                    Công suất máy phát Ozone (theo Qmax)
                  </div>
                  <div className="mt-2 font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
                    {ozoneGHourMax.toFixed(1)} g O₃/giờ
                  </div>
                  <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                    Liều lượng {disinfection.ozoneDoseMgL} mg/L
                  </div>
                </div>

                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
                  <div className="text-xs text-slate-400">
                    Tổng lượng Ozone tiêu thụ/ngày
                  </div>
                  <div className="mt-2 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
                    {ozoneKgDay.toFixed(2)} kg O₃/ngày
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Theo Qtb = {hydraulics.qDay.toLocaleString('vi-VN')} m³/ngày
                  </div>
                </div>

                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
                  <div className="text-xs text-slate-400">
                    Công suất điện máy tạo Ozone
                  </div>
                  <div className="mt-2 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
                    {ozonePowerKw.toFixed(2)} kW
                  </div>
                  <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                    {(ozonePowerKw * 24).toFixed(1)} kWh/ngày
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
