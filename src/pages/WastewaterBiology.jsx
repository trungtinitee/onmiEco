import { useEffect, useState } from 'react';
import {
  Activity,
  Clock,
  Cpu,
  Droplets,
  Filter,
  Flame,
  Layers,
  RotateCcw,
  Wind,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  CheckTable as ReverseCheckTable,
  DecimalInput,
  NumberField as NumberInput,
  StatusBanner,
  ViewModeToggle,
  roundUpToStep,
} from '../components/CalcPrimitives';
import EquipmentSelector from '../components/EquipmentSelector';

const BIO_TABS = [
  { id: 'uasb', label: 'UASB', icon: Flame },
  { id: 'anoxic', label: 'Anoxic', icon: Layers },
  { id: 'aerotank', label: 'Aerotank', icon: Wind },
  { id: 'sbr', label: 'SBR', icon: Clock },
  { id: 'mbbr', label: 'MBBR', icon: Cpu },
  { id: 'mbr', label: 'MBR', icon: Droplets },
  { id: 'clarifier', label: 'Lắng 2', icon: Filter },
];

const BIO_EQUIPMENT_MAP = {
  uasb: {
    label: 'Bể Kỵ khí UASB',
    storageKey: 'omnieco_equipments_wastewaterbiology_uasb',
  },
  anoxic: {
    label: 'Bể Thiếu khí Anoxic',
    storageKey: 'omnieco_equipments_wastewaterbiology_anoxic',
  },
  aerotank: {
    label: 'Bể Sinh học Hiếu khí (Aerotank)',
    storageKey: 'omnieco_equipments_aerotank',
  },
  sbr: {
    label: 'Bể SBR (Theo mẻ)',
    storageKey: 'omnieco_equipments_wastewaterbiology_sbr',
  },
  mbbr: {
    label: 'Bể MBBR (Giá thể di động)',
    storageKey: 'omnieco_equipments_wastewaterbiology_mbbr',
  },
  mbr: {
    label: 'Bể Màng sinh học MBR',
    storageKey: 'omnieco_equipments_wastewaterbiology_mbr',
  },
  clarifier: {
    label: 'Bể Lắng đợt 2 (Lắng sinh học)',
    storageKey: 'omnieco_equipments_wastewaterbiology_clarifier',
  },
};

const CLARIFIER_SHAPES = [
  { value: 'Tròn', label: 'Tròn (Ø D × H)' },
  { value: 'Vuông', label: 'Vuông (a × a × H)' },
];

function interpolateClarifierTank(area, depth, shape) {
  const safeA = Math.max(0, Number(area) || 0);
  const safeH = Math.max(0.5, Number(depth) || 1);
  if (shape === 'Vuông') {
    const a = Math.sqrt(safeA);
    return { area: safeA, H: safeH, a, D: 0, volume: safeA * safeH };
  }
  const D = Math.sqrt((4 * safeA) / Math.PI);
  return { area: safeA, H: safeH, D, a: 0, volume: safeA * safeH };
}

function buildRecommendedClarifier(theo, shape) {
  const H = roundUpToStep(theo.H, 0.1);
  if (shape === 'Vuông') {
    return { a: roundUpToStep(theo.a, 0.1), D: 0, H };
  }
  return { D: roundUpToStep(theo.D, 0.1), a: 0, H };
}

function computeActualClarifier(override, shape) {
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

const SHAPE_OPTIONS = [
  { value: 'Chữ nhật', label: 'Chữ nhật (L × W × H)' },
  { value: 'Vuông', label: 'Vuông (a × a × H)' },
  { value: 'Tròn', label: 'Tròn (Ø D × H)' },
];

function interpolateDimensions(volume, depth, shape, ratioLtoW = 2.0) {
  const safeV = Math.max(0, Number(volume) || 0);
  const safeH = Math.max(0.5, Number(depth) || 1);
  const area = safeV / safeH;

  if (shape === 'Vuông') {
    const a = Math.sqrt(area);
    return { area, H: safeH, a, L: a, W: a, D: 0 };
  }
  if (shape === 'Tròn') {
    const D = Math.sqrt((4 * area) / Math.PI);
    return { area, H: safeH, D, a: 0, L: 0, W: 0 };
  }
  const ratio = Math.max(1, Number(ratioLtoW) || 2.0);
  const W = Math.sqrt(area / ratio);
  const L = W * ratio;
  return { area, H: safeH, L, W, a: 0, D: 0 };
}

function buildRecommendedOverride(theo, shape) {
  const H = roundUpToStep(theo.H, 0.1);
  if (shape === 'Vuông') {
    return { L: 0, W: 0, a: roundUpToStep(theo.a, 0.1), D: 0, H };
  }
  if (shape === 'Tròn') {
    return { L: 0, W: 0, a: 0, D: roundUpToStep(theo.D, 0.1), H };
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

/**
 * Động học Nitrat hóa & Nhu cầu Oxy tổng (Metcalf & Eddy / TCVN 7957:2008)
 */
function calculateNitrificationAndOxygen({
  qDay,
  tempC,
  bodIn,
  bodOut,
  nh4In,
  nh4Out,
  srtDesign,
  hasAnoxic,
  no3DenitrifiedMgL,
  doMgL = 2.0,
}) {
  const T = Math.max(5, Math.min(45, Number(tempC) || 20));
  const safeNh4Out = Math.max(0.1, Number(nh4Out) || 1);

  // Tốc độ sinh trưởng cực đại vi khuẩn Nitrosomonas phụ thuộc nhiệt độ
  // μ_max,20 = 0.45 ngày^-1, θ = 1.072; k_dn,20 = 0.05 ngày^-1, θ_d = 1.04
  const muMaxT = 0.45 * Math.pow(1.072, T - 20);
  const kdnT = 0.05 * Math.pow(1.04, T - 20);
  const kN = 0.74 * Math.pow(1.053, T - 20);
  const kO = 0.5;

  const muNet =
    muMaxT * (safeNh4Out / (kN + safeNh4Out)) * (doMgL / (kO + doMgL)) - kdnT;
  const srtMin = muNet > 0.01 ? 1 / muNet : 99.9;

  // Khối lượng chất ô nhiễm xử lý (kg/ngày)
  const deltaBod = Math.max(0, (Number(bodIn) || 0) - (Number(bodOut) || 0));
  const deltaNh4 = Math.max(0, (Number(nh4In) || 0) - (Number(nh4Out) || 0));
  const bodRemovedKg = (qDay * deltaBod) / 1000;
  const nh4RemovedKg = (qDay * deltaNh4) / 1000;

  // Oxy khử BOD (theo Y = 0.5, kd(T) = 0.06 * 1.04^(T-20))
  const kdT = 0.06 * Math.pow(1.04, T - 20);
  const yObs = 0.5 / (1 + kdT * Math.max(1, Number(srtDesign) || 10));
  const pxBioKg = yObs * bodRemovedKg;
  const o2BodKg = Math.max(0, bodRemovedKg / 0.68 - 1.42 * pxBioKg);

  // Oxy khử NH4+ (4.57 kg O2 / kg N-NH4)
  const o2Nh4Kg = 4.57 * nh4RemovedKg;

  // Oxy hoàn lại do khử NO3- ở Anoxic (2.86 kg O2 / kg NO3-)
  const effectiveNo3MgL = hasAnoxic
    ? Math.min(deltaNh4, Math.max(0, Number(no3DenitrifiedMgL) || 0))
    : 0;
  const no3DenitrifiedKg = (qDay * effectiveNo3MgL) / 1000;
  const o2CreditKg = 2.86 * no3DenitrifiedKg;

  const o2TotalKg = Math.max(0, o2BodKg + o2Nh4Kg - o2CreditKg);

  return {
    T,
    muNet,
    srtMin,
    kdT,
    yObs,
    bodRemovedKg,
    nh4RemovedKg,
    no3DenitrifiedKg,
    o2BodKg,
    o2Nh4Kg,
    o2CreditKg,
    o2TotalKg,
    o2TotalHourKg: o2TotalKg / 24,
  };
}

export default function WastewaterBiology() {
  const {
    globalQ,
    setGlobalQ,
    hydraulics,
    bioQuality,
    setBioQuality,
    bioFocusSignal,
  } = useAppContext();
  const [activeTab, setActiveTab] = useState('aerotank');
  const [o2ViewMode, setO2ViewMode] = useState('table');

  useEffect(() => {
    if (bioFocusSignal > 0) {
      setActiveTab('aerotank');
      window.setTimeout(() => {
        const el = document.getElementById('bio-temp');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }, 80);
    }
  }, [bioFocusSignal]);

  // --- Tab-specific process & geometry state ---
  const [uasb, setUasb] = useState({
    codIn: 1800,
    codOut: 360,
    olr: 6.0,
    depthH: 5.0,
    ratioLW: 1.5,
    shape: 'Chữ nhật',
  });

  const [anoxic, setAnoxic] = useState({
    hrtHours: 2.5,
    no3In: 35,
    no3Out: 7,
    mlss: 3000,
    internalRecyclePct: 200,
    depthH: 4.0,
    ratioLW: 2.0,
    shape: 'Chữ nhật',
  });

  const [aerotank, setAerotank] = useState({
    mlss: 3000,
    srtDesign: 12,
    depthH: 4.2,
    ratioLW: 2.0,
    shape: 'Chữ nhật',
  });

  const [sbr, setSbr] = useState({
    numTanks: 2,
    cycleHours: 6.0,
    fillHours: 1.5,
    reactHours: 3.0,
    settleHours: 1.0,
    decantHours: 0.5,
    mlss: 3500,
    srtDesign: 14,
    exchangeRatio: 0.4,
    depthH: 4.5,
    ratioLW: 1.5,
    shape: 'Chữ nhật',
  });

  const [mbbr, setMbbr] = useState({
    mediaFillPct: 40,
    mediaSsa: 500,
    salr: 10, // g BOD / m2.ngày
    srtDesign: 15,
    depthH: 4.0,
    ratioLW: 2.0,
    shape: 'Chữ nhật',
  });

  const [mbr, setMbr] = useState({
    mlss: 9000,
    srtDesign: 20,
    fluxLmh: 18, // L / m2.h
    depthH: 4.0,
    ratioLW: 2.0,
    shape: 'Chữ nhật',
  });

  // --- Tab 7: Bể lắng 2 (Lắng sinh học + Tuần hoàn bùn RAS) ---
  const [clarifier, setClarifier] = useState({
    numTanks: 1,
    shape: 'Tròn',
    surfaceLoadTarget: 1.0, // m3/m2.h (max chuẩn 1.5)
    surfaceLoadMax: 1.5,
    weirLoadMax: 250, // m3/m.ngày
    hrtMin: 2.0, // giờ
    depthH: 3.5, // m
    weirRings: 1,
    returnSludgeSsMgL: 8000, // mg/L (nồng độ bùn đáy tuần hoàn X_r)
  });
  const [clarifierOverride, setClarifierOverride] = useState(null);

  // Per-tab construction override state
  const [overrides, setOverrides] = useState({
    uasb: null,
    anoxic: null,
    aerotank: null,
    sbr: null,
    mbbr: null,
    mbr: null,
  });

  const isAerobicTab =
    activeTab === 'aerotank' ||
    activeTab === 'sbr' ||
    activeTab === 'mbbr' ||
    activeTab === 'mbr';

  const getTabSrtDesign = (tabId) => {
    if (tabId === 'aerotank') return aerotank.srtDesign;
    if (tabId === 'sbr') return sbr.srtDesign;
    if (tabId === 'mbbr') return mbbr.srtDesign;
    if (tabId === 'mbr') return mbr.srtDesign;
    return 12;
  };

  // Compute Nitrification & Oxygen for current aerobic tab
  const kinetics = calculateNitrificationAndOxygen({
    qDay: hydraulics.qDay,
    tempC: bioQuality.tempC,
    bodIn: bioQuality.bodIn,
    bodOut: bioQuality.bodOut,
    nh4In: bioQuality.nh4In,
    nh4Out: bioQuality.nh4Out,
    srtDesign: getTabSrtDesign(activeTab),
    hasAnoxic: bioQuality.hasAnoxic,
    no3DenitrifiedMgL: bioQuality.no3DenitrifiedMgL,
  });

  // Compute Theoretical Volume & Details per tab
  const getReactorModel = (tabId) => {
    if (tabId === 'uasb') {
      const deltaCod = Math.max(0, uasb.codIn - uasb.codOut);
      const codLoadKg = (hydraulics.qDay * deltaCod) / 1000;
      const vTheo = uasb.olr > 0 ? codLoadKg / uasb.olr : 0;
      const theo = interpolateDimensions(
        vTheo,
        uasb.depthH,
        uasb.shape,
        uasb.ratioLW
      );
      const biogasM3Day = codLoadKg * 0.35;

      return {
        tabId,
        title: 'Bể kỵ khí UASB',
        subtitle: 'Tính thể tích tầng phản ứng theo tải trọng hữu cơ thể tích (OLR)',
        formulaText: `V_lt = (Q × ΔCOD) / (1000 × OLR) = ${codLoadKg.toFixed(1)} / ${uasb.olr} = ${vTheo.toFixed(2)} m³`,
        shape: uasb.shape,
        depthH: uasb.depthH,
        ratioLW: uasb.ratioLW,
        vTheo,
        theo,
        srtDesign: null,
        unitCount: 1,
        setShape: (s) => setUasb((p) => ({ ...p, shape: s })),
        extraMetrics: (actual) => {
          const upflowVel = actual.area > 0 ? hydraulics.qHour / actual.area : 0;
          return [
            {
              label: 'Vận tốc dòng dâng thực (v_up)',
              value: `${upflowVel.toFixed(2)} m/h`,
              note: upflowVel <= 1.0 ? 'Đạt (≤ 1,0 m/h)' : 'Vượt ngưỡng 1,0 m/h',
              warn: upflowVel > 1.0,
            },
            {
              label: 'Lượng khí Methane sinh ra',
              value: `${biogasM3Day.toFixed(1)} m³/ngày`,
              note: 'Hệ số 0,35 m³ CH₄ / kg COD khử',
            },
          ];
        },
      };
    }

    if (tabId === 'anoxic') {
      const vTheo = hydraulics.qHour * anoxic.hrtHours;
      const theo = interpolateDimensions(
        vTheo,
        anoxic.depthH,
        anoxic.shape,
        anoxic.ratioLW
      );
      const deltaNo3 = Math.max(0, anoxic.no3In - anoxic.no3Out);
      const no3LoadKg = (hydraulics.qDay * deltaNo3) / 1000;
      const o2RecoveredKg = 2.86 * no3LoadKg;

      return {
        tabId,
        title: 'Bể thiếu khí Anoxic',
        subtitle: 'Khử Nitrat (NO₃⁻ → N₂) và thu hồi 2,86 kg O₂ cho mỗi kg N-NO₃⁻ khử',
        formulaText: `V_lt = Qtb,h × HRT = ${hydraulics.qHour.toFixed(2)} × ${anoxic.hrtHours} = ${vTheo.toFixed(2)} m³`,
        shape: anoxic.shape,
        depthH: anoxic.depthH,
        ratioLW: anoxic.ratioLW,
        vTheo,
        theo,
        srtDesign: null,
        unitCount: 1,
        setShape: (s) => setAnoxic((p) => ({ ...p, shape: s })),
        extraMetrics: (actual) => {
          const biomassKg = (actual.volume * anoxic.mlss) / 1000;
          const sdnr = biomassKg > 0 ? no3LoadKg / biomassKg : 0;
          return [
            {
              label: 'Oxy thu hồi (2,86 × NO₃⁻ khử)',
              value: `${o2RecoveredKg.toFixed(1)} kg O₂/ngày`,
              note: `Khử ${no3LoadKg.toFixed(1)} kg N-NO₃⁻/ngày`,
            },
            {
              label: 'Tốc độ khử Nitrat riêng (SDNR)',
              value: `${sdnr.toFixed(3)} d⁻¹`,
              note: `Tuần hoàn nội bộ ${anoxic.internalRecyclePct}%`,
            },
          ];
        },
      };
    }

    if (tabId === 'aerotank') {
      const deltaBod = Math.max(0, bioQuality.bodIn - bioQuality.bodOut);
      const num = hydraulics.qDay * 0.5 * deltaBod * aerotank.srtDesign;
      const den =
        Math.max(100, aerotank.mlss) *
        (1 + kinetics.kdT * aerotank.srtDesign);
      const vTheo = den > 0 ? num / den : 0;
      const theo = interpolateDimensions(
        vTheo,
        aerotank.depthH,
        aerotank.shape,
        aerotank.ratioLW
      );

      return {
        tabId,
        title: 'Bể sinh học hiếu khí Aerotank',
        subtitle: 'Xử lý BOD₅ & Nitrat hóa Amoni theo động học tuổi bùn SRT',
        formulaText: `V_lt = (Q × Y × ΔBOD × SRT) / (MLSS × (1 + kd·SRT)) = ${vTheo.toFixed(2)} m³`,
        shape: aerotank.shape,
        depthH: aerotank.depthH,
        ratioLW: aerotank.ratioLW,
        vTheo,
        theo,
        srtDesign: aerotank.srtDesign,
        unitCount: 1,
        setShape: (s) => setAerotank((p) => ({ ...p, shape: s })),
        extraMetrics: (actual) => {
          const fmActual =
            actual.volume > 0 && aerotank.mlss > 0
              ? (hydraulics.qDay * deltaBod) / (actual.volume * aerotank.mlss)
              : 0;
          return [
            {
              label: 'Tải trọng F/M thực tế',
              value: `${fmActual.toFixed(3)} kg/kg·ng`,
              note: 'Chuẩn bùn hoạt tính 0,15 – 0,40',
            },
            {
              label: 'Nhu cầu Oxy tổng',
              value: `${kinetics.o2TotalKg.toFixed(1)} kg O₂/ngày`,
              note: `${kinetics.o2TotalHourKg.toFixed(2)} kg O₂/giờ`,
            },
          ];
        },
      };
    }

    if (tabId === 'sbr') {
      const nTanks = Math.max(1, Number(sbr.numTanks) || 1);
      const cyclesPerDay = sbr.cycleHours > 0 ? 24 / sbr.cycleHours : 1;
      const vFillPerBatch = hydraulics.qDay / (nTanks * cyclesPerDay);
      const vFromExchange =
        sbr.exchangeRatio > 0 ? vFillPerBatch / sbr.exchangeRatio : 0;

      // Also check kinetic biological volume per tank
      const deltaBod = Math.max(0, bioQuality.bodIn - bioQuality.bodOut);
      const vBioTotal =
        (hydraulics.qDay * 0.5 * deltaBod * sbr.srtDesign) /
        (Math.max(100, sbr.mlss) * (1 + kinetics.kdT * sbr.srtDesign));
      const vTheoPerTank = Math.max(vFromExchange, vBioTotal / nTanks);

      const theo = interpolateDimensions(
        vTheoPerTank,
        sbr.depthH,
        sbr.shape,
        sbr.ratioLW
      );

      return {
        tabId,
        title: 'Bể phản ứng theo mẻ SBR (1 bể)',
        subtitle: `Thiết kế cho ${nTanks} bể chạy song song · ${cyclesPerDay.toFixed(1)} mẻ/ngày/bể`,
        formulaText: `V_lt (1 bể) = max(V_mẻ / f_trao_đổi, V_sinh_học / N_bể) = ${vTheoPerTank.toFixed(2)} m³`,
        shape: sbr.shape,
        depthH: sbr.depthH,
        ratioLW: sbr.ratioLW,
        vTheo: vTheoPerTank,
        theo,
        srtDesign: sbr.srtDesign,
        unitCount: nTanks,
        setShape: (s) => setSbr((p) => ({ ...p, shape: s })),
        extraMetrics: () => [
          {
            label: 'Thể tích nước cấp 1 mẻ / bể',
            value: `${vFillPerBatch.toFixed(1)} m³/mẻ`,
            note: `${cyclesPerDay.toFixed(1)} mẻ/ngày (${nTanks} bể)`,
          },
          {
            label: 'Cấp Oxy trong pha React',
            value: `${
              sbr.reactHours > 0
                ? (
                    kinetics.o2TotalKg /
                    (nTanks * cyclesPerDay * sbr.reactHours)
                  ).toFixed(2)
                : '0.00'
            } kg O₂/h·bể`,
            note: `Tổng ngày: ${kinetics.o2TotalKg.toFixed(1)} kg O₂/ngày`,
          },
        ],
      };
    }

    if (tabId === 'mbbr') {
      const bodLoadG = kinetics.bodRemovedKg * 1000;
      const mediaAreaM2 = mbbr.salr > 0 ? bodLoadG / mbbr.salr : 0;
      const vMedia = mbbr.mediaSsa > 0 ? mediaAreaM2 / mbbr.mediaSsa : 0;
      const vTheo =
        mbbr.mediaFillPct > 0 ? vMedia / (mbbr.mediaFillPct / 100) : 0;
      const theo = interpolateDimensions(
        vTheo,
        mbbr.depthH,
        mbbr.shape,
        mbbr.ratioLW
      );

      return {
        tabId,
        title: 'Bể sinh học giá thể di động MBBR',
        subtitle: 'Tính thể tích bể từ diện tích bề mặt giá thể và tỷ lệ điền đầy',
        formulaText: `V_lt = (M_BOD / SALR / SSA) / (φ/100) = ${vTheo.toFixed(2)} m³`,
        shape: mbbr.shape,
        depthH: mbbr.depthH,
        ratioLW: mbbr.ratioLW,
        vTheo,
        theo,
        srtDesign: mbbr.srtDesign,
        unitCount: 1,
        setShape: (s) => setMbbr((p) => ({ ...p, shape: s })),
        extraMetrics: (actual) => {
          const actualMediaVol = actual.volume * (mbbr.mediaFillPct / 100);
          return [
            {
              label: 'Thể tích giá thể cần nạp',
              value: `${actualMediaVol.toFixed(1)} m³`,
              note: `Tỷ lệ đệm ${mbbr.mediaFillPct}% · SSA ${mbbr.mediaSsa} m²/m³`,
            },
            {
              label: 'Nhu cầu Oxy tổng',
              value: `${kinetics.o2TotalKg.toFixed(1)} kg O₂/ngày`,
              note: `${kinetics.o2TotalHourKg.toFixed(2)} kg O₂/giờ`,
            },
          ];
        },
      };
    }

    // mbr
    const deltaBod = Math.max(0, bioQuality.bodIn - bioQuality.bodOut);
    const num = hydraulics.qDay * 0.5 * deltaBod * mbr.srtDesign;
    const den =
      Math.max(100, mbr.mlss) * (1 + kinetics.kdT * mbr.srtDesign);
    const vTheo = den > 0 ? num / den : 0;
    const theo = interpolateDimensions(
      vTheo,
      mbr.depthH,
      mbr.shape,
      mbr.ratioLW
    );
    const membraneAreaM2 =
      mbr.fluxLmh > 0 ? (hydraulics.qHour * 1000) / mbr.fluxLmh : 0;

    return {
      tabId: 'mbr',
      title: 'Bể sinh học màng MBR',
      subtitle: 'MLSS cao giúp thu gọn thể tích bể, tích hợp lọc màng thay bể lắng II',
      formulaText: `V_lt = ${vTheo.toFixed(2)} m³ · A_màng = Q_h × 1000 / Flux = ${membraneAreaM2.toFixed(1)} m²`,
      shape: mbr.shape,
      depthH: mbr.depthH,
      ratioLW: mbr.ratioLW,
      vTheo,
      theo,
      srtDesign: mbr.srtDesign,
      unitCount: 1,
      setShape: (s) => setMbr((p) => ({ ...p, shape: s })),
      extraMetrics: () => [
        {
          label: 'Diện tích màng MBR cần thiết',
          value: `${membraneAreaM2.toFixed(1)} m²`,
          note: `Thông lượng thiết kế ${mbr.fluxLmh} LMH`,
        },
        {
          label: 'Nhu cầu Oxy tổng',
          value: `${kinetics.o2TotalKg.toFixed(1)} kg O₂/ngày`,
          note: `${kinetics.o2TotalHourKg.toFixed(2)} kg O₂/giờ`,
        },
      ],
    };
  };

  const model = getReactorModel(
    activeTab === 'clarifier' ? 'aerotank' : activeTab
  );
  const activeOverride =
    overrides[activeTab === 'clarifier' ? 'aerotank' : activeTab] ??
    buildRecommendedOverride(model.theo, model.shape);
  const actual = computeActualGeometry(activeOverride, model.shape);

  // --- Computed Values: Lắng 2 & Tuần hoàn bùn (RAS) ---
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
  const clarTheo = interpolateClarifierTank(
    clarAreaTheo,
    clarifier.depthH,
    clarifier.shape
  );
  const activeClarOverride =
    clarifierOverride ?? buildRecommendedClarifier(clarTheo, clarifier.shape);
  const clarActual = computeActualClarifier(
    activeClarOverride,
    clarifier.shape
  );
  const clarWeirLen = clarActual.weirLength * Math.max(1, clarifier.weirRings);
  const clarSurfaceLoadActual =
    clarActual.area > 0 ? qMaxPerClarifierH / clarActual.area : 0;
  const clarHrtActual =
    qMaxPerClarifierH > 0 ? clarActual.volume / qMaxPerClarifierH : 0;
  const clarWeirLoadActual =
    clarWeirLen > 0 ? qMaxPerClarifierDay / clarWeirLen : 0;

  // Tuần hoàn bùn (RAS): R = MLSS / (Xr - MLSS), Q_RAS = R * Q_tb
  const sharedMlss = Math.max(100, Number(aerotank.mlss) || 3000);
  const returnSs = Number(clarifier.returnSludgeSsMgL) || 0;
  const isRasValid = returnSs > sharedMlss;
  const rasRatio = isRasValid ? sharedMlss / (returnSs - sharedMlss) : 0;
  const qRasDay = rasRatio * hydraulics.qDay;
  const qRasHour = rasRatio * hydraulics.qHour;

  const isClarSlrOk =
    hydraulics.qDay > 0 && clarSurfaceLoadActual <= clarifier.surfaceLoadMax;
  const isClarHrtOk =
    hydraulics.qDay > 0 && clarHrtActual >= clarifier.hrtMin;
  const isClarWeirOk =
    hydraulics.qDay > 0 && clarWeirLoadActual <= clarifier.weirLoadMax;
  const isClarAllOk =
    isClarSlrOk && isClarHrtOk && isClarWeirOk && isRasValid;

  const handleClarifierShapeChange = (nextShape) => {
    setClarifier((p) => ({ ...p, shape: nextShape }));
    const nextTheo = interpolateClarifierTank(
      clarAreaTheo,
      clarifier.depthH,
      nextShape
    );
    setClarifierOverride(buildRecommendedClarifier(nextTheo, nextShape));
  };

  // Actual hydraulic & SRT reverse checks
  const totalActualVolume = actual.volume * model.unitCount;
  const hrtTheoHours =
    hydraulics.qHour > 0 ? (model.vTheo * model.unitCount) / hydraulics.qHour : 0;
  const hrtActualHours =
    hydraulics.qHour > 0 ? totalActualVolume / hydraulics.qHour : 0;

  const srtActualDays =
    model.srtDesign !== null && model.vTheo > 0
      ? model.srtDesign * (actual.volume / model.vTheo)
      : null;

  const isVolumeOk =
    hydraulics.qDay > 0 && model.vTheo > 0 && actual.volume >= model.vTheo;
  const isSrtDesignOk =
    model.srtDesign === null || model.srtDesign >= kinetics.srtMin;
  const isSrtActualOk =
    srtActualDays === null || srtActualDays >= kinetics.srtMin;
  const isNitrificationOk = !isAerobicTab || (isSrtDesignOk && isSrtActualOk);

  // SBR Phase Check
  const sbrTotalPhase =
    Number(sbr.fillHours) +
    Number(sbr.reactHours) +
    Number(sbr.settleHours) +
    Number(sbr.decantHours);
  const isSbrCycleMatch = Math.abs(sbrTotalPhase - sbr.cycleHours) <= 0.01;
  const isOverallOk =
    isVolumeOk &&
    isNitrificationOk &&
    (activeTab !== 'sbr' || isSbrCycleMatch);

  const handleShapeChange = (nextShape) => {
    model.setShape(nextShape);
    const nextTheo = interpolateDimensions(
      model.vTheo,
      model.depthH,
      nextShape,
      model.ratioLW
    );
    setOverrides((prev) => ({
      ...prev,
      [activeTab]: buildRecommendedOverride(nextTheo, nextShape),
    }));
  };

  const handleSnapRecommended = () => {
    setOverrides((prev) => ({
      ...prev,
      [activeTab]: buildRecommendedOverride(model.theo, model.shape),
    }));
  };

  const updateOverrideField = (field, value) => {
    setOverrides((prev) => ({
      ...prev,
      [activeTab]: {
        ...activeOverride,
        [field]: value,
      },
    }));
  };

  const extraCards = model.extraMetrics(actual);

  return (
    <div className="space-y-6">
      {/* Header & Global Q */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 text-balance">
            Sinh Học &amp; Lắng Đợt 2 (Xử Lý Bậc 2)
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Thiết kế động học bùn hoạt tính, Nitrat hóa, nhu cầu oxy, bể lắng
            thứ cấp và tính toán tuần hoàn bùn (RAS) đồng bộ thông số MLSS.
          </p>
        </div>

        <div className="w-full lg:w-80 rounded-xl bg-slate-800 border border-slate-700/80 p-3.5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
          <label
            htmlFor="bio-global-q"
            className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5"
          >
            <span>Lưu lượng chung (globalQ)</span>
            <span className="font-mono tabular-nums text-slate-300">
              Qtb = {hydraulics.qHour.toFixed(1)} m³/h
            </span>
          </label>
          <div className="relative flex items-center">
            <DecimalInput
              id="bio-global-q"
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

      {/* 7 Technology Tabs */}
      <div
        role="tablist"
        aria-label="Các công nghệ xử lý sinh học"
        className="print:hidden flex items-center gap-2 overflow-x-auto pb-1"
      >
        {BIO_TABS.map((tab) => {
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

      {/* SECTION A: MANDATORY AEROBIC NITRIFICATION & OXYGEN DEMAND */}
      {isAerobicTab && (
        <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500 shrink-0" />
              <h2 className="text-lg font-semibold text-slate-100">
                Động học Nitrat hóa Amoni & Nhu cầu Oxy tổng
              </h2>
            </div>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              SRT_min(T = {kinetics.T}°C) = {kinetics.srtMin.toFixed(2)} ngày
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <NumberInput
              id="bio-temp"
              label="Nhiệt độ nước thải (T)"
              unit="°C"
              value={bioQuality.tempC}
              min={5}
              max={45}
              step={1}
              onChange={(v) => setBioQuality((p) => ({ ...p, tempC: v }))}
            />
            <NumberInput
              id="bio-nh4-in"
              label="N-NH₄⁺ đầu vào"
              unit="mg/L"
              value={bioQuality.nh4In}
              min={0}
              max={500}
              step={1}
              onChange={(v) => setBioQuality((p) => ({ ...p, nh4In: v }))}
            />
            <NumberInput
              id="bio-nh4-out"
              label="N-NH₄⁺ đầu ra mục tiêu"
              unit="mg/L"
              value={bioQuality.nh4Out}
              min={0.5}
              max={100}
              step={0.5}
              onChange={(v) => setBioQuality((p) => ({ ...p, nh4Out: v }))}
            />
            <NumberInput
              id="bio-bod-in"
              label="BOD₅ đầu vào (S₀)"
              unit="mg/L"
              value={bioQuality.bodIn}
              min={10}
              max={5000}
              step={10}
              onChange={(v) => setBioQuality((p) => ({ ...p, bodIn: v }))}
            />
            <NumberInput
              id="bio-bod-out"
              label="BOD₅ đầu ra mục tiêu (S)"
              unit="mg/L"
              value={bioQuality.bodOut}
              min={5}
              max={500}
              step={5}
              onChange={(v) => setBioQuality((p) => ({ ...p, bodOut: v }))}
            />
            <NumberInput
              id="bio-srt-design"
              label="Tuổi bùn thiết kế (SRT_tk)"
              unit="ngày"
              value={model.srtDesign}
              min={1}
              max={60}
              step={1}
              onChange={(v) => {
                if (activeTab === 'aerotank')
                  setAerotank((p) => ({ ...p, srtDesign: v }));
                else if (activeTab === 'sbr')
                  setSbr((p) => ({ ...p, srtDesign: v }));
                else if (activeTab === 'mbbr')
                  setMbbr((p) => ({ ...p, srtDesign: v }));
                else if (activeTab === 'mbr')
                  setMbr((p) => ({ ...p, srtDesign: v }));
              }}
              helperText="Gợi ý: 5 – 15 ngày (Nitrat hóa: 10 – 20 ngày)"
            />
          </div>

          {/* Anoxic Nitrate Recovery Toggle + Input */}
          <div className="pt-4 border-t border-slate-700/70 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <label className="flex items-center gap-3 min-h-[44px] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bioQuality.hasAnoxic}
                onChange={(e) =>
                  setBioQuality((p) => ({ ...p, hasAnoxic: e.target.checked }))
                }
                className="h-5 w-5 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
              />
              <span className="text-sm font-medium text-slate-200">
                Có ngăn Anoxic khử Nitrat (giảm 2,86 kg O₂ / kg N-NO₃⁻ khử)
              </span>
            </label>

            {bioQuality.hasAnoxic && (
              <NumberInput
                id="bio-no3-credit"
                label="Nồng độ N-NO₃⁻ khử được tại Anoxic"
                unit="mg/L"
                value={bioQuality.no3DenitrifiedMgL}
                min={0}
                max={200}
                step={1}
                onChange={(v) =>
                  setBioQuality((p) => ({ ...p, no3DenitrifiedMgL: v }))
                }
              />
            )}
          </div>

          <StatusBanner
            ok={isSrtDesignOk}
            titleOk="ĐẠT ĐIỀU KIỆN NITRAT HÓA AMONI"
            titleFail="CẢNH BÁO: Rửa trôi vi khuẩn Nitrat hóa"
            summaryLabel="SRT_tk / SRT_min"
            message={
              isSrtDesignOk
                ? `Ở ${kinetics.T}°C, SRT thiết kế (${model.srtDesign} ngày) ≥ SRT_min (${kinetics.srtMin.toFixed(2)} ngày), vi khuẩn Nitrosomonas/Nitrobacter duy trì ổn định.`
                : `SRT thiết kế (${model.srtDesign} ngày) < SRT_min (${kinetics.srtMin.toFixed(2)} ngày) tại ${kinetics.T}°C. Nguy cơ rửa trôi vi khuẩn Nitrat hóa, không thể khử N-NH₄⁺!`
            }
            summaryRight={`${Number(model.srtDesign).toFixed(1)} / ${kinetics.srtMin.toFixed(2)} ngày`}
          />

          {/* Total Oxygen Demand Breakdown Table (wrapped in overflow-x-auto) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-400">
                Bảng phân tích nhu cầu Oxy lý thuyết
              </span>
              <ViewModeToggle
                viewMode={o2ViewMode}
                setViewMode={setO2ViewMode}
              />
            </div>

            {o2ViewMode === 'table' ? (
              <div className="overflow-x-auto w-full rounded-lg border border-slate-700/80 print:overflow-visible print:border-gray-300 print:break-inside-avoid">
                <table className="w-full min-w-[600px] text-left border-collapse text-sm print:min-w-0 print:w-full print:text-gray-900">
                  <thead>
                    <tr className="bg-slate-900/90 text-xs font-medium text-slate-400 border-b border-slate-700/80">
                      <th className="py-3 px-4">Thành phần nhu cầu Oxy</th>
                      <th className="py-3 px-4 text-right">Khối lượng chất</th>
                      <th className="py-3 px-4 text-right">Hệ số quy đổi</th>
                      <th className="py-3 px-4 text-right">
                        Oxy (kg O₂/ngày)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    <tr className="hover:bg-slate-900/40">
                      <td className="py-3 px-4 text-slate-200">
                        (+) Oxy khử chất hữu cơ (BOD₅)
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                        {kinetics.bodRemovedKg.toFixed(1)} kg BOD₅/ng
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400">
                        BODu − 1,42·Px
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-100">
                        +{kinetics.o2BodKg.toFixed(1)}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-900/40">
                      <td className="py-3 px-4 text-slate-200">
                        (+) Oxy Nitrat hóa Amoni (N-NH₄⁺)
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                        {kinetics.nh4RemovedKg.toFixed(1)} kg N/ng
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400">
                        4,57 kg O₂/kg N
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-100">
                        +{kinetics.o2Nh4Kg.toFixed(1)}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-900/40">
                      <td className="py-3 px-4 text-slate-200">
                        (−) Oxy hoàn lại từ Anoxic (khử NO₃⁻)
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                        {kinetics.no3DenitrifiedKg.toFixed(1)} kg N/ng
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400">
                        {bioQuality.hasAnoxic
                          ? '−2,86 kg O₂/kg N'
                          : 'Không áp dụng'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-400">
                        −{kinetics.o2CreditKg.toFixed(1)}
                      </td>
                    </tr>
                    <tr className="bg-slate-900/60 font-semibold">
                      <td className="py-3 px-4 text-slate-100" colSpan={3}>
                        Tổng nhu cầu Oxy lý thuyết (O₂ tổng)
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-400">
                        {kinetics.o2TotalKg.toFixed(1)} kg/ng (
                        {kinetics.o2TotalHourKg.toFixed(2)} kg/h)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    title: '(+) Oxy khử chất hữu cơ (BOD₅)',
                    mass: `${kinetics.bodRemovedKg.toFixed(1)} kg BOD₅/ng`,
                    factor: 'BODu − 1,42·Px',
                    o2: `+${kinetics.o2BodKg.toFixed(1)} kg O₂/ng`,
                    accent: 'text-slate-100',
                  },
                  {
                    title: '(+) Oxy Nitrat hóa Amoni (N-NH₄⁺)',
                    mass: `${kinetics.nh4RemovedKg.toFixed(1)} kg N/ng`,
                    factor: '4,57 kg O₂/kg N',
                    o2: `+${kinetics.o2Nh4Kg.toFixed(1)} kg O₂/ng`,
                    accent: 'text-slate-100',
                  },
                  {
                    title: '(−) Oxy hoàn lại từ Anoxic (khử NO₃⁻)',
                    mass: `${kinetics.no3DenitrifiedKg.toFixed(1)} kg N/ng`,
                    factor: bioQuality.hasAnoxic
                      ? '−2,86 kg O₂/kg N'
                      : 'Không áp dụng',
                    o2: `−${kinetics.o2CreditKg.toFixed(1)} kg O₂/ng`,
                    accent: 'text-emerald-400',
                  },
                  {
                    title: 'Tổng nhu cầu Oxy lý thuyết (O₂ tổng)',
                    mass: 'Cân bằng toàn trạm',
                    factor: `${kinetics.o2TotalHourKg.toFixed(2)} kg/h`,
                    o2: `${kinetics.o2TotalKg.toFixed(1)} kg/ng`,
                    accent: 'text-emerald-400',
                    highlight: true,
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className={`bg-slate-800 p-4 rounded-lg border shadow-sm space-y-2.5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid ${
                      item.highlight
                        ? 'border-emerald-500/40'
                        : 'border-slate-700'
                    }`}
                  >
                    <div className="pb-2 border-b border-slate-700/70">
                      <h4 className="text-sm font-semibold text-slate-100 leading-snug">
                        {item.title}
                      </h4>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Khối lượng chất</span>
                        <span className="text-slate-100 font-medium font-mono tabular-nums">
                          {item.mass}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Hệ số quy đổi</span>
                        <span className="text-slate-100 font-medium font-mono tabular-nums">
                          {item.factor}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-700/60">
                        <span className="text-slate-400">Nhu cầu Oxy</span>
                        <span
                          className={`font-mono font-semibold tabular-nums ${item.accent}`}
                        >
                          {item.o2}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* SECTION B: SBR PHASE ALLOCATOR (Rule 3) */}
      {activeTab === 'sbr' && (
        <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                Phân bổ chu kỳ các pha bể SBR
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Tổng thời gian 4 pha (Fill + React + Settle + Decant) phải bằng
                đúng thời gian 1 chu kỳ.
              </p>
            </div>
            <span
              className={`font-mono text-sm font-semibold tabular-nums ${
                isSbrCycleMatch ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              Tổng pha: {sbrTotalPhase.toFixed(2)} / {sbr.cycleHours.toFixed(2)} giờ
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <NumberInput
              id="sbr-num-tanks"
              label="Số bể SBR song song"
              unit="bể"
              value={sbr.numTanks}
              min={1}
              max={8}
              step={1}
              onChange={(v) => setSbr((p) => ({ ...p, numTanks: Math.max(1, Math.round(v)) }))}
            />
            <NumberInput
              id="sbr-cycle"
              label="Thời gian 1 chu kỳ (T_cycle)"
              unit="giờ"
              value={sbr.cycleHours}
              min={2}
              max={24}
              step={0.5}
              onChange={(v) => setSbr((p) => ({ ...p, cycleHours: v }))}
              helperText="Gợi ý: 4 – 8 giờ / chu kỳ"
            />
            <NumberInput
              id="sbr-exchange"
              label="Tỷ lệ trao đổi thể tích (ΔV/V)"
              unit="tỷ lệ"
              value={sbr.exchangeRatio}
              min={0.15}
              max={0.75}
              step={0.05}
              onChange={(v) => setSbr((p) => ({ ...p, exchangeRatio: v }))}
            />
            <NumberInput
              id="sbr-fill"
              label="Pha 1: Làm đầy (Fill)"
              unit="giờ"
              value={sbr.fillHours}
              min={0}
              max={12}
              step={0.25}
              onChange={(v) => setSbr((p) => ({ ...p, fillHours: v }))}
            />
            <NumberInput
              id="sbr-react"
              label="Pha 2: Phản ứng (React)"
              unit="giờ"
              value={sbr.reactHours}
              min={0}
              max={16}
              step={0.25}
              onChange={(v) => setSbr((p) => ({ ...p, reactHours: v }))}
            />
            <NumberInput
              id="sbr-settle"
              label="Pha 3: Lắng tĩnh (Settle)"
              unit="giờ"
              value={sbr.settleHours}
              min={0}
              max={6}
              step={0.25}
              onChange={(v) => setSbr((p) => ({ ...p, settleHours: v }))}
            />
            <NumberInput
              id="sbr-decant"
              label="Pha 4: Chắt nước (Decant)"
              unit="giờ"
              value={sbr.decantHours}
              min={0}
              max={4}
              step={0.25}
              onChange={(v) => setSbr((p) => ({ ...p, decantHours: v }))}
            />
          </div>

          {/* Visual Cycle Bar */}
          {sbrTotalPhase > 0 && (
            <div className="space-y-2">
              <div className="h-3 w-full rounded-full overflow-hidden bg-slate-900 flex">
                <div
                  style={{ width: `${(sbr.fillHours / sbrTotalPhase) * 100}%` }}
                  className="bg-sky-500"
                  title={`Fill: ${sbr.fillHours}h`}
                />
                <div
                  style={{ width: `${(sbr.reactHours / sbrTotalPhase) * 100}%` }}
                  className="bg-emerald-500"
                  title={`React: ${sbr.reactHours}h`}
                />
                <div
                  style={{ width: `${(sbr.settleHours / sbrTotalPhase) * 100}%` }}
                  className="bg-amber-500"
                  title={`Settle: ${sbr.settleHours}h`}
                />
                <div
                  style={{ width: `${(sbr.decantHours / sbrTotalPhase) * 100}%` }}
                  className="bg-slate-400"
                  title={`Decant: ${sbr.decantHours}h`}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono tabular-nums">
                <span>Fill: {sbr.fillHours}h</span>
                <span>React: {sbr.reactHours}h</span>
                <span>Settle: {sbr.settleHours}h</span>
                <span>Decant: {sbr.decantHours}h</span>
              </div>
            </div>
          )}

          <StatusBanner
            ok={isSbrCycleMatch}
            titleOk="PHÂN BỔ GIỜ PHA SBR HỢP LỆ"
            titleFail="CẢNH BÁO: TỔNG GIỜ CÁC PHA SBR SAI LỆCH"
            summaryLabel="Tổng pha / Chu kỳ"
            message={
              isSbrCycleMatch
                ? `Tổng thời gian 4 pha bằng ${sbrTotalPhase.toFixed(2)} giờ, khớp chính xác với thời gian 1 chu kỳ (${sbr.cycleHours.toFixed(2)} giờ).`
                : `Tổng thời gian 4 pha đang là ${sbrTotalPhase.toFixed(2)} giờ, chênh lệch ${(sbrTotalPhase - sbr.cycleHours).toFixed(2)} giờ so với chu kỳ ${sbr.cycleHours.toFixed(2)} giờ. Vui lòng điều chỉnh lại!`
            }
            summaryRight={`${sbrTotalPhase.toFixed(2)} / ${sbr.cycleHours.toFixed(2)} h`}
          />
        </section>
      )}

      {/* SECTION C..E: REACTOR OR LẮNG 2 */}
      {activeTab === 'clarifier' ? (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  1. Thông số Bể lắng đợt 2 &amp; Tuần hoàn bùn hoạt tính (RAS)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tính theo Qmax,h = {hydraulics.qMaxHour.toFixed(2)} m³/h (chia{' '}
                  {nClarifiers} bể) · Đồng bộ MLSS ={' '}
                  {sharedMlss.toLocaleString('vi-VN')} mg/L từ Aerotank
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                F_lt = {clarTheo.area.toFixed(2)} m²/bể · R ={' '}
                {(rasRatio * 100).toFixed(1)}%
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="clar-shape"
                  className="block text-sm font-medium text-slate-200 mb-2"
                >
                  Hình dạng bể lắng 2
                </label>
                <select
                  id="clar-shape"
                  value={clarifier.shape}
                  onChange={(e) => handleClarifierShapeChange(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                >
                  {CLARIFIER_SHAPES.map((s) => (
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
                id="clar-mlss-sync"
                label="MLSS bể Sinh học (đồng bộ)"
                unit="mg/L"
                value={aerotank.mlss}
                min={1500}
                max={6000}
                step={100}
                onChange={(v) => setAerotank((p) => ({ ...p, mlss: v }))}
              />

              <NumberInput
                id="clar-xr"
                label="Nồng độ bùn tuần hoàn đáy (X_r)"
                unit="mg/L"
                value={clarifier.returnSludgeSsMgL}
                min={3000}
                max={15000}
                step={500}
                onChange={(v) =>
                  setClarifier((p) => ({ ...p, returnSludgeSsMgL: v }))
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
                helperText="Gợi ý: 0,5 – 1,5 m³/m²·h (lắng sinh học)"
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
                helperText="Gợi ý: < 240 m³/m·ngày (< 10 m³/m·h)"
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
                helperText="Gợi ý: 1,5 – 3,0 giờ"
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

            <div className="pt-3 border-t border-slate-700/70 text-xs font-mono text-slate-400">
              R = MLSS / (X_r − MLSS) = {sharedMlss} / ({returnSs} −{' '}
              {sharedMlss}) = {rasRatio.toFixed(3)} → Q_RAS ={' '}
              {qRasHour.toFixed(2)} m³/h ({qRasDay.toFixed(1)} m³/ngày)
            </div>
          </section>

          {/* Theoretical Clarifier & RAS KPIs */}
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
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

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
              <div className="text-xs text-slate-400">
                Lưu lượng bùn tuần hoàn (Q_RAS)
              </div>
              <div
                className={`mt-2 font-mono text-xl font-semibold tabular-nums ${
                  isRasValid ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {qRasHour.toFixed(2)} m³/giờ
              </div>
              <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                {qRasDay.toFixed(1)} m³/ngày (Tỷ số R = {(rasRatio * 100).toFixed(1)}
                % Q_tb)
              </div>
            </div>

            <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
              <div className="text-xs text-slate-400">
                Tải trọng bề mặt &amp; Máng tràn thực tế
              </div>
              <div
                className={`mt-2 font-mono text-xl font-semibold tabular-nums ${
                  isClarSlrOk && isClarWeirOk
                    ? 'text-slate-100'
                    : 'text-red-400'
                }`}
              >
                {clarSurfaceLoadActual.toFixed(2)} m³/m²·h
              </div>
              <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
                Máng tràn: {clarWeirLoadActual.toFixed(1)} /{' '}
                {clarifier.weirLoadMax} m³/m·ng
              </div>
            </div>
          </section>

          {/* Override & Reverse Check */}
          <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  2. Chốt kích thước thi công &amp; Kiểm tra ngược Bể lắng 2
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Nhập kích thước chẵn ({clarifier.shape}) để kiểm tra ngược tải
                  trọng bề mặt, máng tràn, HRT và cân bằng bùn RAS.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setClarifierOverride(
                    buildRecommendedClarifier(clarTheo, clarifier.shape)
                  )
                }
                className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                <span>Làm tròn theo lý thuyết</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <StatusBanner
              ok={isClarAllOk}
              titleOk="ĐẠT CHUẨN BỂ LẮNG ĐỢT 2 & TUẦN HOÀN BÙN"
              titleFail="CẢNH BÁO ĐỎ: VƯỢT NGƯỠNG THIẾT KẾ BỂ LẮNG 2"
              summaryLabel="Q_RAS · HRT thực"
              message={
                isClarAllOk
                  ? `Tải bề mặt (${clarSurfaceLoadActual.toFixed(2)} m³/m²·h), máng tràn (${clarWeirLoadActual.toFixed(1)} m³/m·ng), HRT (${clarHrtActual.toFixed(2)}h) và bơm tuần hoàn RAS (${qRasHour.toFixed(1)} m³/h) đạt chuẩn.`
                  : `${!isRasValid ? `Nồng độ bùn tuần hoàn X_r (${returnSs} mg/L) phải lớn hơn MLSS (${sharedMlss} mg/L). ` : ''}${!isClarSlrOk ? `Vượt tải bề mặt (${clarSurfaceLoadActual.toFixed(2)} > ${clarifier.surfaceLoadMax} m³/m²·h). ` : ''}${!isClarWeirOk ? `Vượt tải máng tràn (${clarWeirLoadActual.toFixed(1)} > ${clarifier.weirLoadMax} m³/m·ng). ` : ''}${!isClarHrtOk ? `Thiếu thời gian lưu (${clarHrtActual.toFixed(2)} < ${clarifier.hrtMin} giờ).` : ''}`
              }
              summaryRight={`${qRasHour.toFixed(1)} m³/h · ${clarHrtActual.toFixed(2)} h`}
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
                {
                  name: 'Cân bằng bùn tuần hoàn (X_r > MLSS)',
                  standard: `X_r > ${sharedMlss.toLocaleString('vi-VN')} mg/L`,
                  actual: `R = ${(rasRatio * 100).toFixed(1)}% (${qRasHour.toFixed(2)} m³/h)`,
                  ok: isRasValid,
                  statusText: isRasValid ? 'Đạt cân bằng' : 'Sai nồng độ bùn',
                },
              ]}
            />
          </section>
        </div>
      ) : (
        <>
      {/* SECTION C: REACTOR SPECIFIC PARAMETERS & SHAPE SELECTOR */}
      <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {model.title} — Thông số công nghệ & Hình dạng
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{model.subtitle}</p>
          </div>
          <span className="font-mono text-xs text-emerald-400 tabular-nums">
            V_lt = {model.vTheo.toFixed(2)} m³
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Shape Selector Dropdown */}
          <div>
            <label
              htmlFor={`${activeTab}-shape`}
              className="block text-sm font-medium text-slate-200 mb-2"
            >
              Hình dạng công trình
            </label>
            <select
              id={`${activeTab}-shape`}
              value={model.shape}
              onChange={(e) => handleShapeChange(e.target.value)}
              className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
            >
              {SHAPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {activeTab === 'uasb' && (
            <>
              <NumberInput
                id="uasb-cod-in"
                label="COD đầu vào"
                unit="mg/L"
                value={uasb.codIn}
                min={100}
                max={20000}
                step={50}
                onChange={(v) => setUasb((p) => ({ ...p, codIn: v }))}
              />
              <NumberInput
                id="uasb-cod-out"
                label="COD đầu ra dự kiến"
                unit="mg/L"
                value={uasb.codOut}
                min={20}
                max={5000}
                step={20}
                onChange={(v) => setUasb((p) => ({ ...p, codOut: v }))}
              />
              <NumberInput
                id="uasb-olr"
                label="Tải trọng thể tích (OLR)"
                unit="kg/m³·ng"
                value={uasb.olr}
                min={1}
                max={20}
                step={0.5}
                onChange={(v) => setUasb((p) => ({ ...p, olr: v }))}
                helperText="Gợi ý: 2,0 – 10,0 kg COD/m³·ngày"
              />
              <NumberInput
                id="uasb-h"
                label="Chiều cao phản ứng (H_lt)"
                unit="m"
                value={uasb.depthH}
                min={3}
                max={8}
                step={0.2}
                onChange={(v) => setUasb((p) => ({ ...p, depthH: v }))}
              />
            </>
          )}

          {activeTab === 'anoxic' && (
            <>
              <NumberInput
                id="anoxic-hrt"
                label="Thời gian lưu (HRT)"
                unit="giờ"
                value={anoxic.hrtHours}
                min={0.5}
                max={12}
                step={0.25}
                onChange={(v) => setAnoxic((p) => ({ ...p, hrtHours: v }))}
                helperText="Gợi ý: 1 – 3 giờ"
              />
              <NumberInput
                id="anoxic-no3-in"
                label="N-NO₃⁻ đầu vào Anoxic"
                unit="mg/L"
                value={anoxic.no3In}
                min={0}
                max={200}
                step={1}
                onChange={(v) => setAnoxic((p) => ({ ...p, no3In: v }))}
              />
              <NumberInput
                id="anoxic-no3-out"
                label="N-NO₃⁻ đầu ra mục tiêu"
                unit="mg/L"
                value={anoxic.no3Out}
                min={0}
                max={100}
                step={1}
                onChange={(v) => setAnoxic((p) => ({ ...p, no3Out: v }))}
              />
              <NumberInput
                id="anoxic-mlss"
                label="Nồng độ bùn (MLSS)"
                unit="mg/L"
                value={anoxic.mlss}
                min={1000}
                max={8000}
                step={100}
                onChange={(v) => setAnoxic((p) => ({ ...p, mlss: v }))}
                helperText="Gợi ý: 2.500 – 4.000 mg/L"
              />
              <NumberInput
                id="anoxic-h"
                label="Chiều sâu công tác (H_lt)"
                unit="m"
                value={anoxic.depthH}
                min={2}
                max={7}
                step={0.1}
                onChange={(v) => setAnoxic((p) => ({ ...p, depthH: v }))}
              />
            </>
          )}

          {activeTab === 'aerotank' && (
            <>
              <NumberInput
                id="aero-mlss"
                label="Nồng độ bùn hoạt tính (MLSS)"
                unit="mg/L"
                value={aerotank.mlss}
                min={1500}
                max={6000}
                step={100}
                onChange={(v) => setAerotank((p) => ({ ...p, mlss: v }))}
                helperText="Gợi ý: 2.500 – 4.000 mg/L (TCVN 7957:2008)"
              />
              <NumberInput
                id="aero-h"
                label="Chiều sâu công tác (H_lt)"
                unit="m"
                value={aerotank.depthH}
                min={2.5}
                max={7}
                step={0.1}
                onChange={(v) => setAerotank((p) => ({ ...p, depthH: v }))}
              />
            </>
          )}

          {activeTab === 'sbr' && (
            <>
              <NumberInput
                id="sbr-mlss"
                label="Nồng độ bùn (MLSS)"
                unit="mg/L"
                value={sbr.mlss}
                min={1500}
                max={6000}
                step={100}
                onChange={(v) => setSbr((p) => ({ ...p, mlss: v }))}
                helperText="Gợi ý: 3.000 – 5.000 mg/L"
              />
              <NumberInput
                id="sbr-h"
                label="Chiều sâu hữu ích (H_lt)"
                unit="m"
                value={sbr.depthH}
                min={2.5}
                max={7}
                step={0.1}
                onChange={(v) => setSbr((p) => ({ ...p, depthH: v }))}
              />
            </>
          )}

          {activeTab === 'mbbr' && (
            <>
              <NumberInput
                id="mbbr-fill"
                label="Tỷ lệ điền đầy giá thể (φ)"
                unit="%"
                value={mbbr.mediaFillPct}
                min={20}
                max={70}
                step={5}
                onChange={(v) => setMbbr((p) => ({ ...p, mediaFillPct: v }))}
                helperText="Gợi ý: 30 – 50 % thể tích bể"
              />
              <NumberInput
                id="mbbr-ssa"
                label="Diện tích riêng giá thể (SSA)"
                unit="m²/m³"
                value={mbbr.mediaSsa}
                min={250}
                max={1200}
                step={50}
                onChange={(v) => setMbbr((p) => ({ ...p, mediaSsa: v }))}
                helperText="Gợi ý: 400 – 800 m²/m³"
              />
              <NumberInput
                id="mbbr-salr"
                label="Tải trọng bề mặt (SALR)"
                unit="g/m²·ng"
                value={mbbr.salr}
                min={3}
                max={25}
                step={0.5}
                onChange={(v) => setMbbr((p) => ({ ...p, salr: v }))}
              />
              <NumberInput
                id="mbbr-h"
                label="Chiều sâu công tác (H_lt)"
                unit="m"
                value={mbbr.depthH}
                min={2.5}
                max={7}
                step={0.1}
                onChange={(v) => setMbbr((p) => ({ ...p, depthH: v }))}
              />
            </>
          )}

          {activeTab === 'mbr' && (
            <>
              <NumberInput
                id="mbr-mlss"
                label="Nồng độ bùn màng (MLSS)"
                unit="mg/L"
                value={mbr.mlss}
                min={5000}
                max={15000}
                step={500}
                onChange={(v) => setMbr((p) => ({ ...p, mlss: v }))}
                helperText="Gợi ý: 8.000 – 12.000 mg/L"
              />
              <NumberInput
                id="mbr-flux"
                label="Thông lượng màng (Flux)"
                unit="LMH"
                value={mbr.fluxLmh}
                min={8}
                max={35}
                step={1}
                onChange={(v) => setMbr((p) => ({ ...p, fluxLmh: v }))}
                helperText="Gợi ý: 15 – 25 LMH"
              />
              <NumberInput
                id="mbr-h"
                label="Chiều sâu bể màng (H_lt)"
                unit="m"
                value={mbr.depthH}
                min={2.5}
                max={6.5}
                step={0.1}
                onChange={(v) => setMbr((p) => ({ ...p, depthH: v }))}
              />
            </>
          )}

          {model.shape === 'Chữ nhật' && (
            <NumberInput
              id={`${activeTab}-ratio`}
              label="Tỷ lệ Dài / Rộng (L/W)"
              unit="L/W"
              value={model.ratioLW}
              min={1}
              max={5}
              step={0.1}
              onChange={(v) => {
                if (activeTab === 'uasb') setUasb((p) => ({ ...p, ratioLW: v }));
                else if (activeTab === 'anoxic') setAnoxic((p) => ({ ...p, ratioLW: v }));
                else if (activeTab === 'aerotank') setAerotank((p) => ({ ...p, ratioLW: v }));
                else if (activeTab === 'sbr') setSbr((p) => ({ ...p, ratioLW: v }));
                else if (activeTab === 'mbbr') setMbbr((p) => ({ ...p, ratioLW: v }));
                else if (activeTab === 'mbr') setMbr((p) => ({ ...p, ratioLW: v }));
              }}
            />
          )}
        </div>

        <div className="pt-3 border-t border-slate-700/70 text-xs font-mono text-slate-400">
          {model.formulaText}
        </div>
      </section>

      {/* SECTION D: THEORETICAL INTERPOLATED DIMENSIONS + EXTRA METRICS */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
          <div className="text-xs text-slate-400">
            Kích thước nội suy lý thuyết ({model.shape})
          </div>
          {model.shape === 'Chữ nhật' && (
            <div className="mt-2 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
              {model.theo.L.toFixed(2)} × {model.theo.W.toFixed(2)} ×{' '}
              {model.theo.H.toFixed(2)} m
            </div>
          )}
          {model.shape === 'Vuông' && (
            <div className="mt-2 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
              {model.theo.a.toFixed(2)} × {model.theo.a.toFixed(2)} ×{' '}
              {model.theo.H.toFixed(2)} m
            </div>
          )}
          {model.shape === 'Tròn' && (
            <div className="mt-2 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
              Ø {model.theo.D.toFixed(2)} × {model.theo.H.toFixed(2)} m
            </div>
          )}
          <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
            V_lt = {model.vTheo.toFixed(2)} m³ · F_lt = {model.theo.area.toFixed(2)}{' '}
            m²
          </div>
        </div>

        {extraCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid"
          >
            <div className="text-xs text-slate-400">{card.label}</div>
            <div
              className={`mt-2 font-mono text-xl font-semibold tabular-nums ${
                card.warn ? 'text-red-500' : 'text-slate-100'
              }`}
            >
              {card.value}
            </div>
            <div
              className={`mt-1 text-xs ${
                card.warn ? 'text-red-300' : 'text-slate-400'
              }`}
            >
              {card.note}
            </div>
          </div>
        ))}
      </section>

      {/* SECTION E: CONSTRUCTION OVERRIDE & REVERSE VERIFICATION */}
      <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Kích thước chọn thi công & Kiểm tra ngược (V_thực · HRT · SRT)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Nhập kích thước chọn theo hình dạng{' '}
              <strong className="text-slate-200">{model.shape}</strong>. Hệ
              thống kiểm tra lại V_thực, HRT thực và SRT thực tế.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSnapRecommended}
            className="print:hidden inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
            <span>Làm tròn theo lý thuyết</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {model.shape === 'Chữ nhật' && (
            <>
              <NumberInput
                id={`${activeTab}-ov-L`}
                label="Chiều dài chọn (L)"
                unit="m"
                value={activeOverride.L}
                min={0}
                max={100}
                step={0.1}
                onChange={(v) => updateOverrideField('L', v)}
              />
              <NumberInput
                id={`${activeTab}-ov-W`}
                label="Chiều rộng chọn (W)"
                unit="m"
                value={activeOverride.W}
                min={0}
                max={100}
                step={0.1}
                onChange={(v) => updateOverrideField('W', v)}
              />
              <NumberInput
                id={`${activeTab}-ov-H-rect`}
                label="Chiều cao công tác chọn (H)"
                unit="m"
                value={activeOverride.H}
                min={0}
                max={20}
                step={0.1}
                onChange={(v) => updateOverrideField('H', v)}
              />
            </>
          )}

          {model.shape === 'Vuông' && (
            <>
              <NumberInput
                id={`${activeTab}-ov-a`}
                label="Cạnh bể chọn (a)"
                unit="m"
                value={activeOverride.a}
                min={0}
                max={100}
                step={0.1}
                onChange={(v) => updateOverrideField('a', v)}
              />
              <NumberInput
                id={`${activeTab}-ov-H-sq`}
                label="Chiều cao công tác chọn (H)"
                unit="m"
                value={activeOverride.H}
                min={0}
                max={20}
                step={0.1}
                onChange={(v) => updateOverrideField('H', v)}
              />
            </>
          )}

          {model.shape === 'Tròn' && (
            <>
              <NumberInput
                id={`${activeTab}-ov-D`}
                label="Đường kính chọn (D)"
                unit="m"
                value={activeOverride.D}
                min={0}
                max={100}
                step={0.1}
                onChange={(v) => updateOverrideField('D', v)}
              />
              <NumberInput
                id={`${activeTab}-ov-H-cir`}
                label="Chiều cao công tác chọn (H)"
                unit="m"
                value={activeOverride.H}
                min={0}
                max={20}
                step={0.1}
                onChange={(v) => updateOverrideField('H', v)}
              />
            </>
          )}
        </div>

        {/* Reverse Verification Status Banner */}
        <StatusBanner
          ok={isOverallOk}
          titleOk="ĐẠT CHUẨN HÌNH HỌC & ĐỘNG HỌC"
          titleFail="CẢNH BÁO: KHÔNG ĐẠT CHUẨN THIẾT KẾ"
          summaryLabel="V_thực · HRT thực"
          message={`${
            !isVolumeOk
              ? `Thể tích thực tế (${actual.volume.toFixed(2)} m³) nhỏ hơn thể tích lý thuyết (${model.vTheo.toFixed(2)} m³). `
              : `V_thực = ${actual.volume.toFixed(2)} m³ ≥ V_lt = ${model.vTheo.toFixed(2)} m³. `
          }${
            isAerobicTab && !isSrtActualOk
              ? `SRT thực tế (${srtActualDays?.toFixed(2)} ngày) < SRT_min (${kinetics.srtMin.toFixed(2)} ngày) — Nguy cơ rửa trôi vi khuẩn Nitrat hóa!`
              : ''
          }${
            activeTab === 'sbr' && !isSbrCycleMatch
              ? ` Tổng giờ các pha SBR (${sbrTotalPhase.toFixed(2)}h) không khớp chu kỳ (${sbr.cycleHours.toFixed(2)}h).`
              : ''
          }`}
          summaryRight={`${actual.volume.toFixed(2)} m³ · ${hrtActualHours.toFixed(2)} h`}
        />

        <ReverseCheckTable
          title="Bảng kiểm tra ngược thông số bể sinh học"
          rows={[
            {
              name: 'Thể tích 1 đơn nguyên (V)',
              standard: `${model.vTheo.toFixed(2)} m³`,
              actual: `${actual.volume.toFixed(2)} m³`,
              ok: isVolumeOk,
              statusText: isVolumeOk ? 'Đạt chuẩn' : 'Thiếu thể tích',
            },
            {
              name: 'Thời gian lưu thủy lực (HRT)',
              standard: `${hrtTheoHours.toFixed(2)} giờ`,
              actual: `${hrtActualHours.toFixed(2)} giờ`,
              ok: hrtActualHours >= hrtTheoHours,
              statusText:
                hrtActualHours >= hrtTheoHours ? 'Đạt' : 'Nhỏ hơn LT',
            },
            ...(srtActualDays !== null
              ? [
                  {
                    name: 'Tuổi bùn (SRT thực tế vs SRT_min)',
                    standard: `≥ ${kinetics.srtMin.toFixed(2)} ngày`,
                    actual: `${srtActualDays.toFixed(2)} ngày`,
                    ok: isSrtActualOk,
                    statusText: isSrtActualOk
                      ? 'Nitrat hóa ổn định'
                      : 'Rửa trôi Nitrat',
                  },
                ]
              : []),
            {
              name: 'Diện tích mặt bằng (F)',
              standard: `${model.theo.area.toFixed(2)} m²`,
              actual: `${actual.area.toFixed(2)} m²`,
              ok: actual.area >= model.theo.area,
              statusText:
                model.unitCount > 1
                  ? `× ${model.unitCount} bể`
                  : '1 đơn nguyên',
            },
          ]}
        />
      </section>
        </>
      )}

      <EquipmentSelector
        key={
          BIO_EQUIPMENT_MAP[activeTab]?.storageKey ||
          `omnieco_equipments_wastewaterbiology_${activeTab}`
        }
        moduleLabel={
          BIO_EQUIPMENT_MAP[activeTab]?.label || 'Công trình Sinh học'
        }
        storageKey={
          BIO_EQUIPMENT_MAP[activeTab]?.storageKey ||
          `omnieco_equipments_wastewaterbiology_${activeTab}`
        }
      />
    </div>
  );
}
