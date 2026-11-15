import { useState } from 'react';
import {
  Filter,
  GitFork,
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

const WATER_BASIC_EQUIPMENT_LABELS = {
  iron_mn: 'Công đoạn Khử Sắt / Mangan',
  zigzag_mix: 'Bể Trộn ziczac (Cấp nước)',
  lamella: 'Bể Lắng Lamen',
  rapid_sand: 'Bể Lọc cát nhanh',
};

const WATER_TABS = [
  { id: 'iron_mn', label: 'Khử Sắt / Mangan', icon: Wind },
  { id: 'zigzag_mix', label: 'Trộn ziczac', icon: GitFork },
  { id: 'lamella', label: 'Lắng Lamen', icon: Layers },
  { id: 'rapid_sand', label: 'Lọc cát nhanh', icon: Filter },
];

const TANK_SHAPES = [
  { value: 'Vuông', label: 'Vuông (a × a × H)' },
  { value: 'Chữ nhật', label: 'Chữ nhật (L × W × H)' },
  { value: 'Tròn', label: 'Tròn (Ø D × H)' },
];

function getDynamicViscosity(tempC) {
  const T = Math.max(5, Math.min(45, Number(tempC) || 20));
  return 0.00179 / (1 + 0.03368 * T + 0.000221 * T * T);
}

function interpolateTank(volume, depth, shape, ratioLW = 1.5) {
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
  const ratio = Math.max(1, Number(ratioLW) || 1.5);
  const W = Math.sqrt(area / ratio);
  const L = W * ratio;
  return { area, H: safeH, L, W, a: 0, D: 0 };
}

function buildRecommendedOverride(theo, shape, extra = {}) {
  const H = roundUpToStep(theo.H, 0.1);
  if (shape === 'Vuông') {
    return { a: roundUpToStep(theo.a, 0.1), L: 0, W: 0, D: 0, H, ...extra };
  }
  if (shape === 'Tròn') {
    return { D: roundUpToStep(theo.D, 0.1), a: 0, L: 0, W: 0, H, ...extra };
  }
  return {
    L: roundUpToStep(theo.L, 0.1),
    W: roundUpToStep(theo.W, 0.1),
    a: 0,
    D: 0,
    H,
    ...extra,
  };
}

function computeActualTank(override, shape) {
  const H = Math.max(0, Number(override.H) || 0);
  if (shape === 'Vuông') {
    const a = Math.max(0, Number(override.a) || 0);
    const area = a * a;
    return { area, volume: area * H, H, a, L: a, W: a };
  }
  if (shape === 'Tròn') {
    const D = Math.max(0, Number(override.D) || 0);
    const area = (Math.PI * D * D) / 4;
    return { area, volume: area * H, H, D, L: D, W: D };
  }
  const L = Math.max(0, Number(override.L) || 0);
  const W = Math.max(0, Number(override.W) || 0);
  const area = L * W;
  return { area, volume: area * H, H, L, W };
}

export default function WaterSupplyBasic() {
  const { globalQ, setGlobalQ, hydraulics } = useAppContext();
  const [activeTab, setActiveTab] = useState('iron_mn');
  const [waterTemp, setWaterTemp] = useState(25);
  const mu = getDynamicViscosity(waterTemp);
  const nu = mu / 1000; // độ nhớt động học m2/s

  // --- Tab 1: Khử Sắt / Mangan ---
  const [ironMn, setIronMn] = useState({
    shape: 'Chữ nhật',
    feIn: 8.0, // mg/L
    mnIn: 1.2, // mg/L
    airWaterRatio: 4.0, // m3 khí / m3 nước làm thoáng
    contactMin: 30, // phút
    gTarget: 25, // s^-1 (chống lắng cặn kết tủa)
    depthH: 3.0,
    ratioLW: 1.5,
  });

  // --- Tab 2: Trộn ziczac ---
  const [zigzag, setZigzag] = useState({
    shape: 'Chữ nhật',
    retentionSec: 30, // giây
    numBaffles: 8, // số vách ngăn / ngoặt ziczac
    flowVelTarget: 0.8, // m/s
    zetaTurn: 3.0, // hệ số tổn thất cục bộ 180 độ
    depthH: 1.8,
    ratioLW: 2.0,
  });

  // --- Tab 3: Lắng Lamen ---
  const [lamella, setLamella] = useState({
    shape: 'Chữ nhật',
    surfaceLoadMax: 7.0, // m3/m2.h trên mặt bằng bể Lamen
    surfaceLoadTarget: 5.5,
    plateAngleDeg: 60,
    plateSpacingMm: 50,
    depthH: 3.8,
    ratioLW: 1.5,
  });

  // --- Tab 4: Lọc cát nhanh ---
  const [sandFilter, setSandFilter] = useState({
    shape: 'Chữ nhật',
    numTanks: 2,
    filtrationRateTarget: 7.0, // m/h
    filtrationRateMax: 10.0, // m/h
    backwashWaterRate: 14.0, // L/s.m2
    backwashTimeMin: 6, // phút
    pumpHeadM: 10.0, // m
    backwashAirRate: 16.0, // L/s.m2
    blowerPressureKpa: 40, // kPa
    depthH: 3.2, // m (tổng chiều cao bể lọc hở)
    ratioLW: 1.4,
  });

  // Per-tab construction overrides
  const [overrides, setOverrides] = useState({
    iron_mn: null,
    zigzag_mix: null,
    lamella: null,
    rapid_sand: null,
  });

  // Trạm cấp nước tính theo Q_h = globalQ / 24 (m3/h) và Q_s = Q_h / 3600 (m3/s)
  const qHour = hydraulics.qHour;
  const qSec = qHour / 3600;

  // --- Model Builder for the 4 Water Supply Units ---
  const buildTabModel = (tabId) => {
    if (tabId === 'iron_mn') {
      const vTheo = qHour * (ironMn.contactMin / 60);
      const theo = interpolateTank(
        vTheo,
        ironMn.depthH,
        ironMn.shape,
        ironMn.ratioLW
      );
      const o2StoichKgDay =
        (hydraulics.qDay * (0.14 * ironMn.feIn + 0.29 * ironMn.mnIn)) / 1000;
      const airAerationM3h = qHour * ironMn.airWaterRatio;
      const motorKwTheo =
        (Math.pow(ironMn.gTarget, 2) * mu * vTheo) / (1000 * 0.75);
      const defaultExtra = { motorKw: roundUpToStep(Math.max(0.37, motorKwTheo), 0.1) };

      return {
        tabId,
        title: 'Tháp làm thoáng & Bể tiếp xúc Khử Sắt / Mangan',
        subtitle:
          'Oxy hóa Fe²⁺, Mn²⁺ bằng làm thoáng kết hợp bể tiếp xúc (t = 20–45 phút)',
        formulaText: `V_lt = Q_h × (t/60) = ${qHour.toFixed(2)} × (${ironMn.contactMin}/60) = ${vTheo.toFixed(2)} m³ · O₂ lý thuyết = ${o2StoichKgDay.toFixed(2)} kg/ng`,
        shape: ironMn.shape,
        depthH: ironMn.depthH,
        ratioLW: ironMn.ratioLW,
        vTheo,
        theo,
        defaultExtra,
        setShape: (s) => setIronMn((p) => ({ ...p, shape: s })),
        evaluateReverse: (actual, ov) => {
          const tActualMin = qHour > 0 ? (actual.volume / qHour) * 60 : 0;
          const motorKw = Math.max(0, Number(ov.motorKw ?? defaultExtra.motorKw));
          const gActual =
            actual.volume > 0
              ? Math.sqrt((motorKw * 1000 * 0.75) / (mu * actual.volume))
              : 0;
          const isVolOk = hydraulics.qDay > 0 && actual.volume >= vTheo;
          const isTimeOk = hydraulics.qDay > 0 && tActualMin >= 20;
          const isGOk = gActual >= 10 && gActual <= 50;

          return {
            isAllOk: isVolOk && isTimeOk && isGOk,
            summaryRight: `${actual.volume.toFixed(1)} m³ · G = ${gActual.toFixed(0)} s⁻¹`,
            failReason: `${!isVolOk ? `V_thực (${actual.volume.toFixed(1)} m³) < V_lt (${vTheo.toFixed(1)} m³). ` : ''}${!isTimeOk ? `Thời gian tiếp xúc (${tActualMin.toFixed(1)} phút) < 20 phút. ` : ''}${!isGOk ? `G thực (${gActual.toFixed(0)} s⁻¹) ngoài dải 10–50 s⁻¹.` : ''}`,
            extraCards: [
              {
                label: 'Lưu lượng khí làm thoáng (cấp oxy)',
                value: `${airAerationM3h.toFixed(1)} m³/giờ`,
                note: `Tỷ lệ khí/nước ${ironMn.airWaterRatio}:1 · O₂ hóa học ${o2StoichKgDay.toFixed(2)} kg/ng`,
              },
              {
                label: 'Gradient vận tốc thực (G_thực)',
                value: `${gActual.toFixed(0)} s⁻¹`,
                note: 'Ngưỡng chống lắng cặn: 10 – 50 s⁻¹',
                warn: !isGOk,
              },
            ],
            tableRows: [
              {
                name: 'Thể tích bể tiếp xúc (V)',
                standard: `≥ ${vTheo.toFixed(2)} m³`,
                actual: `${actual.volume.toFixed(2)} m³`,
                ok: isVolOk,
                statusText: isVolOk ? 'Đạt chuẩn' : 'Thiếu thể tích',
              },
              {
                name: 'Thời gian lưu tiếp xúc (t)',
                standard: '≥ 20,0 phút',
                actual: `${tActualMin.toFixed(1)} phút`,
                ok: isTimeOk,
                statusText: isTimeOk ? 'Đạt chuẩn' : 'Quá ngắn',
              },
              {
                name: 'Gradient vận tốc thực tế (G)',
                standard: '10 – 50 s⁻¹',
                actual: `${gActual.toFixed(0)} s⁻¹`,
                ok: isGOk,
                statusText: isGOk ? 'Đạt chuẩn' : 'Ngoài ngưỡng',
              },
            ],
          };
        },
      };
    }

    if (tabId === 'zigzag_mix') {
      const vTheo = qSec * zigzag.retentionSec;
      const theo = interpolateTank(
        vTheo,
        zigzag.depthH,
        zigzag.shape,
        zigzag.ratioLW
      );
      const deltaHTheo =
        zigzag.numBaffles *
        zigzag.zetaTurn *
        ((zigzag.flowVelTarget * zigzag.flowVelTarget) / (2 * 9.81));
      const gTheo =
        zigzag.retentionSec > 0
          ? Math.sqrt((9810 * deltaHTheo) / (mu * zigzag.retentionSec))
          : 0;
      const defaultExtra = { bafflesActual: zigzag.numBaffles };

      return {
        tabId,
        title: 'Bể trộn thủy lực vách ngăn Ziczac',
        subtitle:
          'Tạo tổn thất áp lực qua các ngoặt 180° để khuấy trộn phèn nhanh (G = 300–1.000 s⁻¹)',
        formulaText: `V_lt = Q_s × t = ${qSec.toFixed(4)} × ${zigzag.retentionSec}s = ${vTheo.toFixed(2)} m³ · G = √(γ·Δh / (μ·t))`,
        shape: zigzag.shape,
        depthH: zigzag.depthH,
        ratioLW: zigzag.ratioLW,
        vTheo,
        theo,
        defaultExtra,
        setShape: (s) => setZigzag((p) => ({ ...p, shape: s })),
        evaluateReverse: (actual, ov) => {
          const baffles = Math.max(
            2,
            Math.round(Number(ov.bafflesActual ?? zigzag.numBaffles))
          );
          const tActualSec = qSec > 0 ? actual.volume / qSec : 0;
          const channelWidth = actual.L > 0 ? actual.L / baffles : 0.2;
          const crossArea = channelWidth * actual.H;
          const vActual = crossArea > 0 ? qSec / crossArea : 0;
          const deltaHActual =
            baffles * zigzag.zetaTurn * ((vActual * vActual) / (2 * 9.81));
          const gActual =
            tActualSec > 0
              ? Math.sqrt((9810 * deltaHActual) / (mu * tActualSec))
              : 0;

          const isVolOk = hydraulics.qDay > 0 && actual.volume >= vTheo;
          const isGOk = gActual >= 300 && gActual <= 1100;
          const isVelOk = vActual >= 0.4 && vActual <= 1.4;

          return {
            isAllOk: isVolOk && isGOk && isVelOk,
            summaryRight: `${actual.volume.toFixed(2)} m³ · G = ${gActual.toFixed(0)} s⁻¹`,
            failReason: `${!isVolOk ? `V_thực (${actual.volume.toFixed(2)} m³) < V_lt (${vTheo.toFixed(2)} m³). ` : ''}${!isGOk ? `G thực tế (${gActual.toFixed(0)} s⁻¹) ngoài dải 300–1.100 s⁻¹ (hãy điều chỉnh số vách ngăn hoặc kích thước bể). ` : ''}${!isVelOk ? `Vận tốc hành lang (${vActual.toFixed(2)} m/s) ngoài dải 0,4–1,4 m/s.` : ''}`,
            extraCards: [
              {
                label: 'Gradient vận tốc lý thuyết (G_lt)',
                value: `${gTheo.toFixed(0)} s⁻¹`,
                note: `Δh_lt = ${(deltaHTheo * 1000).toFixed(0)} mm qua ${zigzag.numBaffles} ngoặt`,
              },
              {
                label: 'Gradient vận tốc thực tế (G_thực)',
                value: `${gActual.toFixed(0)} s⁻¹`,
                note: `v_hành lang = ${vActual.toFixed(2)} m/s · Δh = ${(deltaHActual * 1000).toFixed(0)} mm`,
                warn: !isGOk,
              },
            ],
            tableRows: [
              {
                name: 'Thể tích bể trộn (V)',
                standard: `≥ ${vTheo.toFixed(2)} m³`,
                actual: `${actual.volume.toFixed(2)} m³`,
                ok: isVolOk,
                statusText: isVolOk ? 'Đạt chuẩn' : 'Thiếu thể tích',
              },
              {
                name: 'Gradient vận tốc thực (G_thực)',
                standard: '300 – 1.100 s⁻¹',
                actual: `${gActual.toFixed(0)} s⁻¹`,
                ok: isGOk,
                statusText: isGOk
                  ? 'Trộn đạt chuẩn'
                  : gActual < 300
                  ? 'G quá yếu'
                  : 'G quá lớn',
              },
              {
                name: 'Vận tốc qua khe ziczac (v)',
                standard: '0,40 – 1,40 m/s',
                actual: `${vActual.toFixed(2)} m/s`,
                ok: isVelOk,
                statusText: isVelOk ? 'Đạt chuẩn' : 'Ngoài ngưỡng',
              },
              {
                name: 'Tổn thất cột áp qua bể trộn (Δh)',
                standard: 'Tham khảo thủy lực',
                actual: `${deltaHActual.toFixed(3)} m`,
                ok: true,
                statusText: `${baffles} vách ngăn`,
              },
            ],
          };
        },
      };
    }

    if (tabId === 'lamella') {
      const areaTheo =
        lamella.surfaceLoadTarget > 0 ? qHour / lamella.surfaceLoadTarget : 0;
      const vTheo = areaTheo * lamella.depthH;
      const theo = interpolateTank(
        vTheo,
        lamella.depthH,
        lamella.shape,
        lamella.ratioLW
      );
      const defaultExtra = {};

      return {
        tabId,
        title: 'Bể lắng tấm nghiêng Lamella',
        subtitle:
          'Tăng diện tích lắng hiệu dụng nhờ hệ tấm nghiêng 55°–60°, duy trì dòng chảy tầng',
        formulaText: `F_lt = Q_h / q_mb = ${qHour.toFixed(2)} / ${lamella.surfaceLoadTarget} = ${areaTheo.toFixed(2)} m² · V_lt = ${vTheo.toFixed(2)} m³`,
        shape: lamella.shape,
        depthH: lamella.depthH,
        ratioLW: lamella.ratioLW,
        vTheo,
        theo,
        defaultExtra,
        setShape: (s) => setLamella((p) => ({ ...p, shape: s })),
        evaluateReverse: (actual) => {
          const qLoadActual = actual.area > 0 ? qHour / actual.area : 0;
          const alphaRad = (lamella.plateAngleDeg * Math.PI) / 180;
          const dM = lamella.plateSpacingMm / 1000;
          const vKhe =
            actual.area > 0 && Math.sin(alphaRad) > 0
              ? qSec / (actual.area * Math.sin(alphaRad))
              : 0;
          const re = nu > 0 ? (vKhe * dM) / nu : 0;
          // Gradient vận tốc dòng chảy tầng giữa 2 tấm song song: G = 2*sqrt(3)*v / d
          const gKhe = dM > 0 ? (2 * Math.sqrt(3) * vKhe) / dM : 0;

          const isVolOk = hydraulics.qDay > 0 && actual.volume >= vTheo;
          const isLoadOk =
            hydraulics.qDay > 0 && qLoadActual <= lamella.surfaceLoadMax;
          const isReOk = re <= 500;

          return {
            isAllOk: isVolOk && isLoadOk && isReOk,
            summaryRight: `${actual.area.toFixed(1)} m² · q = ${qLoadActual.toFixed(2)} m³/m²·h`,
            failReason: `${!isVolOk ? `V_thực (${actual.volume.toFixed(1)} m³) < V_lt (${vTheo.toFixed(1)} m³). ` : ''}${!isLoadOk ? `Tải trọng bề mặt (${qLoadActual.toFixed(2)} m³/m²·h) > ngưỡng tối đa (${lamella.surfaceLoadMax} m³/m²·h). ` : ''}${!isReOk ? `Số Reynolds khe tấm (${re.toFixed(0)}) > 500 — dòng chảy rối làm vỡ/trôi bông!` : ''}`,
            extraCards: [
              {
                label: 'Tải trọng bề mặt thực tế',
                value: `${qLoadActual.toFixed(2)} m³/m²·h`,
                note: `Giới hạn chuẩn ≤ ${lamella.surfaceLoadMax} m³/m²·h`,
                warn: !isLoadOk,
              },
              {
                label: 'Gradient & Reynolds trong khe tấm',
                value: `G = ${gKhe.toFixed(2)} s⁻¹ · Re = ${re.toFixed(0)}`,
                note: 'Chảy tầng ổn định khi Re ≤ 500',
                warn: !isReOk,
              },
            ],
            tableRows: [
              {
                name: 'Tải trọng bề mặt mặt bằng (q_mb)',
                standard: `≤ ${lamella.surfaceLoadMax.toFixed(1)} m³/m²·h`,
                actual: `${qLoadActual.toFixed(2)} m³/m²·h`,
                ok: isLoadOk,
                statusText: isLoadOk ? 'Đạt chuẩn' : 'Vượt tải trọng',
              },
              {
                name: 'Thể tích bể lắng Lamen (V)',
                standard: `≥ ${vTheo.toFixed(2)} m³`,
                actual: `${actual.volume.toFixed(2)} m³`,
                ok: isVolOk,
                statusText: isVolOk ? 'Đạt chuẩn' : 'Thiếu thể tích',
              },
              {
                name: 'Chế độ chảy trong khe (Reynolds)',
                standard: 'Re ≤ 500 (Chảy tầng)',
                actual: `Re = ${re.toFixed(0)} (G = ${gKhe.toFixed(2)} s⁻¹)`,
                ok: isReOk,
                statusText: isReOk ? 'Chảy tầng' : 'Rối (trôi bông)',
              },
            ],
          };
        },
      };
    }

    // rapid_sand
    const nTanks = Math.max(1, Number(sandFilter.numTanks) || 1);
    const qPerTankHour = qHour / nTanks;
    const areaTheo =
      sandFilter.filtrationRateTarget > 0
        ? qPerTankHour / sandFilter.filtrationRateTarget
        : 0;
    const vTheo = areaTheo * sandFilter.depthH;
    const theo = interpolateTank(
      vTheo,
      sandFilter.depthH,
      sandFilter.shape,
      sandFilter.ratioLW
    );
    const defaultExtra = {};

    return {
      tabId,
      title: 'Bể lọc cát nhanh trọng lực',
      subtitle: `Thiết kế ${nTanks} ngăn lọc song song · Tự động tính bơm nước & quạt gió rửa lọc`,
      formulaText: `F_lt (1 bể) = Q_h / (${nTanks} × v_lọc) = ${areaTheo.toFixed(2)} m² · V_lt = ${vTheo.toFixed(2)} m³`,
      shape: sandFilter.shape,
      depthH: sandFilter.depthH,
      ratioLW: sandFilter.ratioLW,
      vTheo,
      theo,
      defaultExtra,
      setShape: (s) => setSandFilter((p) => ({ ...p, shape: s })),
      evaluateReverse: (actual) => {
        const velNormal = actual.area > 0 ? qPerTankHour / actual.area : 0;
        const velForced =
          nTanks > 1 && actual.area > 0
            ? qHour / ((nTanks - 1) * actual.area)
            : velNormal;

        // Bơm & Quạt rửa lọc cát cho 1 ngăn lọc (F_thực)
        const pumpLs = actual.area * sandFilter.backwashWaterRate;
        const pumpM3h = pumpLs * 3.6;
        const pumpKw =
          (9.81 * (pumpLs / 1000) * sandFilter.pumpHeadM) / 0.72;
        const washWaterVolM3 =
          actual.area *
          (sandFilter.backwashWaterRate / 1000) *
          (sandFilter.backwashTimeMin * 60);

        const airLs = actual.area * sandFilter.backwashAirRate;
        const airM3min = airLs * 0.06;
        const blowerKw =
          ((airLs / 1000) * sandFilter.blowerPressureKpa) / 0.65;

        const isVelOk =
          hydraulics.qDay > 0 &&
          velNormal > 0 &&
          velNormal <= sandFilter.filtrationRateMax;
        const isVolOk = hydraulics.qDay > 0 && actual.volume >= vTheo;

        return {
          isAllOk: isVelOk && isVolOk,
          summaryRight: `${actual.area.toFixed(2)} m²/bể · v = ${velNormal.toFixed(2)} m/h`,
          failReason: `${!isVelOk ? `Tốc độ lọc thực tế (${velNormal.toFixed(2)} m/h) vượt ngưỡng tối đa (${sandFilter.filtrationRateMax} m/h). ` : ''}${!isVolOk ? `Thể tích 1 ngăn lọc (${actual.volume.toFixed(2)} m³) < V_lt (${vTheo.toFixed(2)} m³).` : ''}`,
          extraCards: [
            {
              label: 'Tốc độ lọc thực tế (v_lọc,thực)',
              value: `${velNormal.toFixed(2)} m/h`,
              note:
                nTanks > 1
                  ? `Khi rửa 1 ngăn: ${velForced.toFixed(2)} m/h (Max ${sandFilter.filtrationRateMax})`
                  : `Giới hạn tối đa ≤ ${sandFilter.filtrationRateMax} m/h`,
              warn: !isVelOk,
            },
            {
              label: 'Bơm rửa lọc cát (1 ngăn)',
              value: `${pumpM3h.toFixed(1)} m³/h (${pumpKw.toFixed(2)} kW)`,
              note: `${pumpLs.toFixed(1)} L/s · Cần ${washWaterVolM3.toFixed(1)} m³/lần rửa`,
            },
            {
              label: 'Quạt gió sục rửa lọc (1 ngăn)',
              value: `${airM3min.toFixed(2)} m³/phút (${blowerKw.toFixed(2)} kW)`,
              note: `${airLs.toFixed(1)} L/s @ ${sandFilter.blowerPressureKpa} kPa`,
            },
          ],
          tableRows: [
            {
              name: 'Tốc độ lọc thực bình thường (v_lọc)',
              standard: `≤ ${sandFilter.filtrationRateMax.toFixed(1)} m/h`,
              actual: `${velNormal.toFixed(2)} m/h`,
              ok: isVelOk,
              statusText: isVelOk ? 'Đạt chuẩn' : 'Vượt tốc độ lọc',
            },
            {
              name: 'Diện tích lọc 1 ngăn (F)',
              standard: `≥ ${areaTheo.toFixed(2)} m²`,
              actual: `${actual.area.toFixed(2)} m²`,
              ok: actual.area >= areaTheo,
              statusText:
                actual.area >= areaTheo ? 'Đủ diện tích' : 'Nhỏ hơn lý thuyết',
            },
            {
              name: 'Bơm nước rửa lọc (Q · P)',
              standard: `${sandFilter.backwashWaterRate} L/s·m² · H = ${sandFilter.pumpHeadM} m`,
              actual: `${pumpM3h.toFixed(1)} m³/h · ${pumpKw.toFixed(2)} kW`,
              ok: true,
              statusText: `${washWaterVolM3.toFixed(1)} m³/mẻ`,
            },
            {
              name: 'Quạt gió rửa lọc (Q · P)',
              standard: `${sandFilter.backwashAirRate} L/s·m² · ${sandFilter.blowerPressureKpa} kPa`,
              actual: `${airM3min.toFixed(2)} m³/phút · ${blowerKw.toFixed(2)} kW`,
              ok: true,
              statusText: `${airLs.toFixed(1)} L/s`,
            },
          ],
        };
      },
    };
  };

  const model = buildTabModel(activeTab);
  const activeOv =
    overrides[activeTab] ??
    buildRecommendedOverride(model.theo, model.shape, model.defaultExtra);
  const actual = computeActualTank(activeOv, model.shape);
  const reverse = model.evaluateReverse(actual, activeOv);

  const handleShapeChange = (nextShape) => {
    model.setShape(nextShape);
    const nextTheo = interpolateTank(
      model.vTheo,
      model.depthH,
      nextShape,
      model.ratioLW
    );
    setOverrides((prev) => ({
      ...prev,
      [activeTab]: buildRecommendedOverride(
        nextTheo,
        nextShape,
        model.defaultExtra
      ),
    }));
  };

  const handleSnapRecommended = () => {
    setOverrides((prev) => ({
      ...prev,
      [activeTab]: buildRecommendedOverride(
        model.theo,
        model.shape,
        model.defaultExtra
      ),
    }));
  };

  const updateOv = (field, val) => {
    setOverrides((prev) => ({
      ...prev,
      [activeTab]: {
        ...activeOv,
        [field]: val,
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header & Global Q */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 text-balance">
            Xử Lý Nước Cấp Cơ Bản
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Tính toán Khử Sắt/Mangan, Trộn ziczac thủy lực, Lắng Lamen và Lọc
            cát nhanh kèm kiểm tra ngược Gradient vận tốc G, tốc độ lọc và
            bơm/quạt rửa lọc.
          </p>
        </div>

        <div className="w-full lg:w-80 rounded-xl bg-slate-800 border border-slate-700/80 p-3.5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid">
          <label
            htmlFor="water-global-q"
            className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5"
          >
            <span>Công suất trạm cấp nước (globalQ)</span>
            <span className="font-mono tabular-nums text-slate-300">
              Q = {qHour.toFixed(1)} m³/h
            </span>
          </label>
          <div className="relative flex items-center">
            <DecimalInput
              id="water-global-q"
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
        aria-label="Công trình xử lý nước cấp"
        className="print:hidden flex items-center gap-2 overflow-x-auto pb-1"
      >
        {WATER_TABS.map((tab) => {
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

      {/* 1. Design Parameters & Shape Selector */}
      <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-700/70">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              1. {model.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{model.subtitle}</p>
          </div>
          <span className="font-mono text-xs text-emerald-400 tabular-nums">
            V_lt = {model.vTheo.toFixed(2)} m³ · F_lt ={' '}
            {model.theo.area.toFixed(2)} m²
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Shape Selector Dropdown */}
          <div>
            <label
              htmlFor={`${activeTab}-shape`}
              className="block text-sm font-medium text-slate-200 mb-2"
            >
              Lựa chọn hình dạng công trình
            </label>
            <select
              id={`${activeTab}-shape`}
              value={model.shape}
              onChange={(e) => handleShapeChange(e.target.value)}
              className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
            >
              {TANK_SHAPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {activeTab === 'iron_mn' && (
            <>
              <NumberField
                id="im-fe"
                label="Hàm lượng Sắt tổng (Fe²⁺)"
                unit="mg/L"
                value={ironMn.feIn}
                min={0}
                max={50}
                step={0.5}
                onChange={(v) => setIronMn((p) => ({ ...p, feIn: v }))}
              />
              <NumberField
                id="im-mn"
                label="Hàm lượng Mangan (Mn²⁺)"
                unit="mg/L"
                value={ironMn.mnIn}
                min={0}
                max={15}
                step={0.1}
                onChange={(v) => setIronMn((p) => ({ ...p, mnIn: v }))}
              />
              <NumberField
                id="im-air"
                label="Tỷ lệ khí làm thoáng / nước"
                unit="m³/m³"
                value={ironMn.airWaterRatio}
                min={1}
                max={12}
                step={0.5}
                onChange={(v) => setIronMn((p) => ({ ...p, airWaterRatio: v }))}
                helperText="Gợi ý: Tỷ lệ Khí / Nước = 4 – 6"
              />
              <NumberField
                id="im-time"
                label="Thời gian tiếp xúc oxy hóa"
                unit="phút"
                value={ironMn.contactMin}
                min={15}
                max={60}
                step={5}
                onChange={(v) => setIronMn((p) => ({ ...p, contactMin: v }))}
              />
              <NumberField
                id="im-g"
                label="Gradient vận tốc thiết kế (G)"
                unit="s⁻¹"
                value={ironMn.gTarget}
                min={10}
                max={50}
                step={5}
                onChange={(v) => setIronMn((p) => ({ ...p, gTarget: v }))}
              />
              <NumberField
                id="im-h"
                label="Chiều sâu công tác lý thuyết (H)"
                unit="m"
                value={ironMn.depthH}
                min={1.5}
                max={6}
                step={0.1}
                onChange={(v) => setIronMn((p) => ({ ...p, depthH: v }))}
              />
            </>
          )}

          {activeTab === 'zigzag_mix' && (
            <>
              <NumberField
                id="zz-t"
                label="Thời gian lưu trộn (t)"
                unit="giây"
                value={zigzag.retentionSec}
                min={10}
                max={120}
                step={5}
                onChange={(v) => setZigzag((p) => ({ ...p, retentionSec: v }))}
                helperText="Gợi ý: 20 – 30 giây"
              />
              <NumberField
                id="zz-baffles"
                label="Số vách ngăn ziczac lý thuyết"
                unit="vách"
                value={zigzag.numBaffles}
                min={2}
                max={20}
                step={1}
                onChange={(v) =>
                  setZigzag((p) => ({
                    ...p,
                    numBaffles: Math.max(2, Math.round(v)),
                  }))
                }
              />
              <NumberField
                id="zz-vel"
                label="Vận tốc dòng qua khe mục tiêu"
                unit="m/s"
                value={zigzag.flowVelTarget}
                min={0.4}
                max={1.4}
                step={0.05}
                onChange={(v) => setZigzag((p) => ({ ...p, flowVelTarget: v }))}
                helperText="Gợi ý: 0,8 – 1,2 m/s"
              />
              <NumberField
                id="zz-temp"
                label="Nhiệt độ nước (μ)"
                unit="°C"
                value={waterTemp}
                min={5}
                max={45}
                step={1}
                onChange={setWaterTemp}
              />
              <NumberField
                id="zz-h"
                label="Chiều sâu công tác lý thuyết (H)"
                unit="m"
                value={zigzag.depthH}
                min={0.8}
                max={4}
                step={0.1}
                onChange={(v) => setZigzag((p) => ({ ...p, depthH: v }))}
              />
            </>
          )}

          {activeTab === 'lamella' && (
            <>
              <NumberField
                id="lm-q"
                label="Tải trọng bề mặt thiết kế (q_mb)"
                unit="m³/m²·h"
                value={lamella.surfaceLoadTarget}
                min={2}
                max={10}
                step={0.5}
                onChange={(v) =>
                  setLamella((p) => ({ ...p, surfaceLoadTarget: v }))
                }
                helperText="Gợi ý: 4,0 – 6,0 m³/m²·h"
              />
              <NumberField
                id="lm-qmax"
                label="Giới hạn tải trọng tối đa"
                unit="m³/m²·h"
                value={lamella.surfaceLoadMax}
                min={4}
                max={12}
                step={0.5}
                onChange={(v) =>
                  setLamella((p) => ({ ...p, surfaceLoadMax: v }))
                }
              />
              <NumberField
                id="lm-angle"
                label="Góc nghiêng tấm Lamella (α)"
                unit="độ"
                value={lamella.plateAngleDeg}
                min={45}
                max={75}
                step={5}
                onChange={(v) =>
                  setLamella((p) => ({ ...p, plateAngleDeg: v }))
                }
                helperText="Gợi ý: 60° (thường chọn 55° – 60°)"
              />
              <NumberField
                id="lm-space"
                label="Khoảng cách giữa các tấm (d)"
                unit="mm"
                value={lamella.plateSpacingMm}
                min={25}
                max={100}
                step={5}
                onChange={(v) =>
                  setLamella((p) => ({ ...p, plateSpacingMm: v }))
                }
              />
              <NumberField
                id="lm-h"
                label="Chiều sâu bể lắng lý thuyết (H)"
                unit="m"
                value={lamella.depthH}
                min={2.5}
                max={6.5}
                step={0.1}
                onChange={(v) => setLamella((p) => ({ ...p, depthH: v }))}
              />
            </>
          )}

          {activeTab === 'rapid_sand' && (
            <>
              <NumberField
                id="rs-num"
                label="Số ngăn lọc cát song song"
                unit="ngăn"
                value={sandFilter.numTanks}
                min={1}
                max={12}
                step={1}
                onChange={(v) =>
                  setSandFilter((p) => ({
                    ...p,
                    numTanks: Math.max(1, Math.round(v)),
                  }))
                }
              />
              <NumberField
                id="rs-vel"
                label="Tốc độ lọc thiết kế (v_lọc)"
                unit="m/h"
                value={sandFilter.filtrationRateTarget}
                min={3}
                max={12}
                step={0.5}
                onChange={(v) =>
                  setSandFilter((p) => ({ ...p, filtrationRateTarget: v }))
                }
                helperText="Gợi ý: 5 – 10 m/h"
              />
              <NumberField
                id="rs-vmax"
                label="Giới hạn tốc độ lọc tối đa"
                unit="m/h"
                value={sandFilter.filtrationRateMax}
                min={5}
                max={15}
                step={0.5}
                onChange={(v) =>
                  setSandFilter((p) => ({ ...p, filtrationRateMax: v }))
                }
              />
              <NumberField
                id="rs-bw-w"
                label="Cường độ nước rửa lọc cát"
                unit="L/s·m²"
                value={sandFilter.backwashWaterRate}
                min={10}
                max={20}
                step={0.5}
                onChange={(v) =>
                  setSandFilter((p) => ({ ...p, backwashWaterRate: v }))
                }
                helperText="Gợi ý: 12 – 15 L/s·m²"
              />
              <NumberField
                id="rs-bw-a"
                label="Cường độ gió sục rửa lọc"
                unit="L/s·m²"
                value={sandFilter.backwashAirRate}
                min={10}
                max={25}
                step={0.5}
                onChange={(v) =>
                  setSandFilter((p) => ({ ...p, backwashAirRate: v }))
                }
              />
              <NumberField
                id="rs-pump-h"
                label="Cột áp bơm rửa lọc"
                unit="m"
                value={sandFilter.pumpHeadM}
                min={6}
                max={20}
                step={1}
                onChange={(v) =>
                  setSandFilter((p) => ({ ...p, pumpHeadM: v }))
                }
              />
              <NumberField
                id="rs-h"
                label="Chiều cao bể lọc lý thuyết (H)"
                unit="m"
                value={sandFilter.depthH}
                min={2.2}
                max={5.0}
                step={0.1}
                onChange={(v) => setSandFilter((p) => ({ ...p, depthH: v }))}
              />
            </>
          )}

          {model.shape === 'Chữ nhật' && (
            <NumberField
              id={`${activeTab}-ratio`}
              label="Tỷ lệ Dài / Rộng (L/W)"
              unit="L/W"
              value={model.ratioLW}
              min={1}
              max={5}
              step={0.1}
              onChange={(v) => {
                if (activeTab === 'iron_mn') setIronMn((p) => ({ ...p, ratioLW: v }));
                else if (activeTab === 'zigzag_mix') setZigzag((p) => ({ ...p, ratioLW: v }));
                else if (activeTab === 'lamella') setLamella((p) => ({ ...p, ratioLW: v }));
                else setSandFilter((p) => ({ ...p, ratioLW: v }));
              }}
            />
          )}
        </div>

        <div className="pt-3 border-t border-slate-700/70 text-xs font-mono text-slate-400">
          {model.formulaText}
        </div>
      </section>

      {/* 2. Theoretical Interpolated Sizing & Unit KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
            F_lt = {model.theo.area.toFixed(2)} m² · V_lt ={' '}
            {model.vTheo.toFixed(2)} m³
          </div>
        </div>

        {reverse.extraCards.map((card) => (
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

      {/* 3. Construction Override & Reverse Check */}
      <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-5 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              2. Chốt kích thước chọn thi công & Kiểm tra ngược
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Nhập đè kích thước chẵn ({model.shape}) để hệ thống tính ngược lại
              Gradient vận tốc G, tốc độ lọc thực và kiểm tra ngưỡng.
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {model.shape === 'Chữ nhật' && (
            <>
              <NumberField
                id={`${activeTab}-ov-L`}
                label="Chiều dài chọn (L)"
                unit="m"
                value={activeOv.L}
                min={0}
                max={60}
                step={0.1}
                onChange={(v) => updateOv('L', v)}
              />
              <NumberField
                id={`${activeTab}-ov-W`}
                label="Chiều rộng chọn (W)"
                unit="m"
                value={activeOv.W}
                min={0}
                max={60}
                step={0.1}
                onChange={(v) => updateOv('W', v)}
              />
            </>
          )}

          {model.shape === 'Vuông' && (
            <NumberField
              id={`${activeTab}-ov-a`}
              label="Cạnh bể chọn (a)"
              unit="m"
              value={activeOv.a}
              min={0}
              max={60}
              step={0.1}
              onChange={(v) => updateOv('a', v)}
            />
          )}

          {model.shape === 'Tròn' && (
            <NumberField
              id={`${activeTab}-ov-D`}
              label="Đường kính chọn (D)"
              unit="m"
              value={activeOv.D}
              min={0}
              max={60}
              step={0.1}
              onChange={(v) => updateOv('D', v)}
            />
          )}

          <NumberField
            id={`${activeTab}-ov-H`}
            label="Chiều sâu công tác chọn (H)"
            unit="m"
            value={activeOv.H}
            min={0}
            max={15}
            step={0.1}
            onChange={(v) => updateOv('H', v)}
          />

          {activeTab === 'iron_mn' && (
            <NumberField
              id="im-ov-kw"
              label="Công suất khuấy / sục khí chọn"
              unit="kW"
              value={activeOv.motorKw ?? model.defaultExtra.motorKw}
              min={0}
              max={50}
              step={0.1}
              onChange={(v) => updateOv('motorKw', v)}
            />
          )}

          {activeTab === 'zigzag_mix' && (
            <NumberField
              id="zz-ov-baffles"
              label="Số vách ngăn ziczac chọn"
              unit="vách"
              value={activeOv.bafflesActual ?? zigzag.numBaffles}
              min={2}
              max={24}
              step={1}
              onChange={(v) =>
                updateOv('bafflesActual', Math.max(2, Math.round(v)))
              }
            />
          )}
        </div>

        {/* Status Alert Banner */}
        <StatusBanner
          ok={reverse.isAllOk}
          titleOk="ĐẠT CHUẨN THIẾT KẾ CẤP NƯỚC"
          titleFail="CẢNH BÁO ĐỎ: THÔNG SỐ VƯỢT NGƯỠNG CHO PHÉP"
          summaryLabel="Kết quả thực tế"
          message={
            reverse.isAllOk
              ? 'Các thông số thể tích, vận tốc, Gradient G / tốc độ lọc thực tế đều nằm trong dải chuẩn thiết kế.'
              : reverse.failReason
          }
          summaryRight={reverse.summaryRight}
        />

        <CheckTable rows={reverse.tableRows} />
      </section>

      <EquipmentSelector
        key={`omnieco_equipments_watersupplybasic_${activeTab}`}
        moduleLabel={
          WATER_BASIC_EQUIPMENT_LABELS[activeTab] || 'Công trình Nước cấp'
        }
        storageKey={`omnieco_equipments_watersupplybasic_${activeTab}`}
      />
    </div>
  );
}
