/**
 * API Configuration
 * Centralized place to manage the backend URL.
 */

const getApiBaseUrl = () => {
  let envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

  if (envUrl) {
    envUrl = envUrl.trim();
    // Remove trailing slashes
    while (envUrl.endsWith('/')) {
      envUrl = envUrl.slice(0, -1);
    }
    // Remove trailing /api if present to avoid duplication
    if (envUrl.endsWith('/api')) {
      envUrl = envUrl.slice(0, -4);
    }
    // Now append /api exactly once
    return `${envUrl}/api`;
  }

  return '/api';
};

export const API_BASE_URL = getApiBaseUrl();

/** Origin used to load /uploads and other relative media paths. */
export const getAssetOrigin = () => {
  const explicit =
    import.meta.env.VITE_ASSETS_URL ||
    import.meta.env.VITE_PUBLIC_URL;

  if (explicit) {
    return String(explicit).trim().replace(/\/$/, '');
  }

  const base = API_BASE_URL;
  if (base.startsWith('http://') || base.startsWith('https://')) {
    return base.endsWith('/api') ? base.slice(0, -4) : base;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return '';
};

/** @deprecated Use getAssetOrigin() — kept for imports that expect a constant. */
export const API_ORIGIN = getAssetOrigin();
