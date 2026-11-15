import { useState } from 'react';
import {
  Box,
  Cpu,
  Gauge,
  GitCommitHorizontal,
  RotateCcw,
  Wrench,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  CheckTable,
  NumberField,
  StatusBanner,
  roundUpToStep,
} from '../components/CalcPrimitives';
import EquipmentSelector from '../components/EquipmentSelector';

const MEP_EQUIPMENT_LABELS = {
  pipe: 'Tuyến Ống thủy lực',
  pump: 'Trạm Bơm công nghệ',
  hopper: 'Phễu thu bùn Inox',
  eductor: 'Bộ trộn tĩnh & Eductor',
};

const MEP_TABS = [
  { id: 'pipe', label: 'Ống thủy lực', icon: GitCommitHorizontal },
  { id: 'pump', label: 'Bơm công nghệ', icon: Gauge },
  { id: 'hopper', label: 'Phễu thu bùn Inox', icon: Box },
  { id: 'eductor', label: 'Bộ trộn tĩnh & Eductor', icon: Cpu },
];

// Quy chuẩn đường kính trong thực tế (mm) theo vật liệu thị trường
const PIPE_CATALOG = [
  { dn: 20, uPVC_ID: 21.2, sch10s_ID: 22.5, sch40s_ID: 20.9 },
  { dn: 25, uPVC_ID: 27.2, sch10s_ID: 27.9, sch40s_ID: 26.6 },
  { dn: 32, uPVC_ID: 34.0, sch10s_ID: 36.6, sch40s_ID: 35.1 },
  { dn: 40, uPVC_ID: 42.6, sch10s_ID: 42.8, sch40s_ID: 40.9 },
  { dn: 50, uPVC_ID: 53.6, sch10s_ID: 54.8, sch40s_ID: 52.5 },
  { dn: 65, uPVC_ID: 67.8, sch10s_ID: 66.9, sch40s_ID: 62.7 },
  { dn: 80, uPVC_ID: 81.4, sch10s_ID: 82.8, sch40s_ID: 77.9 },
  { dn: 100, uPVC_ID: 99.4, sch10s_ID: 108.2, sch40s_ID: 102.3 },
  { dn: 125, uPVC_ID: 126.6, sch10s_ID: 134.5, sch40s_ID: 128.2 },
  { dn: 150, uPVC_ID: 144.6, sch10s_ID: 161.5, sch40s_ID: 154.1 },
  { dn: 200, uPVC_ID: 203.4, sch10s_ID: 211.6, sch40s_ID: 202.7 },
  { dn: 250, uPVC_ID: 226.2, sch10s_ID: 264.6, sch40s_ID: 254.5 },
  { dn: 300, uPVC_ID: 285.0, sch10s_ID: 314.8, sch40s_ID: 304.8 },
  { dn: 350, uPVC_ID: 321.2, sch10s_ID: 346.0, sch40s_ID: 336.5 },
  { dn: 400, uPVC_ID: 361.8, sch10s_ID: 396.8, sch40s_ID: 387.3 },
  { dn: 500, uPVC_ID: 452.2, sch10s_ID: 496.9, sch40s_ID: 488.9 },
];

const STANDARD_MOTOR_KW = [
  0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3.0, 4.0, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37,
  45, 55, 75, 90, 110,
];

const getPipeIdMm = (dn, material) => {
  const row =
    PIPE_CATALOG.find((p) => p.dn === Number(dn)) || PIPE_CATALOG[7];
  if (material === 'Inox 304 SCH10S') return row.sch10s_ID;
  if (material === 'Inox 304 SCH40S') return row.sch40s_ID;
  return row.uPVC_ID;
};

const suggestMaterialByCondition = (fluidType, tempC, pressureBar) => {
  if (pressureBar >= 10 || fluidType === 'high_pressure_sludge') {
    return {
      material: 'Inox 304 SCH40S',
      reason:
        'Áp lực cao (≥ 10 bar) hoặc đường ống bùn chịu mài mòn: Bắt buộc dùng Inox 304 SCH40S.',
    };
  }
  if (tempC >= 55 || fluidType === 'hot_industrial') {
    return {
      material: 'Inox 304 SCH10S',
      reason:
        'Nhiệt độ cao (≥ 55°C) hoặc nước thải công nghiệp: Dùng Inox 304 SCH10S (uPVC bị biến dạng nhiệt).',
    };
  }
  if (fluidType === 'chemical') {
    return {
      material: pressureBar > 6 ? 'Inox 304 SCH10S' : 'uPVC',
      reason:
        'Đường ống châm hóa chất ăn mòn (Clo/NaOCl/Axit loãng): Khuyến nghị uPVC chịu ăn mòn (hoặc PVDF/Inox 316 nếu áp cao).',
    };
  }
  return {
    material: 'uPVC',
    reason:
      'Nước sạch / nước thải sinh hoạt nhiệt độ thường (< 45°C, < 6 bar): Dùng uPVC PN10 tối ưu chi phí.',
  };
};

// Tổn thất ma sát Hazen-Williams (m cột nước / 100 m ống)
const calcHazenWilliamsPer100m = (qM3s, idMm, cFactor = 140) => {
  const dM = idMm / 1000;
  if (qM3s <= 0 || dM <= 0) return 0;
  const s = 10.67 * Math.pow(qM3s / cFactor, 1.852) * Math.pow(dM, -4.87);
  return s * 100;
};

export default function MEPHydraulics() {
  const { globalQ, hydraulics } = useAppContext();
  const [activeTab, setActiveTab] = useState('pipe');

  // --- TAB 1: ỐNG THỦY LỰC ---
  const [pipe, setPipe] = useState({
    flowSource: 'qMax', // qMax | qAvg | custom
    customFlowM3h: 60,
    targetVelMs: 1.2,
    fluidType: 'normal_water', // normal_water | hot_industrial | chemical | high_pressure_sludge
    tempC: 30,
    pressureBar: 3.5,
  });
  const [pipeOverride, setPipeOverride] = useState(null); // { material, dn }

  // --- TAB 2: BƠM CÔNG NGHỆ ---
  const [pump, setPump] = useState({
    flowSource: 'qMax',
    customFlowM3h: 60,
    staticHeadM: 8.0,
    pipeLengthM: 45,
    localLossFactorPct: 25,
    suctionDn: 125,
    dischargeDn: 100,
    pipeMaterial: 'Inox 304 SCH10S',
    liquidDensity: 1010, // kg/m3
    pumpEffPct: 68,
    motorEffPct: 90,
  });

  // --- TAB 3: PHỄU THU BÙN INOX ---
  const [hopper, setHopper] = useState({
    shape: 'Vuông', // Vuông | Chữ nhật | Tròn
    targetVolM3: 1.2,
    heightH: 1.5,
    outletSizeM: 0.15, // ống/cửa xả bùn 150 mm
    ratioLW: 1.5, // cho hình chữ nhật
    plateThicknessMm: 3.0,
  });
  const [hopperOv, setHopperOv] = useState(null);

  // --- TAB 4: BỘ TRỘN TĨNH & EDUCTOR ---
  const [eductor, setEductor] = useState({
    // Phần 1: Static Mixer
    mixerFlowM3h: 60,
    mixerDn: 100,
    mixerMaterial: 'Inox 304 SCH10S',
    mixerElements: 6,
    // Phần 2: Tank Jet Eductor
    tankVolM3: 80,
    recircFlowM3h: 45,
    entrainmentRatio: 3.5, // 1 m3 động lực cuốn theo 3.5 m3 nước bể
    numEductors: 4,
    nozzleDiaMm: 22,
  });

  // === CALCULATIONS: 1. ỐNG THỦY LỰC ===
  const qPipeM3h =
    pipe.flowSource === 'qMax'
      ? hydraulics.qMaxHour
      : pipe.flowSource === 'qAvg'
      ? hydraulics.qHour
      : Math.max(0, Number(pipe.customFlowM3h) || 0);
  const qPipeM3s = qPipeM3h / 3600;
  const dInReqMm =
    pipe.targetVelMs > 0
      ? Math.sqrt((4 * qPipeM3s) / (Math.PI * pipe.targetVelMs)) * 1000
      : 0;

  const matSuggestion = suggestMaterialByCondition(
    pipe.fluidType,
    pipe.tempC,
    pipe.pressureBar
  );
  const activeMaterial = pipeOverride?.material ?? matSuggestion.material;

  const recommendedPipeRow =
    PIPE_CATALOG.find(
      (row) => getPipeIdMm(row.dn, activeMaterial) >= dInReqMm
    ) || PIPE_CATALOG[PIPE_CATALOG.length - 1];

  const activeDn = pipeOverride?.dn ?? recommendedPipeRow.dn;
  const activeIdMm = getPipeIdMm(activeDn, activeMaterial);
  const activeAreaM2 = (Math.PI * Math.pow(activeIdMm / 1000, 2)) / 4;
  // KIỂM TRA NGƯỢC ỐNG BẮT BUỘC
  const pipeVelActual = activeAreaM2 > 0 ? qPipeM3s / activeAreaM2 : 0;
  const pipeHeadLossPer100m = calcHazenWilliamsPer100m(
    qPipeM3s,
    activeIdMm,
    activeMaterial === 'uPVC' ? 140 : 130
  );

  const isPipeVelMinOk = qPipeM3h > 0 && pipeVelActual >= 0.6;
  const isPipeVelMaxOk = qPipeM3h > 0 && pipeVelActual <= 2.5;
  const isPipeTempMatOk = !(pipe.tempC >= 55 && activeMaterial === 'uPVC');
  const isPipeAllOk = isPipeVelMinOk && isPipeVelMaxOk && isPipeTempMatOk;

  // === CALCULATIONS: 2. BƠM CÔNG NGHỆ ===
  const qPumpM3h =
    pump.flowSource === 'qMax'
      ? hydraulics.qMaxHour
      : pump.flowSource === 'qAvg'
      ? hydraulics.qHour
      : Math.max(0, Number(pump.customFlowM3h) || 0);
  const qPumpM3s = qPumpM3h / 3600;

  const sucIdMm = getPipeIdMm(pump.suctionDn, pump.pipeMaterial);
  const disIdMm = getPipeIdMm(pump.dischargeDn, pump.pipeMaterial);
  const sucVelActual =
    sucIdMm > 0
      ? qPumpM3s / ((Math.PI * Math.pow(sucIdMm / 1000, 2)) / 4)
      : 0;
  const disVelActual =
    disIdMm > 0
      ? qPumpM3s / ((Math.PI * Math.pow(disIdMm / 1000, 2)) / 4)
      : 0;

  const frictionLoss100m = calcHazenWilliamsPer100m(
    qPumpM3s,
    disIdMm,
    pump.pipeMaterial === 'uPVC' ? 140 : 130
  );
  const frictionLossTotalM = (frictionLoss100m * pump.pipeLengthM) / 100;
  const localLossM =
    frictionLossTotalM * (Math.max(0, pump.localLossFactorPct) / 100);
  const totalDynamicHeadM =
    pump.staticHeadM + frictionLossTotalM + localLossM;

  const hydraulicPowerKw =
    (pump.liquidDensity * 9.81 * qPumpM3s * totalDynamicHeadM) / 1000;
  const shaftPowerKw =
    pump.pumpEffPct > 0 ? hydraulicPowerKw / (pump.pumpEffPct / 100) : 0;
  const requiredMotorKw =
    pump.motorEffPct > 0
      ? (shaftPowerKw * 1.15) / (pump.motorEffPct / 100)
      : 0;
  const selectedMotorKw =
    STANDARD_MOTOR_KW.find((kw) => kw >= requiredMotorKw) ||
    STANDARD_MOTOR_KW[STANDARD_MOTOR_KW.length - 1];

  const isSucVelOk = qPumpM3h > 0 && sucVelActual <= 1.5;
  const isDisVelOk =
    qPumpM3h > 0 && disVelActual >= 0.6 && disVelActual <= 2.5;
  const isPumpAllOk = isSucVelOk && isDisVelOk;

  // === CALCULATIONS: 3. PHỄU THU BÙN INOX ===
  // Nội suy kích thước lý thuyết miệng trên từ V_target và H
  const hHopperTheo = hopper.heightH;
  const bOut = hopper.outletSizeM;
  // Giải đơn giản miệng trên để đạt V_target
  const solveTopDimension = (targetV, h, outSize, shapeType, ratioLW) => {
    if (targetV <= 0 || h <= 0) return outSize + 0.5;
    let low = outSize + 0.1;
    let high = 20;
    for (let i = 0; i < 40; i++) {
      const mid = (low + high) / 2;
      let v = 0;
      if (shapeType === 'Tròn') {
        v =
          ((Math.PI * h) / 12) *
          (mid * mid + mid * outSize + outSize * outSize);
      } else if (shapeType === 'Vuông') {
        const a1 = mid * mid;
        const a2 = outSize * outSize;
        v = (h / 3) * (a1 + a2 + Math.sqrt(a1 * a2));
      } else {
        const lTop = mid * ratioLW;
        const a1 = lTop * mid;
        const a2 = outSize * outSize;
        v = (h / 3) * (a1 + a2 + Math.sqrt(a1 * a2));
      }
      if (v < targetV) low = mid;
      else high = mid;
    }
    return (low + high) / 2;
  };

  const hopTopWTheo = solveTopDimension(
    hopper.targetVolM3,
    hHopperTheo,
    bOut,
    hopper.shape,
    hopper.ratioLW
  );
  const hopTopLTheo =
    hopper.shape === 'Chữ nhật'
      ? hopTopWTheo * hopper.ratioLW
      : hopTopWTheo;

  const activeHopD = hopperOv?.d ?? roundUpToStep(hopTopWTheo, 0.1);
  const activeHopA = hopperOv?.a ?? roundUpToStep(hopTopWTheo, 0.1);
  const activeHopL = hopperOv?.l ?? roundUpToStep(hopTopLTheo, 0.1);
  const activeHopW = hopperOv?.w ?? roundUpToStep(hopTopWTheo, 0.1);
  const activeHopOut = hopperOv?.out ?? bOut;
  const activeHopH = hopperOv?.h ?? hHopperTheo;

  let hopVolActual = 0;
  let hopSurfaceM2 = 0;
  let hopSlopeDeg = 0;

  if (hopper.shape === 'Tròn') {
    hopVolActual =
      ((Math.PI * activeHopH) / 12) *
      (activeHopD * activeHopD +
        activeHopD * activeHopOut +
        activeHopOut * activeHopOut);
    const dr = Math.abs(activeHopD - activeHopOut) / 2;
    const slant = Math.sqrt(dr * dr + activeHopH * activeHopH);
    hopSurfaceM2 = Math.PI * ((activeHopD + activeHopOut) / 2) * slant;
    hopSlopeDeg =
      dr > 0 ? (Math.atan(activeHopH / dr) * 180) / Math.PI : 90;
  } else if (hopper.shape === 'Vuông') {
    const a1 = activeHopA * activeHopA;
    const a2 = activeHopOut * activeHopOut;
    hopVolActual = (activeHopH / 3) * (a1 + a2 + Math.sqrt(a1 * a2));
    const dx = Math.abs(activeHopA - activeHopOut) / 2;
    const slant = Math.sqrt(dx * dx + activeHopH * activeHopH);
    hopSurfaceM2 = 4 * ((activeHopA + activeHopOut) / 2) * slant;
    hopSlopeDeg =
      dx > 0 ? (Math.atan(activeHopH / dx) * 180) / Math.PI : 90;
  } else {
    const a1 = activeHopL * activeHopW;
    const a2 = activeHopOut * activeHopOut;
    hopVolActual = (activeHopH / 3) * (a1 + a2 + Math.sqrt(a1 * a2));
    const dxL = Math.abs(activeHopL - activeHopOut) / 2;
    const dxW = Math.abs(activeHopW - activeHopOut) / 2;
    const slantL = Math.sqrt(dxW * dxW + activeHopH * activeHopH);
    const slantW = Math.sqrt(dxL * dxL + activeHopH * activeHopH);
    hopSurfaceM2 =
      2 * (((activeHopL + activeHopOut) / 2) * slantL) +
      2 * (((activeHopW + activeHopOut) / 2) * slantW);
    const maxRun = Math.max(dxL, dxW);
    hopSlopeDeg =
      maxRun > 0 ? (Math.atan(activeHopH / maxRun) * 180) / Math.PI : 90;
  }

  // Khối lượng tấm Inox 304 (tỷ trọng 7930 kg/m3, cộng 8% bích & gân tăng cứng)
  const hopInoxMassKg =
    hopSurfaceM2 * (hopper.plateThicknessMm / 1000) * 7930 * 1.08;
  const isHopVolOk = hopVolActual >= hopper.targetVolM3;
  const isHopSlopeOk = hopSlopeDeg >= 55;
  const isHopAllOk = isHopVolOk && isHopSlopeOk;

  // === CALCULATIONS: 4. BỘ TRỘN TĨNH & EDUCTOR ===
  const qMixM3s = Math.max(0, Number(eductor.mixerFlowM3h) || 0) / 3600;
  const mixIdMm = getPipeIdMm(eductor.mixerDn, eductor.mixerMaterial);
  const mixAreaM2 = (Math.PI * Math.pow(mixIdMm / 1000, 2)) / 4;
  const mixVelMs = mixAreaM2 > 0 ? qMixM3s / mixAreaM2 : 0;
  // Tổn thất áp qua bộ trộn tĩnh xoắn (K_element ~ 1.8 * rho * v^2 / 2)
  const mixDeltaPPa =
    eductor.mixerElements * 1.8 * 0.5 * 1000 * mixVelMs * mixVelMs;
  const mixDeltaPM = mixDeltaPPa / 9810;
  const mixLengthM = (mixIdMm / 1000) * 1.5 * eductor.mixerElements;
  const mixTimeSec = mixVelMs > 0 ? mixLengthM / mixVelMs : 0;
  // Gradient vận tốc trộn G = sqrt(P / (mu * V)) = sqrt((Q * dP) / (mu * Q * tau)) = sqrt(dP / (mu * tau))
  const mixGSec =
    mixTimeSec > 0 ? Math.sqrt(mixDeltaPPa / (0.001 * mixTimeSec)) : 0;

  const isMixVelOk = mixVelMs >= 0.6 && mixVelMs <= 2.5;
  const isMixGOk = mixGSec >= 500;

  // Eductor khuấy trộn bể
  const qEductorMotiveTotalM3h = Math.max(0, Number(eductor.recircFlowM3h) || 0);
  const qEductorEffectiveM3h =
    qEductorMotiveTotalM3h * (1 + Math.max(0, eductor.entrainmentRatio));
  const tankTurnoverPerHour =
    eductor.tankVolM3 > 0 ? qEductorEffectiveM3h / eductor.tankVolM3 : 0;
  const qOneNozzleM3s =
    eductor.numEductors > 0
      ? qEductorMotiveTotalM3h / 3600 / eductor.numEductors
      : 0;
  const nozzleAreaM2 =
    (Math.PI * Math.pow(eductor.nozzleDiaMm / 1000, 2)) / 4;
  const nozzleVelMs = nozzleAreaM2 > 0 ? qOneNozzleM3s / nozzleAreaM2 : 0;

  const isEductorTurnoverOk = tankTurnoverPerHour >= 1.5;
  const isNozzleVelOk = nozzleVelMs >= 6.0 && nozzleVelMs <= 18.0;
  const isEductorAllOk =
    isMixVelOk && isMixGOk && isEductorTurnoverOk && isNozzleVelOk;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 text-balance">
            Cơ Điện (MEP) & Thủy Lực Đường Ống
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Tính chọn đường kính ống danh định (DN), gợi ý vật liệu theo nhiệt
            độ/hóa chất, kiểm tra ngược vận tốc (0,6–2,5 m/s), bơm công nghệ,
            phễu Inox 304 và bộ trộn tĩnh Eductor.
          </p>
        </div>

        <div className="rounded-xl bg-slate-800 border border-slate-700/80 px-4 py-3 shrink-0 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
          <div className="text-xs text-slate-400">
            Đồng bộ lưu lượng hệ thống (globalQ)
          </div>
          <div className="mt-1 font-mono text-lg font-semibold text-emerald-400 tabular-nums">
            {hydraulics.qHour.toFixed(1)} m³/h (Qmax ={' '}
            {hydraulics.qMaxHour.toFixed(1)} m³/h)
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums">
            {globalQ.toLocaleString('vi-VN')} m³/ngày
          </div>
        </div>
      </section>

      {/* 4 Tabs */}
      <div
        role="tablist"
        aria-label="Hạng mục cơ điện thủy lực"
        className="print:hidden flex items-center gap-2 overflow-x-auto pb-1"
      >
        {MEP_TABS.map((tab) => {
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

      {/* TAB 1: ỐNG THỦY LỰC */}
      {activeTab === 'pipe' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Tính Đường kính trong yêu cầu & Gợi ý vật liệu ống
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Q tính toán = {qPipeM3h.toFixed(2)} m³/h ({qPipeM3s.toFixed(4)}{' '}
                  m³/s)
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                D_trong_yêu_cầu = {dInReqMm.toFixed(1)} mm
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="pipe-q-src"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Nguồn lưu lượng thiết kế
                </label>
                <select
                  id="pipe-q-src"
                  value={pipe.flowSource}
                  onChange={(e) => {
                    setPipe((p) => ({ ...p, flowSource: e.target.value }));
                    setPipeOverride(null);
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="qMax">
                    Theo Qmax,h hệ thống ({hydraulics.qMaxHour.toFixed(1)} m³/h)
                  </option>
                  <option value="qAvg">
                    Theo Qtb,h hệ thống ({hydraulics.qHour.toFixed(1)} m³/h)
                  </option>
                  <option value="custom">Nhập lưu lượng nhánh riêng</option>
                </select>
              </div>

              {pipe.flowSource === 'custom' && (
                <NumberField
                  id="pipe-q-custom"
                  label="Lưu lượng nhánh (Q)"
                  unit="m³/h"
                  value={pipe.customFlowM3h}
                  min={0.5}
                  max={10000}
                  step={5}
                  onChange={(v) => {
                    setPipe((p) => ({ ...p, customFlowM3h: v }));
                    setPipeOverride(null);
                  }}
                />
              )}

              <NumberField
                id="pipe-v-target"
                label="Vận tốc mục tiêu thiết kế (V)"
                unit="m/s"
                value={pipe.targetVelMs}
                min={0.4}
                max={3.5}
                step={0.1}
                onChange={(v) => {
                  setPipe((p) => ({ ...p, targetVelMs: v }));
                  setPipeOverride(null);
                }}
                helperText="Gợi ý: Ống hút 0,6 – 1,2 m/s; Ống đẩy 1,5 – 2,5 m/s"
              />

              <div>
                <label
                  htmlFor="pipe-fluid"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Đặc tính lưu chất / Môi trường
                </label>
                <select
                  id="pipe-fluid"
                  value={pipe.fluidType}
                  onChange={(e) => {
                    setPipe((p) => ({ ...p, fluidType: e.target.value }));
                    setPipeOverride(null);
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="normal_water">
                    Nước sạch / Nước thải thường
                  </option>
                  <option value="hot_industrial">
                    Nước thải CN nhiệt cao / Dung môi
                  </option>
                  <option value="chemical">
                    Hóa chất ăn mòn (Clo / Axit / NaOH)
                  </option>
                  <option value="high_pressure_sludge">
                    Bùn ép / Đường ống chịu áp cao
                  </option>
                </select>
              </div>

              <NumberField
                id="pipe-temp"
                label="Nhiệt độ lưu chất"
                unit="°C"
                value={pipe.tempC}
                min={5}
                max={150}
                step={5}
                onChange={(v) => {
                  setPipe((p) => ({ ...p, tempC: v }));
                  setPipeOverride(null);
                }}
              />

              <NumberField
                id="pipe-press"
                label="Áp suất làm việc tối đa"
                unit="bar"
                value={pipe.pressureBar}
                min={0.5}
                max={25}
                step={0.5}
                onChange={(v) => {
                  setPipe((p) => ({ ...p, pressureBar: v }));
                  setPipeOverride(null);
                }}
              />
            </div>

            <div className="rounded-lg bg-slate-900/80 border border-slate-700/80 p-3.5 flex items-start gap-3">
              <Wrench className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold text-emerald-400">
                  Vật liệu gợi ý: {matSuggestion.material}
                </span>{' '}
                — {matSuggestion.reason}
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Chọn ống DN thị trường & Kiểm tra ngược vận tốc thực (0,6 –
                  2,5 m/s)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Đề xuất gần nhất: DN {recommendedPipeRow.dn} ({activeMaterial}
                  , ID = {getPipeIdMm(recommendedPipeRow.dn, activeMaterial)} mm)
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setPipeOverride({
                    material: matSuggestion.material,
                    dn: recommendedPipeRow.dn,
                  })
                }
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Chọn DN tối ưu theo gợi ý</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="pipe-ov-mat"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Vật liệu ống chọn thi công
                </label>
                <select
                  id="pipe-ov-mat"
                  value={activeMaterial}
                  onChange={(e) =>
                    setPipeOverride({
                      material: e.target.value,
                      dn: activeDn,
                    })
                  }
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="uPVC">Nhựa uPVC (PN10 / Class 3)</option>
                  <option value="Inox 304 SCH10S">
                    Thép không gỉ Inox 304 (SCH10S)
                  </option>
                  <option value="Inox 304 SCH40S">
                    Thép không gỉ Inox 304 (SCH40S - Áp cao)
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="pipe-ov-dn"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Cỡ ống danh định thị trường (DN)
                </label>
                <select
                  id="pipe-ov-dn"
                  value={activeDn}
                  onChange={(e) =>
                    setPipeOverride({
                      material: activeMaterial,
                      dn: Number(e.target.value),
                    })
                  }
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 font-mono text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {PIPE_CATALOG.map((row) => (
                    <option key={row.dn} value={row.dn}>
                      DN {row.dn} (ID thực ={' '}
                      {getPipeIdMm(row.dn, activeMaterial)} mm)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <StatusBanner
              ok={isPipeAllOk}
              titleOk={`ĐẠT CHUẨN ỐNG DN ${activeDn} (${activeMaterial})`}
              titleFail="CẢNH BÁO ĐỎ: VẬN TỐC HOẶC VẬT LIỆU ỐNG KHÔNG ĐẠT CHUẨN"
              message={
                isPipeAllOk
                  ? `Vận tốc thực trong ống DN ${activeDn} (ID = ${activeIdMm} mm) đạt ${pipeVelActual.toFixed(2)} m/s (nằm trong dải 0,60 – 2,50 m/s). Tổn thất áp lực = ${pipeHeadLossPer100m.toFixed(2)} m/100m.`
                  : `${!isPipeVelMinOk ? `Vận tốc thực (${pipeVelActual.toFixed(2)} m/s) < 0,60 m/s — Dễ lắng cặn tắc ống! ` : ''}${!isPipeVelMaxOk ? `Vận tốc thực (${pipeVelActual.toFixed(2)} m/s) > 2,50 m/s — Nguy cơ búa nước & mài mòn! ` : ''}${!isPipeTempMatOk ? `Nhiệt độ ${pipe.tempC}°C vượt giới hạn chịu nhiệt của uPVC — Cần chuyển sang Inox 304!` : ''}`
              }
              summaryRight={`v_thực = ${pipeVelActual.toFixed(2)} m/s`}
            />

            <CheckTable
              rows={[
                {
                  name: `Vận tốc thực trong ống DN ${activeDn} (ID = ${activeIdMm} mm)`,
                  standard: '0,60 – 2,50 m/s',
                  actual: `${pipeVelActual.toFixed(2)} m/s`,
                  ok: isPipeVelMinOk && isPipeVelMaxOk,
                  statusText: !isPipeVelMinOk
                    ? 'Quá chậm (< 0,6 m/s)'
                    : !isPipeVelMaxOk
                    ? 'Quá nhanh (> 2,5 m/s)'
                    : 'Đạt chuẩn',
                },
                {
                  name: 'Tương thích vật liệu theo nhiệt độ',
                  standard:
                    pipe.tempC >= 55 ? 'Inox 304 SCH10S/40S' : 'uPVC / Inox',
                  actual: `${activeMaterial} (${pipe.tempC}°C)`,
                  ok: isPipeTempMatOk,
                  statusText: isPipeTempMatOk
                    ? 'An toàn vật liệu'
                    : 'Biến dạng nhiệt',
                },
                {
                  name: 'Tổn thất ma sát dọc đường (Hazen-Williams)',
                  standard: '≤ 3,00 m/100m (khuyến nghị)',
                  actual: `${pipeHeadLossPer100m.toFixed(2)} m/100m`,
                  ok: pipeHeadLossPer100m <= 5.0,
                  statusText:
                    pipeHeadLossPer100m <= 5.0
                      ? 'Tổn thất hợp lý'
                      : 'Tổn thất cao',
                },
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 2: BƠM CÔNG NGHỆ */}
      {activeTab === 'pump' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Tính Cột áp (TDH) & Công suất Động cơ Bơm
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Q_bơm = {qPumpM3h.toFixed(1)} m³/h · Cột áp toàn phần TDH ={' '}
                  {totalDynamicHeadM.toFixed(2)} m
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                Motor chọn: {selectedMotorKw} kW (P_trục ={' '}
                {shaftPowerKw.toFixed(2)} kW)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="pump-q-src"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Lưu lượng bơm thiết kế
                </label>
                <select
                  id="pump-q-src"
                  value={pump.flowSource}
                  onChange={(e) =>
                    setPump((p) => ({ ...p, flowSource: e.target.value }))
                  }
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="qMax">
                    Theo Qmax,h ({hydraulics.qMaxHour.toFixed(1)} m³/h)
                  </option>
                  <option value="qAvg">
                    Theo Qtb,h ({hydraulics.qHour.toFixed(1)} m³/h)
                  </option>
                  <option value="custom">Nhập lưu lượng bơm riêng</option>
                </select>
              </div>

              {pump.flowSource === 'custom' && (
                <NumberField
                  id="pump-q-custom"
                  label="Lưu lượng 1 bơm (Q)"
                  unit="m³/h"
                  value={pump.customFlowM3h}
                  min={0.5}
                  max={5000}
                  step={5}
                  onChange={(v) =>
                    setPump((p) => ({ ...p, customFlowM3h: v }))
                  }
                />
              )}

              <NumberField
                id="pump-hstatic"
                label="Chiều cao bơm hình học (H_tĩnh)"
                unit="m"
                value={pump.staticHeadM}
                min={0}
                max={120}
                step={0.5}
                onChange={(v) => setPump((p) => ({ ...p, staticHeadM: v }))}
              />

              <NumberField
                id="pump-len"
                label="Tổng chiều dài tuyến ống đẩy"
                unit="m"
                value={pump.pipeLengthM}
                min={1}
                max={2000}
                step={5}
                onChange={(v) => setPump((p) => ({ ...p, pipeLengthM: v }))}
              />

              <div>
                <label
                  htmlFor="pump-suc-dn"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Cỡ ống hút (DN hút)
                </label>
                <select
                  id="pump-suc-dn"
                  value={pump.suctionDn}
                  onChange={(e) =>
                    setPump((p) => ({
                      ...p,
                      suctionDn: Number(e.target.value),
                    }))
                  }
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 font-mono text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {PIPE_CATALOG.map((r) => (
                    <option key={r.dn} value={r.dn}>
                      DN {r.dn} (ID {getPipeIdMm(r.dn, pump.pipeMaterial)} mm)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1 italic">
                  Gợi ý: V_hút = 0,6 – 1,2 m/s (chống xâm thực)
                </p>
              </div>

              <div>
                <label
                  htmlFor="pump-dis-dn"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Cỡ ống đẩy (DN đẩy)
                </label>
                <select
                  id="pump-dis-dn"
                  value={pump.dischargeDn}
                  onChange={(e) =>
                    setPump((p) => ({
                      ...p,
                      dischargeDn: Number(e.target.value),
                    }))
                  }
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 font-mono text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {PIPE_CATALOG.map((r) => (
                    <option key={r.dn} value={r.dn}>
                      DN {r.dn} (ID {getPipeIdMm(r.dn, pump.pipeMaterial)} mm)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1 italic">
                  Gợi ý: V_đẩy = 1,5 – 2,5 m/s
                </p>
              </div>

              <NumberField
                id="pump-eff"
                label="Hiệu suất thủy lực bơm (η_bơm)"
                unit="%"
                value={pump.pumpEffPct}
                min={30}
                max={90}
                step={2}
                onChange={(v) => setPump((p) => ({ ...p, pumpEffPct: v }))}
                helperText="Gợi ý: 60 – 80 %"
              />

              <NumberField
                id="pump-dens"
                label="Tỷ trọng lưu chất bơm"
                unit="kg/m³"
                value={pump.liquidDensity}
                min={950}
                max={1400}
                step={10}
                onChange={(v) => setPump((p) => ({ ...p, liquidDensity: v }))}
              />
            </div>

            <StatusBanner
              ok={isPumpAllOk}
              titleOk={`ĐẠT CHUẨN BƠM — CHỌN MOTOR ${selectedMotorKw} kW (TDH = ${totalDynamicHeadM.toFixed(1)} m)`}
              titleFail="CẢNH BÁO ĐỎ: VẬN TỐC ỐNG HÚT / ỐNG ĐẨY BƠM NGOÀI NGƯỠNG"
              message={
                isPumpAllOk
                  ? `Ống hút DN ${pump.suctionDn} (v = ${sucVelActual.toFixed(2)} m/s ≤ 1,5 m/s) và ống đẩy DN ${pump.dischargeDn} (v = ${disVelActual.toFixed(2)} m/s) đạt chuẩn. Công suất trục = ${shaftPowerKw.toFixed(2)} kW → Chọn động cơ ${selectedMotorKw} kW.`
                  : `${!isSucVelOk ? `Vận tốc ống hút (${sucVelActual.toFixed(2)} m/s) > 1,50 m/s — Nguy cơ xâm thực hỏng cánh bơm! ` : ''}${!isDisVelOk ? `Vận tốc ống đẩy (${disVelActual.toFixed(2)} m/s) ngoài dải 0,60 – 2,50 m/s.` : ''}`
              }
              summaryRight={`${selectedMotorKw} kW · H = ${totalDynamicHeadM.toFixed(1)} m`}
            />

            <CheckTable
              rows={[
                {
                  name: `Vận tốc ống hút DN ${pump.suctionDn} (Chống xâm thực)`,
                  standard: '≤ 1,50 m/s',
                  actual: `${sucVelActual.toFixed(2)} m/s`,
                  ok: isSucVelOk,
                  statusText: isSucVelOk
                    ? 'An toàn hút'
                    : 'Quá nhanh (Xâm thực)',
                },
                {
                  name: `Vận tốc ống đẩy DN ${pump.dischargeDn}`,
                  standard: '0,60 – 2,50 m/s',
                  actual: `${disVelActual.toFixed(2)} m/s`,
                  ok: isDisVelOk,
                  statusText: isDisVelOk ? 'Đạt chuẩn' : 'Ngoài ngưỡng',
                },
                {
                  name: 'Tổng cột áp toàn phần (TDH = H_tĩnh + Δh)',
                  standard: `H_tĩnh = ${pump.staticHeadM} m`,
                  actual: `${totalDynamicHeadM.toFixed(2)} m (Δh = ${(frictionLossTotalM + localLossM).toFixed(2)} m)`,
                  ok: true,
                  statusText: `P_trục = ${shaftPowerKw.toFixed(2)} kW`,
                },
                {
                  name: 'Công suất động cơ chọn (kèm dự phòng 15%)',
                  standard: `≥ ${requiredMotorKw.toFixed(2)} kW`,
                  actual: `${selectedMotorKw} kW`,
                  ok: true,
                  statusText: 'Cấu hình 1 chạy + 1 dự phòng',
                },
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 3: PHỄU THU BÙN INOX */}
      {activeTab === 'hopper' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Phễu Thu bùn Inox 304 (Bích {hopper.shape})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tính thể tích nón/chóp cụt, kiểm tra góc dốc tự trượt bùn (≥
                  55°) và bóc tách khối lượng tấm Inox 304.
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                {hopper.shape === 'Tròn'
                  ? `Ø_lt = ${hopTopWTheo.toFixed(2)} m`
                  : hopper.shape === 'Vuông'
                  ? `Cạnh_lt = ${hopTopWTheo.toFixed(2)} m`
                  : `${hopTopLTheo.toFixed(2)} × ${hopTopWTheo.toFixed(2)} m`}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="hop-shape"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Hình dạng bích miệng phễu Inox
                </label>
                <select
                  id="hop-shape"
                  value={hopper.shape}
                  onChange={(e) => {
                    setHopper((p) => ({ ...p, shape: e.target.value }));
                    setHopperOv(null);
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Vuông">Vuông (Chóp cụt a × a)</option>
                  <option value="Chữ nhật">Chữ nhật (Chóp cụt L × W)</option>
                  <option value="Tròn">Tròn (Nón cụt Ø D)</option>
                </select>
              </div>

              <NumberField
                id="hop-vol"
                label="Thể tích chứa bùn yêu cầu (V_lt)"
                unit="m³"
                value={hopper.targetVolM3}
                min={0.1}
                max={50}
                step={0.1}
                onChange={(v) => {
                  setHopper((p) => ({ ...p, targetVolM3: v }));
                  setHopperOv(null);
                }}
              />

              <NumberField
                id="hop-h"
                label="Chiều cao phễu thiết kế (H)"
                unit="m"
                value={hopper.heightH}
                min={0.4}
                max={6.0}
                step={0.1}
                onChange={(v) => {
                  setHopper((p) => ({ ...p, heightH: v }));
                  setHopperOv(null);
                }}
              />

              <NumberField
                id="hop-out"
                label="Cửa xả bùn đáy phễu"
                unit="m"
                value={hopper.outletSizeM}
                min={0.08}
                max={0.8}
                step={0.05}
                onChange={(v) => {
                  setHopper((p) => ({ ...p, outletSizeM: v }));
                  setHopperOv(null);
                }}
              />

              <NumberField
                id="hop-thick"
                label="Độ dày tấm Inox 304 chế tạo"
                unit="mm"
                value={hopper.plateThicknessMm}
                min={1.5}
                max={10.0}
                step={0.5}
                onChange={(v) =>
                  setHopper((p) => ({ ...p, plateThicknessMm: v }))
                }
              />

              {hopper.shape === 'Chữ nhật' && (
                <NumberField
                  id="hop-ratio"
                  label="Tỷ lệ Dài / Rộng bích trên (L/W)"
                  unit="L/W"
                  value={hopper.ratioLW}
                  min={1.1}
                  max={3.5}
                  step={0.1}
                  onChange={(v) => {
                    setHopper((p) => ({ ...p, ratioLW: v }));
                    setHopperOv(null);
                  }}
                />
              )}
            </div>
          </section>

          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Nhập đè kích thước phễu chế tạo & Tính thể tích nón/chóp
                  cụt
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kiểm tra ngược V_phễu thực tế và góc nghiêng tự chảy bùn (≥
                  55°).
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setHopperOv({
                    d: roundUpToStep(hopTopWTheo, 0.1),
                    a: roundUpToStep(hopTopWTheo, 0.1),
                    l: roundUpToStep(hopTopLTheo, 0.1),
                    w: roundUpToStep(hopTopWTheo, 0.1),
                    out: hopper.outletSizeM,
                    h: hopper.heightH,
                  })
                }
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Làm tròn theo lý thuyết</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {hopper.shape === 'Tròn' && (
                <NumberField
                  id="hop-ov-d"
                  label="Đường kính bích trên (D)"
                  unit="m"
                  value={activeHopD}
                  min={0.3}
                  max={8.0}
                  step={0.1}
                  onChange={(v) =>
                    setHopperOv({
                      d: v,
                      a: activeHopA,
                      l: activeHopL,
                      w: activeHopW,
                      out: activeHopOut,
                      h: activeHopH,
                    })
                  }
                />
              )}

              {hopper.shape === 'Vuông' && (
                <NumberField
                  id="hop-ov-a"
                  label="Cạnh bích vuông trên (a)"
                  unit="m"
                  value={activeHopA}
                  min={0.3}
                  max={8.0}
                  step={0.1}
                  onChange={(v) =>
                    setHopperOv({
                      d: activeHopD,
                      a: v,
                      l: activeHopL,
                      w: activeHopW,
                      out: activeHopOut,
                      h: activeHopH,
                    })
                  }
                />
              )}

              {hopper.shape === 'Chữ nhật' && (
                <>
                  <NumberField
                    id="hop-ov-l"
                    label="Chiều dài bích trên (L)"
                    unit="m"
                    value={activeHopL}
                    min={0.3}
                    max={10.0}
                    step={0.1}
                    onChange={(v) =>
                      setHopperOv({
                        d: activeHopD,
                        a: activeHopA,
                        l: v,
                        w: activeHopW,
                        out: activeHopOut,
                        h: activeHopH,
                      })
                    }
                  />
                  <NumberField
                    id="hop-ov-w"
                    label="Chiều rộng bích trên (W)"
                    unit="m"
                    value={activeHopW}
                    min={0.3}
                    max={8.0}
                    step={0.1}
                    onChange={(v) =>
                      setHopperOv({
                        d: activeHopD,
                        a: activeHopA,
                        l: activeHopL,
                        w: v,
                        out: activeHopOut,
                        h: activeHopH,
                      })
                    }
                  />
                </>
              )}

              <NumberField
                id="hop-ov-out"
                label="Kích thước cửa xả đáy"
                unit="m"
                value={activeHopOut}
                min={0.05}
                max={1.0}
                step={0.05}
                onChange={(v) =>
                  setHopperOv({
                    d: activeHopD,
                    a: activeHopA,
                    l: activeHopL,
                    w: activeHopW,
                    out: v,
                    h: activeHopH,
                  })
                }
              />

              <NumberField
                id="hop-ov-h"
                label="Chiều cao phễu thực tế (H)"
                unit="m"
                value={activeHopH}
                min={0.3}
                max={6.0}
                step={0.1}
                onChange={(v) =>
                  setHopperOv({
                    d: activeHopD,
                    a: activeHopA,
                    l: activeHopL,
                    w: activeHopW,
                    out: activeHopOut,
                    h: v,
                  })
                }
              />
            </div>

            <StatusBanner
              ok={isHopAllOk}
              titleOk="ĐẠT CHUẨN PHỄU THU BÙN INOX 304"
              titleFail="CẢNH BÁO ĐỎ: THIẾU THỂ TÍCH HOẶC GÓC DỐC TỰ CHẢY QUÁ THOẢI"
              message={
                isHopAllOk
                  ? `Thể tích nón/chóp cụt = ${hopVolActual.toFixed(2)} m³ (≥ ${hopper.targetVolM3} m³), góc thành phễu = ${hopSlopeDeg.toFixed(1)}° (≥ 55°). Khối lượng Inox 304 dày ${hopper.plateThicknessMm} mm ≈ ${hopInoxMassKg.toFixed(1)} kg.`
                  : `${!isHopVolOk ? `Thể tích thực (${hopVolActual.toFixed(2)} m³) < yêu cầu (${hopper.targetVolM3} m³). ` : ''}${!isHopSlopeOk ? `Góc nghiêng thành phễu (${hopSlopeDeg.toFixed(1)}°) < 55° — Bùn dễ bám thành không tự tụt xuống đáy!` : ''}`
              }
              summaryRight={`V = ${hopVolActual.toFixed(2)} m³ · ${hopSlopeDeg.toFixed(1)}°`}
            />

            <CheckTable
              rows={[
                {
                  name: `Thể tích nón / chóp cụt thực tế (Bích ${hopper.shape})`,
                  standard: `≥ ${hopper.targetVolM3.toFixed(2)} m³`,
                  actual: `${hopVolActual.toFixed(2)} m³`,
                  ok: isHopVolOk,
                  statusText: isHopVolOk ? 'Đủ thể tích' : 'Thiếu thể tích',
                },
                {
                  name: 'Góc nghiêng nhỏ nhất thành phễu (tự trượt bùn)',
                  standard: '≥ 55,0°',
                  actual: `${hopSlopeDeg.toFixed(1)}°`,
                  ok: isHopSlopeOk,
                  statusText: isHopSlopeOk
                    ? 'Tự trượt tốt'
                    : 'Đọng bùn (< 55°)',
                },
                {
                  name: `Diện tích & Khối lượng Inox 304 (tấm ${hopper.plateThicknessMm} mm)`,
                  standard: 'Đã gồm +8% bích & gân',
                  actual: `${hopSurfaceM2.toFixed(2)} m² · ${hopInoxMassKg.toFixed(1)} kg`,
                  ok: true,
                  statusText: 'Dự toán chế tạo',
                },
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 4: BỘ TRỘN TĨNH & EDUCTOR */}
      {activeTab === 'eductor' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Bộ Trộn Tĩnh Trong Ống (Static Mixer) & Vòi Khuấy Eductor
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kiểm tra Gradient trộn tức thời G (s⁻¹), tổn thất áp qua cánh
                  xoắn và cường độ khuấy đảo bể bằng đầu phun Eductor.
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                G_trộn = {mixGSec.toFixed(0)} s⁻¹ · Đảo bể ={' '}
                {tankTurnoverPerHour.toFixed(2)} lần/h
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <NumberField
                id="mix-q"
                label="Lưu lượng qua bộ trộn tĩnh"
                unit="m³/h"
                value={eductor.mixerFlowM3h}
                min={1}
                max={5000}
                step={5}
                onChange={(v) =>
                  setEductor((p) => ({ ...p, mixerFlowM3h: v }))
                }
              />

              <div>
                <label
                  htmlFor="mix-dn"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Cỡ ống bộ trộn tĩnh (DN)
                </label>
                <select
                  id="mix-dn"
                  value={eductor.mixerDn}
                  onChange={(e) =>
                    setEductor((p) => ({
                      ...p,
                      mixerDn: Number(e.target.value),
                    }))
                  }
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 font-mono text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {PIPE_CATALOG.map((r) => (
                    <option key={r.dn} value={r.dn}>
                      DN {r.dn} (ID {getPipeIdMm(r.dn, eductor.mixerMaterial)} mm)
                    </option>
                  ))}
                </select>
              </div>

              <NumberField
                id="mix-elem"
                label="Số phần tử cánh xoắn"
                unit="cánh"
                value={eductor.mixerElements}
                min={2}
                max={12}
                step={1}
                onChange={(v) =>
                  setEductor((p) => ({ ...p, mixerElements: v }))
                }
              />

              <NumberField
                id="ed-tank"
                label="Thể tích bể đặt đầu phun Eductor"
                unit="m³"
                value={eductor.tankVolM3}
                min={5}
                max={2000}
                step={5}
                onChange={(v) => setEductor((p) => ({ ...p, tankVolM3: v }))}
              />

              <NumberField
                id="ed-q"
                label="Lưu lượng bơm động lực Eductor"
                unit="m³/h"
                value={eductor.recircFlowM3h}
                min={1}
                max={1000}
                step={5}
                onChange={(v) =>
                  setEductor((p) => ({ ...p, recircFlowM3h: v }))
                }
              />

              <NumberField
                id="ed-ratio"
                label="Tỷ số hút cuốn dòng thứ cấp"
                unit="lần"
                value={eductor.entrainmentRatio}
                min={2}
                max={5}
                step={0.5}
                onChange={(v) =>
                  setEductor((p) => ({ ...p, entrainmentRatio: v }))
                }
              />

              <NumberField
                id="ed-num"
                label="Số đầu phun Eductor lắp trong bể"
                unit="đầu"
                value={eductor.numEductors}
                min={1}
                max={24}
                step={1}
                onChange={(v) =>
                  setEductor((p) => ({ ...p, numEductors: v }))
                }
              />

              <NumberField
                id="ed-noz"
                label="Đường kính họng phun (Nozzle)"
                unit="mm"
                value={eductor.nozzleDiaMm}
                min={10}
                max={60}
                step={2}
                onChange={(v) =>
                  setEductor((p) => ({ ...p, nozzleDiaMm: v }))
                }
              />
            </div>

            <StatusBanner
              ok={isEductorAllOk}
              titleOk="ĐẠT CHUẨN TRỘN TĨNH & KHUẤY EDUCTOR"
              titleFail="CẢNH BÁO ĐỎ: THÔNG SỐ TRỘN TĨNH HOẶC EDUCTOR CHƯA ĐẠT"
              message={
                isEductorAllOk
                  ? `Static Mixer DN ${eductor.mixerDn} đạt v = ${mixVelMs.toFixed(2)} m/s, G = ${mixGSec.toFixed(0)} s⁻¹ (ΔP = ${mixDeltaPM.toFixed(2)} m). Cụm ${eductor.numEductors} đầu Eductor tạo tổng dòng ${qEductorEffectiveM3h.toFixed(0)} m³/h (${tankTurnoverPerHour.toFixed(2)} lần/h).`
                  : `${!isMixVelOk ? `Vận tốc bộ trộn tĩnh (${mixVelMs.toFixed(2)} m/s) ngoài dải 0,6–2,5 m/s. ` : ''}${!isMixGOk ? `Gradient trộn G (${mixGSec.toFixed(0)} s⁻¹) < 500 s⁻¹ — Chưa đủ lực trộn hóa chất! ` : ''}${!isEductorTurnoverOk ? `Số lần đảo trộn bể (${tankTurnoverPerHour.toFixed(2)} lần/h) < 1,5 lần/h. ` : ''}${!isNozzleVelOk ? `Vận tốc tia họng phun (${nozzleVelMs.toFixed(1)} m/s) ngoài dải 6–18 m/s.` : ''}`
              }
              summaryRight={`G = ${mixGSec.toFixed(0)} s⁻¹ · v_tia = ${nozzleVelMs.toFixed(1)} m/s`}
            />

            <CheckTable
              rows={[
                {
                  name: `Vận tốc qua Bộ trộn tĩnh DN ${eductor.mixerDn}`,
                  standard: '0,60 – 2,50 m/s',
                  actual: `${mixVelMs.toFixed(2)} m/s`,
                  ok: isMixVelOk,
                  statusText: isMixVelOk ? 'Đạt chuẩn' : 'Ngoài ngưỡng',
                },
                {
                  name: `Cường độ trộn G (${eductor.mixerElements} cánh xoắn, dài ${mixLengthM.toFixed(2)} m)`,
                  standard: '≥ 500 s⁻¹',
                  actual: `${mixGSec.toFixed(0)} s⁻¹ (ΔP = ${mixDeltaPM.toFixed(2)} m)`,
                  ok: isMixGOk,
                  statusText: isMixGOk ? 'Trộn tức thời tốt' : 'Trộn yếu',
                },
                {
                  name: 'Lưu lượng khuấy hiệu dụng & Tần suất đảo bể Eductor',
                  standard: '≥ 1,50 lần/giờ',
                  actual: `${qEductorEffectiveM3h.toFixed(0)} m³/h (${tankTurnoverPerHour.toFixed(2)} lần/h)`,
                  ok: isEductorTurnoverOk,
                  statusText: isEductorTurnoverOk
                    ? 'Đủ khuấy đảo'
                    : 'Lắng cặn góc bể',
                },
                {
                  name: `Vận tốc tia họng phun Ø${eductor.nozzleDiaMm} mm (${eductor.numEductors} đầu)`,
                  standard: '6,0 – 18,0 m/s',
                  actual: `${nozzleVelMs.toFixed(1)} m/s`,
                  ok: isNozzleVelOk,
                  statusText: isNozzleVelOk
                    ? 'Tạo hút cuốn tốt'
                    : nozzleVelMs < 6
                    ? 'Tia phun yếu'
                    : 'Áp lực tia quá cao',
                },
              ]}
            />
          </section>
        </div>
      )}

      <EquipmentSelector
        key={`omnieco_equipments_mephydraulics_${activeTab}`}
        moduleLabel={MEP_EQUIPMENT_LABELS[activeTab] || 'Hạng mục MEP & Ống'}
        storageKey={`omnieco_equipments_mephydraulics_${activeTab}`}
      />
    </div>
  );
}
