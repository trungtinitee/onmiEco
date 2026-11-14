import { useState } from 'react';
import {
  ArrowRight,
  Cable,
  Cpu,
  RotateCcw,
  Wind,
  Zap,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  CheckTable,
  NumberField,
  StatusBanner,
} from '../components/CalcPrimitives';
import EquipmentSelector from '../components/EquipmentSelector';

const ELEC_EQUIPMENT_LABELS = {
  switchgear: 'Tủ điện động lực & Khí cụ điện',
  oxygen: 'Hệ thống Cấp khí & Máy thổi khí',
};

const ELEC_TABS = [
  { id: 'switchgear', label: 'Khí cụ điện & Tủ động lực', icon: Zap },
  { id: 'oxygen', label: 'Nhu cầu Oxy (SOR/AOR) & Máy thổi khí', icon: Wind },
];

// Bảng cáp đồng bọc PVC/XLPE tiêu chuẩn thị trường (Tiết diện mm2 -> Dòng cho phép A)
const COPPER_CABLE_TABLE = [
  { sizeMm2: 1.5, ampacity1P: 17, ampacity3P: 15 },
  { sizeMm2: 2.5, ampacity1P: 24, ampacity3P: 21 },
  { sizeMm2: 4, ampacity1P: 32, ampacity3P: 28 },
  { sizeMm2: 6, ampacity1P: 41, ampacity3P: 36 },
  { sizeMm2: 10, ampacity1P: 57, ampacity3P: 50 },
  { sizeMm2: 16, ampacity1P: 76, ampacity3P: 68 },
  { sizeMm2: 25, ampacity1P: 101, ampacity3P: 89 },
  { sizeMm2: 35, ampacity1P: 125, ampacity3P: 110 },
  { sizeMm2: 50, ampacity1P: 151, ampacity3P: 134 },
  { sizeMm2: 70, ampacity1P: 192, ampacity3P: 171 },
  { sizeMm2: 95, ampacity1P: 232, ampacity3P: 207 },
  { sizeMm2: 120, ampacity1P: 269, ampacity3P: 239 },
  { sizeMm2: 150, ampacity1P: 309, ampacity3P: 275 },
  { sizeMm2: 185, ampacity1P: 353, ampacity3P: 314 },
  { sizeMm2: 240, ampacity1P: 415, ampacity3P: 370 },
];

const STANDARD_CB_AMPS = [
  6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
  630,
];

const STANDARD_CONTACTOR_AMPS = [
  9, 12, 18, 25, 32, 40, 50, 65, 80, 95, 115, 150, 185, 225, 265, 330, 400, 500,
];

const STANDARD_MOTOR_KW = [
  0.75, 1.1, 1.5, 2.2, 3.0, 4.0, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75,
  90, 110, 132, 160,
];

// Độ hòa tan oxy bão hòa Cs (mg/L) ở 1 atm theo nhiệt độ T (°C)
const getCsAtTemp = (tempC) => {
  const t = Math.max(5, Math.min(45, Number(tempC) || 20));
  return 14.652 - 0.41022 * t + 0.007991 * t * t - 0.000077774 * t * t * t;
};

export default function ElectricalCalc() {
  const { hydraulics, bioQuality, biologyNod } = useAppContext();
  const [activeTab, setActiveTab] = useState('switchgear');

  // --- TAB 1: KHÍ CỤ ĐIỆN ---
  const [elec, setElec] = useState({
    powerKw: 15,
    voltage: 380, // 380 (3 pha) | 220 (1 pha)
    cosPhi: 0.85,
    motorEffPct: 90,
    startMethod: 'Y-Delta', // DOL | Y-Delta | VFD
    cableLengthM: 35,
  });
  // Override MCB & Cáp thực tế
  const [mcbOverrideA, setMcbOverrideA] = useState(null);
  const [cableOverrideMm2, setCableOverrideMm2] = useState(null);

  // --- TAB 2: OXY & MÁY THỔI KHÍ ---
  const [oxy, setOxy] = useState({
    useStep4Nod: true, // Tự động lấy NOD (4.57 kg O2/kg NH4+) từ Bước 4
    bodIn: bioQuality.bodIn,
    bodOut: bioQuality.bodOut,
    tknIn: 55,
    tknOut: 8,
    tempC: bioQuality.tempC,
    doTankMgL: 2.0,
    diffuserDepthM: 4.0,
    alphaFactor: 0.6,
    betaFactor: 0.95,
    foulingFactor: 0.9,
    sotePct: 22, // % hiệu suất truyền oxy đĩa thổi khí tinh
    blowerEffPct: 70,
    pipeLossM: 0.8,
  });

  // === CALCULATIONS: 1. KHÍ CỤ ĐIỆN ===
  const isThreePhase = elec.voltage === 380;
  const safeCosPhi = Math.max(0.5, Math.min(1.0, Number(elec.cosPhi) || 0.85));
  const safeMotorEff = Math.max(
    0.5,
    Math.min(1.0, (Number(elec.motorEffPct) || 90) / 100)
  );
  const powerWatts = Math.max(0, Number(elec.powerKw) || 0) * 1000;

  const ratedCurrentA = isThreePhase
    ? powerWatts / (Math.sqrt(3) * 380 * safeCosPhi * safeMotorEff)
    : powerWatts / (220 * safeCosPhi * safeMotorEff);

  const startMultiplier =
    elec.startMethod === 'DOL'
      ? 6.5
      : elec.startMethod === 'Y-Delta'
      ? 2.5
      : 1.5;
  const startingCurrentA = ratedCurrentA * startMultiplier;

  // Gợi ý Cáp đồng (chọn sao cho I_cp >= 1.25 * I_đm và sụt áp <= 5%)
  const rhoCopper = 0.0175; // Ohm·mm2/m
  const suggestedCableRow =
    COPPER_CABLE_TABLE.find((row) => {
      const amp = isThreePhase ? row.ampacity3P : row.ampacity1P;
      const dU = isThreePhase
        ? (Math.sqrt(3) *
            ratedCurrentA *
            (rhoCopper / row.sizeMm2) *
            elec.cableLengthM *
            safeCosPhi) /
          3.8
        : (2 *
            ratedCurrentA *
            (rhoCopper / row.sizeMm2) *
            elec.cableLengthM *
            safeCosPhi) /
          2.2;
      return amp >= ratedCurrentA * 1.25 && dU <= 5.0;
    }) || COPPER_CABLE_TABLE[COPPER_CABLE_TABLE.length - 1];

  const activeCableSizeMm2 = Math.max(
    1.5,
    Number(cableOverrideMm2 ?? suggestedCableRow.sizeMm2) || 1.5
  );
  const activeCableRow =
    COPPER_CABLE_TABLE.find((r) => r.sizeMm2 === activeCableSizeMm2) ||
    suggestedCableRow;
  const activeCableAmpacity = isThreePhase
    ? activeCableRow.ampacity3P
    : activeCableRow.ampacity1P;

  // Sụt áp thực tế (%)
  const voltageDropPct = isThreePhase
    ? (Math.sqrt(3) *
        ratedCurrentA *
        (rhoCopper / activeCableSizeMm2) *
        elec.cableLengthM *
        safeCosPhi) /
      3.8
    : (2 *
        ratedCurrentA *
        (rhoCopper / activeCableSizeMm2) *
        elec.cableLengthM *
        safeCosPhi) /
      2.2;

  // Gợi ý MCB / MCCB
  const targetCbA = ratedCurrentA * 1.25;
  const suggestedCbA =
    STANDARD_CB_AMPS.find((a) => a >= targetCbA) ||
    STANDARD_CB_AMPS[STANDARD_CB_AMPS.length - 1];
  const activeCbA =
    mcbOverrideA !== null && mcbOverrideA > 0 ? mcbOverrideA : suggestedCbA;
  const cbDeviceType = activeCbA <= 63 ? 'MCB' : 'MCCB';

  // Gợi ý Contactor (I_AC3 >= 1.15 * I_đm)
  const suggestedContactorA =
    STANDARD_CONTACTOR_AMPS.find((a) => a >= ratedCurrentA * 1.15) ||
    STANDARD_CONTACTOR_AMPS[STANDARD_CONTACTOR_AMPS.length - 1];

  // Dải Rơ-le nhiệt (đặt trip ~ 1.05 * I_đm)
  const relayMinA = Number((ratedCurrentA * 0.85).toFixed(1));
  const relayMaxA = Number((ratedCurrentA * 1.25).toFixed(1));
  const relayTripA = Number((ratedCurrentA * 1.05).toFixed(1));

  // Kiểm tra ngược an toàn MCB/MCCB thực tế
  const isCbNotUndersized =
    ratedCurrentA > 0 && activeCbA >= ratedCurrentA * 1.15;
  const isCbProtectsCable =
    ratedCurrentA > 0 && activeCbA <= activeCableAmpacity;
  const isVoltageDropOk = ratedCurrentA > 0 && voltageDropPct <= 5.0;
  const isElecAllOk =
    isCbNotUndersized && isCbProtectsCable && isVoltageDropOk;

  // === CALCULATIONS: 2. OXY & MÁY THỔI KHÍ ===
  const qDay = hydraulics.qDay;
  const activeTempC = oxy.useStep4Nod ? bioQuality.tempC : oxy.tempC;
  const activeBodIn = oxy.useStep4Nod ? bioQuality.bodIn : oxy.bodIn;
  const activeBodOut = oxy.useStep4Nod ? bioQuality.bodOut : oxy.bodOut;

  const deltaBod = Math.max(0, activeBodIn - activeBodOut);
  const bodRemovedKgDay = (qDay * deltaBod) / 1000;
  // Khử BOD: ~1.15 kg O2 / kg BOD5 loại bỏ
  const o2BodKgDay = 1.15 * bodRemovedKgDay;

  // NOD: Tự động lấy từ Bước 4 (4.57 kg O2 / kg N-NH4+) hoặc tính từ TKN nhập mới
  const deltaTkn = Math.max(0, oxy.tknIn - oxy.tknOut);
  const tknRemovedKgDay = (qDay * deltaTkn) / 1000;
  const manualNodKgDay = 4.57 * tknRemovedKgDay;

  const nodUsedKgDay = oxy.useStep4Nod
    ? biologyNod.nodKgDay
    : manualNodKgDay;
  const o2CreditKgDay = oxy.useStep4Nod ? biologyNod.o2CreditKgDay : 0;

  // AOR (Actual Oxygen Requirement)
  const aorKgDay = Math.max(0, o2BodKgDay + nodUsedKgDay - o2CreditKgDay);
  const aorKgHour = aorKgDay / 24;

  // Quy đổi AOR -> SOR (Standard Oxygen Requirement)
  const cs20 = 9.08;
  const csT = getCsAtTemp(activeTempC);
  const csTH = csT * (1 + oxy.diffuserDepthM / (2 * 10.33));
  const safeAlpha = Math.max(0.1, Number(oxy.alphaFactor) || 0.6);
  const safeBeta = Math.max(0.1, Number(oxy.betaFactor) || 0.95);
  const safeFouling = Math.max(0.1, Number(oxy.foulingFactor) || 0.9);
  const oxygenRatioTerm = Math.max(
    0.05,
    (safeBeta * csTH - oxy.doTankMgL) / cs20
  );
  const tempTerm = Math.pow(1.024, activeTempC - 20);
  const conversionFactor =
    oxygenRatioTerm * tempTerm * safeAlpha * safeFouling;

  const sorKgHour = conversionFactor > 0 ? aorKgHour / conversionFactor : 0;
  const sorKgDay = sorKgHour * 24;

  // Lưu lượng không khí yêu cầu (0.28 kg O2 / m3 khí chuẩn)
  const soteFrac = Math.max(0.05, Math.min(0.45, oxy.sotePct / 100));
  const airFlowReqM3h = sorKgHour / (soteFrac * 0.28);
  const airFlowReqM3Min = airFlowReqM3h / 60;
  const airFlowReqM3s = airFlowReqM3h / 3600;

  // Áp suất đầu đẩy & Công suất Máy thổi khí (kW) - nén đoạn nhiệt
  const totalHeadWaterM = oxy.diffuserDepthM + oxy.pipeLossM;
  const dischargePressureMbar = totalHeadWaterM * 98.1;
  const p1Kpa = 101.325;
  const p2Kpa = p1Kpa + dischargePressureMbar / 10;
  const gamma = 1.4;
  const adiabaticFactor = (gamma - 1) / gamma;
  const blowerEff = Math.max(0.4, Math.min(0.9, oxy.blowerEffPct / 100));

  const blowerShaftKw =
    (airFlowReqM3s *
      p1Kpa *
      (gamma / (gamma - 1)) *
      (Math.pow(p2Kpa / p1Kpa, adiabaticFactor) - 1)) /
    blowerEff;
  const blowerMotorReqKw = blowerShaftKw * 1.15;
  const suggestedBlowerKw =
    STANDARD_MOTOR_KW.find((kw) => kw >= blowerMotorReqKw) ||
    STANDARD_MOTOR_KW[STANDARD_MOTOR_KW.length - 1];

  const handleSendBlowerToSwitchgear = () => {
    setElec((p) => ({
      ...p,
      powerKw: suggestedBlowerKw,
      voltage: suggestedBlowerKw >= 3 ? 380 : 220,
      startMethod: suggestedBlowerKw >= 7.5 ? 'VFD' : 'DOL',
    }));
    setMcbOverrideA(null);
    setCableOverrideMm2(null);
    setActiveTab('switchgear');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 text-balance">
            Kỹ Thuật Điện Động Lực & Cấp Khí Thổi
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Tính chọn khí cụ điện (Cáp đồng, MCB/MCCB, Contactor, Rơ-le nhiệt)
            và quy đổi nhu cầu Oxy AOR / SOR từ dữ liệu Nitrat hóa Bước 4 để
            chọn máy thổi khí.
          </p>
        </div>

        <div className="rounded-xl bg-slate-800 border border-slate-700/80 px-4 py-3 shrink-0 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
          <div className="text-xs text-slate-400">
            NOD đồng bộ từ Bước 4 (4,57 kg O₂/kg NH₄⁺)
          </div>
          <div className="mt-1 font-mono text-lg font-semibold text-emerald-400 tabular-nums">
            {biologyNod.nodKgHour.toFixed(2)} kg O₂/h (
            {biologyNod.nodKgDay.toFixed(1)} kg/ng)
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums">
            Q = {qDay.toLocaleString('vi-VN')} m³/ng · ΔNH₄⁺ ={' '}
            {biologyNod.deltaNh4.toFixed(1)} mg/L
          </div>
        </div>
      </section>

      {/* 2 Tabs */}
      <div
        role="tablist"
        aria-label="Hạng mục điện và máy thổi khí"
        className="print:hidden flex items-center gap-2 overflow-x-auto pb-1"
      >
        {ELEC_TABS.map((tab) => {
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

      {/* TAB 1: KHÍ CỤ ĐIỆN */}
      {activeTab === 'switchgear' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Thông số Động cơ & Nguồn cấp
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tính dòng điện định mức (I_đm), dòng khởi động (I_kđ) và gợi ý
                  cáp đồng, MCB/MCCB, Contactor, Rơ-le nhiệt.
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                I_đm = {ratedCurrentA.toFixed(2)} A · I_kđ ={' '}
                {startingCurrentA.toFixed(1)} A
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <NumberField
                id="el-power"
                label="Công suất động cơ (P)"
                unit="kW"
                value={elec.powerKw}
                min={0.1}
                max={300}
                step={0.5}
                onChange={(v) => {
                  setElec((p) => ({ ...p, powerKw: v }));
                  setMcbOverrideA(null);
                  setCableOverrideMm2(null);
                }}
              />

              <div>
                <label
                  htmlFor="el-volt"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Điện áp lưới cấp (220V / 380V)
                </label>
                <select
                  id="el-volt"
                  value={elec.voltage}
                  onChange={(e) => {
                    setElec((p) => ({
                      ...p,
                      voltage: Number(e.target.value),
                    }));
                    setMcbOverrideA(null);
                    setCableOverrideMm2(null);
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value={380}>3 pha — 380V / 50Hz</option>
                  <option value={220}>1 pha — 220V / 50Hz</option>
                </select>
              </div>

              <NumberField
                id="el-cosphi"
                label="Hệ số công suất (Cos φ)"
                unit="cosφ"
                value={elec.cosPhi}
                min={0.5}
                max={1.0}
                step={0.01}
                onChange={(v) => {
                  setElec((p) => ({ ...p, cosPhi: v }));
                  setMcbOverrideA(null);
                  setCableOverrideMm2(null);
                }}
              />

              <NumberField
                id="el-eff"
                label="Hiệu suất động cơ (η)"
                unit="%"
                value={elec.motorEffPct}
                min={60}
                max={98}
                step={1}
                onChange={(v) => setElec((p) => ({ ...p, motorEffPct: v }))}
              />

              <div>
                <label
                  htmlFor="el-start"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Phương thức khởi động
                </label>
                <select
                  id="el-start"
                  value={elec.startMethod}
                  onChange={(e) =>
                    setElec((p) => ({ ...p, startMethod: e.target.value }))
                  }
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="DOL">Trực tiếp DOL (I_kđ ≈ 6,5 × I_đm)</option>
                  <option value="Y-Delta">
                    Sao - Tam giác Y/Δ (I_kđ ≈ 2,5 × I_đm)
                  </option>
                  <option value="VFD">
                    Biến tần VFD / Khởi động mềm (1,5 × I_đm)
                  </option>
                </select>
              </div>

              <NumberField
                id="el-len"
                label="Chiều dài tuyến cáp từ tủ đến tải"
                unit="m"
                value={elec.cableLengthM}
                min={1}
                max={500}
                step={5}
                onChange={(v) => setElec((p) => ({ ...p, cableLengthM: v }))}
              />
            </div>

            {/* 4 Equipment Suggestions Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              <div className="rounded-lg bg-slate-900/80 border border-slate-700/80 p-3.5">
                <div className="text-xs text-slate-400">
                  Cáp đồng gợi ý ({isThreePhase ? '4C / 3C+E' : '2C+E'})
                </div>
                <div className="mt-1 font-mono text-lg font-semibold text-emerald-400 tabular-nums">
                  Cu/XLPE/PVC {suggestedCableRow.sizeMm2} mm²
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  I_cp ={' '}
                  {isThreePhase
                    ? suggestedCableRow.ampacity3P
                    : suggestedCableRow.ampacity1P}{' '}
                  A
                </div>
              </div>

              <div className="rounded-lg bg-slate-900/80 border border-slate-700/80 p-3.5">
                <div className="text-xs text-slate-400">
                  {suggestedCbA <= 63 ? 'MCB' : 'MCCB'} gợi ý (
                  {isThreePhase ? '3P' : '2P'})
                </div>
                <div className="mt-1 font-mono text-lg font-semibold text-emerald-400 tabular-nums">
                  {suggestedCbA} A
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  ≥ 1,25 × I_đm ({(ratedCurrentA * 1.25).toFixed(1)} A)
                </div>
              </div>

              <div className="rounded-lg bg-slate-900/80 border border-slate-700/80 p-3.5">
                <div className="text-xs text-slate-400">
                  Contactor khởi động (AC-3)
                </div>
                <div className="mt-1 font-mono text-lg font-semibold text-emerald-400 tabular-nums">
                  {suggestedContactorA} A
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  Cuộn hút {isThreePhase ? '220V / 380V' : '220V'}
                </div>
              </div>

              <div className="rounded-lg bg-slate-900/80 border border-slate-700/80 p-3.5">
                <div className="text-xs text-slate-400">
                  Rơ-le nhiệt bảo vệ quá tải
                </div>
                <div className="mt-1 font-mono text-lg font-semibold text-emerald-400 tabular-nums">
                  {relayMinA} – {relayMaxA} A
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  Chỉnh định trip: {relayTripA} A
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Nhập đè MCB/MCCB & Cáp thực tế → Kiểm tra ngược an toàn
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kiểm tra điều kiện phối hợp bảo vệ: 1,15 × I_đm ≤ I_CB ≤ I_cp
                  cáp đồng và sụt áp ΔU ≤ 5%.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMcbOverrideA(suggestedCbA);
                  setCableOverrideMm2(suggestedCableRow.sizeMm2);
                }}
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Khôi phục theo gợi ý chuẩn</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField
                id="el-ov-mcb"
                label={`Dòng định mức ${cbDeviceType} thực tế chọn lắp`}
                unit="A"
                value={activeCbA}
                min={1}
                max={1000}
                step={1}
                onChange={(v) => setMcbOverrideA(v)}
              />

              <div>
                <label
                  htmlFor="el-ov-cable"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Tiết diện cáp đồng thực tế chọn lắp
                </label>
                <select
                  id="el-ov-cable"
                  value={activeCableSizeMm2}
                  onChange={(e) => setCableOverrideMm2(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 font-mono text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {COPPER_CABLE_TABLE.map((row) => (
                    <option key={row.sizeMm2} value={row.sizeMm2}>
                      Cu {row.sizeMm2} mm² (I_cp ={' '}
                      {isThreePhase ? row.ampacity3P : row.ampacity1P} A)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <StatusBanner
              ok={isElecAllOk}
              titleOk={`AN TOÀN PHỐI HỢP BẢO VỆ: ${cbDeviceType} ${activeCbA}A + CÁP ${activeCableSizeMm2} mm²`}
              titleFail="CẢNH BÁO ĐỎ: MẤT AN TOÀN CHỌN MCB/MCCB HOẶC CÁP ĐỒNG"
              message={
                isElecAllOk
                  ? `${cbDeviceType} ${activeCbA} A đảm bảo không nhảy giả khi chạy tải (I_đm = ${ratedCurrentA.toFixed(1)} A) và bảo vệ an toàn cho dây đồng ${activeCableSizeMm2} mm² (I_cp = ${activeCableAmpacity} A). Sụt áp = ${voltageDropPct.toFixed(2)}%.`
                  : `${!isCbNotUndersized ? `${cbDeviceType} thực tế (${activeCbA} A) < 1,15 × I_đm (${(ratedCurrentA * 1.15).toFixed(1)} A) — Nguy cơ nhảy CB liên tục khi đầy tải/khởi động! ` : ''}${!isCbProtectsCable ? `${cbDeviceType} thực tế (${activeCbA} A) > Dòng cho phép cáp (${activeCableAmpacity} A) — Nguy cơ quá nhiệt CHÁY CÁP trước khi CB ngắt! ` : ''}${!isVoltageDropOk ? `Sụt áp đường dây (${voltageDropPct.toFixed(2)}%) > 5,0%.` : ''}`
              }
              summaryRight={`${cbDeviceType} ${activeCbA}A · ΔU = ${voltageDropPct.toFixed(2)}%`}
            />

            <CheckTable
              rows={[
                {
                  name: 'Dòng định mức & Dòng khởi động động cơ',
                  standard: `${elec.startMethod} (×${startMultiplier})`,
                  actual: `I_đm = ${ratedCurrentA.toFixed(2)} A · I_kđ = ${startingCurrentA.toFixed(1)} A`,
                  ok: true,
                  statusText: `${elec.powerKw} kW / ${elec.voltage}V`,
                },
                {
                  name: `Điều kiện không nhảy giả (I_CB ≥ 1,15 × I_đm)`,
                  standard: `≥ ${(ratedCurrentA * 1.15).toFixed(1)} A`,
                  actual: `${activeCbA} A (${cbDeviceType})`,
                  ok: isCbNotUndersized,
                  statusText: isCbNotUndersized
                    ? 'Đạt chịu tải'
                    : 'CB quá nhỏ (Nhảy giả)',
                },
                {
                  name: `Điều kiện bảo vệ cáp đồng (I_CB ≤ I_cp cáp)`,
                  standard: `≤ ${activeCableAmpacity} A (Cu ${activeCableSizeMm2} mm²)`,
                  actual: `${activeCbA} A`,
                  ok: isCbProtectsCable,
                  statusText: isCbProtectsCable
                    ? 'Bảo vệ được cáp'
                    : 'Nguy cơ cháy cáp!',
                },
                {
                  name: `Sụt áp cuối đường dây (L = ${elec.cableLengthM} m)`,
                  standard: '≤ 5,00 %',
                  actual: `${voltageDropPct.toFixed(2)} %`,
                  ok: isVoltageDropOk,
                  statusText: isVoltageDropOk ? 'Đạt chuẩn' : 'Sụt áp quá lớn',
                },
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 2: OXY & MÁY THỔI KHÍ */}
      {activeTab === 'oxygen' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Dữ liệu BOD, TKN, Nhiệt độ & Tự động nhận NOD từ Bước 4
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Đồng bộ trực tiếp lượng Oxy Nitrat hóa NOD (4,57 kg O₂/kg
                  N-NH₄⁺) từ module Sinh học (Bước 4).
                </p>
              </div>
              <label className="inline-flex items-center gap-2.5 min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={oxy.useStep4Nod}
                  onChange={(e) =>
                    setOxy((p) => ({ ...p, useStep4Nod: e.target.checked }))
                  }
                  className="h-4 w-4 accent-emerald-500 rounded"
                />
                <span>Tự động lấy BOD & NOD từ Bước 4</span>
              </label>
            </div>

            {/* Banner showing Step 4 Sync Source */}
            <div className="rounded-lg bg-slate-900/80 border border-emerald-500/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <Cable className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-emerald-400">
                    Liên kết dữ liệu Bước 4 (WastewaterBiology):
                  </span>{' '}
                  NH₄⁺ vào {bioQuality.nh4In} → ra {bioQuality.nh4Out} mg/L (khử{' '}
                  {biologyNod.nh4RemovedKgDay.toFixed(1)} kg N/ngày) ⇒{' '}
                  <span className="font-mono font-semibold text-slate-100">
                    NOD = {biologyNod.nodKgDay.toFixed(1)} kg O₂/ngày (
                    {biologyNod.nodKgHour.toFixed(2)} kg O₂/h)
                  </span>
                  {bioQuality.hasAnoxic
                    ? ` · Trừ khử Anoxic: −${biologyNod.o2CreditKgDay.toFixed(1)} kg O₂/ngày.`
                    : ''}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <NumberField
                id="ox-bod-in"
                label="BOD₅ đầu vào"
                unit="mg/L"
                value={activeBodIn}
                min={10}
                max={3000}
                step={10}
                disabled={oxy.useStep4Nod}
                onChange={(v) => setOxy((p) => ({ ...p, bodIn: v }))}
              />
              <NumberField
                id="ox-bod-out"
                label="BOD₅ đầu ra"
                unit="mg/L"
                value={activeBodOut}
                min={1}
                max={200}
                step={5}
                disabled={oxy.useStep4Nod}
                onChange={(v) => setOxy((p) => ({ ...p, bodOut: v }))}
              />
              <NumberField
                id="ox-tkn-in"
                label="TKN đầu vào (tham chiếu)"
                unit="mg/L"
                value={oxy.useStep4Nod ? bioQuality.nh4In : oxy.tknIn}
                min={1}
                max={500}
                step={5}
                disabled={oxy.useStep4Nod}
                onChange={(v) => setOxy((p) => ({ ...p, tknIn: v }))}
              />
              <NumberField
                id="ox-tkn-out"
                label="TKN đầu ra"
                unit="mg/L"
                value={oxy.useStep4Nod ? bioQuality.nh4Out : oxy.tknOut}
                min={0}
                max={100}
                step={1}
                disabled={oxy.useStep4Nod}
                onChange={(v) => setOxy((p) => ({ ...p, tknOut: v }))}
              />
              <NumberField
                id="ox-temp"
                label="Nhiệt độ nước thải (T)"
                unit="°C"
                value={activeTempC}
                min={10}
                max={40}
                step={1}
                disabled={oxy.useStep4Nod}
                onChange={(v) => setOxy((p) => ({ ...p, tempC: v }))}
              />
              <NumberField
                id="ox-depth"
                label="Độ sâu đặt đĩa phân phối khí"
                unit="m"
                value={oxy.diffuserDepthM}
                min={2.0}
                max={8.0}
                step={0.2}
                onChange={(v) => setOxy((p) => ({ ...p, diffuserDepthM: v }))}
              />
              <NumberField
                id="ox-sote"
                label="Hiệu suất hòa tan O₂ (SOTE)"
                unit="%"
                value={oxy.sotePct}
                min={10}
                max={35}
                step={1}
                onChange={(v) => setOxy((p) => ({ ...p, sotePct: v }))}
              />
              <NumberField
                id="ox-alpha"
                label="Hệ số truyền oxy α (nước thải)"
                unit="α"
                value={oxy.alphaFactor}
                min={0.35}
                max={0.95}
                step={0.05}
                onChange={(v) => setOxy((p) => ({ ...p, alphaFactor: v }))}
              />
            </div>
          </section>

          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Kết quả Quy đổi AOR → SOR & Gợi ý Công suất Máy thổi khí
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Áp suất đầu đẩy = {dischargePressureMbar.toFixed(0)} mbar (
                  {totalHeadWaterM.toFixed(1)} mH₂O) · Hiệu suất máy thổi khí{' '}
                  {oxy.blowerEffPct}%
                </p>
              </div>
              <button
                type="button"
                onClick={handleSendBlowerToSwitchgear}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <Cpu className="h-4 w-4" />
                <span>Chọn CB/Cáp cho Máy thổi {suggestedBlowerKw} kW</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 4 Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg bg-slate-900/80 border border-slate-700/80 p-3.5">
                <div className="text-xs text-slate-400">
                  Nhu cầu Oxy thực tế (AOR)
                </div>
                <div className="mt-1 font-mono text-xl font-semibold text-slate-100 tabular-nums">
                  {aorKgHour.toFixed(2)} kg O₂/h
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {aorKgDay.toFixed(1)} kg O₂/ngày
                </div>
              </div>

              <div className="rounded-lg bg-slate-900/80 border border-slate-700/80 p-3.5">
                <div className="text-xs text-slate-400">
                  Nhu cầu Oxy tiêu chuẩn (SOR)
                </div>
                <div className="mt-1 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
                  {sorKgHour.toFixed(2)} kg O₂/h
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {sorKgDay.toFixed(1)} kg O₂/ngày
                </div>
              </div>

              <div className="rounded-lg bg-slate-900/80 border border-slate-700/80 p-3.5">
                <div className="text-xs text-slate-400">
                  Lưu lượng khí thổi yêu cầu
                </div>
                <div className="mt-1 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
                  {airFlowReqM3Min.toFixed(2)} m³/phút
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {airFlowReqM3h.toFixed(0)} m³/giờ
                </div>
              </div>

              <div className="rounded-lg bg-slate-900/80 border border-slate-700/80 p-3.5">
                <div className="text-xs text-slate-400">
                  Motor Máy thổi khí gợi ý
                </div>
                <div className="mt-1 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
                  {suggestedBlowerKw} kW
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  P_trục = {blowerShaftKw.toFixed(2)} kW @{' '}
                  {dischargePressureMbar.toFixed(0)} mbar
                </div>
              </div>
            </div>

            <StatusBanner
              ok={qDay > 0 && sorKgHour > 0}
              titleOk={`ĐÃ TÍNH XONG MÁY THỔI KHÍ ${suggestedBlowerKw} kW (${airFlowReqM3Min.toFixed(1)} m³/phút)`}
              titleFail="CHƯA CÓ LƯU LƯỢNG ĐỂ TÍNH MÁY THỔI KHÍ"
              message={
                qDay > 0
                  ? `Từ AOR = ${aorKgHour.toFixed(2)} kg O₂/h (gồm ${o2BodKgDay.toFixed(0)} kg khử BOD + ${nodUsedKgDay.toFixed(0)} kg NOD − ${o2CreditKgDay.toFixed(0)} kg Anoxic) quy đổi ra SOR = ${sorKgHour.toFixed(2)} kg O₂/h. Gợi ý chọn 1 máy chạy + 1 máy dự phòng công suất ${suggestedBlowerKw} kW.`
                  : 'Vui lòng nhập globalQ > 0 tại mục Thông số đầu vào (Q, Kh...) để tính toán nhu cầu Oxy và máy thổi khí.'
              }
              summaryRight={`SOR = ${sorKgHour.toFixed(1)} kg/h · ${suggestedBlowerKw} kW`}
            />

            <CheckTable
              rows={[
                {
                  name: 'Oxy khử BOD₅ (1,15 × ΔBOD)',
                  standard: `ΔBOD = ${deltaBod} mg/L`,
                  actual: `${o2BodKgDay.toFixed(1)} kg/ng (${(o2BodKgDay / 24).toFixed(2)} kg/h)`,
                  ok: true,
                  statusText: 'Nhu cầu Carbon',
                },
                {
                  name: oxy.useStep4Nod
                    ? 'NOD lấy từ Bước 4 (4,57 × ΔNH₄⁺)'
                    : 'NOD tính từ TKN nhập (4,57 × ΔTKN)',
                  standard: oxy.useStep4Nod
                    ? `Bước 4: ΔNH₄⁺ = ${biologyNod.deltaNh4} mg/L`
                    : `ΔTKN = ${deltaTkn} mg/L`,
                  actual: `${nodUsedKgDay.toFixed(1)} kg/ng (${(nodUsedKgDay / 24).toFixed(2)} kg/h)`,
                  ok: true,
                  statusText: 'Nitrat hóa',
                },
                {
                  name: 'Oxy hoàn lại do khử Nitrat ở Anoxic (−2,86 × NO₃⁻)',
                  standard: bioQuality.hasAnoxic
                    ? 'Có bể Anoxic'
                    : 'Không có Anoxic',
                  actual: `−${o2CreditKgDay.toFixed(1)} kg/ng`,
                  ok: true,
                  statusText: 'Tiết kiệm năng lượng',
                },
                {
                  name: `Hệ số quy đổi AOR → SOR (T = ${activeTempC}°C, Cs,T,H = ${csTH.toFixed(2)} mg/L)`,
                  standard: `α=${oxy.alphaFactor}, β=${oxy.betaFactor}, F=${oxy.foulingFactor}`,
                  actual: `Tỷ số AOR/SOR = ${conversionFactor.toFixed(3)}`,
                  ok: true,
                  statusText: `SOR = ${sorKgHour.toFixed(2)} kg/h`,
                },
              ]}
            />
          </section>
        </div>
      )}

      <EquipmentSelector
        key={`omnieco_equipments_electricalcalc_${activeTab}`}
        moduleLabel={
          ELEC_EQUIPMENT_LABELS[activeTab] || 'Hệ thống Điện & Thổi khí'
        }
        storageKey={`omnieco_equipments_electricalcalc_${activeTab}`}
      />
    </div>
  );
}
