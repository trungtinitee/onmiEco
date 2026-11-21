import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { markLegacyEqMigrated, safeSetItem } from '../utils/storage';

const AppContext = createContext(null);
const AppActionsContext = createContext(null);

export const STORAGE_KEY = 'envirocalc_global_state_v1';
export const PROJECTS_STORAGE_KEY = 'omniEco_Projects';
export const ACTIVE_PROJECT_STORAGE_KEY = 'omniEco_ActiveProjectId';
export const PRINT_OPTIONS_STORAGE_KEY = 'omniEco_PrintOptions';
export const THEME_STORAGE_KEY = 'omniEco_Theme';
export const DEFAULT_PROJECT_ID = 'default-project';
export const DEFAULT_CONTRACTOR_NAME =
  'Công ty TNHH Tư vấn - Đầu tư Môi trường D-V-N';

export const getDesignStorageKey = (projectId) =>
  `omniEco_Design_${projectId || DEFAULT_PROJECT_ID}`;

export const DEFAULT_PRINT_OPTIONS = {
  showCompanyHeader: true,
  showProjectInfo: true,
  showDetailedNotes: true,
  showSignatures: true,
};

function loadInitialPrintOptions() {
  if (typeof window === 'undefined') return DEFAULT_PRINT_OPTIONS;
  try {
    const raw = window.localStorage.getItem(PRINT_OPTIONS_STORAGE_KEY);
    if (!raw) return DEFAULT_PRINT_OPTIONS;
    const parsed = JSON.parse(raw);
    return {
      showCompanyHeader:
        typeof parsed?.showCompanyHeader === 'boolean'
          ? parsed.showCompanyHeader
          : true,
      showProjectInfo:
        typeof parsed?.showProjectInfo === 'boolean'
          ? parsed.showProjectInfo
          : true,
      showDetailedNotes:
        typeof parsed?.showDetailedNotes === 'boolean'
          ? parsed.showDetailedNotes
          : true,
      showSignatures:
        typeof parsed?.showSignatures === 'boolean'
          ? parsed.showSignatures
          : true,
    };
  } catch {
    return DEFAULT_PRINT_OPTIONS;
  }
}

function loadInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light'
      ? 'light'
      : 'dark';
  } catch {
    return 'dark';
  }
}

function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return;
  const normalized = theme === 'light' ? 'light' : 'dark';
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(normalized);
  root.style.colorScheme = normalized;
}

function createDefaultProject() {
  return {
    id: DEFAULT_PROJECT_ID,
    name: 'Dự án mặc định',
    contractor: DEFAULT_CONTRACTOR_NAME,
    investor: '',
    location: '',
    capacity: '',
    notes: '',
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
      safeSetItem(defaultBomKey, legacyBom);
    }

    const defaultLogsKey = `omniEco_Logs_${DEFAULT_PROJECT_ID}`;
    const legacyLogs = window.localStorage.getItem('dvn_operation_logs');
    if (legacyLogs !== null && window.localStorage.getItem(defaultLogsKey) === null) {
      safeSetItem(defaultLogsKey, legacyLogs);
    }

    const defaultDesignKey = getDesignStorageKey(DEFAULT_PROJECT_ID);
    const legacyDesign = window.localStorage.getItem(STORAGE_KEY);
    if (
      legacyDesign !== null &&
      window.localStorage.getItem(defaultDesignKey) === null
    ) {
      safeSetItem(defaultDesignKey, legacyDesign);
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
            contractor:
              p.contractor !== undefined && p.contractor !== null
                ? String(p.contractor).trim()
                : DEFAULT_CONTRACTOR_NAME,
            investor: String(p.investor || ''),
            location: String(p.location || ''),
            capacity: String(p.capacity || ''),
            notes: String(p.notes || ''),
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

  safeSetItem(PROJECTS_STORAGE_KEY, JSON.stringify(projectList));

  let activeProjectId = projectList[0].id;
  try {
    const savedActiveId = window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
    if (savedActiveId && projectList.some((p) => p.id === savedActiveId)) {
      activeProjectId = savedActiveId;
    } else {
      safeSetItem(ACTIVE_PROJECT_STORAGE_KEY, activeProjectId);
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

function createDefaultDesignData() {
  return {
    globalQ: 1000,
    peakingFactor: 1.5,
    bioQuality: { ...DEFAULT_BIO_QUALITY },
    wastewaterPollutants: { ...DEFAULT_WASTEWATER_POLLUTANTS },
  };
}

function normalizeDesignData(parsed, fallback = createDefaultDesignData()) {
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
        : fallback.bioQuality.tempC,
      bodIn: Number.isFinite(Number(bq.bodIn))
        ? Number(bq.bodIn)
        : fallback.bioQuality.bodIn,
      bodOut: Number.isFinite(Number(bq.bodOut))
        ? Number(bq.bodOut)
        : fallback.bioQuality.bodOut,
      nh4In: Number.isFinite(Number(bq.nh4In))
        ? Number(bq.nh4In)
        : fallback.bioQuality.nh4In,
      nh4Out: Number.isFinite(Number(bq.nh4Out))
        ? Number(bq.nh4Out)
        : fallback.bioQuality.nh4Out,
      hasAnoxic:
        typeof bq.hasAnoxic === 'boolean'
          ? bq.hasAnoxic
          : fallback.bioQuality.hasAnoxic,
      no3DenitrifiedMgL: Number.isFinite(Number(bq.no3DenitrifiedMgL))
        ? Number(bq.no3DenitrifiedMgL)
        : fallback.bioQuality.no3DenitrifiedMgL,
    },
    wastewaterPollutants: {
      bod5: Number.isFinite(Number(wp.bod5))
        ? Math.max(0, Number(wp.bod5))
        : fallback.wastewaterPollutants.bod5,
      cod: Number.isFinite(Number(wp.cod))
        ? Math.max(0, Number(wp.cod))
        : fallback.wastewaterPollutants.cod,
      ss: Number.isFinite(Number(wp.ss))
        ? Math.max(0, Number(wp.ss))
        : fallback.wastewaterPollutants.ss,
      tn: Number.isFinite(Number(wp.tn))
        ? Math.max(0, Number(wp.tn))
        : fallback.wastewaterPollutants.tn,
      tp: Number.isFinite(Number(wp.tp))
        ? Math.max(0, Number(wp.tp))
        : fallback.wastewaterPollutants.tp,
    },
  };
}

function slugifyProjectName(name) {
  const normalized = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return normalized || 'du-an';
}

function getCompactDateStamp(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function safeReadJsonKey(key, fallback) {
  if (typeof window === 'undefined' || !key) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function loadProjectDesignData(projectId) {
  const fallback = createDefaultDesignData();
  if (typeof window === 'undefined') return fallback;
  const resolvedId = projectId || DEFAULT_PROJECT_ID;
  const designKey = getDesignStorageKey(resolvedId);
  try {
    let raw = window.localStorage.getItem(designKey);
    if (raw === null && resolvedId === DEFAULT_PROJECT_ID) {
      const legacyRaw = window.localStorage.getItem(STORAGE_KEY);
      if (legacyRaw !== null) {
        safeSetItem(designKey, legacyRaw);
        raw = legacyRaw;
      }
    }
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return normalizeDesignData(parsed, fallback);
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }) {
  const [initialProjects] = useState(loadInitialProjects);
  const [projectList, setProjectList] = useState(initialProjects.projectList);
  const [currentProjectId, setCurrentProjectId] = useState(
    initialProjects.activeProjectId
  );

  const [designState, setDesignState] = useState(() => ({
    projectId: initialProjects.activeProjectId,
    data: loadProjectDesignData(initialProjects.activeProjectId),
  }));
  const [projectDataRevision, setProjectDataRevision] = useState(0);
  const [bioFocusSignal, setBioFocusSignal] = useState(0);
  const [printOptions, setPrintOptionsState] = useState(loadInitialPrintOptions);
  const [printModalState, setPrintModalState] = useState({
    open: false,
    documentTitle: '',
  });
  const [availableUnitProcesses, setAvailableUnitProcesses] = useState([]);
  const [selectedUnitProcesses, setSelectedUnitProcesses] = useState([]);
  const [theme, setThemeState] = useState(loadInitialTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
    safeSetItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    setThemeState(nextTheme === 'light' ? 'light' : 'dark');
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const currentProject = useMemo(
    () =>
      projectList.find((p) => p.id === currentProjectId) ||
      projectList[0] ||
      createDefaultProject(),
    [projectList, currentProjectId]
  );

  const activeProjectId = currentProject.id;

  const activeDesignData = useMemo(
    () =>
      designState.projectId === activeProjectId
        ? designState.data
        : loadProjectDesignData(activeProjectId),
    [designState, activeProjectId]
  );

  const { globalQ, peakingFactor, bioQuality, wastewaterPollutants } =
    activeDesignData;

  useEffect(() => {
    safeSetItem(PROJECTS_STORAGE_KEY, JSON.stringify(projectList));
  }, [projectList]);

  useEffect(() => {
    if (!currentProject?.id) return;
    safeSetItem(ACTIVE_PROJECT_STORAGE_KEY, currentProject.id);
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

  const createProject = useCallback((rawInput) => {
    const payload =
      typeof rawInput === 'object' && rawInput !== null
        ? rawInput
        : { name: rawInput };
    const trimmed = String(payload.name || '').trim();
    if (!trimmed) {
      return { ok: false, message: 'Vui lòng nhập tên dự án.' };
    }
    const newProject = {
      id: createProjectId(),
      name: trimmed,
      contractor:
        String(payload.contractor ?? '').trim() || DEFAULT_CONTRACTOR_NAME,
      investor: String(payload.investor || '').trim(),
      location: String(payload.location || '').trim(),
      capacity: String(payload.capacity || '').trim(),
      notes: String(payload.notes || '').trim(),
      createdAt: new Date().toISOString(),
    };
    setProjectList((prev) => [...prev, newProject]);
    setCurrentProjectId(newProject.id);
    return { ok: true, project: newProject };
  }, []);

  const updateProject = useCallback(
    (projectId, updates) => {
      const trimmedName = String(updates?.name || '').trim();
      if (!trimmedName) {
        return { ok: false, message: 'Tên dự án là bắt buộc.' };
      }
      if (!projectList.some((project) => project.id === projectId)) {
        return { ok: false, message: 'Không tìm thấy dự án để cập nhật.' };
      }
      setProjectList((prev) =>
        prev.map((project) => {
          if (project.id !== projectId) return project;
          return {
            ...project,
            name: trimmedName,
            contractor: String(
              updates?.contractor ?? project.contractor ?? DEFAULT_CONTRACTOR_NAME
            ).trim(),
            investor: String(updates?.investor ?? project.investor ?? '').trim(),
            location: String(updates?.location ?? project.location ?? '').trim(),
            capacity: String(updates?.capacity ?? project.capacity ?? '').trim(),
            notes: String(updates?.notes ?? project.notes ?? '').trim(),
          };
        })
      );
      return { ok: true };
    },
    [projectList]
  );

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
        const exactKeys = new Set([
          `omniEco_BOM_${projectId}`,
          `omniEco_Logs_${projectId}`,
          `omniEco_Design_${projectId}`,
          `omniEco_GSheetUrl_${projectId}`,
        ]);
        const isDefaultProject = projectId === DEFAULT_PROJECT_ID;
        if (isDefaultProject) {
          exactKeys.add(STORAGE_KEY);
          exactKeys.add('omnieco_project_procurement');
          exactKeys.add('dvn_operation_logs');
          exactKeys.add('dvn_gsheet_url');
        }
        const eqSelPrefix = `omniEco_EqSel_${projectId}_`;
        const calcPrefix = `omniEco_Calc_${projectId}_`;
        Object.keys(window.localStorage).forEach((key) => {
          if (
            exactKeys.has(key) ||
            key.startsWith(eqSelPrefix) ||
            key.startsWith(calcPrefix) ||
            (isDefaultProject && key.startsWith('omnieco_equipments_'))
          ) {
            window.localStorage.removeItem(key);
          }
        });
        if (isDefaultProject) {
          markLegacyEqMigrated();
        }
      } catch {
        // Ignore storage errors
      }

      return { ok: true };
    },
    [projectList, currentProject?.id]
  );

  // Tự động nạp lại thông số thiết kế của dự án mới khi đổi currentProjectId
  useEffect(() => {
    setDesignState((prev) =>
      prev.projectId === activeProjectId
        ? prev
        : {
            projectId: activeProjectId,
            data: loadProjectDesignData(activeProjectId),
          }
    );
  }, [activeProjectId]);

  // Chỉ ghi localStorage khi designState.projectId khớp activeProjectId (chống ghi đè chéo dự án)
  useEffect(() => {
    if (designState.projectId !== activeProjectId) return;
    const payload = {
      ...designState.data,
      updatedAt: new Date().toISOString(),
    };
    safeSetItem(getDesignStorageKey(activeProjectId), JSON.stringify(payload));
  }, [designState, activeProjectId]);

  const updateActiveDesignData = useCallback(
    (updater) => {
      setDesignState((prev) => {
        const baseData =
          prev.projectId === activeProjectId
            ? prev.data
            : loadProjectDesignData(activeProjectId);
        const nextData =
          typeof updater === 'function' ? updater(baseData) : updater;
        return {
          projectId: activeProjectId,
          data: nextData,
        };
      });
    },
    [activeProjectId]
  );

  const setGlobalQ = useCallback(
    (nextValue) => {
      const parsed = Number(nextValue);
      const sanitized = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
      updateActiveDesignData((prev) => ({ ...prev, globalQ: sanitized }));
    },
    [updateActiveDesignData]
  );

  const setPeakingFactor = useCallback(
    (nextFactor) => {
      const parsed = Number(nextFactor);
      const sanitized =
        Number.isNaN(parsed) || parsed < 1 ? 1 : Math.min(parsed, 5);
      updateActiveDesignData((prev) => ({ ...prev, peakingFactor: sanitized }));
    },
    [updateActiveDesignData]
  );

  const setBioQuality = useCallback(
    (updater) => {
      updateActiveDesignData((prev) => ({
        ...prev,
        bioQuality:
          typeof updater === 'function' ? updater(prev.bioQuality) : updater,
      }));
    },
    [updateActiveDesignData]
  );

  const setWastewaterPollutants = useCallback(
    (updater) => {
      updateActiveDesignData((prev) => ({
        ...prev,
        wastewaterPollutants:
          typeof updater === 'function'
            ? updater(prev.wastewaterPollutants)
            : updater,
      }));
    },
    [updateActiveDesignData]
  );

  const resetDefaults = useCallback(() => {
    updateActiveDesignData(() => createDefaultDesignData());
  }, [updateActiveDesignData]);

  const triggerBiologyFocus = useCallback(() => {
    setBioFocusSignal((n) => n + 1);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    safeSetItem(PRINT_OPTIONS_STORAGE_KEY, JSON.stringify(printOptions));
  }, [printOptions]);

  const setPrintOptions = useCallback((updater) => {
    setPrintOptionsState((prev) =>
      typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
    );
  }, []);

  const availableUnitProcessesRef = useRef(availableUnitProcesses);

  useEffect(() => {
    availableUnitProcessesRef.current = availableUnitProcesses;
  }, [availableUnitProcesses]);

  const registerPrintUnitProcesses = useCallback((processes) => {
    const normalized = Array.isArray(processes)
      ? Array.from(
          new Set(
            processes.map((p) => String(p || '').trim()).filter(Boolean)
          )
        )
      : [];
    availableUnitProcessesRef.current = normalized;
    setAvailableUnitProcesses((prev) => {
      if (
        prev.length === normalized.length &&
        prev.every((item, idx) => item === normalized[idx])
      ) {
        return prev;
      }
      return normalized;
    });
    setSelectedUnitProcesses(normalized);
  }, []);

  const openPrintModal = useCallback((documentTitle = '') => {
    setSelectedUnitProcesses(availableUnitProcessesRef.current);
    setPrintModalState({
      open: true,
      documentTitle: typeof documentTitle === 'string' ? documentTitle : '',
    });
  }, []);

  const closePrintModal = useCallback(() => {
    setPrintModalState((prev) => ({ ...prev, open: false }));
  }, []);

  const confirmAndPrint = useCallback(() => {
    setPrintModalState((prev) => ({ ...prev, open: false }));
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
      });
    });
  }, []);

  const exportProjectJson = useCallback(() => {
    const projectId = activeProjectId || DEFAULT_PROJECT_ID;
    const calcPrefix = `omniEco_Calc_${projectId}_`;
    const eqSelPrefix = `omniEco_EqSel_${projectId}_`;
    const calculations = {};
    const equipmentSelections = {};

    if (typeof window !== 'undefined') {
      try {
        Object.keys(window.localStorage)
          .sort()
          .forEach((key) => {
            if (key.startsWith(calcPrefix)) {
              const suffix = key.slice(calcPrefix.length);
              if (!suffix) return;
              const raw = window.localStorage.getItem(key);
              if (raw === null) return;
              try {
                calculations[suffix] = JSON.parse(raw);
              } catch {
                // Skip corrupt calculation entry
              }
            } else if (key.startsWith(eqSelPrefix)) {
              const suffix = key.slice(eqSelPrefix.length);
              if (!suffix) return;
              const raw = window.localStorage.getItem(key);
              if (raw === null) return;
              try {
                equipmentSelections[suffix] = JSON.parse(raw);
              } catch {
                // Skip corrupt equipment selection entry
              }
            }
          });
      } catch {
        // Ignore storage read errors
      }
    }

    const storedBom = safeReadJsonKey(`omniEco_BOM_${projectId}`, []);
    const bom = Array.isArray(storedBom) ? storedBom : [];

    const storedLogs = safeReadJsonKey(`omniEco_Logs_${projectId}`, []);
    const logs = Array.isArray(storedLogs) ? storedLogs : [];

    let gsheetUrl = '';
    if (typeof window !== 'undefined') {
      try {
        const savedUrl = window.localStorage.getItem(
          `omniEco_GSheetUrl_${projectId}`
        );
        if (savedUrl !== null) {
          gsheetUrl = savedUrl;
        } else if (projectId === DEFAULT_PROJECT_ID) {
          gsheetUrl = window.localStorage.getItem('dvn_gsheet_url') || '';
        }
      } catch {
        gsheetUrl = '';
      }
    }

    const projectInfo = {
      name: currentProject?.name || 'Dự án mặc định',
      contractor:
        currentProject?.contractor !== undefined &&
        currentProject?.contractor !== null
          ? String(currentProject.contractor)
          : DEFAULT_CONTRACTOR_NAME,
      investor: String(currentProject?.investor || ''),
      location: String(currentProject?.location || ''),
      capacity: String(currentProject?.capacity || ''),
      notes: String(currentProject?.notes || ''),
    };

    const design = {
      globalQ,
      peakingFactor,
      bioQuality,
      wastewaterPollutants,
    };

    const now = new Date();
    const payload = {
      app: 'OmniEco',
      schemaVersion: 2,
      exportedAt: now.toISOString(),
      projectInfo,
      design,
      calculations,
      equipmentSelections,
      bom,
      logs,
      gsheetUrl,
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const slugProjectName = slugifyProjectName(projectInfo.name);
    const dateStamp = getCompactDateStamp(now);
    link.href = url;
    link.download = `omniEco_${slugProjectName}_${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [
    activeProjectId,
    currentProject,
    globalQ,
    peakingFactor,
    bioQuality,
    wastewaterPollutants,
  ]);

  const importProjectJson = useCallback(
    (rawText) => {
      try {
        const parsed = JSON.parse(rawText);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return {
            ok: false,
            message: 'File JSON không hợp lệ. Vui lòng kiểm tra lại định dạng file.',
          };
        }

        const projectId = activeProjectId || DEFAULT_PROJECT_ID;
        const isSchemaV2 = Number(parsed.schemaVersion) === 2;

        if (isSchemaV2) {
          const designSource =
            parsed.design && typeof parsed.design === 'object'
              ? parsed.design
              : null;

          if (designSource && typeof designSource.globalQ !== 'undefined') {
            const parsedQ = Number(designSource.globalQ);
            if (!Number.isFinite(parsedQ) || parsedQ < 0) {
              return {
                ok: false,
                message: 'Giá trị globalQ trong file JSON không hợp lệ.',
              };
            }
          }

          const nextDesign = designSource
            ? normalizeDesignData(designSource, createDefaultDesignData())
            : createDefaultDesignData();

          const nextCalculations =
            parsed.calculations &&
            typeof parsed.calculations === 'object' &&
            !Array.isArray(parsed.calculations)
              ? parsed.calculations
              : {};

          const nextEquipmentSelections =
            parsed.equipmentSelections &&
            typeof parsed.equipmentSelections === 'object' &&
            !Array.isArray(parsed.equipmentSelections)
              ? parsed.equipmentSelections
              : {};

          const nextBom = Array.isArray(parsed.bom) ? parsed.bom : [];
          const nextLogs = Array.isArray(parsed.logs) ? parsed.logs : [];
          const nextGsheetUrl =
            typeof parsed.gsheetUrl === 'string' ? parsed.gsheetUrl.trim() : '';

          if (typeof window !== 'undefined') {
            const calcPrefix = `omniEco_Calc_${projectId}_`;
            const eqSelPrefix = `omniEco_EqSel_${projectId}_`;
            const isDefaultProject = projectId === DEFAULT_PROJECT_ID;

            // 1. Dọn dẹp toàn bộ key tính toán & thiết bị đã gán cũ của dự án hiện tại
            // (Tuyệt đối không đụng tới kho thiết bị dùng chung omnieco_equipments)
            Object.keys(window.localStorage).forEach((key) => {
              if (
                key.startsWith(calcPrefix) ||
                key.startsWith(eqSelPrefix) ||
                (isDefaultProject && key.startsWith('omnieco_equipments_'))
              ) {
                window.localStorage.removeItem(key);
              }
            });
            if (isDefaultProject) {
              markLegacyEqMigrated();
            }

            // 2. Ghi thông số tính toán chi tiết & overrides (calculations)
            Object.entries(nextCalculations).forEach(([suffix, val]) => {
              const cleanSuffix = String(suffix || '').trim();
              if (!cleanSuffix) return;
              safeSetItem(
                `${calcPrefix}${cleanSuffix}`,
                JSON.stringify(val)
              );
            });

            // 3. Ghi danh sách thiết bị gán vào từng công đoạn (equipmentSelections)
            Object.entries(nextEquipmentSelections).forEach(([suffix, val]) => {
              const cleanSuffix = String(suffix || '').trim();
              if (!cleanSuffix || !Array.isArray(val)) return;
              safeSetItem(
                `${eqSelPrefix}${cleanSuffix}`,
                JSON.stringify(val)
              );
            });

            // 4. Ghi BOM, Nhật ký vận hành, Google Sheet URL và thông số thiết kế
            safeSetItem(
              `omniEco_BOM_${projectId}`,
              JSON.stringify(nextBom)
            );
            safeSetItem(
              `omniEco_Logs_${projectId}`,
              JSON.stringify(nextLogs)
            );
            safeSetItem(
              `omniEco_GSheetUrl_${projectId}`,
              nextGsheetUrl
            );
            safeSetItem(
              getDesignStorageKey(projectId),
              JSON.stringify({
                ...nextDesign,
                updatedAt: new Date().toISOString(),
              })
            );
          }

          // 5. Cập nhật thông tin hành chính dự án (projectInfo)
          let resolvedName = currentProject?.name || 'Dự án mặc định';
          if (
            parsed.projectInfo &&
            typeof parsed.projectInfo === 'object' &&
            !Array.isArray(parsed.projectInfo)
          ) {
            const info = parsed.projectInfo;
            const trimmedName = String(info.name || '').trim();
            if (trimmedName) {
              resolvedName = trimmedName;
            }
            setProjectList((prev) =>
              prev.map((project) => {
                if (project.id !== projectId) return project;
                return {
                  ...project,
                  name: trimmedName || project.name,
                  contractor:
                    info.contractor !== undefined && info.contractor !== null
                      ? String(info.contractor).trim()
                      : project.contractor ?? DEFAULT_CONTRACTOR_NAME,
                  investor:
                    info.investor !== undefined
                      ? String(info.investor || '').trim()
                      : project.investor,
                  location:
                    info.location !== undefined
                      ? String(info.location || '').trim()
                      : project.location,
                  capacity:
                    info.capacity !== undefined
                      ? String(info.capacity || '').trim()
                      : project.capacity,
                  notes:
                    info.notes !== undefined
                      ? String(info.notes || '').trim()
                      : project.notes,
                };
              })
            );
          }

          // 6. Đồng bộ state thiết kế & kích hoạt làm mới tức thì toàn bộ trang con
          setDesignState({
            projectId,
            data: nextDesign,
          });
          setProjectDataRevision((n) => n + 1);

          const calcCount = Object.keys(nextCalculations).length;
          return {
            ok: true,
            message: `Đã nhập toàn bộ dự án "${resolvedName}" (Q = ${nextDesign.globalQ.toLocaleString('vi-VN')} m³/ngày, ${calcCount} nhóm tính toán, ${nextBom.length} mục BOM, ${nextLogs.length} nhật ký).`,
          };
        }

        // Tương thích ngược: File JSON cũ (schema v1 hoặc object 4 trường thiết kế)
        const source = parsed?.state
          ? parsed.state
          : parsed?.design
          ? parsed.design
          : parsed;

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

        updateActiveDesignData((prev) => normalizeDesignData(source, prev));
        setProjectDataRevision((n) => n + 1);

        return {
          ok: true,
          message: `Đã nhập thành công hồ sơ thiết kế JSON (Q = ${nextQ.toLocaleString('vi-VN')} m³/ngày).`,
        };
      } catch {
        return {
          ok: false,
          message: 'Không thể đọc file JSON. Vui lòng kiểm tra cú pháp file.',
        };
      }
    },
    [activeProjectId, currentProject?.name, updateActiveDesignData]
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
      updateProject,
      deleteProject,
      setGlobalQ,
      setPeakingFactor,
      setBioQuality,
      setWastewaterPollutants,
      triggerBiologyFocus,
      resetDefaults,
      importProjectJson,
      setPrintOptions,
      openPrintModal,
      closePrintModal,
      confirmAndPrint,
      registerPrintUnitProcesses,
      setSelectedUnitProcesses,
      setTheme,
      toggleTheme,
    }),
    [
      selectProject,
      createProject,
      updateProject,
      deleteProject,
      setGlobalQ,
      setPeakingFactor,
      setBioQuality,
      setWastewaterPollutants,
      triggerBiologyFocus,
      resetDefaults,
      importProjectJson,
      setPrintOptions,
      openPrintModal,
      closePrintModal,
      confirmAndPrint,
      registerPrintUnitProcesses,
      setTheme,
      toggleTheme,
    ]
  );

  const value = useMemo(
    () => ({
      projectList,
      currentProjectId: activeProjectId,
      currentProject,
      projectDataRevision,
      selectProject,
      createProject,
      updateProject,
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
      printOptions,
      printModalState,
      availableUnitProcesses,
      selectedUnitProcesses,
      setPrintOptions,
      openPrintModal,
      closePrintModal,
      confirmAndPrint,
      registerPrintUnitProcesses,
      setSelectedUnitProcesses,
      theme,
      setTheme,
      toggleTheme,
    }),
    [
      projectList,
      activeProjectId,
      currentProject,
      projectDataRevision,
      selectProject,
      createProject,
      updateProject,
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
      printOptions,
      printModalState,
      availableUnitProcesses,
      selectedUnitProcesses,
      setPrintOptions,
      openPrintModal,
      closePrintModal,
      confirmAndPrint,
      registerPrintUnitProcesses,
      theme,
      setTheme,
      toggleTheme,
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
