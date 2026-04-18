// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var ROUTES = {
  home: "/",
  login: "/login",
  lumix: "/lumix",
  admin: "/admin"
};
var PLANS = {
  trial: "trial",
  oneMonth: "1month",
  threeMonth: "3month",
  sixMonth: "6month",
  lifetime: "lifetime"
};
var FEATURES = {
  tts: "tts",
  dubFile: "dub_file",
  dubLink: "dub_link",
  translateFile: "translate_file",
  translateLink: "translate_link"
};
var TRIAL_DEFAULTS = {
  charLimitStandard: 2e4,
  charLimitCharacter: 2e3,
  totalTtsSrt: 7,
  totalCharacterUse: 2,
  totalAiVideo: 2,
  totalAiVideoChar: 1,
  totalVideoTranslate: 2,
  maxVideoSizeMB: 25,
  maxVideoDurationSec: 150,
  maxAiVideoDurationSecStd: 180,
  maxAiVideoDurationSecChar: 90
};
var PAID_PLAN_LIMITS = {
  charLimitStandard: 3e4,
  charLimitCharacter: 2e3,
  dailyTtsSrt: 999,
  dailyCharacterUse: 999,
  dailyAiVideo: 999,
  dailyVideoTranslate: 999
};
var getLoginUrl = () => `${window.location.origin}/login`;
export {
  AXIOS_TIMEOUT_MS,
  COOKIE_NAME,
  FEATURES,
  NOT_ADMIN_ERR_MSG,
  ONE_YEAR_MS,
  PAID_PLAN_LIMITS,
  PLANS,
  ROUTES,
  TRIAL_DEFAULTS,
  UNAUTHED_ERR_MSG,
  getLoginUrl
};
