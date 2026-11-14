import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AppContext = createContext(null);

export const STORAGE_KEY = 'envirocalc_global_state_v1';

export const FLOW_PRESETS = [
  { label: '100 m³/ngày', value: 100, note: 'Trạm quy mô nhỏ' },
  { label: '500 m³/ngày', value: 500, note: 'Khu dân cư / Nhà máy vừa' },
  { label: '1.000 m³/ngày', value: 1000, note: 'Cụm công nghiệp nhỏ' },
  { label: '2.500 m³/ngày', value: 2500, note: 'Khu công nghiệp tiêu chuẩn' },
  { label: '5.000 m³/ngày', value: 5000, note: 'Nhà máy xử lý tập trung' },
];

const DEFAULT_BIO_QUALITY = {
  tempC: 25,
  bodIn: 250,
  bodOut: 20,
  nh4In: 45,
  nh4Out: 5,
  hasAnoxic: true,
  no3DenitrifiedMgL: 28,
};

function loadInitialState() {
  const fallback = {
    globalQ: 1000,
    peakingFactor: 1.5,
    bioQuality: DEFAULT_BIO_QUALITY,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const q = Number(parsed?.globalQ);
    const k = Number(parsed?.peakingFactor);
    const bq = parsed?.bioQuality || {};

    return {
      globalQ: Number.isFinite(q) && q >= 0 ? q : fallback.globalQ,
      peakingFactor:
        Number.isFinite(k) && k >= 1 && k <= 5 ? k : fallback.peakingFactor,
      bioQuality: {
        tempC: Number.isFinite(Number(bq.tempC))
          ? Number(bq.tempC)
          : DEFAULT_BIO_QUALITY.tempC,
        bodIn: Number.isFinite(Number(bq.bodIn))
          ? Number(bq.bodIn)
          : DEFAULT_BIO_QUALITY.bodIn,
        bodOut: Number.isFinite(Number(bq.bodOut))
          ? Number(bq.bodOut)
          : DEFAULT_BIO_QUALITY.bodOut,
        nh4In: Number.isFinite(Number(bq.nh4In))
          ? Number(bq.nh4In)
          : DEFAULT_BIO_QUALITY.nh4In,
        nh4Out: Number.isFinite(Number(bq.nh4Out))
          ? Number(bq.nh4Out)
          : DEFAULT_BIO_QUALITY.nh4Out,
        hasAnoxic:
          typeof bq.hasAnoxic === 'boolean'
            ? bq.hasAnoxic
            : DEFAULT_BIO_QUALITY.hasAnoxic,
        no3DenitrifiedMgL: Number.isFinite(Number(bq.no3DenitrifiedMgL))
          ? Number(bq.no3DenitrifiedMgL)
          : DEFAULT_BIO_QUALITY.no3DenitrifiedMgL,
      },
    };
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }) {
  const [initial] = useState(loadInitialState);
  const [globalQ, setGlobalQState] = useState(initial.globalQ);
  const [peakingFactor, setPeakingFactorState] = useState(
    initial.peakingFactor
  );
  const [bioQuality, setBioQuality] = useState(initial.bioQuality);
  const [bioFocusSignal, setBioFocusSignal] = useState(0);

  // Tự động lưu Global State vào localStorage mỗi khi thay đổi
  useEffect(() => {
    try {
      const payload = {
        globalQ,
        peakingFactor,
        bioQuality,
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [globalQ, peakingFactor, bioQuality]);

  const setGlobalQ = (nextValue) => {
    const parsed = Number(nextValue);
    if (Number.isNaN(parsed) || parsed < 0) {
      setGlobalQState(0);
      return;
    }
    setGlobalQState(parsed);
  };

  const setPeakingFactor = (nextFactor) => {
    const parsed = Number(nextFactor);
    if (Number.isNaN(parsed) || parsed < 1) {
      setPeakingFactorState(1);
      return;
    }
    setPeakingFactorState(Math.min(parsed, 5));
  };

  const resetDefaults = () => {
    setGlobalQState(1000);
    setPeakingFactorState(1.5);
    setBioQuality(DEFAULT_BIO_QUALITY);
  };

  const triggerBiologyFocus = () => {
    setBioFocusSignal((n) => n + 1);
  };

  const exportProjectJson = () => {
    const payload = {
      app: 'EnviroCalc',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      state: {
        globalQ,
        peakingFactor,
        bioQuality,
      },
    };
    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `envirocalc-thiet-ke-${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importProjectJson = (rawText) => {
    try {
      const parsed = JSON.parse(rawText);
      const source = parsed?.state ? parsed.state : parsed;
      if (
        !source ||
        typeof source !== 'object' ||
        typeof source.globalQ === 'undefined'
      ) {
        return {
          ok: false,
          message:
            'File JSON không đúng định dạng thiết kế EnviroCalc (thiếu globalQ).',
        };
      }
      const nextQ = Number(source.globalQ);
      if (!Number.isFinite(nextQ) || nextQ < 0) {
        return {
          ok: false,
          message: 'Giá trị globalQ trong file JSON không hợp lệ.',
        };
      }
      setGlobalQ(nextQ);

      if (typeof source.peakingFactor !== 'undefined') {
        setPeakingFactor(source.peakingFactor);
      }
      if (source.bioQuality && typeof source.bioQuality === 'object') {
        const bq = source.bioQuality;
        setBioQuality((prev) => ({
          tempC: Number.isFinite(Number(bq.tempC))
            ? Number(bq.tempC)
            : prev.tempC,
          bodIn: Number.isFinite(Number(bq.bodIn))
            ? Number(bq.bodIn)
            : prev.bodIn,
          bodOut: Number.isFinite(Number(bq.bodOut))
            ? Number(bq.bodOut)
            : prev.bodOut,
          nh4In: Number.isFinite(Number(bq.nh4In))
            ? Number(bq.nh4In)
            : prev.nh4In,
          nh4Out: Number.isFinite(Number(bq.nh4Out))
            ? Number(bq.nh4Out)
            : prev.nh4Out,
          hasAnoxic:
            typeof bq.hasAnoxic === 'boolean' ? bq.hasAnoxic : prev.hasAnoxic,
          no3DenitrifiedMgL: Number.isFinite(Number(bq.no3DenitrifiedMgL))
            ? Number(bq.no3DenitrifiedMgL)
            : prev.no3DenitrifiedMgL,
        }));
      }

      return {
        ok: true,
        message: `Đã nhập thành công hồ sơ JSON (Q = ${nextQ.toLocaleString('vi-VN')} m³/ngày).`,
      };
    } catch {
      return {
        ok: false,
        message: 'Không thể đọc file JSON. Vui lòng kiểm tra cú pháp file.',
      };
    }
  };

  const hydraulics = useMemo(() => {
    const qDay = Math.max(0, Number(globalQ) || 0);
    const qHour = qDay / 24;
    const qSecond = (qDay * 1000) / 86400;
    const qMaxHour = qHour * peakingFactor;
    const qMaxSecond = qSecond * peakingFactor;

    const qMaxM3s = qMaxSecond / 1000;
    const velocityTarget = 0.8;
    const pipeDiameterMm =
      qMaxM3s > 0
        ? Math.sqrt((4 * qMaxM3s) / (Math.PI * velocityTarget)) * 1000
        : 0;

    return {
      qDay,
      qHour,
      qSecond,
      qMaxHour,
      qMaxSecond,
      pipeDiameterMm,
      velocityTarget,
    };
  }, [globalQ, peakingFactor]);

  const biologyNod = useMemo(() => {
    const qDay = hydraulics.qDay;
    const deltaNh4 = Math.max(
      0,
      (Number(bioQuality.nh4In) || 0) - (Number(bioQuality.nh4Out) || 0)
    );
    const nh4RemovedKgDay = (qDay * deltaNh4) / 1000;
    const nodKgDay = 4.57 * nh4RemovedKgDay;
    const nodKgHour = nodKgDay / 24;

    const effectiveNo3MgL = bioQuality.hasAnoxic
      ? Math.min(deltaNh4, Math.max(0, Number(bioQuality.no3DenitrifiedMgL) || 0))
      : 0;
    const no3DenitrifiedKgDay = (qDay * effectiveNo3MgL) / 1000;
    const o2CreditKgDay = 2.86 * no3DenitrifiedKgDay;

    return {
      deltaNh4,
      nh4RemovedKgDay,
      nodKgDay,
      nodKgHour,
      no3DenitrifiedKgDay,
      o2CreditKgDay,
      o2CreditKgHour: o2CreditKgDay / 24,
    };
  }, [hydraulics.qDay, bioQuality]);

  const value = useMemo(
    () => ({
      globalQ,
      setGlobalQ,
      peakingFactor,
      setPeakingFactor,
      hydraulics,
      bioQuality,
      setBioQuality,
      biologyNod,
      bioFocusSignal,
      triggerBiologyFocus,
      resetDefaults,
      exportProjectJson,
      importProjectJson,
    }),
    [
      globalQ,
      peakingFactor,
      hydraulics,
      bioQuality,
      biologyNod,
      bioFocusSignal,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
