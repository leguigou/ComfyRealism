import pkg from '../package.json';

/**
 * Global application configuration.
 * Centralizing this ensures a single source of truth for metadata and constants.
 */
export const APP_CONFIG = {
  VERSION: pkg.version,
  GITHUB_REPO: 'leguigou/ComfyRealism',
  API_ENDPOINTS: {
    CHECK_UPDATE: '/api/updates/check',
    SETTINGS: '/api/settings',
    USERS: '/api/users',
    AUTH_CHECK: '/api/auth/check'
  }
} as const;
