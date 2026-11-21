import { useState } from 'react';
import {
  Cpu,
  Filter,
  RotateCcw,
  ShieldAlert,
  Sparkles,
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
import { useProjectState } from '../hooks/useProjectState';

const WATER_ADV_EQUIPMENT_LABELS = {
  softener: 'Cột Làm mềm nước (Cation)',
  carbon: 'Cột Lọc Than hoạt tính',
  ro_uf: 'Hệ thống Màng lọc RO / UF',
  medical: 'Hệ thống Nước rửa tay Y tế',
};

const ADV_TABS = [
  { id: 'softener', label: 'Làm mềm', icon: Sparkles },
  { id: 'carbon', label: 'Lọc than', icon: Filter },
  { id: 'ro_uf', label: 'RO / UF', icon: Cpu },
  { id: 'medical', label: 'Nước rửa tay y tế', icon: ShieldAlert },
];

const MARKET_COLUMN_DIAMETERS_M = [
  0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.75, 0.9, 1.05, 1.2, 1.4, 1.6, 1.8, 2.0,
];

const RO_ELEMENTS = {
  'RO 8040': { label: 'Màng RO 8040 (37,2 m²/màng)', areaM2: 37.2, maxFlux: 24 },
  'RO 4040': { label: 'Màng RO 4040 (7,9 m²/màng)', areaM2: 7.9, maxFlux: 24 },
  'UF 8060': { label: 'Module UF 8060 (50 m²/vỏ)', areaM2: 50.0, maxFlux: 85 },
};

export default function WaterSupplyAdvanced() {
  const { globalQ, setGlobalQ, hydraulics } = useAppContext();
  const [activeTab, setActiveTab] = useState('softener');

  const qHour = hydraulics.qHour;

  // --- Tab 1: Làm mềm (Cột Cation Tròn) ---
  const [softener, setSoftener] = useProjectState('waterAdv_softener', {
    numCols: 2,
    velTarget: 18, // m/h (chuẩn 15 - 25)
    velMax: 25,
    hardnessIn: 200, // mg/L CaCO3
    hardnessOut: 10,
    resinCapacityGL: 45, // g CaCO3 / L nhựa
    cycleHours: 12, // giờ giữa 2 lần hoàn nguyên
    resinDepthM: 1.2,
  });
  const [softOv, setSoftOv] = useProjectState('waterAdv_softOv', null);

  // --- Tab 2: Lọc than (Cột Than hoạt tính Tròn) ---
  const [carbon, setCarbon] = useProjectState('waterAdv_carbon', {
    numCols: 2,
    velTarget: 10, // m/h (chuẩn 8 - 15)
    velMax: 15,
    ebctMin: 8, // phút (tối thiểu 5 phút)
    mediaDepthM: 1.2,
  });
  const [carbonOv, setCarbonOv] = useProjectState('waterAdv_carbonOv', null);

  // --- Tab 3: RO / UF ---
  const [rouf, setRouf] = useProjectState('waterAdv_rouf', {
    systemType: 'RO', // RO | UF
    elementModel: 'RO 8040',
    fluxTargetLmh: 18,
    recoveryPct: 75,
    elementsPerHousing: 4,
  });
  const [roufOv, setRoufOv] = useProjectState('waterAdv_roufOv', null);

  // --- Tab 4: Nước rửa tay y tế ---
  const [medical, setMedical] = useProjectState('waterAdv_medical', {
    pipeInnerDiaMm: 25, // mm (Inox 316L DN25)
    deadLegLengthMm: 60, // mm (Chuẩn <= 3 * d = 75 mm)
    loopFlowM3h: 4.5, // lưu lượng bơm tuần hoàn giữ v >= 1.0 m/s
    finalFilterMicron: '0.2', // Bắt buộc <= 0.2 um
    numCartridges: 2,
    cartridgeAreaM2: 0.7, // m2 / lõi 20 inch
    maxFilterVelMh: 3.0, // m/h (tương đương 3000 LMH cho lõi tinh 0.2 um)
    housingDiaM: 0.25,
    housingHeightM: 0.8,
  });

  // === CALCULATIONS: 1. LÀM MỀM ===
  const nSoftCols = Math.max(1, Number(softener.numCols) || 1);
  const qPerSoftH = qHour / nSoftCols;
  const softAreaFromVel =
    softener.velTarget > 0 ? qPerSoftH / softener.velTarget : 0;
  const deltaHardness = Math.max(0, softener.hardnessIn - softener.hardnessOut);
  const resinVolRequired =
    softener.resinCapacityGL > 0
      ? (qPerSoftH * softener.cycleHours * deltaHardness) /
        (1000 * softener.resinCapacityGL)
      : 0;
  const softAreaFromResin =
    softener.resinDepthM > 0 ? resinVolRequired / softener.resinDepthM : 0;
  const softAreaTheo = Math.max(softAreaFromVel, softAreaFromResin);
  const softDiaTheo = Math.sqrt((4 * softAreaTheo) / Math.PI);
  const softHeightTheo = softener.resinDepthM * 1.45 + 0.4;
  const softDiaRec =
    MARKET_COLUMN_DIAMETERS_M.find((d) => d >= softDiaTheo) ??
    roundUpToStep(softDiaTheo, 0.1);
  const softHeightRec = roundUpToStep(softHeightTheo, 0.1);

  const activeSoftD = softOv?.D ?? softDiaRec;
  const activeSoftH = softOv?.H ?? softHeightRec;
  const softAreaActual = (Math.PI * activeSoftD * activeSoftD) / 4;
  const softVelActual = softAreaActual > 0 ? qPerSoftH / softAreaActual : 0;
  const softResinVolActual = softAreaActual * softener.resinDepthM;
  const softCycleActualH =
    qPerSoftH * deltaHardness > 0
      ? (softResinVolActual * 1000 * softener.resinCapacityGL) /
        (qPerSoftH * deltaHardness)
      : 0;
  const softSaltKgPerRegen = softResinVolActual * 130; // ~130 kg NaCl / m3 nhựa

  const isSoftVelOk =
    hydraulics.qDay > 0 &&
    softVelActual > 0 &&
    softVelActual <= softener.velMax;
  const isSoftDiaOk = hydraulics.qDay > 0 && activeSoftD >= softDiaTheo;
  const isSoftAllOk = isSoftVelOk && isSoftDiaOk;

  // === CALCULATIONS: 2. LỌC THAN ===
  const nCarbonCols = Math.max(1, Number(carbon.numCols) || 1);
  const qPerCarbonH = qHour / nCarbonCols;
  const carbonAreaFromVel =
    carbon.velTarget > 0 ? qPerCarbonH / carbon.velTarget : 0;
  const carbonVolFromEbct = qPerCarbonH * (carbon.ebctMin / 60);
  const carbonAreaFromEbct =
    carbon.mediaDepthM > 0 ? carbonVolFromEbct / carbon.mediaDepthM : 0;
  const carbonAreaTheo = Math.max(carbonAreaFromVel, carbonAreaFromEbct);
  const carbonDiaTheo = Math.sqrt((4 * carbonAreaTheo) / Math.PI);
  const carbonHeightTheo = carbon.mediaDepthM * 1.35 + 0.4;
  const carbonDiaRec =
    MARKET_COLUMN_DIAMETERS_M.find((d) => d >= carbonDiaTheo) ??
    roundUpToStep(carbonDiaTheo, 0.1);
  const carbonHeightRec = roundUpToStep(carbonHeightTheo, 0.1);

  const activeCarbonD = carbonOv?.D ?? carbonDiaRec;
  const activeCarbonH = carbonOv?.H ?? carbonHeightRec;
  const carbonAreaActual = (Math.PI * activeCarbonD * activeCarbonD) / 4;
  const carbonVelActual =
    carbonAreaActual > 0 ? qPerCarbonH / carbonAreaActual : 0;
  const carbonMediaVolActual = carbonAreaActual * carbon.mediaDepthM;
  const carbonMassActualKg = carbonMediaVolActual * 500;
  const carbonEbctActual =
    qPerCarbonH > 0 ? (carbonMediaVolActual / qPerCarbonH) * 60 : 0;

  const isCarbonVelOk =
    hydraulics.qDay > 0 &&
    carbonVelActual > 0 &&
    carbonVelActual <= carbon.velMax;
  const isCarbonEbctOk = hydraulics.qDay > 0 && carbonEbctActual >= 5.0;
  const isCarbonAllOk = isCarbonVelOk && isCarbonEbctOk;

  // === CALCULATIONS: 3. RO / UF ===
  const elemInfo = RO_ELEMENTS[rouf.elementModel] || RO_ELEMENTS['RO 8040'];
  const qPermeateH = qHour;
  const qFeedH =
    rouf.recoveryPct > 0 ? qPermeateH / (rouf.recoveryPct / 100) : qPermeateH;
  const qRejectH = Math.max(0, qFeedH - qPermeateH);
  const memAreaTheo =
    rouf.fluxTargetLmh > 0 ? (qPermeateH * 1000) / rouf.fluxTargetLmh : 0;
  const numElementsTheo =
    elemInfo.areaM2 > 0
      ? Math.max(1, Math.ceil(memAreaTheo / elemInfo.areaM2))
      : 1;
  const elemPerHousing = Math.max(1, Number(rouf.elementsPerHousing) || 1);
  const numHousingsTheo = Math.max(
    1,
    Math.ceil(numElementsTheo / Math.max(1, elemPerHousing))
  );

  const activeHousings = roufOv?.housings ?? numHousingsTheo;
  const activeElemPerHousing = roufOv?.elemPerHousing ?? elemPerHousing;
  const totalElementsActual = activeHousings * activeElemPerHousing;
  const totalMemAreaActual = totalElementsActual * elemInfo.areaM2;
  const fluxActualLmh =
    totalMemAreaActual > 0 ? (qPermeateH * 1000) / totalMemAreaActual : 0;
  const velPerHousingM3h = activeHousings > 0 ? qFeedH / activeHousings : 0;

  const isRoufFluxOk =
    hydraulics.qDay > 0 &&
    fluxActualLmh > 0 &&
    fluxActualLmh <= elemInfo.maxFlux;
  const isRoufCountOk =
    hydraulics.qDay > 0 && totalElementsActual >= numElementsTheo;
  const isRoufAllOk = isRoufFluxOk && isRoufCountOk;

  // === CALCULATIONS: 4. NƯỚC RỬA TAY Y TẾ ===
  const deadLegRatio =
    medical.pipeInnerDiaMm > 0
      ? medical.deadLegLengthMm / medical.pipeInnerDiaMm
      : 999;
  const maxAllowedDeadLegMm = medical.pipeInnerDiaMm * 3;
  const isDeadLegOk =
    medical.pipeInnerDiaMm > 0 && deadLegRatio <= 3.0;

  const isSterileMicronOk =
    medical.finalFilterMicron === '0.2' || medical.finalFilterMicron === '0.1';

  const nCartridges = Math.max(1, Number(medical.numCartridges) || 1);
  const totalCartridgeArea = nCartridges * medical.cartridgeAreaM2;
  const medFilterVelActual =
    totalCartridgeArea > 0 ? qHour / totalCartridgeArea : 0;
  const isMedFilterVelOk =
    hydraulics.qDay > 0 &&
    medFilterVelActual > 0 &&
    medFilterVelActual <= medical.maxFilterVelMh;

  const pipeAreaM2 = Math.PI * Math.pow(medical.pipeInnerDiaMm / 1000 / 2, 2);
  const loopVelocityMs =
    pipeAreaM2 > 0 ? medical.loopFlowM3h / 3600 / pipeAreaM2 : 0;
  const isLoopVelOk = loopVelocityMs >= 1.0;

  const isMedicalAllOk =
    isDeadLegOk && isSterileMicronOk && isMedFilterVelOk && isLoopVelOk;

  return (
    <div className="space-y-6">
      {/* Header & Global Q */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 text-balance">
            Xử Lý Nước Cấp Nâng Cao & Nước Y Tế
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Thiết kế cột Làm mềm, Lọc than hoạt tính, màng RO/UF và kiểm tra
            nghiêm ngặt chuẩn y tế (Dead-leg ≤ 3:1, lọc tinh 0,2 µm cuối tuyến).
          </p>
        </div>

        <div className="w-full lg:w-80 rounded-xl bg-slate-800 border border-slate-700/80 p-3.5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
          <label
            htmlFor="adv-global-q"
            className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5"
          >
            <span>Công suất cấp nước (globalQ)</span>
            <span className="font-mono tabular-nums text-slate-300">
              Q = {qHour.toFixed(2)} m³/h
            </span>
          </label>
          <div className="relative flex items-center">
            <DecimalInput
              id="adv-global-q"
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
        aria-label="Xử lý nước cấp nâng cao"
        className="print:hidden flex items-center gap-2 overflow-x-auto pb-1"
      >
        {ADV_TABS.map((tab) => {
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

      {/* TAB 1: LÀM MỀM */}
      {activeTab === 'softener' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Cột Làm mềm Trao đổi Ion (Mặc định cột Tròn)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lưu lượng qua mỗi cột: {qPerSoftH.toFixed(2)} m³/h (tổng{' '}
                  {nSoftCols} cột)
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                D_lt = {softDiaTheo.toFixed(2)} m (Ø
                {Math.round(softDiaTheo * 1000)} mm)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <NumberField
                id="soft-cols"
                label="Số cột làm mềm song song"
                unit="cột"
                value={softener.numCols}
                min={1}
                max={8}
                step={1}
                onChange={(v) =>
                  setSoftener((p) => ({
                    ...p,
                    numCols: Math.max(1, Math.round(v)),
                  }))
                }
              />
              <NumberField
                id="soft-vel"
                label="Vận tốc lọc thiết kế (v_tk)"
                unit="m/h"
                value={softener.velTarget}
                min={10}
                max={30}
                step={1}
                onChange={(v) => setSoftener((p) => ({ ...p, velTarget: v }))}
                helperText="Gợi ý: 10 – 25 m/h"
              />
              <NumberField
                id="soft-vmax"
                label="Giới hạn vận tốc lọc tối đa"
                unit="m/h"
                value={softener.velMax}
                min={15}
                max={35}
                step={1}
                onChange={(v) => setSoftener((p) => ({ ...p, velMax: v }))}
              />
              <NumberField
                id="soft-h-in"
                label="Độ cứng nước nguồn (CaCO₃)"
                unit="mg/L"
                value={softener.hardnessIn}
                min={20}
                max={1000}
                step={10}
                onChange={(v) => setSoftener((p) => ({ ...p, hardnessIn: v }))}
              />
              <NumberField
                id="soft-cycle"
                label="Chu kỳ giữa 2 lần hoàn nguyên"
                unit="giờ"
                value={softener.cycleHours}
                min={4}
                max={48}
                step={2}
                onChange={(v) => setSoftener((p) => ({ ...p, cycleHours: v }))}
                helperText="Gợi ý: 8 – 24 giờ"
              />
              <NumberField
                id="soft-depth"
                label="Chiều cao lớp hạt nhựa Cation"
                unit="m"
                value={softener.resinDepthM}
                min={0.6}
                max={2.5}
                step={0.1}
                onChange={(v) => setSoftener((p) => ({ ...p, resinDepthM: v }))}
              />
            </div>
          </section>

          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Chốt kích thước cột Tròn (D, H) & Kiểm tra ngược
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lý thuyết: Ø {softDiaTheo.toFixed(2)} m × H{' '}
                  {softHeightTheo.toFixed(2)} m. Chọn cột tiêu chuẩn thị trường
                  hoặc nhập tay.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSoftOv({ D: softDiaRec, H: softHeightRec })
                }
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Chọn cột Ø {Math.round(softDiaRec * 1000)} mm</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="soft-preset"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Đường kính cột Composite chuẩn
                </label>
                <select
                  id="soft-preset"
                  value={
                    MARKET_COLUMN_DIAMETERS_M.includes(activeSoftD)
                      ? activeSoftD
                      : ''
                  }
                  onChange={(e) => {
                    if (e.target.value !== '') {
                      setSoftOv({
                        D: Number(e.target.value),
                        H: activeSoftH,
                      });
                    }
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Nhập tay bên cạnh --</option>
                  {MARKET_COLUMN_DIAMETERS_M.map((d) => (
                    <option key={d} value={d}>
                      Cột Ø {Math.round(d * 1000)} mm ({d.toFixed(2)} m)
                    </option>
                  ))}
                </select>
              </div>

              <NumberField
                id="soft-ov-d"
                label="Đường kính cột chọn (D)"
                unit="m"
                value={activeSoftD}
                min={0.1}
                max={4.0}
                step={0.05}
                onChange={(v) => setSoftOv({ D: v, H: activeSoftH })}
              />
              <NumberField
                id="soft-ov-h"
                label="Chiều cao cột chọn (H)"
                unit="m"
                value={activeSoftH}
                min={0.5}
                max={5.0}
                step={0.1}
                onChange={(v) => setSoftOv({ D: activeSoftD, H: v })}
              />
            </div>

            <StatusBanner
              ok={isSoftAllOk}
              titleOk="ĐẠT CHUẨN CỘT LÀM MỀM ION"
              titleFail="CẢNH BÁO ĐỎ: CỘT LÀM MỀM KHÔNG ĐẠT CHUẨN"
              message={
                isSoftAllOk
                  ? `Vận tốc lọc thực tế (${softVelActual.toFixed(1)} m/h ≤ ${softener.velMax} m/h), chu kỳ hoàn nguyên thực ${softCycleActualH.toFixed(1)} giờ, lượng muối ~${softSaltKgPerRegen.toFixed(1)} kg NaCl/lần.`
                  : `${!isSoftDiaOk ? `Đường kính cột (${activeSoftD.toFixed(2)} m) nhỏ hơn lý thuyết (${softDiaTheo.toFixed(2)} m). ` : ''}${!isSoftVelOk ? `Vận tốc lọc thực tế (${softVelActual.toFixed(1)} m/h) vượt ngưỡng ${softener.velMax} m/h.` : ''}`
              }
              summaryRight={`${softVelActual.toFixed(1)} m/h · ${(softResinVolActual * 1000).toFixed(0)} L nhựa`}
            />

            <CheckTable
              rows={[
                {
                  name: 'Vận tốc lọc thực tế qua cột (v_thực)',
                  standard: `≤ ${softener.velMax} m/h`,
                  actual: `${softVelActual.toFixed(2)} m/h`,
                  ok: isSoftVelOk,
                  statusText: isSoftVelOk ? 'Đạt chuẩn' : 'Vượt vận tốc',
                },
                {
                  name: 'Đường kính cột Tròn (D)',
                  standard: `≥ ${softDiaTheo.toFixed(2)} m`,
                  actual: `${activeSoftD.toFixed(2)} m`,
                  ok: isSoftDiaOk,
                  statusText: isSoftDiaOk ? 'Đạt chuẩn' : 'Quá nhỏ',
                },
                {
                  name: 'Thể tích hạt nhựa Cation (1 cột)',
                  standard: `≥ ${resinVolRequired.toFixed(2)} m³`,
                  actual: `${softResinVolActual.toFixed(2)} m³ (${(softResinVolActual * 1000).toFixed(0)} L)`,
                  ok: softResinVolActual >= resinVolRequired,
                  statusText: `Chu kỳ ${softCycleActualH.toFixed(1)} giờ`,
                },
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 2: LỌC THAN */}
      {activeTab === 'carbon' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Cột Lọc Than Hoạt Tính (Mặc định cột Tròn)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lưu lượng qua mỗi cột: {qPerCarbonH.toFixed(2)} m³/h (tổng{' '}
                  {nCarbonCols} cột)
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                D_lt = {carbonDiaTheo.toFixed(2)} m (Ø
                {Math.round(carbonDiaTheo * 1000)} mm)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <NumberField
                id="carb-cols"
                label="Số cột lọc than song song"
                unit="cột"
                value={carbon.numCols}
                min={1}
                max={8}
                step={1}
                onChange={(v) =>
                  setCarbon((p) => ({
                    ...p,
                    numCols: Math.max(1, Math.round(v)),
                  }))
                }
              />
              <NumberField
                id="carb-vel"
                label="Vận tốc lọc thiết kế (v_tk)"
                unit="m/h"
                value={carbon.velTarget}
                min={5}
                max={20}
                step={1}
                onChange={(v) => setCarbon((p) => ({ ...p, velTarget: v }))}
                helperText="Gợi ý: 5 – 15 m/h"
              />
              <NumberField
                id="carb-vmax"
                label="Giới hạn vận tốc lọc tối đa"
                unit="m/h"
                value={carbon.velMax}
                min={8}
                max={25}
                step={1}
                onChange={(v) => setCarbon((p) => ({ ...p, velMax: v }))}
              />
              <NumberField
                id="carb-ebct"
                label="Thời gian tiếp xúc rỗng (EBCT)"
                unit="phút"
                value={carbon.ebctMin}
                min={3}
                max={20}
                step={1}
                onChange={(v) => setCarbon((p) => ({ ...p, ebctMin: v }))}
                helperText="Gợi ý: 10 – 20 phút"
              />
              <NumberField
                id="carb-depth"
                label="Chiều cao lớp than hoạt tính"
                unit="m"
                value={carbon.mediaDepthM}
                min={0.6}
                max={2.5}
                step={0.1}
                onChange={(v) => setCarbon((p) => ({ ...p, mediaDepthM: v }))}
              />
            </div>
          </section>

          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Chốt kích thước cột Tròn (D, H) & Kiểm tra ngược
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lý thuyết: Ø {carbonDiaTheo.toFixed(2)} m × H{' '}
                  {carbonHeightTheo.toFixed(2)} m.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCarbonOv({ D: carbonDiaRec, H: carbonHeightRec })
                }
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Chọn cột Ø {Math.round(carbonDiaRec * 1000)} mm</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="carb-preset"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Đường kính cột tiêu chuẩn
                </label>
                <select
                  id="carb-preset"
                  value={
                    MARKET_COLUMN_DIAMETERS_M.includes(activeCarbonD)
                      ? activeCarbonD
                      : ''
                  }
                  onChange={(e) => {
                    if (e.target.value !== '') {
                      setCarbonOv({
                        D: Number(e.target.value),
                        H: activeCarbonH,
                      });
                    }
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Nhập tay bên cạnh --</option>
                  {MARKET_COLUMN_DIAMETERS_M.map((d) => (
                    <option key={d} value={d}>
                      Cột Ø {Math.round(d * 1000)} mm ({d.toFixed(2)} m)
                    </option>
                  ))}
                </select>
              </div>

              <NumberField
                id="carb-ov-d"
                label="Đường kính cột chọn (D)"
                unit="m"
                value={activeCarbonD}
                min={0.1}
                max={4.0}
                step={0.05}
                onChange={(v) => setCarbonOv({ D: v, H: activeCarbonH })}
              />
              <NumberField
                id="carb-ov-h"
                label="Chiều cao cột chọn (H)"
                unit="m"
                value={activeCarbonH}
                min={0.5}
                max={5.0}
                step={0.1}
                onChange={(v) => setCarbonOv({ D: activeCarbonD, H: v })}
              />
            </div>

            <StatusBanner
              ok={isCarbonAllOk}
              titleOk="ĐẠT CHUẨN CỘT LỌC THAN HOẠT TÍNH"
              titleFail="CẢNH BÁO ĐỎ: CỘT LỌC THAN KHÔNG ĐẠT CHUẨN"
              message={
                isCarbonAllOk
                  ? `Vận tốc lọc thực (${carbonVelActual.toFixed(2)} m/h ≤ ${carbon.velMax} m/h) và EBCT thực (${carbonEbctActual.toFixed(1)} phút ≥ 5 phút). Khối lượng than 1 cột: ${carbonMassActualKg.toFixed(0)} kg.`
                  : `${!isCarbonVelOk ? `Vận tốc lọc thực (${carbonVelActual.toFixed(2)} m/h) vượt ngưỡng ${carbon.velMax} m/h. ` : ''}${!isCarbonEbctOk ? `Thời gian tiếp xúc EBCT thực (${carbonEbctActual.toFixed(1)} phút) < 5 phút.` : ''}`
              }
              summaryRight={`${carbonVelActual.toFixed(2)} m/h · ${carbonMassActualKg.toFixed(0)} kg than`}
            />

            <CheckTable
              rows={[
                {
                  name: 'Vận tốc lọc thực tế (v_thực)',
                  standard: `≤ ${carbon.velMax} m/h`,
                  actual: `${carbonVelActual.toFixed(2)} m/h`,
                  ok: isCarbonVelOk,
                  statusText: isCarbonVelOk ? 'Đạt chuẩn' : 'Vượt vận tốc',
                },
                {
                  name: 'Thời gian tiếp xúc rỗng thực (EBCT)',
                  standard: '≥ 5,0 phút',
                  actual: `${carbonEbctActual.toFixed(1)} phút`,
                  ok: isCarbonEbctOk,
                  statusText: isCarbonEbctOk ? 'Đạt chuẩn' : 'Quá ngắn',
                },
                {
                  name: 'Khối lượng than hoạt tính (500 kg/m³)',
                  standard: `${nCarbonCols} cột × ${carbonMassActualKg.toFixed(0)} kg`,
                  actual: `${(carbonMassActualKg * nCarbonCols).toFixed(0)} kg tổng`,
                  ok: true,
                  statusText: `${carbonMediaVolActual.toFixed(2)} m³/cột`,
                },
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 3: RO / UF */}
      {activeTab === 'ro_uf' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Nội suy Số vỏ màng (Housing) & Phần tử màng RO / UF
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lưu lượng thành phẩm: {qPermeateH.toFixed(2)} m³/h · Lưu lượng
                  cấp màng: {qFeedH.toFixed(2)} m³/h (Xả bỏ: {qRejectH.toFixed(2)}{' '}
                  m³/h)
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                Nội suy: {numHousingsTheo} vỏ ({numElementsTheo} màng)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="rouf-model"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Chủng loại màng RO / UF
                </label>
                <select
                  id="rouf-model"
                  value={rouf.elementModel}
                  onChange={(e) => {
                    const nextModel = e.target.value;
                    const isUf = nextModel.startsWith('UF');
                    setRouf((p) => ({
                      ...p,
                      systemType: isUf ? 'UF' : 'RO',
                      elementModel: nextModel,
                      fluxTargetLmh: isUf ? 60 : 18,
                      recoveryPct: isUf ? 90 : 75,
                      elementsPerHousing: isUf ? 1 : 4,
                    }));
                    setRoufOv(null);
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {Object.entries(RO_ELEMENTS).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.label}
                    </option>
                  ))}
                </select>
              </div>

              <NumberField
                id="rouf-flux"
                label="Thông lượng thiết kế (Flux)"
                unit="LMH"
                value={rouf.fluxTargetLmh}
                min={8}
                max={90}
                step={1}
                onChange={(v) => setRouf((p) => ({ ...p, fluxTargetLmh: v }))}
                helperText="Gợi ý: RO 15 – 25 LMH; UF 40 – 60 LMH"
              />

              <NumberField
                id="rouf-rec"
                label="Tỷ lệ thu hồi nước sạch (Recovery)"
                unit="%"
                value={rouf.recoveryPct}
                min={40}
                max={96}
                step={5}
                onChange={(v) => setRouf((p) => ({ ...p, recoveryPct: v }))}
                helperText="Gợi ý: RO 50 – 75 % (UF 85 – 95 %)"
              />

              <NumberField
                id="rouf-eph"
                label="Số màng trong 1 vỏ (Housing)"
                unit="màng/vỏ"
                value={rouf.elementsPerHousing}
                min={1}
                max={8}
                step={1}
                onChange={(v) =>
                  setRouf((p) => ({
                    ...p,
                    elementsPerHousing: Math.max(1, Math.round(v)),
                  }))
                }
              />
            </div>
          </section>

          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Nhập đè số vỏ Housing & Số màng thực tế
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lý thuyết cần tối thiểu {numElementsTheo} màng ({numHousingsTheo}{' '}
                  vỏ × {elemPerHousing} màng/vỏ).
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setRoufOv({
                    housings: numHousingsTheo,
                    elemPerHousing,
                  })
                }
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Lấy theo nội suy ({numHousingsTheo} vỏ)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField
                id="rouf-ov-housings"
                label="Số lượng vỏ màng (Housing) thực tế"
                unit="vỏ"
                value={activeHousings}
                min={1}
                max={100}
                step={1}
                onChange={(v) =>
                  setRoufOv({
                    housings: Math.max(1, Math.round(v)),
                    elemPerHousing: activeElemPerHousing,
                  })
                }
              />
              <NumberField
                id="rouf-ov-eph"
                label="Số phần tử màng / 1 vỏ thực tế"
                unit="màng/vỏ"
                value={activeElemPerHousing}
                min={1}
                max={8}
                step={1}
                onChange={(v) =>
                  setRoufOv({
                    housings: activeHousings,
                    elemPerHousing: Math.max(1, Math.round(v)),
                  })
                }
              />
            </div>

            <StatusBanner
              ok={isRoufAllOk}
              titleOk={`ĐẠT CHUẨN CẤU HÌNH MÀNG ${rouf.systemType}`}
              titleFail={`CẢNH BÁO ĐỎ: THIẾU MÀNG HOẶC QUÁ TẢI FLUX ${rouf.systemType}`}
              message={
                isRoufAllOk
                  ? `Tổng ${totalElementsActual} màng (${totalMemAreaActual.toFixed(1)} m²) cho thông lượng thực tế ${fluxActualLmh.toFixed(1)} LMH ≤ ${elemInfo.maxFlux} LMH.`
                  : `${!isRoufCountOk ? `Tổng số màng thực tế (${totalElementsActual}) nhỏ hơn số màng lý thuyết (${numElementsTheo}). ` : ''}${!isRoufFluxOk ? `Thông lượng thực (${fluxActualLmh.toFixed(1)} LMH) vượt giới hạn ${elemInfo.maxFlux} LMH — nguy cơ nghẹt màng nhanh!` : ''}`
              }
              summaryRight={`${totalElementsActual} màng · ${fluxActualLmh.toFixed(1)} LMH`}
            />

            <CheckTable
              rows={[
                {
                  name: 'Tổng số phần tử màng',
                  standard: `≥ ${numElementsTheo} màng`,
                  actual: `${totalElementsActual} màng (${activeHousings} vỏ)`,
                  ok: isRoufCountOk,
                  statusText: isRoufCountOk ? 'Đủ màng' : 'Thiếu màng',
                },
                {
                  name: 'Thông lượng lọc thực tế (Flux)',
                  standard: `≤ ${elemInfo.maxFlux} LMH`,
                  actual: `${fluxActualLmh.toFixed(2)} LMH`,
                  ok: isRoufFluxOk,
                  statusText: isRoufFluxOk ? 'Đạt chuẩn' : 'Quá tải màng',
                },
                {
                  name: 'Lưu lượng cấp qua 1 vỏ màng',
                  standard: 'Phân phối đều',
                  actual: `${velPerHousingM3h.toFixed(2)} m³/h·vỏ`,
                  ok: true,
                  statusText: `${totalMemAreaActual.toFixed(1)} m² tổng`,
                },
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 4: NƯỚC RỬA TAY Y TẾ */}
      {activeTab === 'medical' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Kiểm tra Hệ Y Tế Nghiêm Ngặt (Dead-leg 3:1 & Lọc tinh 0,2 µm)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bắt buộc kiểm soát đoạn ống cụt Dead-leg ≤ 3:1 chống Biofilm và
                  cụm lọc vô trùng ≤ 0,2 µm cuối tuyến trước vòi rửa tay phẫu
                  thuật.
                </p>
              </div>
              <span
                className={`font-mono text-xs font-semibold tabular-nums ${
                  isMedicalAllOk ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                Dead-leg = {deadLegRatio.toFixed(2)} : 1
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <NumberField
                id="med-pipe-d"
                label="Đường kính trong ống nhánh (d_ống)"
                unit="mm"
                value={medical.pipeInnerDiaMm}
                min={10}
                max={150}
                step={5}
                onChange={(v) =>
                  setMedical((p) => ({ ...p, pipeInnerDiaMm: v }))
                }
              />

              <NumberField
                id="med-dead-leg"
                label="Chiều dài đoạn ống cụt (Dead-leg L)"
                unit="mm"
                value={medical.deadLegLengthMm}
                min={0}
                max={1000}
                step={5}
                onChange={(v) =>
                  setMedical((p) => ({ ...p, deadLegLengthMm: v }))
                }
                helperText="Gợi ý: < 3D (nhỏ hơn 3 lần đường kính ống nhánh)"
              />

              <NumberField
                id="med-loop-q"
                label="Lưu lượng bơm tuần hoàn vòng kín"
                unit="m³/h"
                value={medical.loopFlowM3h}
                min={0.5}
                max={50}
                step={0.5}
                onChange={(v) => setMedical((p) => ({ ...p, loopFlowM3h: v }))}
                helperText="Gợi ý: Duy trì vận tốc vòng > 0,9 m/s chống Biofilm"
              />

              <div>
                <label
                  htmlFor="med-micron"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Cụm lọc tinh cuối tuyến (Point-of-Use)
                </label>
                <select
                  id="med-micron"
                  value={medical.finalFilterMicron}
                  onChange={(e) =>
                    setMedical((p) => ({
                      ...p,
                      finalFilterMicron: e.target.value,
                    }))
                  }
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="0.2">Lọc vô trùng 0,2 µm (Chuẩn y tế)</option>
                  <option value="0.1">Lọc siêu vô trùng 0,1 µm (Đạt chuẩn)</option>
                  <option value="0.45">Lọc 0,45 µm (Không đạt vô trùng)</option>
                  <option value="1.0">Lọc 1,0 µm (Vi phạm chuẩn y tế)</option>
                  <option value="5.0">Lọc thô 5,0 µm (Vi phạm chuẩn y tế)</option>
                  <option value="none">Không lắp lọc cuối tuyến (Vi phạm)</option>
                </select>
              </div>

              <NumberField
                id="med-cartridges"
                label="Số lượng lõi lọc tinh cuối tuyến"
                unit="lõi"
                value={medical.numCartridges}
                min={1}
                max={24}
                step={1}
                onChange={(v) =>
                  setMedical((p) => ({
                    ...p,
                    numCartridges: Math.max(1, Math.round(v)),
                  }))
                }
              />

              <NumberField
                id="med-cart-area"
                label="Diện tích màng 1 lõi lọc (m²/lõi)"
                unit="m²"
                value={medical.cartridgeAreaM2}
                min={0.2}
                max={3.0}
                step={0.1}
                onChange={(v) =>
                  setMedical((p) => ({ ...p, cartridgeAreaM2: v }))
                }
              />
            </div>

            {/* Medical Compliance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="rounded-xl bg-slate-900 border border-slate-700/80 p-4">
                <div className="text-xs text-slate-400">
                  Kiểm tra Dead-leg (Chuẩn ≤ 3 : 1)
                </div>
                <div
                  className={`mt-1.5 font-mono text-xl font-semibold tabular-nums ${
                    isDeadLegOk ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {deadLegRatio.toFixed(2)} : 1
                </div>
                <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
                  Giới hạn tối đa L ≤ {maxAllowedDeadLegMm.toFixed(0)} mm
                </div>
              </div>

              <div className="rounded-xl bg-slate-900 border border-slate-700/80 p-4">
                <div className="text-xs text-slate-400">
                  Vận tốc lọc thực qua lõi 0,2 µm
                </div>
                <div
                  className={`mt-1.5 font-mono text-xl font-semibold tabular-nums ${
                    isMedFilterVelOk ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {medFilterVelActual.toFixed(2)} m/h
                </div>
                <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
                  Ngưỡng cho phép ≤ {medical.maxFilterVelMh.toFixed(1)} m/h
                </div>
              </div>

              <div className="rounded-xl bg-slate-900 border border-slate-700/80 p-4">
                <div className="text-xs text-slate-400">
                  Vận tốc tuần hoàn trong ống Loop
                </div>
                <div
                  className={`mt-1.5 font-mono text-xl font-semibold tabular-nums ${
                    isLoopVelOk ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {loopVelocityMs.toFixed(2)} m/s
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Yêu cầu ≥ 1,0 m/s chống bám Biofilm
                </div>
              </div>
            </div>

            <StatusBanner
              ok={isMedicalAllOk}
              titleOk="ĐẠT CHUẨN NƯỚC RỬA TAY VÔ TRÙNG Y TẾ"
              titleFail="CẢNH BÁO ĐỎ: VI PHẠM CHUẨN Y TẾ NGHIÊM NGẶT"
              message={
                isMedicalAllOk
                  ? `Tỷ lệ Dead-leg (${deadLegRatio.toFixed(2)}:1 ≤ 3:1), cụm lọc tinh ${medical.finalFilterMicron} µm cuối tuyến, vận tốc lọc thực ${medFilterVelActual.toFixed(2)} m/h và tuần hoàn ${loopVelocityMs.toFixed(2)} m/s đều đạt chuẩn.`
                  : `${!isDeadLegOk ? `VI PHẠM DEAD-LEG 3:1 (${deadLegRatio.toFixed(2)}:1 > 3:1, L_max = ${maxAllowedDeadLegMm} mm) — Nguy cơ phát sinh Biofilm! ` : ''}${!isSterileMicronOk ? `VI PHẠM CỤM LỌC CUỐI TUYẾN — Bắt buộc sử dụng lọc tinh ≤ 0,2 µm! ` : ''}${!isMedFilterVelOk ? `Vận tốc lọc qua lõi (${medFilterVelActual.toFixed(2)} m/h) vượt ngưỡng ${medical.maxFilterVelMh} m/h. ` : ''}${!isLoopVelOk ? `Vận tốc tuần hoàn (${loopVelocityMs.toFixed(2)} m/s) < 1,0 m/s.` : ''}`
              }
              summaryRight={`${deadLegRatio.toFixed(2)}:1 · ${medical.finalFilterMicron === 'none' ? 'Chưa lắp' : `${medical.finalFilterMicron} µm`}`}
            />

            <CheckTable
              rows={[
                {
                  name: 'Kiểm tra tỷ lệ Dead-leg (L / d_ống)',
                  standard: `≤ 3,00 : 1 (≤ ${maxAllowedDeadLegMm.toFixed(0)} mm)`,
                  actual: `${deadLegRatio.toFixed(2)} : 1 (${medical.deadLegLengthMm} mm)`,
                  ok: isDeadLegOk,
                  statusText: isDeadLegOk ? 'Đạt chuẩn 3:1' : 'Vi phạm Dead-leg',
                },
                {
                  name: 'Cấp độ cụm lọc tinh cuối tuyến',
                  standard: 'Bắt buộc ≤ 0,2 µm',
                  actual:
                    medical.finalFilterMicron === 'none'
                      ? 'Không có'
                      : `${medical.finalFilterMicron} µm`,
                  ok: isSterileMicronOk,
                  statusText: isSterileMicronOk
                    ? 'Đạt chuẩn vô trùng'
                    : 'Không đạt vô trùng',
                },
                {
                  name: 'Vận tốc lọc thực qua lõi tinh (v_lọc)',
                  standard: `≤ ${medical.maxFilterVelMh.toFixed(1)} m/h`,
                  actual: `${medFilterVelActual.toFixed(2)} m/h (${nCartridges} lõi)`,
                  ok: isMedFilterVelOk,
                  statusText: isMedFilterVelOk ? 'Đạt chuẩn' : 'Quá tải lõi lọc',
                },
                {
                  name: 'Vận tốc dòng tuần hoàn chống Biofilm',
                  standard: '≥ 1,00 m/s',
                  actual: `${loopVelocityMs.toFixed(2)} m/s`,
                  ok: isLoopVelOk,
                  statusText: isLoopVelOk ? 'Đạt chuẩn' : 'Nguy cơ đóng cặn',
                },
              ]}
            />
          </section>
        </div>
      )}

      <EquipmentSelector
        key={`omnieco_equipments_watersupplyadvanced_${activeTab}`}
        moduleLabel={
          WATER_ADV_EQUIPMENT_LABELS[activeTab] || 'Công trình Nước cấp nâng cao'
        }
        storageKey={`omnieco_equipments_watersupplyadvanced_${activeTab}`}
      />
    </div>
  );
}
