/**
 * RF3A: Navigation Memory Utility
 * Preserves hierarchy context (selected node) across CRM modules.
 */

const STORAGE_KEY = 'crm_v3_navigation_memory';

export const saveNavigationContext = (node) => {
  if (!node) {
    sessionStorage.removeItem(STORAGE_KEY);
  } else {
    // Only store essential data to keep it lightweight
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
    // Optional: add expiry check (e.g., 2 hours)
    if (Date.now() - memory.timestamp > 2 * 60 * 60 * 1000) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return memory;
  } catch (e) {
    return null;
  }
};

/**
 * Syncs URL search params with the hierarchy context.
 * This enables deep linking and command routing (RF3).
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
