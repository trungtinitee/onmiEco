import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const AppContext = createContext(null);
const AppActionsContext = createContext(null);

export const STORAGE_KEY = 'envirocalc_global_state_v1';
export const PROJECTS_STORAGE_KEY = 'omniEco_Projects';
export const ACTIVE_PROJECT_STORAGE_KEY = 'omniEco_ActiveProjectId';
export const DEFAULT_PROJECT_ID = 'default-project';

function createDefaultProject() {
  return {
    id: DEFAULT_PROJECT_ID,
    name: 'Dự án mặc định',
    createdAt: new Date().toISOString(),
  };
}

function createProjectId() {
  return `prj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function migrateLegacyProjectDataIfNeeded() {
  if (typeof window === 'undefined') return;
  try {
    const defaultBomKey = `omniEco_BOM_${DEFAULT_PROJECT_ID}`;
    const legacyBom = window.localStorage.getItem('omnieco_project_procurement');
    if (legacyBom !== null && window.localStorage.getItem(defaultBomKey) === null) {
      window.localStorage.setItem(defaultBomKey, legacyBom);
    }

    const defaultLogsKey = `omniEco_Logs_${DEFAULT_PROJECT_ID}`;
    const legacyLogs = window.localStorage.getItem('dvn_operation_logs');
    if (legacyLogs !== null && window.localStorage.getItem(defaultLogsKey) === null) {
      window.localStorage.setItem(defaultLogsKey, legacyLogs);
    }
  } catch {
    // Ignore storage errors safely
  }
}

function loadInitialProjects() {
  const fallbackList = [createDefaultProject()];
  if (typeof window === 'undefined') {
    return {
      projectList: fallbackList,
      activeProjectId: fallbackList[0].id,
    };
  }

  migrateLegacyProjectDataIfNeeded();

  let projectList = fallbackList;
  try {
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .filter((p) => p && typeof p === 'object' && p.id && p.name)
          .map((p) => ({
            id: String(p.id),
            name: String(p.name).trim() || 'Dự án không tên',
            createdAt: p.createdAt ? String(p.createdAt) : new Date().toISOString(),
          }));
        if (normalized.length > 0) {
          projectList = normalized;
        }
      }
    }
  } catch {
    projectList = fallbackList;
  }

  try {
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projectList));
  } catch {
    // Ignore storage quota errors
  }

  let activeProjectId = projectList[0].id;
  try {
    const savedActiveId = window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
    if (savedActiveId && projectList.some((p) => p.id === savedActiveId)) {
      activeProjectId = savedActiveId;
    } else {
      window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, activeProjectId);
    }
  } catch {
    // Ignore storage errors
  }

  return { projectList, activeProjectId };
}

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

const DEFAULT_WASTEWATER_POLLUTANTS = {
  bod5: 250,
  cod: 500,
  ss: 220,
  tn: 45,
  tp: 8,
};

function loadInitialState() {
  const fallback = {
    globalQ: 1000,
    peakingFactor: 1.5,
    bioQuality: DEFAULT_BIO_QUALITY,
    wastewaterPollutants: DEFAULT_WASTEWATER_POLLUTANTS,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const q = Number(parsed?.globalQ);
    const k = Number(parsed?.peakingFactor);
    const bq = parsed?.bioQuality || {};
    const wp = parsed?.wastewaterPollutants || {};

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
      wastewaterPollutants: {
        bod5: Number.isFinite(Number(wp.bod5))
          ? Math.max(0, Number(wp.bod5))
          : DEFAULT_WASTEWATER_POLLUTANTS.bod5,
        cod: Number.isFinite(Number(wp.cod))
          ? Math.max(0, Number(wp.cod))
          : DEFAULT_WASTEWATER_POLLUTANTS.cod,
        ss: Number.isFinite(Number(wp.ss))
          ? Math.max(0, Number(wp.ss))
          : DEFAULT_WASTEWATER_POLLUTANTS.ss,
        tn: Number.isFinite(Number(wp.tn))
          ? Math.max(0, Number(wp.tn))
          : DEFAULT_WASTEWATER_POLLUTANTS.tn,
        tp: Number.isFinite(Number(wp.tp))
          ? Math.max(0, Number(wp.tp))
          : DEFAULT_WASTEWATER_POLLUTANTS.tp,
      },
    };
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }) {
  const [initial] = useState(loadInitialState);
  const [initialProjects] = useState(loadInitialProjects);
  const [projectList, setProjectList] = useState(initialProjects.projectList);
  const [currentProjectId, setCurrentProjectId] = useState(
    initialProjects.activeProjectId
  );

  const [globalQ, setGlobalQState] = useState(initial.globalQ);
  const [peakingFactor, setPeakingFactorState] = useState(
    initial.peakingFactor
  );
  const [bioQuality, setBioQuality] = useState(initial.bioQuality);
  const [wastewaterPollutants, setWastewaterPollutants] = useState(
    initial.wastewaterPollutants
  );
  const [bioFocusSignal, setBioFocusSignal] = useState(0);

  const currentProject = useMemo(
    () =>
      projectList.find((p) => p.id === currentProjectId) ||
      projectList[0] ||
      createDefaultProject(),
    [projectList, currentProjectId]
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projectList));
    } catch {
      // Ignore storage quota errors
    }
  }, [projectList]);

  useEffect(() => {
    if (!currentProject?.id) return;
    try {
      window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, currentProject.id);
    } catch {
      // Ignore storage quota errors
    }
  }, [currentProject?.id]);

  const selectProject = useCallback(
    (projectId) => {
      if (!projectId) return;
      setCurrentProjectId((prev) => {
        if (projectList.some((p) => p.id === projectId)) {
          return projectId;
        }
        return prev;
      });
    },
    [projectList]
  );

  const createProject = useCallback((rawName) => {
    const trimmed = String(rawName || '').trim();
    if (!trimmed) {
      return { ok: false, message: 'Vui lòng nhập tên dự án.' };
    }
    const newProject = {
      id: createProjectId(),
      name: trimmed,
      createdAt: new Date().toISOString(),
    };
    setProjectList((prev) => [...prev, newProject]);
    setCurrentProjectId(newProject.id);
    return { ok: true, project: newProject };
  }, []);

  const deleteProject = useCallback(
    (projectId) => {
      if (projectList.length <= 1) {
        return {
          ok: false,
          message: 'Không thể xóa dự án cuối cùng trong hệ thống.',
        };
      }
      const nextList = projectList.filter((p) => p.id !== projectId);
      if (nextList.length === projectList.length) {
        return { ok: false, message: 'Không tìm thấy dự án cần xóa.' };
      }

      setProjectList(nextList);
      if (currentProject?.id === projectId) {
        setCurrentProjectId(nextList[0].id);
      }

      try {
        window.localStorage.removeItem(`omniEco_BOM_${projectId}`);
        window.localStorage.removeItem(`omniEco_Logs_${projectId}`);
      } catch {
        // Ignore storage errors
      }

      return { ok: true };
    },
    [projectList, currentProject?.id]
  );

  // Tự động lưu Global State vào localStorage mỗi khi thay đổi
  useEffect(() => {
    try {
      const payload = {
        globalQ,
        peakingFactor,
        bioQuality,
        wastewaterPollutants,
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [globalQ, peakingFactor, bioQuality, wastewaterPollutants]);

  const setGlobalQ = useCallback((nextValue) => {
    const parsed = Number(nextValue);
    if (Number.isNaN(parsed) || parsed < 0) {
      setGlobalQState(0);
      return;
    }
    setGlobalQState(parsed);
  }, []);

  const setPeakingFactor = useCallback((nextFactor) => {
    const parsed = Number(nextFactor);
    if (Number.isNaN(parsed) || parsed < 1) {
      setPeakingFactorState(1);
      return;
    }
    setPeakingFactorState(Math.min(parsed, 5));
  }, []);

  const resetDefaults = useCallback(() => {
    setGlobalQState(1000);
    setPeakingFactorState(1.5);
    setBioQuality(DEFAULT_BIO_QUALITY);
    setWastewaterPollutants(DEFAULT_WASTEWATER_POLLUTANTS);
  }, []);

  const triggerBiologyFocus = useCallback(() => {
    setBioFocusSignal((n) => n + 1);
  }, []);

  const exportProjectJson = useCallback(() => {
    const payload = {
      app: 'OmniEco',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      state: {
        globalQ,
        peakingFactor,
        bioQuality,
        wastewaterPollutants,
      },
    };
    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `omnieco-thiet-ke-${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [globalQ, peakingFactor, bioQuality, wastewaterPollutants]);

  const importProjectJson = useCallback(
    (rawText) => {
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
              'File JSON không đúng định dạng thiết kế OmniEco (thiếu globalQ).',
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
        if (
          source.wastewaterPollutants &&
          typeof source.wastewaterPollutants === 'object'
        ) {
          const wp = source.wastewaterPollutants;
          setWastewaterPollutants((prev) => ({
            bod5: Number.isFinite(Number(wp.bod5))
              ? Math.max(0, Number(wp.bod5))
              : prev.bod5,
            cod: Number.isFinite(Number(wp.cod))
              ? Math.max(0, Number(wp.cod))
              : prev.cod,
            ss: Number.isFinite(Number(wp.ss))
              ? Math.max(0, Number(wp.ss))
              : prev.ss,
            tn: Number.isFinite(Number(wp.tn))
              ? Math.max(0, Number(wp.tn))
              : prev.tn,
            tp: Number.isFinite(Number(wp.tp))
              ? Math.max(0, Number(wp.tp))
              : prev.tp,
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
    },
    [setGlobalQ, setPeakingFactor]
  );

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

  const stableActions = useMemo(
    () => ({
      selectProject,
      createProject,
      deleteProject,
      setGlobalQ,
      setPeakingFactor,
      setBioQuality,
      setWastewaterPollutants,
      triggerBiologyFocus,
      resetDefaults,
      importProjectJson,
    }),
    [
      selectProject,
      createProject,
      deleteProject,
      setGlobalQ,
      setPeakingFactor,
      triggerBiologyFocus,
      resetDefaults,
      importProjectJson,
    ]
  );

  const value = useMemo(
    () => ({
      projectList,
      currentProject,
      selectProject,
      createProject,
      deleteProject,
      globalQ,
      setGlobalQ,
      peakingFactor,
      setPeakingFactor,
      hydraulics,
      bioQuality,
      setBioQuality,
      wastewaterPollutants,
      setWastewaterPollutants,
      biologyNod,
      bioFocusSignal,
      triggerBiologyFocus,
      resetDefaults,
      exportProjectJson,
      importProjectJson,
    }),
    [
      projectList,
      currentProject,
      selectProject,
      createProject,
      deleteProject,
      globalQ,
      setGlobalQ,
      peakingFactor,
      setPeakingFactor,
      hydraulics,
      bioQuality,
      wastewaterPollutants,
      biologyNod,
      bioFocusSignal,
      triggerBiologyFocus,
      resetDefaults,
      exportProjectJson,
      importProjectJson,
    ]
  );

  return (
    <AppActionsContext.Provider value={stableActions}>
      <AppContext.Provider value={value}>{children}</AppContext.Provider>
    </AppActionsContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

export function useAppActions() {
  const actions = useContext(AppActionsContext);
  if (!actions) {
    throw new Error('useAppActions must be used within an AppProvider');
  }
  return actions;
}
