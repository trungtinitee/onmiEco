import { useState } from 'react';
import { Cog, Layers, RotateCcw, Sun } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  CheckTable as ReverseCheckTable,
  DecimalInput,
  NumberField as NumberInput,
  StatusBanner as ReverseAlertBanner,
  roundUpToStep,
} from '../components/CalcPrimitives';
import EquipmentSelector from '../components/EquipmentSelector';

const SLUDGE_EQUIPMENT_LABELS = {
  thickener: 'Bể Nén bùn đứng',
  dewatering: 'Hệ thống Máy ép bùn',
  drying_bed: 'Sân phơi bùn',
};

const SLUDGE_TABS = [
  { id: 'thickener', label: 'Nén bùn đứng', icon: Layers },
  { id: 'dewatering', label: 'Máy ép bùn', icon: Cog },
  { id: 'drying_bed', label: 'Sân phơi bùn', icon: Sun },
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
  const [activeTab, setActiveTab] = useState('thickener');

  // --- Tab 1: Nén bùn đứng ---
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

  // --- Tab 2: Máy ép bùn Khung bản / Trục vít ---
  const [dewatering, setDewatering] = useState({
    machineType: 'Khung bản',
    operateHours: 8, // giờ/ngày
    cakeMoisturePct: 75, // % độ ẩm bùn bánh
    polymerDoseKgTon: 4.0, // kg/tấn DS
    polymerConcPct: 0.1, // % dung dịch pha
    plateFluxKgM2h: 12, // kg DS / m2.h (Khung bản)
    screwFlowRateM3h: 5, // m3 / h mỗi máy (Trục vít)
  });

  // --- Tab 3: Sân phơi bùn ---
  const [dryingBed, setDryingBed] = useState({
    numBeds: 4, // số ô sân phơi
    solidsLoadingYear: 100, // kg DS / m2.năm (chuẩn 80 - 150)
    sludgeDepthM: 0.25, // chiều cao lớp bùn đổ 1 mẻ (m)
    cycleDays: 15, // thời gian phơi khô 1 mẻ (ngày)
    bedWidthM: null,
    bedLengthM: null,
  });

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

  // --- Computed Values: Sân phơi bùn ---
  const annualDrySolidsKg = sludgeDryKgDay * 365;
  const dryingAreaFromLoading =
    dryingBed.solidsLoadingYear > 0
      ? annualDrySolidsKg / dryingBed.solidsLoadingYear
      : 0;
  const dryingAreaFromCycle =
    dryingBed.sludgeDepthM > 0
      ? (qThickenedDay * dryingBed.cycleDays) / dryingBed.sludgeDepthM
      : 0;
  const dryingAreaTheoTotal = Math.max(
    dryingAreaFromLoading,
    dryingAreaFromCycle
  );
  const nBeds = Math.max(1, Number(dryingBed.numBeds) || 1);
  const dryingAreaPerBedTheo = dryingAreaTheoTotal / nBeds;
  const bedWidthTheo = Math.sqrt(dryingAreaPerBedTheo / 2);
  const bedLengthTheo = bedWidthTheo * 2;
  const recommendedBedW = roundUpToStep(bedWidthTheo, 0.5);
  const recommendedBedL = roundUpToStep(bedLengthTheo, 0.5);

  const activeBedW =
    dryingBed.bedWidthM !== null
      ? Math.max(0, Number(dryingBed.bedWidthM) || 0)
      : recommendedBedW;
  const activeBedL =
    dryingBed.bedLengthM !== null
      ? Math.max(0, Number(dryingBed.bedLengthM) || 0)
      : recommendedBedL;
  const dryingAreaPerBedActual = activeBedW * activeBedL;
  const dryingAreaTotalActual = dryingAreaPerBedActual * nBeds;
  const actualSolidsLoadingYear =
    dryingAreaTotalActual > 0 ? annualDrySolidsKg / dryingAreaTotalActual : 0;
  const actualSludgeDepthM =
    dryingAreaTotalActual > 0
      ? (qThickenedDay * dryingBed.cycleDays) / dryingAreaTotalActual
      : 0;

  const isDryingAreaOk =
    hydraulics.qDay > 0 && dryingAreaTotalActual >= dryingAreaTheoTotal;
  const isDryingLoadOk =
    hydraulics.qDay > 0 &&
    actualSolidsLoadingYear <= dryingBed.solidsLoadingYear;
  const isDryingDepthOk =
    hydraulics.qDay > 0 && actualSludgeDepthM <= dryingBed.sludgeDepthM;
  const isDryingAllOk = isDryingAreaOk && isDryingLoadOk && isDryingDepthOk;

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
            Quản Lý &amp; Xử Lý Bùn Cặn (Tuyến Bùn)
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Tính toán tuyến xử lý bùn: bể nén bùn đứng trọng lực, máy ép bùn
            (khung bản / trục vít), định lượng Polymer và sân phơi bùn.
          </p>
        </div>

        <div className="w-full lg:w-80 rounded-xl bg-slate-800 border border-slate-700/80 p-3.5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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
            <DecimalInput
              id="sludge-global-q"
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

      {/* 3 Tabs */}
      <div
        role="tablist"
        aria-label="Công trình quản lý bùn cặn"
        className="print:hidden flex items-center gap-2 overflow-x-auto pb-1"
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

      {/* TAB 2: NÉN BÙN ĐỨNG */}
      {activeTab === 'thickener' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
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
            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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

          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
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
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
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
            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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

      {/* TAB 3: SÂN PHƠI BÙN */}
      {activeTab === 'drying_bed' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Thông số thiết kế Sân phơi bùn (Sludge Drying Bed)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tính theo lượng chất rắn khô ({sludgeDryKgDay.toFixed(1)} kg
                  DS/ngày) và lưu lượng bùn sau nén ({qThickenedDay.toFixed(2)}{' '}
                  m³/ngày)
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                F_lt tổng = {dryingAreaTheoTotal.toFixed(1)} m² ({nBeds} ô)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <NumberInput
                id="dry-num-beds"
                label="Số ô sân phơi bùn bố trí"
                unit="ô"
                value={dryingBed.numBeds}
                min={2}
                max={24}
                step={1}
                onChange={(v) =>
                  setDryingBed((p) => ({
                    ...p,
                    numBeds: Math.max(1, Math.round(v)),
                  }))
                }
              />

              <NumberInput
                id="dry-solids-load"
                label="Tải trọng chất rắn khô (L_s)"
                unit="kg DS/m²·năm"
                value={dryingBed.solidsLoadingYear}
                min={50}
                max={250}
                step={10}
                onChange={(v) =>
                  setDryingBed((p) => ({ ...p, solidsLoadingYear: v }))
                }
              />

              <NumberInput
                id="dry-depth"
                label="Chiều cao lớp bùn đổ 1 mẻ (h_đổ)"
                unit="m"
                value={dryingBed.sludgeDepthM}
                min={0.15}
                max={0.45}
                step={0.05}
                onChange={(v) =>
                  setDryingBed((p) => ({ ...p, sludgeDepthM: v }))
                }
              />

              <NumberInput
                id="dry-cycle"
                label="Chu kỳ làm khô bùn (T_mẻ)"
                unit="ngày/mẻ"
                value={dryingBed.cycleDays}
                min={7}
                max={30}
                step={1}
                onChange={(v) => setDryingBed((p) => ({ ...p, cycleDays: v }))}
              />
            </div>

            <div className="pt-3 border-t border-slate-700/70 text-xs font-mono text-slate-400">
              F_tải = ({sludgeDryKgDay.toFixed(1)} × 365) /{' '}
              {dryingBed.solidsLoadingYear} = {dryingAreaFromLoading.toFixed(1)}{' '}
              m² · F_chu kỳ = ({qThickenedDay.toFixed(2)} × {dryingBed.cycleDays}
              ) / {dryingBed.sludgeDepthM} = {dryingAreaFromCycle.toFixed(1)} m²
            </div>
          </section>

          {/* Theoretical Drying Bed KPIs */}
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
              <div className="text-xs text-slate-400">
                Tổng diện tích sân phơi lý thuyết
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
                {dryingAreaTheoTotal.toFixed(1)} m²
              </div>
              <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                Mỗi ô: {dryingAreaPerBedTheo.toFixed(1)} m² ({bedLengthTheo.toFixed(1)} ×{' '}
                {bedWidthTheo.toFixed(1)} m)
              </div>
            </div>

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
              <div className="text-xs text-slate-400">
                Tổng lượng bùn khô phát sinh/năm
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
                {(annualDrySolidsKg / 1000).toFixed(1)} tấn DS/năm
              </div>
              <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                {sludgeDryKgDay.toFixed(1)} kg DS/ngày · {qThickenedDay.toFixed(2)}{' '}
                m³ bùn nén/ng
              </div>
            </div>

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
              <div className="text-xs text-slate-400">
                Thể tích bùn nạp trong 1 chu kỳ ({dryingBed.cycleDays} ngày)
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
                {(qThickenedDay * dryingBed.cycleDays).toFixed(1)} m³/mẻ
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Bề dày lớp bùn thực tế: {actualSludgeDepthM.toFixed(2)} m
              </div>
            </div>
          </section>

          {/* Override & Reverse Check */}
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Chốt kích thước 1 ô sân phơi &amp; Kiểm tra ngược
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Nhập kích thước chẵn cho mỗi ô (tổng {nBeds} ô) để kiểm tra
                  ngược tải trọng chất rắn và chiều cao đổ bùn thực tế.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDryingBed((p) => ({
                    ...p,
                    bedLengthM: recommendedBedL,
                    bedWidthM: recommendedBedW,
                  }))
                }
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Làm tròn theo lý thuyết</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberInput
                id="dry-ov-L"
                label="Chiều dài 1 ô sân phơi (L)"
                unit="m"
                value={activeBedL}
                min={1}
                max={50}
                step={0.5}
                onChange={(v) => setDryingBed((p) => ({ ...p, bedLengthM: v }))}
              />
              <NumberInput
                id="dry-ov-W"
                label="Chiều rộng 1 ô sân phơi (W)"
                unit="m"
                value={activeBedW}
                min={1}
                max={30}
                step={0.5}
                onChange={(v) => setDryingBed((p) => ({ ...p, bedWidthM: v }))}
              />
            </div>

            <ReverseAlertBanner
              ok={isDryingAllOk}
              titleOk="ĐẠT CHUẨN DIỆN TÍCH & TẢI TRỌNG SÂN PHƠI BÙN"
              titleFail="CẢNH BÁO ĐỎ: SÂN PHƠI BÙN KHÔNG ĐỦ DIỆN TÍCH"
              summaryLabel="Tổng F_thực · h_đổ thực"
              message={
                isDryingAllOk
                  ? `Tổng diện tích ${nBeds} ô (${dryingAreaTotalActual.toFixed(1)} m²) ≥ yêu cầu (${dryingAreaTheoTotal.toFixed(1)} m²), chiều cao đổ bùn thực tế (${actualSludgeDepthM.toFixed(2)} m) đạt chuẩn.`
                  : `${!isDryingAreaOk ? `Tổng diện tích (${dryingAreaTotalActual.toFixed(1)} m²) < yêu cầu (${dryingAreaTheoTotal.toFixed(1)} m²). ` : ''}${!isDryingLoadOk ? `Vượt tải trọng chất rắn (${actualSolidsLoadingYear.toFixed(1)} > ${dryingBed.solidsLoadingYear} kg DS/m²·năm). ` : ''}${!isDryingDepthOk ? `Chiều dày lớp bùn (${actualSludgeDepthM.toFixed(2)} m) vượt mức cho phép (${dryingBed.sludgeDepthM} m).` : ''}`
              }
              summaryRight={`${dryingAreaTotalActual.toFixed(1)} m² · ${actualSludgeDepthM.toFixed(2)} m`}
            />

            <ReverseCheckTable
              rows={[
                {
                  name: `Tổng diện tích sân phơi (${nBeds} ô)`,
                  standard: `≥ ${dryingAreaTheoTotal.toFixed(1)} m²`,
                  actual: `${dryingAreaTotalActual.toFixed(1)} m²`,
                  ok: isDryingAreaOk,
                  statusText: isDryingAreaOk ? 'Đạt chuẩn' : 'Thiếu diện tích',
                },
                {
                  name: 'Tải trọng chất rắn khô (L_s)',
                  standard: `≤ ${dryingBed.solidsLoadingYear.toFixed(0)} kg DS/m²·năm`,
                  actual: `${actualSolidsLoadingYear.toFixed(1)} kg DS/m²·năm`,
                  ok: isDryingLoadOk,
                  statusText: isDryingLoadOk ? 'Đạt chuẩn' : 'Vượt tải trọng',
                },
                {
                  name: 'Chiều dày lớp bùn 1 chu kỳ (h_đổ)',
                  standard: `≤ ${dryingBed.sludgeDepthM.toFixed(2)} m`,
                  actual: `${actualSludgeDepthM.toFixed(2)} m`,
                  ok: isDryingDepthOk,
                  statusText: isDryingDepthOk ? 'Đạt chiều dày' : 'Quá dày',
                },
              ]}
            />
          </section>
        </div>
      )}

      <EquipmentSelector
        key={`omnieco_equipments_wastewatersludge_${activeTab}`}
        moduleLabel={
          SLUDGE_EQUIPMENT_LABELS[activeTab] || 'Công trình Xử lý Bùn'
        }
        storageKey={`omnieco_equipments_wastewatersludge_${activeTab}`}
      />
    </div>
  );
}
