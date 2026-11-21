export const STORAGE_QUOTA_EVENT = 'omnieco:storage-quota-exceeded';
export const STORAGE_QUOTA_MESSAGE =
  'Bộ nhớ trình duyệt đã đầy, hãy xuất JSON dự phòng hoặc xóa bớt dự án cũ.';
export const LEGACY_EQ_MIGRATED_KEY = 'omniEco_LegacyEqMigrated';

let lastQuotaEventTs = 0;
const QUOTA_EVENT_THROTTLE_MS = 3000;

function isQuotaExceededError(err) {
  if (!err) return false;
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014
  );
}

function notifyQuotaExceeded(key) {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastQuotaEventTs < QUOTA_EVENT_THROTTLE_MS) return;
  lastQuotaEventTs = now;
  window.dispatchEvent(
    new CustomEvent(STORAGE_QUOTA_EVENT, {
      detail: {
        key,
        message: STORAGE_QUOTA_MESSAGE,
      },
    })
  );
}

export function safeSetItem(key, value) {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded(key);
    }
    return false;
  }
}

export function isLegacyEqMigrated() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LEGACY_EQ_MIGRATED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markLegacyEqMigrated() {
  safeSetItem(LEGACY_EQ_MIGRATED_KEY, '1');
}
