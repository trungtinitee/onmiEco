import { useState } from 'react';
import {
  Flame,
  Layers,
  Recycle,
  RotateCcw,
  Trash2,
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

const SOLID_EQUIPMENT_LABELS = {
  landfill: 'Ô chôn lấp hợp vệ sinh',
  compost: 'Khu Ủ phân Compost',
  incinerator: 'Lò đốt rác Y tế / Nguy hại',
};

const SOLID_TABS = [
  { id: 'landfill', label: 'Ô chôn lấp hợp vệ sinh', icon: Layers },
  { id: 'compost', label: 'Ủ phân Compost', icon: Recycle },
  { id: 'incinerator', label: 'Lò đốt rác y tế / nguy hại', icon: Flame },
];

const WASTE_PRESETS_TON = [1, 2, 5, 10, 20];

// Thể tích hình chóp cụt đáy chữ nhật (L1 x W1) và mặt (L2 x W2), chiều cao H
const calcFrustumVolume = (l1, w1, l2, w2, h) => {
  if (l1 <= 0 || w1 <= 0 || l2 <= 0 || w2 <= 0 || h <= 0) return 0;
  const a1 = l1 * w1;
  const a2 = l2 * w2;
  return (h / 3) * (a1 + a2 + Math.sqrt(a1 * a2));
};

// Nội suy chiều rộng đáy W_bottom cho ô chóp cụt mở rộng lên trên theo mái dốc taluy m
const solveLandfillBottomWidth = (targetVol, h, ratioLW, slopeM) => {
  if (targetVol <= 0 || h <= 0) return 1;
  let low = 1;
  let high = 500;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    const lBot = mid * ratioLW;
    const wTop = mid + 2 * slopeM * h;
    const lTop = lBot + 2 * slopeM * h;
    const v = calcFrustumVolume(lBot, mid, lTop, wTop, h);
    if (v < targetVol) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
};

// Nội suy chiều rộng đáy W_bottom cho luống ủ chóp cụt thu nhỏ lên đỉnh theo mái dốc m
const solveCompostBottomWidth = (targetVol, h, ratioLW, slopeM) => {
  if (targetVol <= 0 || h <= 0) return 1;
  const minW = 2 * slopeM * h + 0.5;
  let low = minW;
  let high = 200;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    const lBot = mid * ratioLW;
    const wTop = Math.max(0.4, mid - 2 * slopeM * h);
    const lTop = Math.max(0.8, lBot - 2 * slopeM * h);
    const v = calcFrustumVolume(lBot, mid, lTop, wTop, h);
    if (v < targetVol) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
};

export default function SolidWasteCalc() {
  const { globalQ } = useAppContext();
  const [activeTab, setActiveTab] = useState('landfill');
  const [wasteTonDay, setWasteTonDay] = useState(5);

  const qWasteTon = Math.max(0, Number(wasteTonDay) || 0);
  const qWasteKg = qWasteTon * 1000;

  // --- TAB 1: Ô CHÔN LẤP ---
  const [landfill, setLandfill] = useState({
    shape: 'Hình chóp cụt', // Hình chóp cụt | Chữ nhật
    operatingYears: 5,
    compactedDensityKgM3: 750,
    coverSoilRatioPct: 15,
    depthH: 6.0,
    ratioLW: 1.5,
    slopeM: 1.5, // mái dốc 1:1.5
  });
  const [landfillOv, setLandfillOv] = useState(null);

  // --- TAB 2: Ủ COMPOST ---
  const [compost, setCompost] = useState({
    shape: 'Hình chóp cụt', // Hình chóp cụt | Chữ nhật
    organicPct: 60,
    densityKgM3: 550,
    retentionDays: 35,
    numWindrows: 4,
    heightH: 1.8,
    ratioLW: 4.0,
    slopeM: 0.6,
  });
  const [compostOv, setCompostOv] = useState(null);

  // --- TAB 3: LÒ ĐỐT RÁC Y TẾ / NGUY HẠI ---
  const [incinerator, setIncinerator] = useState({
    burnHoursDay: 10,
    primaryShape: 'Tròn', // Tròn | Chữ nhật
    secondaryShape: 'Tròn', // Tròn | Chữ nhật
    primaryLoadKgM3H: 100, // tải trọng buồng sơ cấp (kg/m3·h)
    primaryTempC: 850,
    secondaryTempC: 1100, // >= 1050 C cho rác y tế/nguy hại
    flueGasNm3Kg: 10.0, // lưu lượng khói chuẩn Nm3 / kg rác
    targetRetentionSec: 2.2, // yêu cầu bắt buộc >= 2.0s
  });
  const [incOv, setIncOv] = useState(null);

  // === CALCULATIONS: 1. Ô CHÔN LẤP ===
  const lfDays = Math.max(1, landfill.operatingYears * 365);
  const lfWasteVolTheo =
    landfill.compactedDensityKgM3 > 0
      ? (qWasteKg * lfDays) / landfill.compactedDensityKgM3
      : 0;
  const lfTotalVolTheo =
    lfWasteVolTheo * (1 + Math.max(0, landfill.coverSoilRatioPct) / 100);

  let lfWBotTheo = 0;
  let lfLBotTheo = 0;
  let lfWTopTheo = 0;
  let lfLTopTheo = 0;

  if (landfill.shape === 'Chữ nhật') {
    const area = landfill.depthH > 0 ? lfTotalVolTheo / landfill.depthH : 0;
    lfWBotTheo = Math.sqrt(area / Math.max(1, landfill.ratioLW));
    lfLBotTheo = lfWBotTheo * Math.max(1, landfill.ratioLW);
    lfWTopTheo = lfWBotTheo;
    lfLTopTheo = lfLBotTheo;
  } else {
    lfWBotTheo = solveLandfillBottomWidth(
      lfTotalVolTheo,
      landfill.depthH,
      Math.max(1, landfill.ratioLW),
      Math.max(0, landfill.slopeM)
    );
    lfLBotTheo = lfWBotTheo * Math.max(1, landfill.ratioLW);
    lfWTopTheo = lfWBotTheo + 2 * Math.max(0, landfill.slopeM) * landfill.depthH;
    lfLTopTheo = lfLBotTheo + 2 * Math.max(0, landfill.slopeM) * landfill.depthH;
  }

  const activeLfLBot = landfillOv?.lBot ?? roundUpToStep(lfLBotTheo, 0.5);
  const activeLfWBot = landfillOv?.wBot ?? roundUpToStep(lfWBotTheo, 0.5);
  const activeLfLTop = landfillOv?.lTop ?? roundUpToStep(lfLTopTheo, 0.5);
  const activeLfWTop = landfillOv?.wTop ?? roundUpToStep(lfWTopTheo, 0.5);
  const activeLfH = landfillOv?.h ?? landfill.depthH;

  const lfVolActual =
    landfill.shape === 'Chữ nhật'
      ? activeLfLBot * activeLfWBot * activeLfH
      : calcFrustumVolume(
          activeLfLBot,
          activeLfWBot,
          activeLfLTop,
          activeLfWTop,
          activeLfH
        );
  const lfNetWasteVolActual =
    lfVolActual / (1 + Math.max(0, landfill.coverSoilRatioPct) / 100);
  const lfActualCapacityTons =
    (lfNetWasteVolActual * landfill.compactedDensityKgM3) / 1000;
  const lfActualYears =
    qWasteTon > 0 ? lfActualCapacityTons / (qWasteTon * 365) : 0;
  const lfTopArea =
    landfill.shape === 'Chữ nhật'
      ? activeLfLBot * activeLfWBot
      : activeLfLTop * activeLfWTop;
  // Nước rỉ rác sơ bộ (~25% lượng mưa 1800 mm/năm trên diện tích mặt ô đang mở)
  const lfLeachateM3Day = (lfTopArea * 1.8 * 0.25) / 365;
  const isLfVolOk = qWasteTon > 0 && lfVolActual >= lfTotalVolTheo;

  // === CALCULATIONS: 2. Ủ COMPOST ===
  const compInputKgDay = qWasteKg * (Math.max(0, compost.organicPct) / 100);
  const compTotalVolTheo =
    compost.densityKgM3 > 0
      ? (compInputKgDay * Math.max(1, compost.retentionDays)) /
        compost.densityKgM3
      : 0;
  const nWindrows = Math.max(1, Math.round(compost.numWindrows));
  const compOneVolTheo = compTotalVolTheo / nWindrows;

  let cpWBotTheo = 0;
  let cpLBotTheo = 0;
  let cpWTopTheo = 0;
  let cpLTopTheo = 0;

  if (compost.shape === 'Chữ nhật') {
    const area = compost.heightH > 0 ? compOneVolTheo / compost.heightH : 0;
    cpWBotTheo = Math.sqrt(area / Math.max(1, compost.ratioLW));
    cpLBotTheo = cpWBotTheo * Math.max(1, compost.ratioLW);
    cpWTopTheo = cpWBotTheo;
    cpLTopTheo = cpLBotTheo;
  } else {
    cpWBotTheo = solveCompostBottomWidth(
      compOneVolTheo,
      compost.heightH,
      Math.max(1, compost.ratioLW),
      Math.max(0, compost.slopeM)
    );
    cpLBotTheo = cpWBotTheo * Math.max(1, compost.ratioLW);
    cpWTopTheo = Math.max(
      0.4,
      cpWBotTheo - 2 * Math.max(0, compost.slopeM) * compost.heightH
    );
    cpLTopTheo = Math.max(
      0.8,
      cpLBotTheo - 2 * Math.max(0, compost.slopeM) * compost.heightH
    );
  }

  const activeCpLBot = compostOv?.lBot ?? roundUpToStep(cpLBotTheo, 0.2);
  const activeCpWBot = compostOv?.wBot ?? roundUpToStep(cpWBotTheo, 0.2);
  const activeCpLTop = compostOv?.lTop ?? roundUpToStep(cpLTopTheo, 0.2);
  const activeCpWTop = compostOv?.wTop ?? roundUpToStep(cpWTopTheo, 0.2);
  const activeCpH = compostOv?.h ?? compost.heightH;

  const cpOneVolActual =
    compost.shape === 'Chữ nhật'
      ? activeCpLBot * activeCpWBot * activeCpH
      : calcFrustumVolume(
          activeCpLBot,
          activeCpWBot,
          activeCpLTop,
          activeCpWTop,
          activeCpH
        );
  const cpTotalVolActual = cpOneVolActual * nWindrows;
  const cpRetentionActualDays =
    compInputKgDay > 0
      ? (cpTotalVolActual * compost.densityKgM3) / compInputKgDay
      : 0;
  // Sản lượng phân compost thành phẩm (~38% khối lượng rác hữu cơ đầu vào)
  const cpProductTonDay = (compInputKgDay * 0.38) / 1000;
  // Nhu cầu thổi khí hiếu khí (~0.6 m3 khí / tấn chất hữu cơ · phút -> m3/giờ)
  const cpBlowerM3h = ((compInputKgDay * compost.retentionDays) / 1000) * 0.6 * 60 * 0.15;

  const isCpVolOk = qWasteTon > 0 && cpTotalVolActual >= compTotalVolTheo;
  const isCpHeightOk = activeCpH > 0 && activeCpH <= 2.5;
  const isCpAllOk = isCpVolOk && isCpHeightOk;

  // === CALCULATIONS: 3. LÒ ĐỐT RÁC Y TẾ / NGUY HẠI ===
  const burnRateKgH =
    incinerator.burnHoursDay > 0 ? qWasteKg / incinerator.burnHoursDay : 0;
  // Thể tích buồng sơ cấp lý thuyết
  const incVol1Theo =
    incinerator.primaryLoadKgM3H > 0
      ? burnRateKgH / incinerator.primaryLoadKgM3H
      : 0;
  // Lưu lượng khói thực tế tại nhiệt độ buồng thứ cấp (T2 °C)
  const flueGasStdM3s = (burnRateKgH * incinerator.flueGasNm3Kg) / 3600;
  const flueGasHotM3s =
    flueGasStdM3s * ((incinerator.secondaryTempC + 273.15) / 273.15);
  // Thể tích buồng thứ cấp lý thuyết
  const incVol2Theo = flueGasHotM3s * incinerator.targetRetentionSec;

  // Nội suy kích thước lý thuyết buồng sơ cấp (tỷ lệ chuẩn L1 = 2 * D1 nếu Tròn; L1=1.6W1, H1=1.2W1 nếu Chữ nhật)
  const inc1DTheo = Math.cbrt((2 * incVol1Theo) / Math.PI);
  const inc1LTheoCyl = inc1DTheo * 2;
  const inc1WTheoRect = Math.cbrt(incVol1Theo / (1.6 * 1.2));
  const inc1LTheoRect = inc1WTheoRect * 1.6;
  const inc1HTheoRect = inc1WTheoRect * 1.2;

  // Nội suy kích thước lý thuyết buồng thứ cấp (tỷ lệ chuẩn H2 = 2.5 * D2 nếu Tròn; L2=1.5W2, H2=2.2W2 nếu Chữ nhật)
  const inc2DTheo = Math.cbrt((4 * incVol2Theo) / (Math.PI * 2.5));
  const inc2HTheoCyl = inc2DTheo * 2.5;
  const inc2WTheoRect = Math.cbrt(incVol2Theo / (1.5 * 2.2));
  const inc2LTheoRect = inc2WTheoRect * 1.5;
  const inc2HTheoRect = inc2WTheoRect * 2.2;

  // Giá trị override hoặc mặc định làm tròn
  const activeInc1D = incOv?.d1 ?? roundUpToStep(inc1DTheo, 0.1);
  const activeInc1LenCyl = incOv?.len1Cyl ?? roundUpToStep(inc1LTheoCyl, 0.1);
  const activeInc1L = incOv?.l1 ?? roundUpToStep(inc1LTheoRect, 0.1);
  const activeInc1W = incOv?.w1 ?? roundUpToStep(inc1WTheoRect, 0.1);
  const activeInc1H = incOv?.h1 ?? roundUpToStep(inc1HTheoRect, 0.1);

  const activeInc2D = incOv?.d2 ?? roundUpToStep(inc2DTheo, 0.1);
  const activeInc2HCyl = incOv?.h2Cyl ?? roundUpToStep(inc2HTheoCyl, 0.1);
  const activeInc2L = incOv?.l2 ?? roundUpToStep(inc2LTheoRect, 0.1);
  const activeInc2W = incOv?.w2 ?? roundUpToStep(inc2WTheoRect, 0.1);
  const activeInc2H = incOv?.h2 ?? roundUpToStep(inc2HTheoRect, 0.1);

  const incVol1Actual =
    incinerator.primaryShape === 'Tròn'
      ? ((Math.PI * activeInc1D * activeInc1D) / 4) * activeInc1LenCyl
      : activeInc1L * activeInc1W * activeInc1H;

  const incVol2Actual =
    incinerator.secondaryShape === 'Tròn'
      ? ((Math.PI * activeInc2D * activeInc2D) / 4) * activeInc2HCyl
      : activeInc2L * activeInc2W * activeInc2H;

  // KIỂM TRA NGƯỢC BẮT BUỘC: Dùng Thể tích buồng thứ cấp nhập đè tính ngược Thời gian lưu khí cháy
  const retentionActualSec =
    flueGasHotM3s > 0 ? incVol2Actual / flueGasHotM3s : 0;

  const isIncRetentionOk = qWasteTon > 0 && retentionActualSec >= 2.0;
  const isIncTempOk = incinerator.secondaryTempC >= 1050;
  const isIncVol1Ok = qWasteTon > 0 && incVol1Actual >= incVol1Theo;
  const isIncAllOk = isIncRetentionOk && isIncTempOk && isIncVol1Ok;

  return (
    <div className="space-y-6">
      {/* Header & Daily Waste Input */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 text-balance">
            Quản Lý & Xử Lý Chất Thải Rắn
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Thiết kế Ô chôn lấp hợp vệ sinh, Luống ủ Compost và Lò đốt rác y
            tế/nguy hại kèm kiểm tra ngược thời gian lưu khí cháy (≥ 2 giây).
          </p>
        </div>

        <div className="w-full lg:w-96 rounded-xl bg-slate-800 border border-slate-700/80 p-3.5 space-y-2.5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
          <label
            htmlFor="waste-ton-input"
            className="flex items-center justify-between text-xs font-medium text-slate-400"
          >
            <span className="flex items-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5 text-emerald-500" />
              Khối lượng rác đầu vào
            </span>
            <span className="font-mono tabular-nums text-slate-300">
              {qWasteKg.toLocaleString('vi-VN')} kg/ng · Nước:{' '}
              {globalQ.toLocaleString('vi-VN')} m³/ng
            </span>
          </label>
          <div className="relative flex items-center">
            <DecimalInput
              id="waste-ton-input"
              value={wasteTonDay}
              onValueChange={setWasteTonDay}
              className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 pr-24 py-2 font-mono text-base font-semibold text-emerald-400 tabular-nums focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
            />
            <span className="absolute right-3 text-xs font-mono text-slate-400 pointer-events-none">
              tấn/ngày
            </span>
          </div>
          <div className="print:hidden flex flex-wrap gap-1.5">
            {WASTE_PRESETS_TON.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setWasteTonDay(val)}
                className={`min-h-[44px] px-3 py-1.5 rounded text-xs font-mono tabular-nums transition-colors ${
                  wasteTonDay === val
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-slate-500'
                }`}
              >
                {val} tấn
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 3 Tabs */}
      <div
        role="tablist"
        aria-label="Công trình xử lý chất thải rắn"
        className="print:hidden flex items-center gap-2 overflow-x-auto pb-1"
      >
        {SOLID_TABS.map((tab) => {
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

      {/* TAB 1: Ô CHÔN LẤP */}
      {activeTab === 'landfill' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Thông số lý thuyết Ô chôn lấp ({landfill.shape})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tổng rác {landfill.operatingYears} năm:{' '}
                  {(qWasteTon * lfDays).toLocaleString('vi-VN')} tấn · V_rác ={' '}
                  {lfWasteVolTheo.toFixed(0)} m³ (+{landfill.coverSoilRatioPct}%
                  đất phủ)
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                V_tổng_lt = {lfTotalVolTheo.toFixed(0)} m³
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="lf-shape"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Hình dạng ô chôn lấp
                </label>
                <select
                  id="lf-shape"
                  value={landfill.shape}
                  onChange={(e) => {
                    setLandfill((p) => ({ ...p, shape: e.target.value }));
                    setLandfillOv(null);
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Hình chóp cụt">
                    Hình chóp cụt (Đào sâu có mái taluy)
                  </option>
                  <option value="Chữ nhật">Chữ nhật (Tường đứng L × W × H)</option>
                </select>
              </div>

              <NumberField
                id="lf-years"
                label="Thời gian khai thác ô (Tuổi thọ)"
                unit="năm"
                value={landfill.operatingYears}
                min={1}
                max={30}
                step={0.5}
                onChange={(v) => {
                  setLandfill((p) => ({ ...p, operatingYears: v }));
                  setLandfillOv(null);
                }}
              />

              <NumberField
                id="lf-density"
                label="Tỷ trọng rác sau đầm nén"
                unit="kg/m³"
                value={landfill.compactedDensityKgM3}
                min={400}
                max={1200}
                step={50}
                onChange={(v) => {
                  setLandfill((p) => ({ ...p, compactedDensityKgM3: v }));
                  setLandfillOv(null);
                }}
              />

              <NumberField
                id="lf-cover"
                label="Tỷ lệ đất phủ trung gian & đỉnh"
                unit="%"
                value={landfill.coverSoilRatioPct}
                min={5}
                max={35}
                step={1}
                onChange={(v) => {
                  setLandfill((p) => ({ ...p, coverSoilRatioPct: v }));
                  setLandfillOv(null);
                }}
              />

              <NumberField
                id="lf-depth"
                label="Chiều sâu thiết kế ô (H)"
                unit="m"
                value={landfill.depthH}
                min={2}
                max={20}
                step={0.5}
                onChange={(v) => {
                  setLandfill((p) => ({ ...p, depthH: v }));
                  setLandfillOv(null);
                }}
              />

              <NumberField
                id="lf-ratio"
                label="Tỷ lệ Dài / Rộng đáy (L/W)"
                unit="L/W"
                value={landfill.ratioLW}
                min={1}
                max={4}
                step={0.1}
                onChange={(v) => {
                  setLandfill((p) => ({ ...p, ratioLW: v }));
                  setLandfillOv(null);
                }}
              />

              {landfill.shape === 'Hình chóp cụt' && (
                <NumberField
                  id="lf-slope"
                  label="Hệ số mái dốc taluy (1 : m)"
                  unit="m"
                  value={landfill.slopeM}
                  min={0.5}
                  max={3}
                  step={0.25}
                  onChange={(v) => {
                    setLandfill((p) => ({ ...p, slopeM: v }));
                    setLandfillOv(null);
                  }}
                />
              )}
            </div>
          </section>

          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Nhập đè kích thước thi công ({landfill.shape})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lý thuyết đáy: {lfLBotTheo.toFixed(1)} × {lfWBotTheo.toFixed(1)}{' '}
                  m
                  {landfill.shape === 'Hình chóp cụt'
                    ? ` · Miệng ô: ${lfLTopTheo.toFixed(1)} × ${lfWTopTheo.toFixed(1)} m`
                    : ''}{' '}
                  · H = {landfill.depthH} m
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setLandfillOv({
                    lBot: roundUpToStep(lfLBotTheo, 0.5),
                    wBot: roundUpToStep(lfWBotTheo, 0.5),
                    lTop: roundUpToStep(lfLTopTheo, 0.5),
                    wTop: roundUpToStep(lfWTopTheo, 0.5),
                    h: landfill.depthH,
                  })
                }
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Làm tròn theo lý thuyết</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <NumberField
                id="lf-ov-lbot"
                label={
                  landfill.shape === 'Chữ nhật'
                    ? 'Chiều dài ô (L)'
                    : 'Chiều dài đáy ô (L_đáy)'
                }
                unit="m"
                value={activeLfLBot}
                min={2}
                max={500}
                step={0.5}
                onChange={(v) =>
                  setLandfillOv({
                    lBot: v,
                    wBot: activeLfWBot,
                    lTop: activeLfLTop,
                    wTop: activeLfWTop,
                    h: activeLfH,
                  })
                }
              />
              <NumberField
                id="lf-ov-wbot"
                label={
                  landfill.shape === 'Chữ nhật'
                    ? 'Chiều rộng ô (W)'
                    : 'Chiều rộng đáy ô (W_đáy)'
                }
                unit="m"
                value={activeLfWBot}
                min={2}
                max={500}
                step={0.5}
                onChange={(v) =>
                  setLandfillOv({
                    lBot: activeLfLBot,
                    wBot: v,
                    lTop: activeLfLTop,
                    wTop: activeLfWTop,
                    h: activeLfH,
                  })
                }
              />

              {landfill.shape === 'Hình chóp cụt' && (
                <>
                  <NumberField
                    id="lf-ov-ltop"
                    label="Chiều dài miệng ô (L_mặt)"
                    unit="m"
                    value={activeLfLTop}
                    min={2}
                    max={550}
                    step={0.5}
                    onChange={(v) =>
                      setLandfillOv({
                        lBot: activeLfLBot,
                        wBot: activeLfWBot,
                        lTop: v,
                        wTop: activeLfWTop,
                        h: activeLfH,
                      })
                    }
                  />
                  <NumberField
                    id="lf-ov-wtop"
                    label="Chiều rộng miệng ô (W_mặt)"
                    unit="m"
                    value={activeLfWTop}
                    min={2}
                    max={550}
                    step={0.5}
                    onChange={(v) =>
                      setLandfillOv({
                        lBot: activeLfLBot,
                        wBot: activeLfWBot,
                        lTop: activeLfLTop,
                        wTop: v,
                        h: activeLfH,
                      })
                    }
                  />
                </>
              )}

              <NumberField
                id="lf-ov-h"
                label="Chiều sâu / cao thực tế (H)"
                unit="m"
                value={activeLfH}
                min={1}
                max={30}
                step={0.5}
                onChange={(v) =>
                  setLandfillOv({
                    lBot: activeLfLBot,
                    wBot: activeLfWBot,
                    lTop: activeLfLTop,
                    wTop: activeLfWTop,
                    h: v,
                  })
                }
              />
            </div>

            <StatusBanner
              ok={isLfVolOk}
              titleOk="ĐẠT CHUẨN DUNG TÍCH Ô CHÔN LẤP"
              titleFail="CẢNH BÁO ĐỎ: THIẾU DUNG TÍCH CHÔN LẤP THEO TUỔI THỌ"
              message={
                isLfVolOk
                  ? `Thể tích thực (${lfVolActual.toFixed(0)} m³) đáp ứng đủ ${lfActualYears.toFixed(1)} năm khai thác (${lfActualCapacityTons.toFixed(0)} tấn rác đầm nén). Nước rỉ rác dự kiến ~${lfLeachateM3Day.toFixed(1)} m³/ngày.`
                  : `Thể tích thực (${lfVolActual.toFixed(0)} m³) nhỏ hơn thể tích lý thuyết (${lfTotalVolTheo.toFixed(0)} m³). Cần tăng kích thước hoặc chiều sâu H.`
              }
              summaryRight={`V_thực = ${lfVolActual.toFixed(0)} m³`}
            />

            <CheckTable
              rows={[
                {
                  name: `Thể tích ô (${landfill.shape})`,
                  standard: `≥ ${lfTotalVolTheo.toFixed(0)} m³`,
                  actual: `${lfVolActual.toFixed(0)} m³`,
                  ok: isLfVolOk,
                  statusText: isLfVolOk ? 'Đủ dung tích' : 'Thiếu thể tích',
                },
                {
                  name: 'Thời gian khai thác thực tế',
                  standard: `≥ ${landfill.operatingYears} năm`,
                  actual: `${lfActualYears.toFixed(2)} năm`,
                  ok: lfActualYears >= landfill.operatingYears,
                  statusText:
                    lfActualYears >= landfill.operatingYears
                      ? 'Đạt tuổi thọ'
                      : 'Rút ngắn tuổi thọ',
                },
                {
                  name: 'Nước rỉ rác ước tính (diện tích mặt mở)',
                  standard: `A_mặt = ${lfTopArea.toFixed(0)} m²`,
                  actual: `${lfLeachateM3Day.toFixed(1)} m³/ngày`,
                  ok: true,
                  statusText: 'Cần trạm xử lý nước rỉ',
                },
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 2: Ủ COMPOST */}
      {activeTab === 'compost' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Thông số Luống ủ Compost ({compost.shape})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rác hữu cơ đưa vào ủ: {compInputKgDay.toLocaleString('vi-VN')}{' '}
                  kg/ngày ({compost.organicPct}%) · Chia {nWindrows} luống ủ
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                V_tổng_lt = {compTotalVolTheo.toFixed(1)} m³ (
                {compOneVolTheo.toFixed(1)} m³/luống)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="cp-shape"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Hình dạng luống / ngăn ủ
                </label>
                <select
                  id="cp-shape"
                  value={compost.shape}
                  onChange={(e) => {
                    setCompost((p) => ({ ...p, shape: e.target.value }));
                    setCompostOv(null);
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Hình chóp cụt">
                    Hình chóp cụt (Luống đống hình thang)
                  </option>
                  <option value="Chữ nhật">
                    Chữ nhật (Bể / ngăn ủ tường bê tông)
                  </option>
                </select>
              </div>

              <NumberField
                id="cp-org"
                label="Tỷ lệ rác hữu cơ phân loại"
                unit="%"
                value={compost.organicPct}
                min={10}
                max={100}
                step={5}
                onChange={(v) => {
                  setCompost((p) => ({ ...p, organicPct: v }));
                  setCompostOv(null);
                }}
              />

              <NumberField
                id="cp-days"
                label="Thời gian lưu ủ tích cực"
                unit="ngày"
                value={compost.retentionDays}
                min={14}
                max={90}
                step={1}
                onChange={(v) => {
                  setCompost((p) => ({ ...p, retentionDays: v }));
                  setCompostOv(null);
                }}
              />

              <NumberField
                id="cp-density"
                label="Tỷ trọng khối ủ"
                unit="kg/m³"
                value={compost.densityKgM3}
                min={350}
                max={800}
                step={25}
                onChange={(v) => {
                  setCompost((p) => ({ ...p, densityKgM3: v }));
                  setCompostOv(null);
                }}
              />

              <NumberField
                id="cp-windrows"
                label="Số lượng luống / ngăn ủ"
                unit="luống"
                value={compost.numWindrows}
                min={1}
                max={30}
                step={1}
                onChange={(v) => {
                  setCompost((p) => ({ ...p, numWindrows: v }));
                  setCompostOv(null);
                }}
              />

              <NumberField
                id="cp-height"
                label="Chiều cao luống ủ thiết kế (H)"
                unit="m"
                value={compost.heightH}
                min={0.8}
                max={3.0}
                step={0.1}
                onChange={(v) => {
                  setCompost((p) => ({ ...p, heightH: v }));
                  setCompostOv(null);
                }}
              />
            </div>
          </section>

          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Nhập đè kích thước 1 luống ủ & Kiểm tra chiều cao / thời
                  gian lưu
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lý thuyết 1 luống: Đáy {cpLBotTheo.toFixed(1)} ×{' '}
                  {cpWBotTheo.toFixed(1)} m
                  {compost.shape === 'Hình chóp cụt'
                    ? ` · Đỉnh ${cpLTopTheo.toFixed(1)} × ${cpWTopTheo.toFixed(1)} m`
                    : ''}{' '}
                  · H = {compost.heightH} m
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCompostOv({
                    lBot: roundUpToStep(cpLBotTheo, 0.2),
                    wBot: roundUpToStep(cpWBotTheo, 0.2),
                    lTop: roundUpToStep(cpLTopTheo, 0.2),
                    wTop: roundUpToStep(cpWTopTheo, 0.2),
                    h: compost.heightH,
                  })
                }
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Làm tròn theo lý thuyết</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <NumberField
                id="cp-ov-lbot"
                label={
                  compost.shape === 'Chữ nhật'
                    ? 'Chiều dài ngăn ủ (L)'
                    : 'Chiều dài đáy luống (L_đáy)'
                }
                unit="m"
                value={activeCpLBot}
                min={1}
                max={100}
                step={0.2}
                onChange={(v) =>
                  setCompostOv({
                    lBot: v,
                    wBot: activeCpWBot,
                    lTop: activeCpLTop,
                    wTop: activeCpWTop,
                    h: activeCpH,
                  })
                }
              />
              <NumberField
                id="cp-ov-wbot"
                label={
                  compost.shape === 'Chữ nhật'
                    ? 'Chiều rộng ngăn ủ (W)'
                    : 'Chiều rộng đáy luống (W_đáy)'
                }
                unit="m"
                value={activeCpWBot}
                min={1}
                max={30}
                step={0.2}
                onChange={(v) =>
                  setCompostOv({
                    lBot: activeCpLBot,
                    wBot: v,
                    lTop: activeCpLTop,
                    wTop: activeCpWTop,
                    h: activeCpH,
                  })
                }
              />

              {compost.shape === 'Hình chóp cụt' && (
                <>
                  <NumberField
                    id="cp-ov-ltop"
                    label="Chiều dài đỉnh luống (L_đỉnh)"
                    unit="m"
                    value={activeCpLTop}
                    min={0.5}
                    max={100}
                    step={0.2}
                    onChange={(v) =>
                      setCompostOv({
                        lBot: activeCpLBot,
                        wBot: activeCpWBot,
                        lTop: v,
                        wTop: activeCpWTop,
                        h: activeCpH,
                      })
                    }
                  />
                  <NumberField
                    id="cp-ov-wtop"
                    label="Chiều rộng đỉnh luống (W_đỉnh)"
                    unit="m"
                    value={activeCpWTop}
                    min={0.4}
                    max={30}
                    step={0.2}
                    onChange={(v) =>
                      setCompostOv({
                        lBot: activeCpLBot,
                        wBot: activeCpWBot,
                        lTop: activeCpLTop,
                        wTop: v,
                        h: activeCpH,
                      })
                    }
                  />
                </>
              )}

              <NumberField
                id="cp-ov-h"
                label="Chiều cao luống ủ thực tế (H)"
                unit="m"
                value={activeCpH}
                min={0.5}
                max={4.0}
                step={0.1}
                onChange={(v) =>
                  setCompostOv({
                    lBot: activeCpLBot,
                    wBot: activeCpWBot,
                    lTop: activeCpLTop,
                    wTop: activeCpWTop,
                    h: v,
                  })
                }
              />
            </div>

            <StatusBanner
              ok={isCpAllOk}
              titleOk="ĐẠT CHUẨN HỆ THỐNG Ủ COMPOST"
              titleFail="CẢNH BÁO ĐỎ: KHÔNG ĐẠT DUNG TÍCH HOẶC CHIỀU CAO LUỐNG Ủ"
              message={
                isCpAllOk
                  ? `Tổng thể tích ${nWindrows} luống = ${cpTotalVolActual.toFixed(1)} m³ (lưu ${cpRetentionActualDays.toFixed(1)} ngày). Thu hồi mùn Compost ~${cpProductTonDay.toFixed(2)} tấn/ngày.`
                  : `${!isCpVolOk ? `Tổng thể tích thực (${cpTotalVolActual.toFixed(1)} m³) < yêu cầu (${compTotalVolTheo.toFixed(1)} m³). ` : ''}${!isCpHeightOk ? `Chiều cao luống (${activeCpH.toFixed(1)} m) > 2,5 m — dễ nén yếm khí sinh mùi H₂S!` : ''}`
              }
              summaryRight={`${cpTotalVolActual.toFixed(1)} m³ · ${cpRetentionActualDays.toFixed(1)} ngày`}
            />

            <CheckTable
              rows={[
                {
                  name: `Tổng thể tích ủ (${nWindrows} luống × ${cpOneVolActual.toFixed(1)} m³)`,
                  standard: `≥ ${compTotalVolTheo.toFixed(1)} m³`,
                  actual: `${cpTotalVolActual.toFixed(1)} m³`,
                  ok: isCpVolOk,
                  statusText: isCpVolOk ? 'Đủ thể tích' : 'Thiếu thể tích',
                },
                {
                  name: 'Chiều cao đống ủ hiếu khí (H)',
                  standard: '≤ 2,50 m',
                  actual: `${activeCpH.toFixed(2)} m`,
                  ok: isCpHeightOk,
                  statusText: isCpHeightOk
                    ? 'Thoáng khí tốt'
                    : 'Quá cao (Gây yếm khí)',
                },
                {
                  name: 'Quạt thổi khí đáy & Sản lượng phân mùn',
                  standard: `Lưu ${cpRetentionActualDays.toFixed(1)} ngày`,
                  actual: `${cpBlowerM3h.toFixed(0)} m³/h · ${cpProductTonDay.toFixed(2)} tấn/ng`,
                  ok: true,
                  statusText: 'Thu hồi 38%',
                },
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 3: LÒ ĐỐT RÁC Y TẾ / NGUY HẠI */}
      {activeTab === 'incinerator' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Thông số Nhiệt & Thể tích lý thuyết Lò đốt 2 cấp
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Công suất đốt: {burnRateKgH.toFixed(1)} kg/giờ · Lưu lượng
                  khói nóng ở {incinerator.secondaryTempC}°C ={' '}
                  {flueGasHotM3s.toFixed(3)} m³/s
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                V_sơ cấp_lt = {incVol1Theo.toFixed(2)} m³ · V_thứ cấp_lt ={' '}
                {incVol2Theo.toFixed(2)} m³
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <NumberField
                id="inc-hours"
                label="Số giờ đốt mỗi ngày"
                unit="giờ/ng"
                value={incinerator.burnHoursDay}
                min={2}
                max={24}
                step={1}
                onChange={(v) => {
                  setIncinerator((p) => ({ ...p, burnHoursDay: v }));
                  setIncOv(null);
                }}
              />

              <NumberField
                id="inc-t2"
                label="Nhiệt độ buồng đốt thứ cấp (T₂)"
                unit="°C"
                value={incinerator.secondaryTempC}
                min={850}
                max={1300}
                step={25}
                onChange={(v) => {
                  setIncinerator((p) => ({ ...p, secondaryTempC: v }));
                  setIncOv(null);
                }}
              />

              <NumberField
                id="inc-gas"
                label="Suất sinh khói chuẩn (đktc)"
                unit="Nm³/kg"
                value={incinerator.flueGasNm3Kg}
                min={6}
                max={16}
                step={0.5}
                onChange={(v) => {
                  setIncinerator((p) => ({ ...p, flueGasNm3Kg: v }));
                  setIncOv(null);
                }}
              />

              <NumberField
                id="inc-load1"
                label="Tải trọng đốt buồng sơ cấp"
                unit="kg/m³·h"
                value={incinerator.primaryLoadKgM3H}
                min={50}
                max={200}
                step={10}
                onChange={(v) => {
                  setIncinerator((p) => ({ ...p, primaryLoadKgM3H: v }));
                  setIncOv(null);
                }}
              />

              <div>
                <label
                  htmlFor="inc-shape1"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Hình dạng buồng sơ cấp
                </label>
                <select
                  id="inc-shape1"
                  value={incinerator.primaryShape}
                  onChange={(e) => {
                    setIncinerator((p) => ({
                      ...p,
                      primaryShape: e.target.value,
                    }));
                    setIncOv(null);
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Tròn">Tròn (Trụ ngang Ø D₁ × L₁)</option>
                  <option value="Chữ nhật">Chữ nhật (L₁ × W₁ × H₁)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="inc-shape2"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Hình dạng buồng thứ cấp
                </label>
                <select
                  id="inc-shape2"
                  value={incinerator.secondaryShape}
                  onChange={(e) => {
                    setIncinerator((p) => ({
                      ...p,
                      secondaryShape: e.target.value,
                    }));
                    setIncOv(null);
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Tròn">Tròn (Tháp đứng Ø D₂ × H₂)</option>
                  <option value="Chữ nhật">Chữ nhật (L₂ × W₂ × H₂)</option>
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Nhập đè kích thước 2 buồng đốt → Kiểm tra ngược Thời gian
                  lưu khí cháy
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Buồng thứ cấp thực tế V₂_thực = {incVol2Actual.toFixed(2)} m³ ·
                  Yêu cầu thời gian lưu khí cháy τ₂ ≥ 2,00 giây (QCVN
                  02/30:BTNMT).
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setIncOv({
                    d1: roundUpToStep(inc1DTheo, 0.1),
                    len1Cyl: roundUpToStep(inc1LTheoCyl, 0.1),
                    l1: roundUpToStep(inc1LTheoRect, 0.1),
                    w1: roundUpToStep(inc1WTheoRect, 0.1),
                    h1: roundUpToStep(inc1HTheoRect, 0.1),
                    d2: roundUpToStep(inc2DTheo, 0.1),
                    h2Cyl: roundUpToStep(inc2HTheoCyl, 0.1),
                    l2: roundUpToStep(inc2LTheoRect, 0.1),
                    w2: roundUpToStep(inc2WTheoRect, 0.1),
                    h2: roundUpToStep(inc2HTheoRect, 0.1),
                  })
                }
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Làm tròn theo lý thuyết</span>
              </button>
            </div>

            {/* Buồng sơ cấp inputs */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-400">
                Kích thước Buồng đốt sơ cấp (V₁_thực = {incVol1Actual.toFixed(2)}{' '}
                m³ / V₁_lt = {incVol1Theo.toFixed(2)} m³)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {incinerator.primaryShape === 'Tròn' ? (
                  <>
                    <NumberField
                      id="inc-ov-d1"
                      label="Đường kính trong buồng sơ cấp (D₁)"
                      unit="m"
                      value={activeInc1D}
                      min={0.4}
                      max={6.0}
                      step={0.1}
                      onChange={(v) =>
                        setIncOv({
                          d1: v,
                          len1Cyl: activeInc1LenCyl,
                          l1: activeInc1L,
                          w1: activeInc1W,
                          h1: activeInc1H,
                          d2: activeInc2D,
                          h2Cyl: activeInc2HCyl,
                          l2: activeInc2L,
                          w2: activeInc2W,
                          h2: activeInc2H,
                        })
                      }
                    />
                    <NumberField
                      id="inc-ov-l1c"
                      label="Chiều dài buồng sơ cấp (L₁)"
                      unit="m"
                      value={activeInc1LenCyl}
                      min={0.5}
                      max={12.0}
                      step={0.1}
                      onChange={(v) =>
                        setIncOv({
                          d1: activeInc1D,
                          len1Cyl: v,
                          l1: activeInc1L,
                          w1: activeInc1W,
                          h1: activeInc1H,
                          d2: activeInc2D,
                          h2Cyl: activeInc2HCyl,
                          l2: activeInc2L,
                          w2: activeInc2W,
                          h2: activeInc2H,
                        })
                      }
                    />
                  </>
                ) : (
                  <>
                    <NumberField
                      id="inc-ov-l1"
                      label="Chiều dài buồng sơ cấp (L₁)"
                      unit="m"
                      value={activeInc1L}
                      min={0.5}
                      max={12.0}
                      step={0.1}
                      onChange={(v) =>
                        setIncOv({
                          d1: activeInc1D,
                          len1Cyl: activeInc1LenCyl,
                          l1: v,
                          w1: activeInc1W,
                          h1: activeInc1H,
                          d2: activeInc2D,
                          h2Cyl: activeInc2HCyl,
                          l2: activeInc2L,
                          w2: activeInc2W,
                          h2: activeInc2H,
                        })
                      }
                    />
                    <NumberField
                      id="inc-ov-w1"
                      label="Chiều rộng buồng sơ cấp (W₁)"
                      unit="m"
                      value={activeInc1W}
                      min={0.5}
                      max={8.0}
                      step={0.1}
                      onChange={(v) =>
                        setIncOv({
                          d1: activeInc1D,
                          len1Cyl: activeInc1LenCyl,
                          l1: activeInc1L,
                          w1: v,
                          h1: activeInc1H,
                          d2: activeInc2D,
                          h2Cyl: activeInc2HCyl,
                          l2: activeInc2L,
                          w2: activeInc2W,
                          h2: activeInc2H,
                        })
                      }
                    />
                    <NumberField
                      id="inc-ov-h1"
                      label="Chiều cao buồng sơ cấp (H₁)"
                      unit="m"
                      value={activeInc1H}
                      min={0.5}
                      max={8.0}
                      step={0.1}
                      onChange={(v) =>
                        setIncOv({
                          d1: activeInc1D,
                          len1Cyl: activeInc1LenCyl,
                          l1: activeInc1L,
                          w1: activeInc1W,
                          h1: v,
                          d2: activeInc2D,
                          h2Cyl: activeInc2HCyl,
                          l2: activeInc2L,
                          w2: activeInc2W,
                          h2: activeInc2H,
                        })
                      }
                    />
                  </>
                )}
              </div>
            </div>

            {/* Buồng thứ cấp inputs */}
            <div className="space-y-2 pt-2 border-t border-slate-700/60">
              <div className="text-xs font-medium text-slate-400">
                Kích thước Buồng đốt thứ cấp (V₂_thực = {incVol2Actual.toFixed(2)}{' '}
                m³ / V₂_lt = {incVol2Theo.toFixed(2)} m³)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {incinerator.secondaryShape === 'Tròn' ? (
                  <>
                    <NumberField
                      id="inc-ov-d2"
                      label="Đường kính buồng thứ cấp (D₂)"
                      unit="m"
                      value={activeInc2D}
                      min={0.4}
                      max={6.0}
                      step={0.1}
                      onChange={(v) =>
                        setIncOv({
                          d1: activeInc1D,
                          len1Cyl: activeInc1LenCyl,
                          l1: activeInc1L,
                          w1: activeInc1W,
                          h1: activeInc1H,
                          d2: v,
                          h2Cyl: activeInc2HCyl,
                          l2: activeInc2L,
                          w2: activeInc2W,
                          h2: activeInc2H,
                        })
                      }
                    />
                    <NumberField
                      id="inc-ov-h2c"
                      label="Chiều cao buồng thứ cấp (H₂)"
                      unit="m"
                      value={activeInc2HCyl}
                      min={0.5}
                      max={15.0}
                      step={0.1}
                      onChange={(v) =>
                        setIncOv({
                          d1: activeInc1D,
                          len1Cyl: activeInc1LenCyl,
                          l1: activeInc1L,
                          w1: activeInc1W,
                          h1: activeInc1H,
                          d2: activeInc2D,
                          h2Cyl: v,
                          l2: activeInc2L,
                          w2: activeInc2W,
                          h2: activeInc2H,
                        })
                      }
                    />
                  </>
                ) : (
                  <>
                    <NumberField
                      id="inc-ov-l2"
                      label="Chiều dài buồng thứ cấp (L₂)"
                      unit="m"
                      value={activeInc2L}
                      min={0.5}
                      max={10.0}
                      step={0.1}
                      onChange={(v) =>
                        setIncOv({
                          d1: activeInc1D,
                          len1Cyl: activeInc1LenCyl,
                          l1: activeInc1L,
                          w1: activeInc1W,
                          h1: activeInc1H,
                          d2: activeInc2D,
                          h2Cyl: activeInc2HCyl,
                          l2: v,
                          w2: activeInc2W,
                          h2: activeInc2H,
                        })
                      }
                    />
                    <NumberField
                      id="inc-ov-w2"
                      label="Chiều rộng buồng thứ cấp (W₂)"
                      unit="m"
                      value={activeInc2W}
                      min={0.5}
                      max={8.0}
                      step={0.1}
                      onChange={(v) =>
                        setIncOv({
                          d1: activeInc1D,
                          len1Cyl: activeInc1LenCyl,
                          l1: activeInc1L,
                          w1: activeInc1W,
                          h1: activeInc1H,
                          d2: activeInc2D,
                          h2Cyl: activeInc2HCyl,
                          l2: activeInc2L,
                          w2: v,
                          h2: activeInc2H,
                        })
                      }
                    />
                    <NumberField
                      id="inc-ov-h2"
                      label="Chiều cao buồng thứ cấp (H₂)"
                      unit="m"
                      value={activeInc2H}
                      min={0.5}
                      max={15.0}
                      step={0.1}
                      onChange={(v) =>
                        setIncOv({
                          d1: activeInc1D,
                          len1Cyl: activeInc1LenCyl,
                          l1: activeInc1L,
                          w1: activeInc1W,
                          h1: activeInc1H,
                          d2: activeInc2D,
                          h2Cyl: activeInc2HCyl,
                          l2: activeInc2L,
                          w2: activeInc2W,
                          h2: v,
                        })
                      }
                    />
                  </>
                )}
              </div>
            </div>

            <StatusBanner
              ok={isIncAllOk}
              titleOk="ĐẠT CHUẨN LÒ ĐỐT RÁC Y TẾ / NGUY HẠI"
              titleFail="CẢNH BÁO ĐỎ: THỜI GIAN LƯU KHÍ CHÁY < 2 GIÂY HOẶC KHÔNG ĐẠT CHUẨN"
              message={
                isIncAllOk
                  ? `Thời gian lưu khí cháy buồng thứ cấp = ${retentionActualSec.toFixed(2)} giây (≥ 2,00 giây) ở ${incinerator.secondaryTempC}°C — Đảm bảo phân hủy Dioxin/Furan.`
                  : `${!isIncRetentionOk ? `CẢNH BÁO: Thời gian lưu khí cháy buồng thứ cấp (${retentionActualSec.toFixed(2)} giây) < 2,00 giây — Nguy cơ không phân hủy triệt để Dioxin/Furan! ` : ''}${!isIncTempOk ? `Nhiệt độ thứ cấp (${incinerator.secondaryTempC}°C) < 1050°C. ` : ''}${!isIncVol1Ok ? `Thể tích buồng sơ cấp (${incVol1Actual.toFixed(2)} m³) < lý thuyết (${incVol1Theo.toFixed(2)} m³).` : ''}`
              }
              summaryRight={`τ₂ = ${retentionActualSec.toFixed(2)} giây · V₂ = ${incVol2Actual.toFixed(2)} m³`}
            />

            <CheckTable
              rows={[
                {
                  name: 'Thời gian lưu khí cháy buồng thứ cấp (τ₂ = V₂_thực / Q_khói)',
                  standard: '≥ 2,00 giây',
                  actual: `${retentionActualSec.toFixed(2)} giây`,
                  ok: isIncRetentionOk,
                  statusText: isIncRetentionOk
                    ? 'Đạt chuẩn (≥ 2s)'
                    : 'Không đạt (< 2s)',
                },
                {
                  name: 'Nhiệt độ buồng đốt thứ cấp (T₂)',
                  standard: '≥ 1.050 °C',
                  actual: `${incinerator.secondaryTempC} °C`,
                  ok: isIncTempOk,
                  statusText: isIncTempOk
                    ? 'Phân hủy Dioxin tốt'
                    : 'Chưa đủ nhiệt',
                },
                {
                  name: 'Thể tích buồng đốt sơ cấp thực tế (V₁_thực)',
                  standard: `≥ ${incVol1Theo.toFixed(2)} m³`,
                  actual: `${incVol1Actual.toFixed(2)} m³`,
                  ok: isIncVol1Ok,
                  statusText: isIncVol1Ok ? 'Đủ dung tích đốt' : 'Quá tải buồng 1',
                },
                {
                  name: 'Lưu lượng khói nóng qua buồng thứ cấp',
                  standard: `${flueGasStdM3s.toFixed(3)} Nm³/s (đktc)`,
                  actual: `${flueGasHotM3s.toFixed(3)} m³/s (${(flueGasHotM3s * 3600).toFixed(0)} m³/h)`,
                  ok: true,
                  statusText: `${burnRateKgH.toFixed(1)} kg rác/h`,
                },
              ]}
            />
          </section>
        </div>
      )}

      <EquipmentSelector
        key={`omnieco_equipments_solidwaste_${activeTab}`}
        moduleLabel={
          SOLID_EQUIPMENT_LABELS[activeTab] || 'Công trình Chất thải rắn'
        }
        storageKey={`omnieco_equipments_solidwaste_${activeTab}`}
      />
    </div>
  );
}
