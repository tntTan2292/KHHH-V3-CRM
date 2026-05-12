/**
 * RF3A & RF4D: Navigation Memory Utility
 * Preserves hierarchy context (selected node) and time context (dates) across CRM modules.
 */

const STORAGE_KEY = 'crm_v3_navigation_memory';
const DATE_STORAGE_KEY = 'crm_v3_date_memory';

export const saveNavigationContext = (node) => {
  if (!node) {
    sessionStorage.removeItem(STORAGE_KEY);
  } else {
    const memory = {
      key: node.key,
      title: node.title,
      type: node.type,
      timestamp: Date.now()
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  }
};

export const getNavigationContext = () => {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    const memory = JSON.parse(saved);
    if (Date.now() - memory.timestamp > 2 * 60 * 60 * 1000) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return memory;
  } catch (e) {
    return null;
  }
};

// RF4D: Date Persistence
export const saveDateContext = (startDate, endDate) => {
  if (!startDate && !endDate) {
    sessionStorage.removeItem(DATE_STORAGE_KEY);
  } else {
    const dateMemory = {
      startDate,
      endDate,
      timestamp: Date.now()
    };
    sessionStorage.setItem(DATE_STORAGE_KEY, JSON.stringify(dateMemory));
  }
};

export const getDateContext = () => {
  const saved = sessionStorage.getItem(DATE_STORAGE_KEY);
  if (!saved) return null;
  try {
    const memory = JSON.parse(saved);
    // Date memory lasts shorter (e.g., 30 mins) to avoid stale data
    if (Date.now() - memory.timestamp > 30 * 60 * 1000) {
      sessionStorage.removeItem(DATE_STORAGE_KEY);
      return null;
    }
    return memory;
  } catch (e) {
    return null;
  }
};

/**
 * Syncs URL search params with the hierarchy context.
 */
export const syncUrlWithContext = (node, searchParams, setSearchParams) => {
  const newParams = new URLSearchParams(searchParams);
  if (node && node.key) {
    newParams.set('node_code', node.key);
    if (node.type) newParams.set('node_type', node.type);
    if (node.title) newParams.set('node_title', node.title);
  } else {
    newParams.delete('node_code');
    newParams.delete('node_type');
    newParams.delete('node_title');
  }
  setSearchParams(newParams, { replace: true });
};

/**
 * Retrieves hierarchy context from URL search params.
 */
export const getContextFromUrl = (searchParams) => {
  const code = searchParams.get('node_code');
  if (!code) return null;
  return {
    key: code,
    type: searchParams.get('node_type'),
    title: searchParams.get('node_title') || 'Đang chọn'
  };
};
