import { useState } from 'react';
import { Droplets, Filter, RotateCcw, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  DecimalInput,
  NumberField,
  StatusBanner,
  ViewModeToggle,
  roundUpToStep,
} from '../components/CalcPrimitives';
import EquipmentSelector from '../components/EquipmentSelector';

const TERTIARY_EQUIPMENT_LABELS = {
  pressure_filter: 'Bồn Lọc áp lực đa tầng',
  disinfection: 'Hệ thống Khử trùng (Clo/UV/Ozone)',
};

const TERTIARY_TABS = [
  { id: 'pressure_filter', label: 'Bồn Lọc áp lực', icon: Filter },
  { id: 'disinfection', label: 'Khử trùng', icon: ShieldCheck },
];

const MARKET_DIAMETERS_M = [
  0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.5,
];

export default function WastewaterTertiary() {
  const { globalQ, setGlobalQ, hydraulics } = useAppContext();
  const [activeTab, setActiveTab] = useState('pressure_filter');
  const [mediaViewMode, setMediaViewMode] = useState('table');

  // --- Tab 1: Bồn Lọc áp lực ---
  const [filter, setFilter] = useState({
    numTanks: 2,
    shape: 'Tròn',
    filtrationRateTarget: 8.0, // m/h (chuẩn 5 - 12)
    filtrationRateMax: 12.0,
    backwashWaterRate: 12.0, // L/s.m2
    backwashAirRate: 15.0, // L/s.m2
    gravelHeight: 0.3, // Sỏi đỡ (1600 kg/m3)
    sandHeight: 0.7, // Cát thạch anh (1500 kg/m3)
    carbonHeight: 0.5, // Than hoạt tính (500 kg/m3)
    manganeseHeight: 0.0, // Quặng Mangan (1800 kg/m3)
  });
  const [filterDiameterOverrideM, setFilterDiameterOverrideM] = useState(null);

  // --- Tab 2: Khử trùng ---
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

  // Media Layer Breakdown
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

  // --- Disinfection Calculations ---
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

  return (
    <div className="space-y-6">
      {/* Header & Synchronized globalQ */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 text-balance">
            Hoàn Thiện &amp; Khử Trùng (Xử Lý Bậc 3)
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Công đoạn đánh bóng nước sau xử lý sinh học trước khi xả thải hoặc
            tái sử dụng: bồn lọc áp lực đa tầng và khử trùng Clo / UV / Ozone.
          </p>
        </div>

        <div className="w-full lg:w-80 rounded-xl bg-slate-800 border border-slate-700/80 p-3.5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
          <label
            htmlFor="tertiary-global-q"
            className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5"
          >
            <span>Lưu lượng chung (globalQ)</span>
            <span className="font-mono tabular-nums text-slate-300">
              Qmax = {hydraulics.qMaxHour.toFixed(1)} m³/h
            </span>
          </label>
          <div className="relative flex items-center">
            <DecimalInput
              id="tertiary-global-q"
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

      {/* 2 Tabs: Lọc áp lực & Khử trùng */}
      <div
        role="tablist"
        aria-label="Công trình xử lý bậc 3"
        className="print:hidden flex items-center gap-2 overflow-x-auto pb-1"
      >
        {TERTIARY_TABS.map((tab) => {
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

      {/* TAB 1: BỒN LỌC ÁP LỰC */}
      {activeTab === 'pressure_filter' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
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
                helperText="Gợi ý: 8 – 12 m/h (lọc áp lực)"
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
                helperText="Gợi ý: 12 – 15 L/s·m²"
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

            {/* Media Layer Heights */}
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

          {/* Market Diameter Override & Pump/Blower Sizing */}
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Chọn Đường kính bồn thị trường &amp; Kiểm tra ngược
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
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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

            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <Droplets className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>
                    Bảng bóc tách khối lượng vật liệu lọc thực tế (theo bồn Ø{' '}
                    {activeFilterDia.toFixed(2)} m)
                  </span>
                </div>
                <ViewModeToggle
                  viewMode={mediaViewMode}
                  setViewMode={setMediaViewMode}
                />
              </div>

              {mediaViewMode === 'table' ? (
                <div className="overflow-x-auto w-full rounded-lg border border-slate-700/80 print:overflow-visible print:border-gray-300 print:break-inside-avoid">
                  <table className="w-full min-w-[680px] text-left border-collapse text-sm print:min-w-0 print:w-full print:text-gray-900">
                    <thead>
                      <tr className="bg-slate-900/90 text-xs font-medium text-slate-400 border-b border-slate-700/80">
                        <th className="py-3 px-4">Lớp vật liệu lọc</th>
                        <th className="py-3 px-4 text-right">Chiều cao (m)</th>
                        <th className="py-3 px-4 text-right">
                          Tỷ trọng (kg/m³)
                        </th>
                        <th className="py-3 px-4 text-right">
                          Thể tích / 1 bồn
                        </th>
                        <th className="py-3 px-4 text-right">
                          Khối lượng / 1 bồn
                        </th>
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
                        <td className="py-3 px-4 text-right text-slate-400">
                          —
                        </td>
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
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mediaLayers.map((layer) => (
                    <div
                      key={layer.name}
                      className="bg-slate-800 p-4 rounded-lg border border-slate-700 shadow-sm space-y-2.5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid"
                    >
                      <div className="pb-2 border-b border-slate-700/70">
                        <h4 className="text-sm font-semibold text-slate-100">
                          {layer.name}
                        </h4>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">Chiều cao</span>
                          <span className="text-slate-100 font-medium font-mono tabular-nums">
                            {layer.heightM.toFixed(2)} m
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">Tỷ trọng</span>
                          <span className="text-slate-100 font-medium font-mono tabular-nums">
                            {layer.densityKgM3.toLocaleString('vi-VN')} kg/m³
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">Thể tích / 1 bồn</span>
                          <span className="text-slate-100 font-medium font-mono tabular-nums">
                            {layer.volOneTank.toFixed(3)} m³
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">Khối lượng / 1 bồn</span>
                          <span className="font-mono font-medium tabular-nums text-emerald-400">
                            {layer.massOneTank.toLocaleString('vi-VN', {
                              maximumFractionDigits: 0,
                            })}{' '}
                            kg
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-700/60">
                          <span className="text-slate-400">
                            Tổng ({nFilterTanks} bồn)
                          </span>
                          <span className="text-slate-100 font-medium font-mono tabular-nums">
                            {layer.massTotal.toLocaleString('vi-VN', {
                              maximumFractionDigits: 0,
                            })}{' '}
                            kg
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="bg-slate-800 p-4 rounded-lg border border-emerald-500/40 shadow-sm space-y-2.5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
                    <div className="pb-2 border-b border-slate-700/70">
                      <h4 className="text-sm font-semibold text-emerald-400">
                        Tổng cộng vật liệu lọc
                      </h4>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Tổng chiều cao</span>
                        <span className="text-slate-100 font-medium font-mono tabular-nums">
                          {totalMediaHeight.toFixed(2)} m
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Thể tích / 1 bồn</span>
                        <span className="text-slate-100 font-medium font-mono tabular-nums">
                          {totalMediaVolOne.toFixed(3)} m³
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Khối lượng / 1 bồn</span>
                        <span className="font-mono font-medium tabular-nums text-emerald-400">
                          {totalMediaMassOne.toLocaleString('vi-VN', {
                            maximumFractionDigits: 0,
                          })}{' '}
                          kg
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-700/60">
                        <span className="text-slate-400">
                          Tổng ({nFilterTanks} bồn)
                        </span>
                        <span className="font-mono font-semibold tabular-nums text-emerald-400">
                          {totalMediaMassAll.toLocaleString('vi-VN', {
                            maximumFractionDigits: 0,
                          })}{' '}
                          kg
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: KHỬ TRÙNG (CLO/JAVEN, UV, OZONE) */}
      {activeTab === 'disinfection' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
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
                  <NumberField
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
                    helperText="Gợi ý: 3 – 10 mg/L"
                  />
                  <NumberField
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
                  <NumberField
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
                    helperText="Gợi ý: 15 – 30 phút (TCVN 7957:2008)"
                  />
                  <NumberField
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
                  <NumberField
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
                    helperText="Gợi ý: 30 – 40 mJ/cm²"
                  />
                  <NumberField
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
                  <NumberField
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
                  <NumberField
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
                    helperText="Gợi ý: 2 – 5 mg/L"
                  />
                  <NumberField
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

          <section className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {disinfection.method === 'Clo / Javen' && (
              <>
                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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

                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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

                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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
                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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

                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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

                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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
                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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

                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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

                <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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

      <EquipmentSelector
        key={`omnieco_equipments_wastewatertertiary_${activeTab}`}
        moduleLabel={
          TERTIARY_EQUIPMENT_LABELS[activeTab] || 'Công trình Hoàn thiện (Bậc 3)'
        }
        storageKey={`omnieco_equipments_wastewatertertiary_${activeTab}`}
      />
    </div>
  );
}
