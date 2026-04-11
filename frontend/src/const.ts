// Standalone constants for frontend (no @shared dependency needed for Vercel deploy)

export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';

export const getLoginUrl = () => {
  return `${window.location.origin}/login`;
};
// preview test
