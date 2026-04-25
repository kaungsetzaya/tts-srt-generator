/**
 * Convert backend error messages to user-friendly Myanmar text.
 */
export function friendlyError(raw: string): string {
  if (!raw) return "တစ်ခုခုမှားယွင်းနေပါသည်။ ထပ်ကြိုးစားပါ။";
  if (raw.includes("Insufficient credits"))
    return "Credit မလုံလောက်ပါ။ Plan ဝယ်ယူပါ။";
  if (raw.includes("Please login")) return "ကျေးဇူးပြု၍ Login ဝင်ပါ။";
  if (raw.includes("banned"))
    return "သင့် Account ကို ပိတ်ထားပါသည်။ Admin ကို ဆက်သွယ်ပါ။";
  if (raw.includes("File too large") || raw.includes("Max 25MB"))
    return "ဖိုင်အကြီးလွန်ပါသည်။ အများဆုံး 25MB အထိသာ တင်နိုင်ပါသည်။";
  if (raw.includes("Whisper could not detect"))
    return "ဗီဒီယိုတွင် စကားပြောသံ ရှာမတွေ့ပါ။ အသံပါသော ဗီဒီယိုကို ထပ်ကြိုးစားပါ။";
  if (raw.includes("MURF_API_KEY not configured"))
    return "Voice Change စနစ် ပြင်ဆင်ဆဲဖြစ်ပါသည်။ Standard Voice ကို သုံးပါ။";
  if (
    raw.includes("yt-dlp") ||
    raw.includes("download") ||
    raw.includes("ဒေါင်းလုတ်မရပါ")
  )
    return "ဗီဒီယို Link ကို ဒေါင်းလုတ်မရပါ။ Link ကို စစ်ပြီး ထပ်ကြိုးစားပါ။";
  if (
    raw.includes("Command failed") ||
    raw.includes("/tmp/") ||
    raw.includes("/root/")
  )
    return "လုပ်ဆောင်မှု မအောင်မြင်ပါ။ ခဏစောင့်ပြီး ထပ်ကြိုးစားပါ။";
  if (raw.includes("Too many login"))
    return "Login ကြိုးစားမှု များလွန်ပါသည်။ ၁ မိနစ်စောင့်ပြီး ထပ်ကြိုးစားပါ။";
  if (raw.includes("Invalid code"))
    return "Code မှားနေပါသည်။ Telegram Bot မှ Code အသစ်ယူပါ။";
  if (raw.includes("No active subscription"))
    return "Subscription မရှိသေးပါ။ Admin ကို ဆက်သွယ်ပါ။";
  if (raw.includes("Database") || raw.includes("DB"))
    return "စနစ် ယာယီ ချို့ယွင်းနေပါသည်။ ခဏစောင့်ပြီး ထပ်ကြိုးစားပါ။";
  if (raw.includes("Invalid text")) return "စာသား ထည့်ပါ။";
  if (raw.includes("Failed to generate audio"))
    return "အသံ ဖန်တီး၍ မရပါ။ ထပ်ကြိုးစားပါ။";
  if (/[\u1000-\u109F]/.test(raw)) return raw;
  return "တစ်ခုခု မှားယွင်းနေပါသည်။ ထပ်ကြိုးစားပါ။";
}
