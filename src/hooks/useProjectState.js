import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_PROJECT_ID, useAppContext } from '../context/AppContext';
import { safeSetItem } from '../utils/storage';

export const CALC_STORAGE_PREFIX = 'omniEco_Calc_';

export const getCalcStorageKey = (projectId, stateKey) =>
  `${CALC_STORAGE_PREFIX}${projectId || DEFAULT_PROJECT_ID}_${stateKey}`;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function resolveInitialValue(initialValue) {
  return typeof initialValue === 'function' ? initialValue() : initialValue;
}

function readProjectState(storageKey, initialValue) {
  const fallback = resolveInitialValue(initialValue);
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);

    if (isPlainObject(fallback)) {
      return isPlainObject(parsed) ? { ...fallback, ...parsed } : fallback;
    }

    if (Array.isArray(fallback)) {
      return Array.isArray(parsed) ? parsed : fallback;
    }

    if (typeof fallback === 'number') {
      return typeof parsed === 'number' && Number.isFinite(parsed)
        ? parsed
        : fallback;
    }

    return parsed !== undefined ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Custom Hook lưu trữ state tính toán & overrides cô lập theo từng dự án (currentProjectId).
 * Key lưu trữ: omniEco_Calc_${currentProjectId}_${stateKey}
 */
export function useProjectState(stateKey, initialValue) {
  const { currentProjectId, currentProject, projectDataRevision } =
    useAppContext();
  const activeProjectId =
    currentProjectId || currentProject?.id || DEFAULT_PROJECT_ID;
  const activeRevision = projectDataRevision || 0;
  const storageKey = getCalcStorageKey(activeProjectId, stateKey);

  const initialValueRef = useRef(initialValue);
  initialValueRef.current = initialValue;

  const [ownedState, setOwnedState] = useState(() => ({
    projectId: activeProjectId,
    revision: activeRevision,
    key: storageKey,
    value: readProjectState(storageKey, initialValue),
    shouldPersist: false,
  }));

  // Đồng bộ giá trị tức thì ngay khi đổi dự án hoặc nhập JSON (tránh hiển thị dữ liệu cũ ở frame đầu)
  const currentValue = useMemo(
    () =>
      ownedState.projectId === activeProjectId &&
      ownedState.revision === activeRevision &&
      ownedState.key === storageKey
        ? ownedState.value
        : readProjectState(storageKey, initialValueRef.current),
    [ownedState, activeProjectId, activeRevision, storageKey]
  );

  // Tự động nạp lại dữ liệu khi chuyển currentProjectId, stateKey hoặc sau khi import JSON
  useEffect(() => {
    setOwnedState((prev) =>
      prev.projectId === activeProjectId &&
      prev.revision === activeRevision &&
      prev.key === storageKey
        ? prev
        : {
            projectId: activeProjectId,
            revision: activeRevision,
            key: storageKey,
            value: readProjectState(storageKey, initialValueRef.current),
            shouldPersist: false,
          }
    );
  }, [activeProjectId, activeRevision, storageKey]);

  // Chỉ ghi xuống localStorage khi projectId, revision & key sở hữu khớp hoàn toàn (chống ghi đè chéo)
  useEffect(() => {
    if (!ownedState.shouldPersist) return;
    if (ownedState.projectId !== activeProjectId) return;
    if (ownedState.revision !== activeRevision) return;
    if (ownedState.key !== storageKey) return;
    if (typeof window === 'undefined') return;

    safeSetItem(storageKey, JSON.stringify(ownedState.value));
  }, [ownedState, activeProjectId, activeRevision, storageKey]);

  const setProjectState = useCallback(
    (updater) => {
      setOwnedState((prev) => {
        const baseValue =
          prev.projectId === activeProjectId &&
          prev.revision === activeRevision &&
          prev.key === storageKey
            ? prev.value
            : readProjectState(storageKey, initialValueRef.current);
        const nextValue =
          typeof updater === 'function' ? updater(baseValue) : updater;

        return {
          projectId: activeProjectId,
          revision: activeRevision,
          key: storageKey,
          value: nextValue,
          shouldPersist: true,
        };
      });
    },
    [activeProjectId, activeRevision, storageKey]
  );

  return [currentValue, setProjectState];
}

export default useProjectState;
