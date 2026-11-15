import { useState } from 'react';
import {
  CloudCog,
  Droplets,
  Filter,
  Layers,
  RotateCcw,
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

const AIR_EQUIPMENT_LABELS = {
  cyclone: 'Thiết bị Lọc bụi Xyclon',
  baghouse: 'Hệ thống Lọc bụi Túi vải',
  scrubber: 'Tháp Hấp thụ khí thải (Scrubber)',
  adsorption: 'Tháp Hấp phụ Than hoạt tính',
};

const AIR_TABS = [
  { id: 'cyclone', label: 'Xyclon', icon: Wind },
  { id: 'baghouse', label: 'Lọc túi vải', icon: Filter },
  { id: 'scrubber', label: 'Tháp hấp thụ Scrubber', icon: Droplets },
  { id: 'adsorption', label: 'Hấp phụ than', icon: Layers },
];

const AIR_PRESETS = [2000, 5000, 10000, 20000, 40000];

export default function AirEmissionsCalc() {
  const { globalQ } = useAppContext();
  const [activeTab, setActiveTab] = useState('cyclone');
  const [airFlowM3h, setAirFlowM3h] = useState(10000);

  const qAirHour = Math.max(0, Number(airFlowM3h) || 0);
  const qAirSec = qAirHour / 3600;

  // --- Tab 1: Xyclon (Mặc định Tròn) ---
  const [cyclone, setCyclone] = useState({
    model: 'Lapple', // Lapple | Stairmand
    numUnits: 1,
    bodyVelTarget: 3.0, // m/s (chuẩn 2.0 - 4.5)
    bodyVelMax: 4.5,
    inletVelMax: 25.0,
  });
  const [cycloneOv, setCycloneOv] = useState(null);

  // --- Tab 2: Lọc túi vải ---
  const [baghouse, setBaghouse] = useState({
    shape: 'Chữ nhật',
    airToClothMMin: 1.2, // m/phút (chuẩn 0.8 - 1.5)
    airToClothMaxMMin: 1.5,
    bagDiaMm: 130,
    bagLenM: 2.5,
    bagPitchFactor: 1.5, // khoảng cách tâm túi = 1.5 * d_túi
    chamberHeightM: 4.5,
    ratioLW: 1.5,
  });
  const [bagOv, setBagOv] = useState(null);

  // --- Tab 3: Tháp hấp thụ Scrubber (Mặc định Tròn) ---
  const [scrubber, setScrubber] = useState({
    gasVelTarget: 1.8, // m/s (chuẩn 1.2 - 2.2)
    floodingVelMax: 2.5, // m/s (vận tốc sặc / văng dung dịch)
    packingContactSec: 1.5, // giây
    extraHeightM: 2.2, // đáy + phân phối + tách ẩm demister
    liquidGasRatioLM3: 2.5, // L dung dịch / m3 khí
  });
  const [scrubberOv, setScrubberOv] = useState(null);

  // --- Tab 4: Hấp phụ than (Tròn hoặc Chữ nhật) ---
  const [adsorption, setAdsorption] = useState({
    shape: 'Tròn', // Tròn | Chữ nhật
    gasVelTarget: 0.3, // m/s (chuẩn 0.15 - 0.45)
    gasVelMax: 0.5, // m/s
    ebctSec: 2.5, // giây
    extraHeightM: 1.2,
    ratioLW: 1.5,
  });
  const [adsOv, setAdsOv] = useState(null);

  // === CALCULATIONS: 1. XYCLON ===
  const nCyclones = Math.max(1, Number(cyclone.numUnits) || 1);
  const qCycSec = qAirSec / nCyclones;
  const cycAreaTheo =
    cyclone.bodyVelTarget > 0 ? qCycSec / cyclone.bodyVelTarget : 0;
  const cycDiaTheo = Math.sqrt((4 * cycAreaTheo) / Math.PI);
  const cycBodyRatio = cyclone.model === 'Stairmand' ? 1.5 : 2.0;
  const cycConeRatio = cyclone.model === 'Stairmand' ? 2.5 : 2.0;
  const cycHBodyTheo = cycDiaTheo * cycBodyRatio;
  const cycHConeTheo = cycDiaTheo * cycConeRatio;

  const activeCycD = cycloneOv?.D ?? roundUpToStep(cycDiaTheo, 0.1);
  const activeCycHBody =
    cycloneOv?.hBody ?? roundUpToStep(cycHBodyTheo, 0.1);
  const activeCycHCone =
    cycloneOv?.hCone ?? roundUpToStep(cycHConeTheo, 0.1);
  const cycTotalH = activeCycHBody + activeCycHCone;
  const cycAreaActual = (Math.PI * activeCycD * activeCycD) / 4;
  const cycBodyVelActual = cycAreaActual > 0 ? qCycSec / cycAreaActual : 0;
  // Diện tích cửa vào: Lapple (0.5D * 0.25D = 0.125 D^2), Stairmand (0.5D * 0.2D = 0.10 D^2)
  const inletFactor = cyclone.model === 'Stairmand' ? 0.1 : 0.125;
  const cycInletArea = inletFactor * activeCycD * activeCycD;
  const cycInletVelActual = cycInletArea > 0 ? qCycSec / cycInletArea : 0;

  const isCycBodyVelOk =
    qAirHour > 0 &&
    cycBodyVelActual > 0 &&
    cycBodyVelActual <= cyclone.bodyVelMax;
  const isCycInletVelOk =
    qAirHour > 0 &&
    cycInletVelActual >= 10 &&
    cycInletVelActual <= cyclone.inletVelMax;
  const isCycAllOk = isCycBodyVelOk && isCycInletVelOk;

  // === CALCULATIONS: 2. LỌC TÚI VẢI ===
  const bagDiaM = baghouse.bagDiaMm / 1000;
  const areaOneBag = Math.PI * bagDiaM * baghouse.bagLenM;
  const clothAreaTheo =
    baghouse.airToClothMMin > 0
      ? qAirHour / (baghouse.airToClothMMin * 60)
      : 0;
  const numBagsTheo =
    areaOneBag > 0 ? Math.max(1, Math.ceil(clothAreaTheo / areaOneBag)) : 1;
  const pitchM = bagDiaM * baghouse.bagPitchFactor;
  const chamberAreaTheo = numBagsTheo * pitchM * pitchM;
  const safeBagRatioLW = Math.max(1, Number(baghouse.ratioLW) || 1.5);
  const chamberWTheo = Math.sqrt(chamberAreaTheo / safeBagRatioLW);
  const chamberLTheo = chamberWTheo * safeBagRatioLW;
  const chamberDTheo = Math.sqrt((4 * chamberAreaTheo) / Math.PI);

  const activeBagsCount = bagOv?.numBags ?? numBagsTheo;
  const activeBagL = bagOv?.L ?? roundUpToStep(chamberLTheo, 0.1);
  const activeBagW = bagOv?.W ?? roundUpToStep(chamberWTheo, 0.1);
  const activeBagD = bagOv?.D ?? roundUpToStep(chamberDTheo, 0.1);
  const activeBagH = bagOv?.H ?? baghouse.chamberHeightM;

  const clothAreaActual = activeBagsCount * areaOneBag;
  const airToClothActualMMin =
    clothAreaActual > 0 ? qAirHour / (clothAreaActual * 60) : 0;
  const airToClothActualMs = airToClothActualMMin / 60;

  const chamberGrossArea =
    baghouse.shape === 'Tròn'
      ? (Math.PI * activeBagD * activeBagD) / 4
      : activeBagL * activeBagW;
  const bagsCrossArea = activeBagsCount * ((Math.PI * bagDiaM * bagDiaM) / 4);
  const freeGasArea = Math.max(0.01, chamberGrossArea - bagsCrossArea);
  const interstitialVelMs = qAirHour > 0 ? qAirSec / freeGasArea : 0;

  const isBagClothVelOk =
    qAirHour > 0 &&
    airToClothActualMMin > 0 &&
    airToClothActualMMin <= baghouse.airToClothMaxMMin;
  const isBagUpflowOk = qAirHour > 0 && interstitialVelMs <= 1.5;
  const isBagAllOk = isBagClothVelOk && isBagUpflowOk;

  // === CALCULATIONS: 3. THÁP HẤP THỤ SCRUBBER ===
  const scrubAreaTheo =
    scrubber.gasVelTarget > 0 ? qAirSec / scrubber.gasVelTarget : 0;
  const scrubDiaTheo = Math.sqrt((4 * scrubAreaTheo) / Math.PI);
  const scrubPackHTheo = scrubber.gasVelTarget * scrubber.packingContactSec;
  const scrubTotalHTheo = scrubPackHTheo + scrubber.extraHeightM;

  const activeScrubD = scrubberOv?.D ?? roundUpToStep(scrubDiaTheo, 0.1);
  const activeScrubPackH =
    scrubberOv?.hPack ?? roundUpToStep(scrubPackHTheo, 0.1);
  const activeScrubTotalH =
    scrubberOv?.hTotal ??
    roundUpToStep(activeScrubPackH + scrubber.extraHeightM, 0.1);

  const scrubAreaActual = (Math.PI * activeScrubD * activeScrubD) / 4;
  const scrubVelActual = scrubAreaActual > 0 ? qAirSec / scrubAreaActual : 0;
  const scrubContactActualSec =
    scrubVelActual > 0 ? activeScrubPackH / scrubVelActual : 0;
  const scrubPumpM3h = (qAirHour * scrubber.liquidGasRatioLM3) / 1000;
  const scrubLiquidFlux =
    scrubAreaActual > 0 ? scrubPumpM3h / scrubAreaActual : 0;

  const isScrubVelOk =
    qAirHour > 0 &&
    scrubVelActual > 0 &&
    scrubVelActual <= scrubber.floodingVelMax;
  const isScrubContactOk = qAirHour > 0 && scrubContactActualSec >= 1.0;
  const isScrubAllOk = isScrubVelOk && isScrubContactOk;

  // === CALCULATIONS: 4. HẤP PHỤ THAN ===
  const adsAreaTheo =
    adsorption.gasVelTarget > 0 ? qAirSec / adsorption.gasVelTarget : 0;
  const adsBedHTheo = adsorption.gasVelTarget * adsorption.ebctSec;
  const adsTotalHTheo = adsBedHTheo + adsorption.extraHeightM;
  const adsDiaTheo = Math.sqrt((4 * adsAreaTheo) / Math.PI);
  const safeAdsRatioLW = Math.max(1, Number(adsorption.ratioLW) || 1.5);
  const adsWTheo = Math.sqrt(adsAreaTheo / safeAdsRatioLW);
  const adsLTheo = adsWTheo * safeAdsRatioLW;

  const activeAdsD = adsOv?.D ?? roundUpToStep(adsDiaTheo, 0.1);
  const activeAdsL = adsOv?.L ?? roundUpToStep(adsLTheo, 0.1);
  const activeAdsW = adsOv?.W ?? roundUpToStep(adsWTheo, 0.1);
  const activeAdsBedH = adsOv?.hBed ?? roundUpToStep(adsBedHTheo, 0.1);
  const activeAdsTotalH =
    adsOv?.hTotal ?? roundUpToStep(activeAdsBedH + adsorption.extraHeightM, 0.1);

  const adsAreaActual =
    adsorption.shape === 'Tròn'
      ? (Math.PI * activeAdsD * activeAdsD) / 4
      : activeAdsL * activeAdsW;
  const adsVelActual = adsAreaActual > 0 ? qAirSec / adsAreaActual : 0;
  const adsEbctActual = adsVelActual > 0 ? activeAdsBedH / adsVelActual : 0;
  const adsCarbonVolM3 = adsAreaActual * activeAdsBedH;
  const adsCarbonMassKg = adsCarbonVolM3 * 500;

  const isAdsVelOk =
    qAirHour > 0 &&
    adsVelActual > 0 &&
    adsVelActual <= adsorption.gasVelMax;
  const isAdsEbctOk = qAirHour > 0 && adsEbctActual >= 1.5;
  const isAdsAllOk = isAdsVelOk && isAdsEbctOk;

  return (
    <div className="space-y-6">
      {/* Header & Air Flow Input */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 text-balance">
            Xử Lý Khí Thải & Kiểm Soát Bụi
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Tính toán Xyclon, Lọc bụi túi vải, Tháp hấp thụ Scrubber và Tháp hấp
            phụ than hoạt tính, kèm kiểm tra ngược vận tốc khí thực chống văng
            dung dịch / rách túi.
          </p>
        </div>

        <div className="w-full lg:w-96 rounded-xl bg-slate-800 border border-slate-700/80 p-3.5 space-y-2.5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
          <label
            htmlFor="air-flow-input"
            className="flex items-center justify-between text-xs font-medium text-slate-400"
          >
            <span className="flex items-center gap-1.5">
              <CloudCog className="h-3.5 w-3.5 text-emerald-500" />
              Lưu lượng khí thải (Q_khí)
            </span>
            <span className="font-mono tabular-nums text-slate-300">
              {qAirSec.toFixed(2)} m³/s · Nước: {globalQ.toLocaleString('vi-VN')} m³/ng
            </span>
          </label>
          <div className="relative flex items-center">
            <DecimalInput
              id="air-flow-input"
              value={airFlowM3h}
              onValueChange={setAirFlowM3h}
              className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 pr-20 py-2 font-mono text-base font-semibold text-emerald-400 tabular-nums focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
            />
            <span className="absolute right-3 text-xs font-mono text-slate-400 pointer-events-none">
              m³/giờ
            </span>
          </div>
          <div className="print:hidden flex flex-wrap gap-1.5">
            {AIR_PRESETS.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAirFlowM3h(val)}
                className={`min-h-[44px] px-3 py-1.5 rounded text-xs font-mono tabular-nums transition-colors ${
                  airFlowM3h === val
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-slate-500'
                }`}
              >
                {(val / 1000).toFixed(0)}k
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 4 Tabs */}
      <div
        role="tablist"
        aria-label="Công trình xử lý khí thải"
        className="print:hidden flex items-center gap-2 overflow-x-auto pb-1"
      >
        {AIR_TABS.map((tab) => {
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

      {/* TAB 1: XYCLON */}
      {activeTab === 'cyclone' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Thông số lý thuyết Xyclon (Mặc định thân Tròn)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lưu lượng 1 Xyclon: {(qAirHour / nCyclones).toFixed(0)} m³/h (
                  {qCycSec.toFixed(3)} m³/s)
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                D_lt = {cycDiaTheo.toFixed(2)} m · H_nón ={' '}
                {cycHConeTheo.toFixed(2)} m
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="cyc-model"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Chuẩn hình học Xyclon (Tròn)
                </label>
                <select
                  id="cyc-model"
                  value={cyclone.model}
                  onChange={(e) => {
                    setCyclone((p) => ({ ...p, model: e.target.value }));
                    setCycloneOv(null);
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Lapple">
                    Lapple Phổ thông (H_trụ = 2D, H_nón = 2D)
                  </option>
                  <option value="Stairmand">
                    Stairmand Hiệu suất cao (H_trụ = 1,5D, H_nón = 2,5D)
                  </option>
                </select>
              </div>

              <NumberField
                id="cyc-units"
                label="Số đơn nguyên Xyclon song song"
                unit="cái"
                value={cyclone.numUnits}
                min={1}
                max={12}
                step={1}
                onChange={(v) => {
                  setCyclone((p) => ({
                    ...p,
                    numUnits: Math.max(1, Math.round(v)),
                  }));
                  setCycloneOv(null);
                }}
              />

              <NumberField
                id="cyc-vel"
                label="Vận tốc quy ước qua thân (v_tk)"
                unit="m/s"
                value={cyclone.bodyVelTarget}
                min={1.5}
                max={5.0}
                step={0.2}
                onChange={(v) => {
                  setCyclone((p) => ({ ...p, bodyVelTarget: v }));
                  setCycloneOv(null);
                }}
                helperText="Gợi ý: 2,0 – 4,0 m/s"
              />

              <NumberField
                id="cyc-vmax"
                label="Giới hạn vận tốc thân tối đa"
                unit="m/s"
                value={cyclone.bodyVelMax}
                min={3.0}
                max={7.0}
                step={0.5}
                onChange={(v) => setCyclone((p) => ({ ...p, bodyVelMax: v }))}
              />

              <NumberField
                id="cyc-inlet-max"
                label="Giới hạn vận tốc cửa vào tối đa"
                unit="m/s"
                value={cyclone.inletVelMax}
                min={15}
                max={35}
                step={1}
                onChange={(v) => setCyclone((p) => ({ ...p, inletVelMax: v }))}
                helperText="Gợi ý: Vận tốc cửa vào tối ưu 15 – 20 m/s"
              />
            </div>
          </section>

          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Kích thước đè (D, H_trụ, H_nón) & Kiểm tra vận tốc khí thực
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lý thuyết: D = {cycDiaTheo.toFixed(2)} m · H_trụ ={' '}
                  {cycHBodyTheo.toFixed(2)} m · H_nón = {cycHConeTheo.toFixed(2)}{' '}
                  m
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCycloneOv({
                    D: roundUpToStep(cycDiaTheo, 0.1),
                    hBody: roundUpToStep(cycHBodyTheo, 0.1),
                    hCone: roundUpToStep(cycHConeTheo, 0.1),
                  })
                }
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Làm tròn theo lý thuyết</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <NumberField
                id="cyc-ov-d"
                label="Đường kính thân Xyclon chọn (D)"
                unit="m"
                value={activeCycD}
                min={0.2}
                max={6.0}
                step={0.1}
                onChange={(v) =>
                  setCycloneOv({
                    D: v,
                    hBody: activeCycHBody,
                    hCone: activeCycHCone,
                  })
                }
              />
              <NumberField
                id="cyc-ov-hb"
                label="Chiều cao phần trụ (H_trụ)"
                unit="m"
                value={activeCycHBody}
                min={0.2}
                max={12.0}
                step={0.1}
                onChange={(v) =>
                  setCycloneOv({
                    D: activeCycD,
                    hBody: v,
                    hCone: activeCycHCone,
                  })
                }
              />
              <NumberField
                id="cyc-ov-hc"
                label="Chiều cao phần nón (H_nón)"
                unit="m"
                value={activeCycHCone}
                min={0.2}
                max={12.0}
                step={0.1}
                onChange={(v) =>
                  setCycloneOv({
                    D: activeCycD,
                    hBody: activeCycHBody,
                    hCone: v,
                  })
                }
              />
            </div>

            <StatusBanner
              ok={isCycAllOk}
              titleOk="ĐẠT CHUẨN VẬN TỐC KHÍ XYCLON"
              titleFail="CẢNH BÁO ĐỎ: VẬN TỐC KHÍ XYCLON NGOÀI NGƯỠNG"
              message={
                isCycAllOk
                  ? `Vận tốc khí thân thực tế (${cycBodyVelActual.toFixed(2)} m/s) và cửa vào (${cycInletVelActual.toFixed(1)} m/s) đạt chuẩn. Tổng chiều cao thiết bị = ${cycTotalH.toFixed(2)} m.`
                  : `${!isCycBodyVelOk ? `Vận tốc thân thực tế (${cycBodyVelActual.toFixed(2)} m/s) vượt giới hạn ${cyclone.bodyVelMax} m/s — gây xoáy ngược cuốn bụi! ` : ''}${!isCycInletVelOk ? `Vận tốc cửa vào (${cycInletVelActual.toFixed(1)} m/s) ngoài dải 10–${cyclone.inletVelMax} m/s.` : ''}`
              }
              summaryRight={`v_thân = ${cycBodyVelActual.toFixed(2)} m/s · v_vào = ${cycInletVelActual.toFixed(1)} m/s`}
            />

            <CheckTable
              rows={[
                {
                  name: 'Vận tốc khí thực trong thân Xyclon',
                  standard: `≤ ${cyclone.bodyVelMax.toFixed(1)} m/s`,
                  actual: `${cycBodyVelActual.toFixed(2)} m/s`,
                  ok: isCycBodyVelOk,
                  statusText: isCycBodyVelOk ? 'Đạt chuẩn' : 'Vượt ngưỡng',
                },
                {
                  name: 'Vận tốc khí thực tại cửa vào Xyclon',
                  standard: `10,0 – ${cyclone.inletVelMax.toFixed(1)} m/s`,
                  actual: `${cycInletVelActual.toFixed(2)} m/s`,
                  ok: isCycInletVelOk,
                  statusText: isCycInletVelOk
                    ? 'Đạt lực ly tâm'
                    : cycInletVelActual > cyclone.inletVelMax
                    ? 'Quá lớn (mài mòn)'
                    : 'Quá yếu',
                },
                {
                  name: 'Tổng chiều cao thân + nón (H_trụ + H_nón)',
                  standard: `${(cycHBodyTheo + cycHConeTheo).toFixed(2)} m (LT)`,
                  actual: `${cycTotalH.toFixed(2)} m`,
                  ok: true,
                  statusText: `${nCyclones} đơn nguyên`,
                },
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 2: LỌC TÚI VẢI */}
      {activeTab === 'baghouse' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Thiết kế Lọc bụi Túi vải (Baghouse Filter)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Diện tích vải cần thiết: {clothAreaTheo.toFixed(1)} m² (1 túi
                  Ø{baghouse.bagDiaMm} × {baghouse.bagLenM} m ={' '}
                  {areaOneBag.toFixed(2)} m²)
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                Nội suy: {numBagsTheo} túi
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="bag-shape"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Hình dạng vỏ buồng lọc túi
                </label>
                <select
                  id="bag-shape"
                  value={baghouse.shape}
                  onChange={(e) => {
                    setBaghouse((p) => ({ ...p, shape: e.target.value }));
                    setBagOv(null);
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Chữ nhật">Chữ nhật (L × W × H)</option>
                  <option value="Tròn">Tròn (Ø D × H)</option>
                </select>
              </div>

              <NumberField
                id="bag-atc"
                label="Vận tốc lọc qua vải thiết kế (A/C)"
                unit="m/phút"
                value={baghouse.airToClothMMin}
                min={0.5}
                max={2.0}
                step={0.1}
                onChange={(v) => {
                  setBaghouse((p) => ({ ...p, airToClothMMin: v }));
                  setBagOv(null);
                }}
                helperText="Gợi ý: 0,5 – 2,0 m/phút"
              />

              <NumberField
                id="bag-atc-max"
                label="Giới hạn vận tốc lọc gây rách túi"
                unit="m/phút"
                value={baghouse.airToClothMaxMMin}
                min={0.8}
                max={2.5}
                step={0.1}
                onChange={(v) =>
                  setBaghouse((p) => ({ ...p, airToClothMaxMMin: v }))
                }
              />

              <NumberField
                id="bag-dia"
                label="Đường kính 1 túi vải"
                unit="mm"
                value={baghouse.bagDiaMm}
                min={100}
                max={200}
                step={10}
                onChange={(v) => setBaghouse((p) => ({ ...p, bagDiaMm: v }))}
              />

              <NumberField
                id="bag-len"
                label="Chiều dài 1 túi vải"
                unit="m"
                value={baghouse.bagLenM}
                min={1.0}
                max={6.0}
                step={0.5}
                onChange={(v) => setBaghouse((p) => ({ ...p, bagLenM: v }))}
              />
            </div>
          </section>

          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Nhập đè số túi & kích thước buồng → Kiểm tra rách túi
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kiểm tra vận tốc xuyên vải (m/phút) và vận tốc khí dâng giữa
                  các túi (m/s).
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setBagOv({
                    numBags: numBagsTheo,
                    L: roundUpToStep(chamberLTheo, 0.1),
                    W: roundUpToStep(chamberWTheo, 0.1),
                    D: roundUpToStep(chamberDTheo, 0.1),
                    H: baghouse.chamberHeightM,
                  })
                }
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Làm tròn theo lý thuyết</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <NumberField
                id="bag-ov-count"
                label="Số lượng túi vải chọn"
                unit="túi"
                value={activeBagsCount}
                min={1}
                max={2000}
                step={1}
                onChange={(v) =>
                  setBagOv({
                    numBags: Math.max(1, Math.round(v)),
                    L: activeBagL,
                    W: activeBagW,
                    D: activeBagD,
                    H: activeBagH,
                  })
                }
              />

              {baghouse.shape === 'Tròn' ? (
                <NumberField
                  id="bag-ov-d"
                  label="Đường kính buồng lọc (D)"
                  unit="m"
                  value={activeBagD}
                  min={0.5}
                  max={15}
                  step={0.1}
                  onChange={(v) =>
                    setBagOv({
                      numBags: activeBagsCount,
                      L: activeBagL,
                      W: activeBagW,
                      D: v,
                      H: activeBagH,
                    })
                  }
                />
              ) : (
                <>
                  <NumberField
                    id="bag-ov-l"
                    label="Chiều dài buồng lọc (L)"
                    unit="m"
                    value={activeBagL}
                    min={0.5}
                    max={25}
                    step={0.1}
                    onChange={(v) =>
                      setBagOv({
                        numBags: activeBagsCount,
                        L: v,
                        W: activeBagW,
                        D: activeBagD,
                        H: activeBagH,
                      })
                    }
                  />
                  <NumberField
                    id="bag-ov-w"
                    label="Chiều rộng buồng lọc (W)"
                    unit="m"
                    value={activeBagW}
                    min={0.5}
                    max={20}
                    step={0.1}
                    onChange={(v) =>
                      setBagOv({
                        numBags: activeBagsCount,
                        L: activeBagL,
                        W: v,
                        D: activeBagD,
                        H: activeBagH,
                      })
                    }
                  />
                </>
              )}

              <NumberField
                id="bag-ov-h"
                label="Chiều cao buồng lọc (H)"
                unit="m"
                value={activeBagH}
                min={2.0}
                max={12.0}
                step={0.1}
                onChange={(v) =>
                  setBagOv({
                    numBags: activeBagsCount,
                    L: activeBagL,
                    W: activeBagW,
                    D: activeBagD,
                    H: v,
                  })
                }
              />
            </div>

            <StatusBanner
              ok={isBagAllOk}
              titleOk="ĐẠT CHUẨN VẬN TỐC LỌC TÚI VẢI"
              titleFail="CẢNH BÁO ĐỎ: VẬN TỐC KHÍ QUÁ LỚN — NGUY CƠ RÁCH TÚI VẢI"
              message={
                isBagAllOk
                  ? `Vận tốc lọc qua vải (${airToClothActualMMin.toFixed(2)} m/phút) và vận tốc dâng giữa các túi (${interstitialVelMs.toFixed(2)} m/s) đạt ngưỡng an toàn.`
                  : `${!isBagClothVelOk ? `Vận tốc qua vải thực tế (${airToClothActualMMin.toFixed(2)} m/phút) > giới hạn (${baghouse.airToClothMaxMMin} m/phút) — Nguy cơ rách túi và xuyên bụi! ` : ''}${!isBagUpflowOk ? `Vận tốc khí dâng giữa các túi (${interstitialVelMs.toFixed(2)} m/s) > 1,5 m/s gây va đập rách túi!` : ''}`
              }
              summaryRight={`${airToClothActualMMin.toFixed(2)} m/phút · ${interstitialVelMs.toFixed(2)} m/s`}
            />

            <CheckTable
              rows={[
                {
                  name: 'Vận tốc khí lọc xuyên vải (Air-to-Cloth)',
                  standard: `≤ ${baghouse.airToClothMaxMMin.toFixed(2)} m/phút`,
                  actual: `${airToClothActualMMin.toFixed(2)} m/phút (${airToClothActualMs.toFixed(4)} m/s)`,
                  ok: isBagClothVelOk,
                  statusText: isBagClothVelOk
                    ? 'Đạt chuẩn'
                    : 'Quá tải (Rách túi)',
                },
                {
                  name: 'Vận tốc khí dâng giữa các khe túi',
                  standard: '≤ 1,50 m/s',
                  actual: `${interstitialVelMs.toFixed(2)} m/s`,
                  ok: isBagUpflowOk,
                  statusText: isBagUpflowOk
                    ? 'An toàn giũ bụi'
                    : 'Quá lớn (Mài mòn túi)',
                },
                {
                  name: 'Tổng diện tích vải lọc thực tế',
                  standard: `≥ ${clothAreaTheo.toFixed(1)} m²`,
                  actual: `${clothAreaActual.toFixed(1)} m² (${activeBagsCount} túi)`,
                  ok: clothAreaActual >= clothAreaTheo,
                  statusText:
                    clothAreaActual >= clothAreaTheo
                      ? 'Đủ diện tích'
                      : 'Thiếu diện tích',
                },
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 3: THÁP HẤP THỤ SCRUBBER */}
      {activeTab === 'scrubber' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Tháp Hấp thụ Đệm Scrubber (Mặc định tháp Tròn)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tính đường kính tháp, chiều cao tầng vật liệu đệm và lưu lượng
                  bơm tuần hoàn dung dịch hấp thụ.
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                D_lt = {scrubDiaTheo.toFixed(2)} m · H_đệm ={' '}
                {scrubPackHTheo.toFixed(2)} m
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <NumberField
                id="scb-vel"
                label="Vận tốc khí qua tháp trống (v_tk)"
                unit="m/s"
                value={scrubber.gasVelTarget}
                min={0.6}
                max={2.4}
                step={0.1}
                onChange={(v) => {
                  setScrubber((p) => ({ ...p, gasVelTarget: v }));
                  setScrubberOv(null);
                }}
                helperText="Gợi ý: 1,0 – 3,0 m/s"
              />
              <NumberField
                id="scb-vmax"
                label="Vận tốc sặc / văng dung dịch tối đa"
                unit="m/s"
                value={scrubber.floodingVelMax}
                min={1.8}
                max={3.5}
                step={0.1}
                onChange={(v) =>
                  setScrubber((p) => ({ ...p, floodingVelMax: v }))
                }
              />
              <NumberField
                id="scb-contact"
                label="Thời gian lưu khí trong tầng đệm"
                unit="giây"
                value={scrubber.packingContactSec}
                min={0.8}
                max={5.0}
                step={0.1}
                onChange={(v) => {
                  setScrubber((p) => ({ ...p, packingContactSec: v }));
                  setScrubberOv(null);
                }}
              />
              <NumberField
                id="scb-lg"
                label="Tỷ lệ Lỏng / Khí (L/G)"
                unit="L/m³"
                value={scrubber.liquidGasRatioLM3}
                min={0.5}
                max={10}
                step={0.5}
                onChange={(v) =>
                  setScrubber((p) => ({ ...p, liquidGasRatioLM3: v }))
                }
              />
              <NumberField
                id="scb-extra"
                label="Chiều cao khoang đáy + tách ẩm đỉnh"
                unit="m"
                value={scrubber.extraHeightM}
                min={1.0}
                max={5.0}
                step={0.1}
                onChange={(v) => {
                  setScrubber((p) => ({ ...p, extraHeightM: v }));
                  setScrubberOv(null);
                }}
              />
            </div>
          </section>

          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Nhập đè D, H tháp Scrubber & Kiểm tra sặc/văng dung dịch
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lý thuyết: Ø {scrubDiaTheo.toFixed(2)} m · H_đệm{' '}
                  {scrubPackHTheo.toFixed(2)} m · H_tổng{' '}
                  {scrubTotalHTheo.toFixed(2)} m.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setScrubberOv({
                    D: roundUpToStep(scrubDiaTheo, 0.1),
                    hPack: roundUpToStep(scrubPackHTheo, 0.1),
                    hTotal: roundUpToStep(scrubTotalHTheo, 0.1),
                  })
                }
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Làm tròn theo lý thuyết</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <NumberField
                id="scb-ov-d"
                label="Đường kính tháp chọn (D)"
                unit="m"
                value={activeScrubD}
                min={0.2}
                max={8.0}
                step={0.1}
                onChange={(v) =>
                  setScrubberOv({
                    D: v,
                    hPack: activeScrubPackH,
                    hTotal: activeScrubTotalH,
                  })
                }
              />
              <NumberField
                id="scb-ov-hp"
                label="Chiều cao lớp đệm chọn (H_đệm)"
                unit="m"
                value={activeScrubPackH}
                min={0.5}
                max={10.0}
                step={0.1}
                onChange={(v) =>
                  setScrubberOv({
                    D: activeScrubD,
                    hPack: v,
                    hTotal: activeScrubTotalH,
                  })
                }
              />
              <NumberField
                id="scb-ov-ht"
                label="Tổng chiều cao tháp chọn (H)"
                unit="m"
                value={activeScrubTotalH}
                min={1.0}
                max={20.0}
                step={0.1}
                onChange={(v) =>
                  setScrubberOv({
                    D: activeScrubD,
                    hPack: activeScrubPackH,
                    hTotal: v,
                  })
                }
              />
            </div>

            <StatusBanner
              ok={isScrubAllOk}
              titleOk="ĐẠT CHUẨN THÁP HẤP THỤ SCRUBBER"
              titleFail="CẢNH BÁO ĐỎ: VẬN TỐC KHÍ QUÁ LỚN GÂY VĂNG DUNG DỊCH / SẶC THÁP"
              message={
                isScrubAllOk
                  ? `Vận tốc khí thực (${scrubVelActual.toFixed(2)} m/s ≤ ${scrubber.floodingVelMax} m/s), thời gian lưu qua đệm ${scrubContactActualSec.toFixed(2)} giây. Bơm tuần hoàn: ${scrubPumpM3h.toFixed(1)} m³/h.`
                  : `${!isScrubVelOk ? `Vận tốc khí thực (${scrubVelActual.toFixed(2)} m/s) vượt giới hạn sặc tháp (${scrubber.floodingVelMax} m/s) — gây văng dung dịch hấp thụ ra ống khói! ` : ''}${!isScrubContactOk ? `Thời gian lưu qua lớp đệm (${scrubContactActualSec.toFixed(2)}s) < 1,0 giây.` : ''}`
              }
              summaryRight={`v_khí = ${scrubVelActual.toFixed(2)} m/s · Bơm ${scrubPumpM3h.toFixed(1)} m³/h`}
            />

            <CheckTable
              rows={[
                {
                  name: 'Vận tốc khí thực qua tiết diện tháp',
                  standard: `≤ ${scrubber.floodingVelMax.toFixed(1)} m/s`,
                  actual: `${scrubVelActual.toFixed(2)} m/s`,
                  ok: isScrubVelOk,
                  statusText: isScrubVelOk
                    ? 'Không sặc tháp'
                    : 'Văng dung dịch',
                },
                {
                  name: 'Thời gian lưu khí thực trong lớp đệm',
                  standard: '≥ 1,00 giây',
                  actual: `${scrubContactActualSec.toFixed(2)} giây`,
                  ok: isScrubContactOk,
                  statusText: isScrubContactOk ? 'Đạt chuẩn' : 'Quá ngắn',
                },
                {
                  name: 'Bơm tuần hoàn & Mật độ tưới lỏng',
                  standard: `L/G = ${scrubber.liquidGasRatioLM3} L/m³`,
                  actual: `${scrubPumpM3h.toFixed(1)} m³/h (${scrubLiquidFlux.toFixed(1)} m³/m²·h)`,
                  ok: true,
                  statusText: `V_đệm = ${(scrubAreaActual * activeScrubPackH).toFixed(2)} m³`,
                },
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 4: HẤP PHỤ THAN */}
      {activeTab === 'adsorption' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Tháp Hấp phụ Than hoạt tính (Chọn Tròn hoặc Chữ nhật)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Diện tích mặt cắt lý thuyết: {adsAreaTheo.toFixed(2)} m² ·
                  Chiều dày lớp than lý thuyết: {adsBedHTheo.toFixed(2)} m
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                {adsorption.shape === 'Tròn'
                  ? `D_lt = ${adsDiaTheo.toFixed(2)} m`
                  : `${adsLTheo.toFixed(2)} × ${adsWTheo.toFixed(2)} m`}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="ads-shape"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Hình dạng tháp hấp phụ than
                </label>
                <select
                  id="ads-shape"
                  value={adsorption.shape}
                  onChange={(e) => {
                    setAdsorption((p) => ({ ...p, shape: e.target.value }));
                    setAdsOv(null);
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Tròn">Tròn (Ø D × H)</option>
                  <option value="Chữ nhật">Chữ nhật (L × W × H)</option>
                </select>
              </div>

              <NumberField
                id="ads-vel"
                label="Vận tốc khí qua lớp than (v_tk)"
                unit="m/s"
                value={adsorption.gasVelTarget}
                min={0.1}
                max={0.6}
                step={0.05}
                onChange={(v) => {
                  setAdsorption((p) => ({ ...p, gasVelTarget: v }));
                  setAdsOv(null);
                }}
                helperText="Gợi ý: 0,2 – 0,5 m/s"
              />

              <NumberField
                id="ads-vmax"
                label="Giới hạn vận tốc khí tối đa"
                unit="m/s"
                value={adsorption.gasVelMax}
                min={0.3}
                max={0.8}
                step={0.05}
                onChange={(v) =>
                  setAdsorption((p) => ({ ...p, gasVelMax: v }))
                }
              />

              <NumberField
                id="ads-ebct"
                label="Thời gian tiếp xúc rỗng (EBCT)"
                unit="giây"
                value={adsorption.ebctSec}
                min={1.0}
                max={8.0}
                step={0.5}
                onChange={(v) => {
                  setAdsorption((p) => ({ ...p, ebctSec: v }));
                  setAdsOv(null);
                }}
                helperText="Gợi ý: 1 – 3 giây"
              />

              {adsorption.shape === 'Chữ nhật' && (
                <NumberField
                  id="ads-ratio"
                  label="Tỷ lệ Dài / Rộng (L/W)"
                  unit="L/W"
                  value={adsorption.ratioLW}
                  min={1.0}
                  max={4.0}
                  step={0.1}
                  onChange={(v) => {
                    setAdsorption((p) => ({ ...p, ratioLW: v }));
                    setAdsOv(null);
                  }}
                />
              )}
            </div>
          </section>

          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Chốt kích thước thi công & Kiểm tra vận tốc khí thực
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Nhập đè kích thước {adsorption.shape} và chiều dày lớp than
                  hoạt tính.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setAdsOv({
                    D: roundUpToStep(adsDiaTheo, 0.1),
                    L: roundUpToStep(adsLTheo, 0.1),
                    W: roundUpToStep(adsWTheo, 0.1),
                    hBed: roundUpToStep(adsBedHTheo, 0.1),
                    hTotal: roundUpToStep(adsTotalHTheo, 0.1),
                  })
                }
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Làm tròn theo lý thuyết</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {adsorption.shape === 'Tròn' ? (
                <NumberField
                  id="ads-ov-d"
                  label="Đường kính tháp chọn (D)"
                  unit="m"
                  value={activeAdsD}
                  min={0.3}
                  max={10}
                  step={0.1}
                  onChange={(v) =>
                    setAdsOv({
                      D: v,
                      L: activeAdsL,
                      W: activeAdsW,
                      hBed: activeAdsBedH,
                      hTotal: activeAdsTotalH,
                    })
                  }
                />
              ) : (
                <>
                  <NumberField
                    id="ads-ov-l"
                    label="Chiều dài tháp chọn (L)"
                    unit="m"
                    value={activeAdsL}
                    min={0.3}
                    max={15}
                    step={0.1}
                    onChange={(v) =>
                      setAdsOv({
                        D: activeAdsD,
                        L: v,
                        W: activeAdsW,
                        hBed: activeAdsBedH,
                        hTotal: activeAdsTotalH,
                      })
                    }
                  />
                  <NumberField
                    id="ads-ov-w"
                    label="Chiều rộng tháp chọn (W)"
                    unit="m"
                    value={activeAdsW}
                    min={0.3}
                    max={15}
                    step={0.1}
                    onChange={(v) =>
                      setAdsOv({
                        D: activeAdsD,
                        L: activeAdsL,
                        W: v,
                        hBed: activeAdsBedH,
                        hTotal: activeAdsTotalH,
                      })
                    }
                  />
                </>
              )}

              <NumberField
                id="ads-ov-hbed"
                label="Tổng chiều dày lớp than (H_than)"
                unit="m"
                value={activeAdsBedH}
                min={0.2}
                max={4.0}
                step={0.1}
                onChange={(v) =>
                  setAdsOv({
                    D: activeAdsD,
                    L: activeAdsL,
                    W: activeAdsW,
                    hBed: v,
                    hTotal: activeAdsTotalH,
                  })
                }
              />

              <NumberField
                id="ads-ov-htot"
                label="Chiều cao tổng tháp chọn (H)"
                unit="m"
                value={activeAdsTotalH}
                min={0.5}
                max={10.0}
                step={0.1}
                onChange={(v) =>
                  setAdsOv({
                    D: activeAdsD,
                    L: activeAdsL,
                    W: activeAdsW,
                    hBed: activeAdsBedH,
                    hTotal: v,
                  })
                }
              />
            </div>

            <StatusBanner
              ok={isAdsAllOk}
              titleOk="ĐẠT CHUẨN THÁP HẤP PHỤ THAN HOẠT TÍNH"
              titleFail="CẢNH BÁO ĐỎ: VẬN TỐC KHÍ HOẶC THỜI GIAN LƯU KHÔNG ĐẠT"
              message={
                isAdsAllOk
                  ? `Vận tốc khí thực (${adsVelActual.toFixed(2)} m/s ≤ ${adsorption.gasVelMax} m/s), thời gian tiếp xúc EBCT = ${adsEbctActual.toFixed(2)}s. Khối lượng than cần nạp: ${adsCarbonMassKg.toFixed(0)} kg.`
                  : `${!isAdsVelOk ? `Vận tốc khí thực (${adsVelActual.toFixed(2)} m/s) vượt giới hạn ${adsorption.gasVelMax} m/s — dễ xáo trộn hạt than & xuyên thủng hấp phụ! ` : ''}${!isAdsEbctOk ? `Thời gian tiếp xúc thực (${adsEbctActual.toFixed(2)}s) < 1,5 giây.` : ''}`
              }
              summaryRight={`v_khí = ${adsVelActual.toFixed(2)} m/s · ${adsCarbonMassKg.toFixed(0)} kg than`}
            />

            <CheckTable
              rows={[
                {
                  name: 'Vận tốc khí thực qua lớp than',
                  standard: `≤ ${adsorption.gasVelMax.toFixed(2)} m/s`,
                  actual: `${adsVelActual.toFixed(2)} m/s`,
                  ok: isAdsVelOk,
                  statusText: isAdsVelOk ? 'Đạt chuẩn' : 'Vượt vận tốc',
                },
                {
                  name: 'Thời gian lưu tiếp xúc thực (EBCT)',
                  standard: '≥ 1,50 giây',
                  actual: `${adsEbctActual.toFixed(2)} giây`,
                  ok: isAdsEbctOk,
                  statusText: isAdsEbctOk ? 'Đạt chuẩn' : 'Quá ngắn',
                },
                {
                  name: 'Thể tích & Khối lượng than (500 kg/m³)',
                  standard: `F_thực = ${adsAreaActual.toFixed(2)} m²`,
                  actual: `${adsCarbonVolM3.toFixed(2)} m³ · ${adsCarbonMassKg.toFixed(0)} kg`,
                  ok: true,
                  statusText: `H_tháp = ${activeAdsTotalH.toFixed(2)} m`,
                },
              ]}
            />
          </section>
        </div>
      )}

      <EquipmentSelector
        key={`omnieco_equipments_airemissions_${activeTab}`}
        moduleLabel={
          AIR_EQUIPMENT_LABELS[activeTab] || 'Công trình Xử lý Khí thải'
        }
        storageKey={`omnieco_equipments_airemissions_${activeTab}`}
      />
    </div>
  );
}
