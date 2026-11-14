import { useState } from 'react';
import {
  Beaker,
  ClipboardList,
  Droplets,
  FlaskConical,
  Sparkles,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { NumberField, StatusBanner } from '../components/CalcPrimitives';

const OPS_TABS = [
  { id: 'nutrient', label: 'Dinh dưỡng (100:5:1)', icon: FlaskConical },
  { id: 'carbon', label: 'Carbon khử Nitơ', icon: Beaker },
  { id: 'alkalinity', label: 'Kiềm NaHCO₃ (7,14)', icon: Droplets },
  { id: 'mbr_clean', label: 'Rửa màng MBR (MC/RC)', icon: Sparkles },
];

export default function OperationsCalc() {
  const { hydraulics, bioQuality } = useAppContext();
  const [activeTab, setActiveTab] = useState('nutrient');

  // --- TAB 1: DINH DƯỠNG (BOD:N:P = 100:5:1) ---
  const [nutrient, setNutrient] = useState({
    bodMgL: 400,
    nAvailMgL: 5,
    pAvailMgL: 0.5,
    pSource: 'DAP', // DAP | H3PO4
    tankVolL: 1000, // bồn pha hóa chất (Lít)
  });

  // --- TAB 2: CARBON BÙ KHỬ NITƠ ---
  const [carbon, setCarbon] = useState({
    no3InMgL: 35,
    no3OutMgL: 7,
    bodAvailAnoxicMgL: 40, // BOD sẵn có tham gia khử NO3 ở Anoxic
    sourceType: 'Molasses', // Molasses | Acetic99 | Acetic50 | Methanol
  });

  // --- TAB 3: KIỀM NaHCO3 BÙ NITRAT HÓA ---
  const [alk, setAlk] = useState({
    useStep4Nh4: true,
    nh4InMgL: bioQuality.nh4In,
    nh4OutMgL: bioQuality.nh4Out,
    alkInMgL: 120,
    alkTargetOutMgL: 70,
    hasAnoxicCredit: bioQuality.hasAnoxic,
    no3DenitMgL: bioQuality.no3DenitrifiedMgL,
  });

  // --- TAB 4: RỬA MÀNG MBR (MC & RC) ---
  const [mbr, setMbr] = useState({
    membraneAreaM2: 500,
    mcSpecVolLM2: 2.5, // L dung dịch / m2 màng cho rửa bảo trì MC
    mcJavenPpm: 400, // chuẩn 300 - 500 ppm
    rcSpecVolLM2: 4.0, // L dung dịch / m2 màng cho rửa phục hồi RC
    rcJavenPpm: 2000, // chuẩn 1000 - 3000 ppm
    acidType: 'Acid Citric', // Acid Citric | Acid Oxalic
    rcAcidPpm: 1500, // chuẩn 1000 - 2000 ppm
    javenPct: 10, // NaOCl thương phẩm 10% (hoặc 12%)
    javenDensity: 1.15, // kg/L
  });

  const qDay = hydraulics.qDay;

  // === CALCULATIONS: 1. DINH DƯỠNG (100:5:1) ===
  const bodLoadKgDay = (qDay * Math.max(0, nutrient.bodMgL)) / 1000;
  const nReqKgDay = bodLoadKgDay * 0.05;
  const pReqKgDay = bodLoadKgDay * 0.01;
  const nAvailKgDay = (qDay * Math.max(0, nutrient.nAvailMgL)) / 1000;
  const pAvailKgDay = (qDay * Math.max(0, nutrient.pAvailMgL)) / 1000;

  const pDeficitKgDay = Math.max(0, pReqKgDay - pAvailKgDay);
  // DAP ((NH4)2HPO4): 20.1% P, 18% N; H3PO4 85%: 26.86% P, density 1.685 kg/L
  const dapKgDay = nutrient.pSource === 'DAP' ? pDeficitKgDay / 0.201 : 0;
  const h3po4KgDay =
    nutrient.pSource === 'H3PO4' ? pDeficitKgDay / 0.2686 : 0;
  const h3po4LitersDay = h3po4KgDay / 1.685;
  const nFromDapKgDay = dapKgDay * 0.18;

  const nDeficitKgDay = Math.max(0, nReqKgDay - nAvailKgDay - nFromDapKgDay);
  // Ure CO(NH2)2: 46% N nguyên chất
  const ureKgDay = nDeficitKgDay / 0.46;
  const totalSolidChemKgDay = ureKgDay + dapKgDay;
  // Gợi ý lưu lượng bơm định lượng nếu pha vào bồn tankVolL
  const dosingFlowLh = nutrient.tankVolL / 24;

  // === CALCULATIONS: 2. CARBON KHỬ NITƠ ===
  const deltaNo3MgL = Math.max(0, carbon.no3InMgL - carbon.no3OutMgL);
  const no3RemovedKgDay = (qDay * deltaNo3MgL) / 1000;
  // Nhu cầu COD cho khử Nitrat: 4.0 kg COD / kg NO3-N
  const codNeededTotalKgDay = 4.0 * no3RemovedKgDay;
  // COD từ BOD sẵn có ở Anoxic (BOD5 * 1.5)
  const codAvailKgDay = (qDay * Math.max(0, carbon.bodAvailAnoxicMgL) * 1.5) / 1000;
  const codDeficitKgDay = Math.max(0, codNeededTotalKgDay - codAvailKgDay);

  const carbonProps =
    carbon.sourceType === 'Molasses'
      ? {
          name: 'Mật rỉ đường (Molasses)',
          codPerKg: 0.8, // 800 g COD/kg
          density: 1.35,
          unitNote: '800 g COD/kg · tỷ trọng 1,35 kg/L',
        }
      : carbon.sourceType === 'Acetic99'
      ? {
          name: 'Acid Acetic 99% (CH₃COOH)',
          codPerKg: 1.056, // 1.067 * 0.99
          density: 1.05,
          unitNote: '1.056 g COD/kg · tỷ trọng 1,05 kg/L',
        }
      : carbon.sourceType === 'Acetic50'
      ? {
          name: 'Acid Acetic 50%',
          codPerKg: 0.533,
          density: 1.06,
          unitNote: '533 g COD/kg · tỷ trọng 1,06 kg/L',
        }
      : {
          name: 'Methanol 99% (CH₃OH)',
          codPerKg: 1.485,
          density: 0.79,
          unitNote: '1.485 g COD/kg · tỷ trọng 0,79 kg/L',
        };

  const carbonMassKgDay = codDeficitKgDay / carbonProps.codPerKg;
  const carbonLitersDay = carbonMassKgDay / carbonProps.density;
  const carbonLitersHour = carbonLitersDay / 24;

  // === CALCULATIONS: 3. KIỀM NaHCO3 BÙ NITRAT HÓA ===
  const activeNh4In = alk.useStep4Nh4 ? bioQuality.nh4In : alk.nh4InMgL;
  const activeNh4Out = alk.useStep4Nh4 ? bioQuality.nh4Out : alk.nh4OutMgL;
  const deltaNh4MgL = Math.max(0, activeNh4In - activeNh4Out);
  const nh4RemovedKgDay = (qDay * deltaNh4MgL) / 1000;

  // Tiêu thụ 7.14 g kiềm CaCO3 / g N-NH4+
  const alkConsumedMgL = 7.14 * deltaNh4MgL;
  const alkConsumedKgDay = 7.14 * nh4RemovedKgDay;

  // Hoàn lại 3.57 g kiềm CaCO3 / g NO3-N nếu có Anoxic
  const effNo3DenitMgL = alk.hasAnoxicCredit
    ? Math.min(deltaNh4MgL, Math.max(0, alk.no3DenitMgL))
    : 0;
  const alkRecoveredMgL = 3.57 * effNo3DenitMgL;
  const alkRecoveredKgDay = (qDay * alkRecoveredMgL) / 1000;

  const alkRemainMgL = alk.alkInMgL - alkConsumedMgL + alkRecoveredMgL;
  const alkDeficitMgL = Math.max(0, alk.alkTargetOutMgL - alkRemainMgL);
  const alkDeficitKgDay = (qDay * alkDeficitMgL) / 1000;
  // 1 kg kiềm CaCO3 cần 1.68 kg NaHCO3 nguyên chất -> ~1.70 kg NaHCO3 99%
  const nahco3KgDay = alkDeficitKgDay * 1.7;
  const nahco3KgHour = nahco3KgDay / 24;
  const nahco3Bags25Kg = nahco3KgDay / 25;
  const isAlkSafeWithoutDose = alkRemainMgL >= alk.alkTargetOutMgL;

  // === CALCULATIONS: 4. RỬA MÀNG MBR (MC & RC) ===
  const areaM2 = Math.max(0, Number(mbr.membraneAreaM2) || 0);
  const mcTotalVolL = areaM2 * Math.max(0, mbr.mcSpecVolLM2);
  const rcTotalVolL = areaM2 * Math.max(0, mbr.rcSpecVolLM2);

  // Nồng độ Javen thương phẩm (mg/L = % * 10000 * tỷ trọng)
  const safeJavenPct = Math.max(0, Number(mbr.javenPct) || 0);
  const safeJavenDensity = Math.max(0.5, Number(mbr.javenDensity) || 1.15);
  const javenMgPerL = (safeJavenPct / 100) * safeJavenDensity * 1_000_000;
  const mcJavenLiters =
    javenMgPerL > 0 ? (mcTotalVolL * mbr.mcJavenPpm) / javenMgPerL : 0;
  const mcCleanWaterLiters = Math.max(0, mcTotalVolL - mcJavenLiters);

  const rcJavenLiters =
    javenMgPerL > 0 ? (rcTotalVolL * mbr.rcJavenPpm) / javenMgPerL : 0;
  const rcCleanWaterJavenL = Math.max(0, rcTotalVolL - rcJavenLiters);

  // Acid Citric / Oxalic (dạng bột tinh khiết 99%): kg = V(L) * ppm / (10^6 * 0.99)
  const rcAcidKg = (rcTotalVolL * mbr.rcAcidPpm) / (1_000_000 * 0.99);

  const isMcPpmOk = mbr.mcJavenPpm >= 300 && mbr.mcJavenPpm <= 500;
  const isRcJavenOk = mbr.rcJavenPpm >= 1000 && mbr.rcJavenPpm <= 3000;
  const isRcAcidOk = mbr.rcAcidPpm >= 1000 && mbr.rcAcidPpm <= 2000;
  const isMbrAllOk = areaM2 > 0 && isMcPpmOk && isRcJavenOk && isRcAcidOk;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 text-balance">
            Sổ Tay Vận Hành Di Động & Pha Chế Hóa Chất
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Tra cứu nhanh định lượng Ure/DAP/H₃PO₄, Mật rỉ/Acid Acetic, Kiềm
            NaHCO₃ và bảng pha chế lít dung dịch rửa màng MBR (MC/RC) ngay tại
            hiện trường.
          </p>
        </div>

        <div className="rounded-xl bg-slate-800 border border-slate-700/80 px-4 py-3 shrink-0">
          <div className="text-xs text-slate-400">
            Lưu lượng trạm (globalQ)
          </div>
          <div className="mt-1 font-mono text-lg font-semibold text-emerald-400 tabular-nums">
            {qDay.toLocaleString('vi-VN')} m³/ngày
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums">
            {hydraulics.qHour.toFixed(1)} m³/giờ
          </div>
        </div>
      </section>

      {/* 4 Tabs */}
      <div
        role="tablist"
        aria-label="Hạng mục vận hành hóa chất"
        className="flex items-center gap-2 overflow-x-auto pb-1"
      >
        {OPS_TABS.map((tab) => {
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

      {/* TAB 1: DINH DƯỠNG (BOD:N:P = 100:5:1) */}
      {activeTab === 'nutrient' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Tính Dinh dưỡng Sinh học (Tỷ lệ chuẩn BOD : N : P = 100 :
                  5 : 1)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tải lượng BOD = {bodLoadKgDay.toFixed(1)} kg/ngày ⇒ Nhu cầu N ={' '}
                  {nReqKgDay.toFixed(2)} kg/ng · P = {pReqKgDay.toFixed(2)} kg/ng
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                Ure 46%N · {nutrient.pSource === 'DAP' ? 'DAP (18N-46P₂O₅)' : 'H₃PO₄ 85%'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <NumberField
                id="nut-bod"
                label="BOD₅ nước thải vào bể sinh học"
                unit="mg/L"
                value={nutrient.bodMgL}
                min={20}
                max={5000}
                step={20}
                onChange={(v) => setNutrient((p) => ({ ...p, bodMgL: v }))}
              />
              <NumberField
                id="nut-navail"
                label="Nitơ tổng sẵn có trong nước thải"
                unit="mg/L"
                value={nutrient.nAvailMgL}
                min={0}
                max={500}
                step={1}
                onChange={(v) => setNutrient((p) => ({ ...p, nAvailMgL: v }))}
              />
              <NumberField
                id="nut-pavail"
                label="Photpho sẵn có trong nước thải"
                unit="mg/L"
                value={nutrient.pAvailMgL}
                min={0}
                max={100}
                step={0.5}
                onChange={(v) => setNutrient((p) => ({ ...p, pAvailMgL: v }))}
              />

              <div>
                <label
                  htmlFor="nut-psrc"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Hóa chất cấp Photpho
                </label>
                <select
                  id="nut-psrc"
                  value={nutrient.pSource}
                  onChange={(e) =>
                    setNutrient((p) => ({ ...p, pSource: e.target.value }))
                  }
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="DAP">
                    Phân DAP — (NH₄)₂HPO₄ (20,1% P + 18% N)
                  </option>
                  <option value="H3PO4">
                    Axit Photphoric H₃PO₄ 85% (Lỏng, 26,9% P)
                  </option>
                </select>
              </div>

              <NumberField
                id="nut-tank"
                label="Thể tích bồn pha hóa chất ngày"
                unit="Lít"
                value={nutrient.tankVolL}
                min={100}
                max={10000}
                step={100}
                onChange={(v) => setNutrient((p) => ({ ...p, tankVolL: v }))}
              />
            </div>

            <StatusBanner
              ok={qDay > 0}
              summaryLabel="Thông số pha chế"
              titleOk={`ĐỊNH LƯỢNG NGÀY: URE ${ureKgDay.toFixed(2)} kg + ${
                nutrient.pSource === 'DAP'
                  ? `DAP ${dapKgDay.toFixed(2)} kg`
                  : `H₃PO₄ 85% ${h3po4LitersDay.toFixed(2)} Lít`
              }`}
              titleFail="CHƯA CÓ LƯU LƯỢNG ĐỂ TÍNH DINH DƯỠNG"
              message={
                nutrient.pSource === 'DAP'
                  ? `Cân ${dapKgDay.toFixed(2)} kg DAP (đã tự bổ sung ${nFromDapKgDay.toFixed(2)} kg N) và ${ureKgDay.toFixed(2)} kg Ure hòa tan vào bồn ${nutrient.tankVolL} Lít nước, chạy bơm định lượng ${dosingFlowLh.toFixed(1)} L/giờ.`
                  : `Đong ${h3po4LitersDay.toFixed(2)} Lít H₃PO₄ 85% (${h3po4KgDay.toFixed(2)} kg) và cân ${ureKgDay.toFixed(2)} kg Ure hòa vào bồn ${nutrient.tankVolL} Lít, bơm định lượng ${dosingFlowLh.toFixed(1)} L/giờ.`
              }
              summaryRight={`Ure ${ureKgDay.toFixed(1)} kg/ng`}
            />

            <SummaryTable
              headers={['Hạng mục hóa chất', 'Lượng thiếu hụt', 'Khối lượng / Thể tích ngày', 'Ghi chú pha bồn']}
              rows={[
                [
                  'Ure công nghiệp (CO(NH₂)₂ — 46% N)',
                  `${nDeficitKgDay.toFixed(2)} kg N/ng`,
                  `${ureKgDay.toFixed(2)} kg/ngày (${(ureKgDay / 24).toFixed(2)} kg/h)`,
                  'Đã trừ phần N có sẵn từ nước thải & DAP',
                ],
                nutrient.pSource === 'DAP'
                  ? [
                      'Phân DAP ((NH₄)₂HPO₄ — 20,1% P, 18% N)',
                      `${pDeficitKgDay.toFixed(2)} kg P/ng`,
                      `${dapKgDay.toFixed(2)} kg/ngày (${(dapKgDay / 24).toFixed(2)} kg/h)`,
                      `Đóng góp thêm ${nFromDapKgDay.toFixed(2)} kg N/ngày`,
                    ]
                  : [
                      'Axit Photphoric H₃PO₄ 85% (26,9% P)',
                      `${pDeficitKgDay.toFixed(2)} kg P/ng`,
                      `${h3po4LitersDay.toFixed(2)} Lít/ngày (${h3po4KgDay.toFixed(2)} kg)`,
                      'Châm trực tiếp hoặc pha loãng chống ăn mòn',
                    ],
                [
                  'Tổng hóa chất rắn pha bồn / Bơm định lượng',
                  `Bồn ${nutrient.tankVolL} Lít`,
                  `${totalSolidChemKgDay.toFixed(2)} kg/ngày`,
                  `Lưu lượng bơm = ${dosingFlowLh.toFixed(1)} Lít/giờ`,
                ],
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 2: CARBON BÙ KHỬ NITƠ */}
      {activeTab === 'carbon' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Tính Nguồn Carbon Ngoài (Mật rỉ / Acid Acetic) bù khử Nitơ
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Khử {no3RemovedKgDay.toFixed(1)} kg NO₃⁻-N/ngày cần tổng{' '}
                  {codNeededTotalKgDay.toFixed(1)} kg COD/ngày (tỷ lệ 4,0 kg
                  COD/kg NO₃⁻-N).
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                COD cần bù = {codDeficitKgDay.toFixed(1)} kg/ngày
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <NumberField
                id="cb-no3in"
                label="N-NO₃⁻ vào bể Anoxic"
                unit="mg/L"
                value={carbon.no3InMgL}
                min={0}
                max={300}
                step={1}
                onChange={(v) => setCarbon((p) => ({ ...p, no3InMgL: v }))}
              />
              <NumberField
                id="cb-no3out"
                label="N-NO₃⁻ mục tiêu đầu ra"
                unit="mg/L"
                value={carbon.no3OutMgL}
                min={0}
                max={100}
                step={1}
                onChange={(v) => setCarbon((p) => ({ ...p, no3OutMgL: v }))}
              />
              <NumberField
                id="cb-bod"
                label="BOD₅ sẵn có vào Anoxic"
                unit="mg/L"
                value={carbon.bodAvailAnoxicMgL}
                min={0}
                max={1000}
                step={5}
                onChange={(v) =>
                  setCarbon((p) => ({ ...p, bodAvailAnoxicMgL: v }))
                }
              />
              <div>
                <label
                  htmlFor="cb-src"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Loại nguồn Carbon bổ sung
                </label>
                <select
                  id="cb-src"
                  value={carbon.sourceType}
                  onChange={(e) =>
                    setCarbon((p) => ({ ...p, sourceType: e.target.value }))
                  }
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Molasses">
                    Mật rỉ đường (Molasses — 800 g COD/kg)
                  </option>
                  <option value="Acetic99">
                    Acid Acetic 99% (CH₃COOH)
                  </option>
                  <option value="Acetic50">
                    Acid Acetic 50% (Pha sẵn)
                  </option>
                  <option value="Methanol">Methanol 99% (CH₃OH)</option>
                </select>
              </div>
            </div>

            <StatusBanner
              ok={qDay > 0}
              summaryLabel="Thông số pha chế"
              titleOk={`CHÂM ${carbonProps.name.toUpperCase()}: ${carbonMassKgDay.toFixed(1)} kg/ngày (${carbonLitersDay.toFixed(1)} Lít/ngày)`}
              titleFail="CHƯA CÓ LƯU LƯỢNG ĐỂ TÍNH NGUỒN CARBON"
              message={`Lượng COD thiếu hụt cho quá trình khử Nitrat = ${codDeficitKgDay.toFixed(1)} kg COD/ngày. Cài đặt bơm định lượng ${carbonProps.name} ở mức ${carbonLitersHour.toFixed(2)} Lít/giờ (${carbonMassKgDay.toFixed(1)} kg/ngày).`}
              summaryRight={`${carbonLitersDay.toFixed(1)} L/ng (${carbonLitersHour.toFixed(2)} L/h)`}
            />

            <SummaryTable
              headers={['Thông số tính toán', 'Giá trị quy đổi', 'Định mức / Đặc tính', 'Ghi chú vận hành']}
              rows={[
                [
                  'Lượng N-NO₃⁻ cần khử tại Anoxic',
                  `${no3RemovedKgDay.toFixed(2)} kg N/ngày`,
                  `ΔNO₃⁻ = ${deltaNo3MgL.toFixed(1)} mg/L`,
                  'Định mức chuẩn 4,0 kg COD / kg NO₃⁻-N',
                ],
                [
                  'COD tổng yêu cầu / COD sẵn có',
                  `${codNeededTotalKgDay.toFixed(1)} / ${codAvailKgDay.toFixed(1)} kg COD/ng`,
                  `Thiếu hụt = ${codDeficitKgDay.toFixed(1)} kg COD/ng`,
                  'COD sẵn có = 1,5 × BOD₅ vào Anoxic',
                ],
                [
                  `Lượng ${carbonProps.name} cần châm`,
                  `${carbonMassKgDay.toFixed(2)} kg/ng · ${carbonLitersDay.toFixed(2)} Lít/ng`,
                  carbonProps.unitNote,
                  `Chỉnh bơm định lượng = ${carbonLitersHour.toFixed(2)} Lít/giờ`,
                ],
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 3: KIỀM NaHCO3 BÙ NITRAT HÓA */}
      {activeTab === 'alkalinity' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Tính Kiềm NaHCO₃ bù Nitrat hóa (7,14 g kiềm / g NH₄⁺)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kiểm tra tụt độ kiềm cuối bể Aerotank và định lượng Baking Soda
                  NaHCO₃ giữ pH ổn định 7,0–7,5.
                </p>
              </div>
              <label className="inline-flex items-center gap-2.5 min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alk.useStep4Nh4}
                  onChange={(e) =>
                    setAlk((p) => ({ ...p, useStep4Nh4: e.target.checked }))
                  }
                  className="h-4 w-4 accent-emerald-500 rounded"
                />
                <span>Lấy ΔNH₄⁺ từ Bước 4 ({bioQuality.nh4In}→{bioQuality.nh4Out} mg/L)</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <NumberField
                id="alk-nh4in"
                label="N-NH₄⁺ đầu vào"
                unit="mg/L"
                value={activeNh4In}
                min={0}
                max={500}
                step={1}
                disabled={alk.useStep4Nh4}
                onChange={(v) => setAlk((p) => ({ ...p, nh4InMgL: v }))}
              />
              <NumberField
                id="alk-nh4out"
                label="N-NH₄⁺ đầu ra"
                unit="mg/L"
                value={activeNh4Out}
                min={0}
                max={100}
                step={0.5}
                disabled={alk.useStep4Nh4}
                onChange={(v) => setAlk((p) => ({ ...p, nh4OutMgL: v }))}
              />
              <NumberField
                id="alk-in"
                label="Độ kiềm nước thải đầu vào"
                unit="mg CaCO₃/L"
                value={alk.alkInMgL}
                min={0}
                max={1000}
                step={10}
                onChange={(v) => setAlk((p) => ({ ...p, alkInMgL: v }))}
              />
              <NumberField
                id="alk-target"
                label="Độ kiềm dư cần giữ ở đầu ra"
                unit="mg CaCO₃/L"
                value={alk.alkTargetOutMgL}
                min={40}
                max={200}
                step={10}
                onChange={(v) => setAlk((p) => ({ ...p, alkTargetOutMgL: v }))}
              />

              <div className="flex items-end">
                <label className="w-full min-h-[44px] inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alk.hasAnoxicCredit}
                    onChange={(e) =>
                      setAlk((p) => ({
                        ...p,
                        hasAnoxicCredit: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-emerald-500 rounded"
                  />
                  <span>Có bể Anoxic hoàn kiềm (+3,57 g/g NO₃⁻)</span>
                </label>
              </div>

              {alk.hasAnoxicCredit && (
                <NumberField
                  id="alk-no3"
                  label="Lượng N-NO₃⁻ khử ở Anoxic"
                  unit="mg/L"
                  value={alk.no3DenitMgL}
                  min={0}
                  max={200}
                  step={1}
                  onChange={(v) => setAlk((p) => ({ ...p, no3DenitMgL: v }))}
                />
              )}
            </div>

            <StatusBanner
              ok={isAlkSafeWithoutDose}
              summaryLabel="Thông số pha chế"
              titleOk="ĐỘ KIỀM TỰ NHIÊN ĐỦ CHO NITRAT HÓA"
              titleFail={`CẢNH BÁO THIẾU KIỀM — CẦN CHÂM ${nahco3KgDay.toFixed(1)} kg NaHCO₃/ngày`}
              message={
                isAlkSafeWithoutDose
                  ? `Độ kiềm dự kiến còn lại = ${alkRemainMgL.toFixed(1)} mg CaCO₃/L (≥ ngưỡng giữ ${alk.alkTargetOutMgL} mg/L). Không cần châm thêm NaHCO₃.`
                  : `Nitrat hóa tiêu thụ ${alkConsumedMgL.toFixed(1)} mg CaCO₃/L làm kiềm còn lại tụt xuống ${alkRemainMgL.toFixed(1)} mg/L (< ${alk.alkTargetOutMgL} mg/L). Cần bổ sung ${nahco3KgDay.toFixed(1)} kg NaHCO₃/ngày (~${nahco3Bags25Kg.toFixed(1)} bao 25 kg/ngày) để tránh tụt pH!`
              }
              summaryRight={
                isAlkSafeWithoutDose
                  ? `Dư ${alkRemainMgL.toFixed(0)} mg/L`
                  : `${nahco3KgDay.toFixed(1)} kg NaHCO₃/ng`
              }
            />

            <SummaryTable
              headers={['Hạng mục cân bằng kiềm', 'Nồng độ (mg CaCO₃/L)', 'Khối lượng ngày', 'Ghi chú hóa học']}
              rows={[
                [
                  'Kiềm tiêu thụ do Nitrat hóa (7,14 × ΔNH₄⁺)',
                  `−${alkConsumedMgL.toFixed(1)} mg/L`,
                  `${alkConsumedKgDay.toFixed(1)} kg CaCO₃/ng`,
                  `ΔNH₄⁺ = ${deltaNh4MgL.toFixed(1)} mg/L (${nh4RemovedKgDay.toFixed(1)} kg N/ng)`,
                ],
                [
                  'Kiềm hoàn lại từ bể Anoxic (3,57 × ΔNO₃⁻)',
                  `+${alkRecoveredMgL.toFixed(1)} mg/L`,
                  `${alkRecoveredKgDay.toFixed(1)} kg CaCO₃/ng`,
                  alk.hasAnoxicCredit ? 'Đang tính hoàn kiềm' : 'Không có Anoxic',
                ],
                [
                  'Kiềm còn lại nếu không châm / Thiếu hụt cần bù',
                  `${alkRemainMgL.toFixed(1)} / Thiếu ${alkDeficitMgL.toFixed(1)} mg/L`,
                  `${alkDeficitKgDay.toFixed(1)} kg CaCO₃/ng`,
                  `Mục tiêu đầu ra ≥ ${alk.alkTargetOutMgL} mg/L`,
                ],
                [
                  'Lượng NaHCO₃ (Baking Soda 99%) cần châm',
                  `1,70 kg NaHCO₃ / kg CaCO₃`,
                  `${nahco3KgDay.toFixed(2)} kg/ng (${nahco3KgHour.toFixed(2)} kg/h)`,
                  `Tương đương ${nahco3Bags25Kg.toFixed(1)} bao (25 kg/bao)/ngày`,
                ],
              ]}
            />
          </section>
        </div>
      )}

      {/* TAB 4: RỬA MÀNG MBR (MC & RC) */}
      {activeTab === 'mbr_clean' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Thông số Màng MBR & Nồng độ Rửa bảo trì (MC) / Rửa phục hồi
                  (RC)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rửa bảo trì MC: Javen 300–500 ppm · Rửa phục hồi RC: Javen
                  1.000–3.000 ppm + Acid Citric/Oxalic 1.000–2.000 ppm.
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                V_pha MC = {mcTotalVolL.toFixed(0)} L · V_pha RC ={' '}
                {rcTotalVolL.toFixed(0)} L
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <NumberField
                id="mbr-area"
                label="Tổng diện tích màng MBR cần rửa"
                unit="m²"
                value={mbr.membraneAreaM2}
                min={10}
                max={20000}
                step={50}
                onChange={(v) => setMbr((p) => ({ ...p, membraneAreaM2: v }))}
              />

              <NumberField
                id="mbr-javen-pct"
                label="Nồng độ Javen gốc (NaOCl)"
                unit="%"
                value={mbr.javenPct}
                min={5}
                max={15}
                step={1}
                onChange={(v) => setMbr((p) => ({ ...p, javenPct: v }))}
              />

              <NumberField
                id="mbr-mc-vol"
                label="Định mức dung dịch rửa MC"
                unit="L/m²"
                value={mbr.mcSpecVolLM2}
                min={1.0}
                max={5.0}
                step={0.5}
                onChange={(v) => setMbr((p) => ({ ...p, mcSpecVolLM2: v }))}
              />

              <NumberField
                id="mbr-mc-ppm"
                label="Javen rửa MC (300–500 ppm)"
                unit="ppm"
                value={mbr.mcJavenPpm}
                min={100}
                max={1000}
                step={50}
                onChange={(v) => setMbr((p) => ({ ...p, mcJavenPpm: v }))}
              />

              <NumberField
                id="mbr-rc-vol"
                label="Định mức dung dịch rửa RC"
                unit="L/m²"
                value={mbr.rcSpecVolLM2}
                min={2.0}
                max={8.0}
                step={0.5}
                onChange={(v) => setMbr((p) => ({ ...p, rcSpecVolLM2: v }))}
              />

              <NumberField
                id="mbr-rc-javen"
                label="Javen rửa RC (1.000–3.000 ppm)"
                unit="ppm"
                value={mbr.rcJavenPpm}
                min={500}
                max={5000}
                step={100}
                onChange={(v) => setMbr((p) => ({ ...p, rcJavenPpm: v }))}
              />

              <div>
                <label
                  htmlFor="mbr-acid-type"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Loại Axit rửa vô cơ (RC)
                </label>
                <select
                  id="mbr-acid-type"
                  value={mbr.acidType}
                  onChange={(e) =>
                    setMbr((p) => ({ ...p, acidType: e.target.value }))
                  }
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Acid Citric">Acid Citric (Bột 99%)</option>
                  <option value="Acid Oxalic">Acid Oxalic (Bột 99%)</option>
                </select>
              </div>

              <NumberField
                id="mbr-rc-acid"
                label={`${mbr.acidType} (1.000–2.000 ppm)`}
                unit="ppm"
                value={mbr.rcAcidPpm}
                min={500}
                max={4000}
                step={100}
                onChange={(v) => setMbr((p) => ({ ...p, rcAcidPpm: v }))}
              />
            </div>

            <StatusBanner
              ok={isMbrAllOk}
              summaryLabel="Thông số pha chế"
              titleOk="ĐẠT CHUẨN NỒNG ĐỘ RỬA MÀNG MBR — SẴN SÀNG PHA CHẾ"
              titleFail="CẢNH BÁO ĐỎ: NỒNG ĐỘ HÓA CHẤT NGOÀI KHUYẾN CÁO BẢO VỆ MÀNG"
              message={
                isMbrAllOk
                  ? `Các ngưỡng ppm đều nằm trong dải an toàn cho sợi màng PVDF. Tổng Javen ${mbr.javenPct}% cần đong: ${mcJavenLiters.toFixed(2)} L (rửa MC) và ${rcJavenLiters.toFixed(2)} L (rửa RC); ${mbr.acidType}: ${rcAcidKg.toFixed(2)} kg.`
                  : `${!isMcPpmOk ? `Javen rửa MC (${mbr.mcJavenPpm} ppm) ngoài dải 300–500 ppm. ` : ''}${!isRcJavenOk ? `Javen rửa RC (${mbr.rcJavenPpm} ppm) ngoài dải 1.000–3.000 ppm (quá cao dễ giòn sợi màng PVDF!). ` : ''}${!isRcAcidOk ? `${mbr.acidType} (${mbr.rcAcidPpm} ppm) ngoài dải 1.000–2.000 ppm.` : ''}`
              }
              summaryRight={`MC: ${mcJavenLiters.toFixed(1)} L · RC: ${rcJavenLiters.toFixed(1)} L`}
            />
          </section>

          {/* Bảng pha chế Lít xuất xưởng cho công nhân vận hành */}
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-emerald-500" />
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Bảng Pha Chế Dung Dịch Rửa Màng MBR (Theo Lít thực tế)
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Diện tích màng = {areaM2.toLocaleString('vi-VN')} m² · Javen{' '}
                {mbr.javenPct}% (ρ = {mbr.javenDensity})
              </span>
            </div>

            <div className="overflow-x-auto w-full rounded-lg border border-slate-700/80">
              <table className="w-full min-w-[720px] text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-900/90 text-xs font-medium text-slate-400 border-b border-slate-700/80">
                    <th className="py-3 px-4">Quy trình rửa màng</th>
                    <th className="py-3 px-4">Hóa chất sử dụng</th>
                    <th className="py-3 px-4 text-right">Nồng độ (ppm)</th>
                    <th className="py-3 px-4 text-right">Tổng dung dịch</th>
                    <th className="py-3 px-4 text-right">
                      Đong Hóa chất gốc
                    </th>
                    <th className="py-3 px-4 text-right">Nước sạch cấp vào</th>
                    <th className="py-3 px-4 text-right">Thời gian ngâm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  <tr className="hover:bg-slate-900/40">
                    <td className="py-3 px-4 font-medium text-slate-100">
                      1. Rửa bảo trì (MC — hàng tuần)
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      Javen NaOCl {mbr.javenPct}%
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums ${
                        isMcPpmOk ? 'text-emerald-500' : 'text-red-500'
                      }`}
                    >
                      {mbr.mcJavenPpm} ppm
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                      {mcTotalVolL.toFixed(0)} Lít
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-emerald-400">
                      {mcJavenLiters.toFixed(2)} Lít
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                      {mcCleanWaterLiters.toFixed(1)} Lít
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-slate-400">
                      30 – 45 phút
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-900/40">
                    <td className="py-3 px-4 font-medium text-slate-100">
                      2. Rửa phục hồi (RC Bước 1 — Hữu cơ)
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      Javen NaOCl {mbr.javenPct}%
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums ${
                        isRcJavenOk ? 'text-emerald-500' : 'text-red-500'
                      }`}
                    >
                      {mbr.rcJavenPpm} ppm
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                      {rcTotalVolL.toFixed(0)} Lít
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-emerald-400">
                      {rcJavenLiters.toFixed(2)} Lít
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                      {rcCleanWaterJavenL.toFixed(1)} Lít
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-slate-400">
                      2 – 4 giờ
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-900/40">
                    <td className="py-3 px-4 font-medium text-slate-100">
                      3. Rửa phục hồi (RC Bước 2 — Vô cơ)
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {mbr.acidType} (bột 99%)
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums ${
                        isRcAcidOk ? 'text-emerald-500' : 'text-red-500'
                      }`}
                    >
                      {mbr.rcAcidPpm} ppm
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                      {rcTotalVolL.toFixed(0)} Lít
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-emerald-400">
                      {rcAcidKg.toFixed(2)} kg
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                      {rcTotalVolL.toFixed(1)} Lít
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-slate-400">
                      2 – 4 giờ (Xả sạch Javen trước)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SummaryTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto w-full rounded-lg border border-slate-700/80">
      <table className="w-full min-w-[640px] text-left border-collapse text-sm">
        <thead>
          <tr className="bg-slate-900/90 text-xs font-medium text-slate-400 border-b border-slate-700/80">
            {headers.map((h) => (
              <th key={h} className="py-3 px-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/60">
          {rows.map((cells, idx) => (
            <tr key={idx} className="hover:bg-slate-900/40">
              {cells.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  className={`py-3 px-4 ${
                    cIdx === 0
                      ? 'font-medium text-slate-100'
                      : cIdx === 2
                      ? 'font-mono font-semibold text-emerald-400 tabular-nums'
                      : 'text-slate-300 font-mono text-xs tabular-nums'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
