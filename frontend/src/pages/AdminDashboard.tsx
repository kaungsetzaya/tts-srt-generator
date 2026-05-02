import * as React from "react";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  Loader2, Users, Crown, Clock, Plus, Shield, Settings, Search, LogOut,
  BarChart3, Ban, Check, CheckCircle, Activity, Zap, Server, ChevronRight,
  ChevronLeft, Mic, FileVideo, AlertTriangle, UserCheck, UserX, Bug,
  RefreshCw, X, Info, Banknote, Calendar, Trash2, History, ArrowUpRight,
} from "lucide-react";
import { ACCENT, ACCENT_SECONDARY } from "@shared/const";

type Plan = "trial" | "starter" | "creator" | "pro";
type MainTab = "overview" | "users" | "reports" | "settings";
type TimeFrame = "week" | "month" | "year" | "all";

const PLAN_LABELS: Record<Plan, string> = {
  trial: "Trial (15cr)",
  starter: "Starter Pack (50cr)",
  creator: "Creator Pack (200cr)",
  pro: "Pro Pack (500cr)",
};
const PLAN_PRICE: Record<Plan, number> = {
  trial: 0, starter: 15000, creator: 35000, pro: 75000,
};
const FEATURE_LABELS: Record<string, string> = {
  tts: "TTS", video_upload: "Video Upload", video_link: "Video Link",
  dub_file: "Dub File", dub_link: "Dub Link",
};

const C = ACCENT;
const C_GOLD = ACCENT_SECONDARY;
const C_BG = "#0a0a0a";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#141210] border border-white/[0.06] rounded-xl ${className}`}>
      {children}
    </div>
  );
}

function Stat({ label, value, color = C, sub }: { label: string; value: any; color?: string; sub?: string }) {
  return (
    <div className="bg-[#141210] border border-white/[0.06] rounded-xl p-5">
      <p className="text-xs uppercase tracking-wider text-white/40 mb-2 font-semibold">{label}</p>
      <p className="text-3xl font-black" style={{ color }}>{value}</p>
      {sub && <p className="text-sm text-white/30 mt-1">{sub}</p>}
    </div>
  );
}

function MiniBar({ label, count, max, color = C }: { label: string; count: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-28 text-sm font-semibold text-white/70 truncate">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-white/[0.06]">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-sm font-bold w-10 text-right" style={{ color }}>{count}</div>
    </div>
  );
}

// ── User Detail Drawer ─────────────────────────────────────────
function UserDetailDrawer({ userId, userName, onClose, tz }: { userId: string; userName: string; onClose: () => void; tz: string }) {
  const { data, isLoading } = trpc.adminStats.getUserDetail.useQuery({ userId }, { refetchInterval: 3000 });
  const { data: userCredits } = trpc.admin.getTransactions.useQuery({ userId }, { enabled: !!userId });
  const banMutation = trpc.admin.banUser.useMutation();
  const utils = trpc.useUtils();

  const fmtDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };
  const fmtTime = (d: any) =>
    !d ? "—" : new Date(d).toLocaleString("en-US", { timeZone: tz, day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
  const fmtDate = (d: any) => !d ? "—" : new Date(d).toLocaleDateString("en-US", { timeZone: tz, day: "2-digit", month: "short", year: "numeric" });

  const maxVoice = Math.max(...(data?.voices?.map((v: any) => v.count) ?? [1]));
  const maxDaily = Math.max(...(data?.daily?.map((d: any) => d.count) ?? [1]));
  const maxHour = Math.max(...(data?.activeHours?.map((h: any) => h.count) ?? [1]));

  const handleBan = () => {
    if (confirm(`Are you sure you want to ${data?.user?.banned ? "unban" : "ban"} this user?`)) {
      banMutation.mutate({ userId, ban: !data?.user?.banned }, { onSuccess: () => utils.adminStats.getUserDetail.invalidate() });
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/70" onClick={onClose}>
        <div className="w-full max-w-xl h-full bg-[#0a0a0a] border-l border-white/[0.06] flex items-center justify-center" onClick={e => e.stopPropagation()}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: C }} />
        </div>
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/70" onClick={onClose}>
        <div className="w-full max-w-xl h-full bg-[#0a0a0a] border-l border-white/[0.06] flex items-center justify-center" onClick={e => e.stopPropagation()}>
          <p className="text-white/30">User not found</p>
        </div>
      </div>
    );
  }

  const u = data.user;
  const s = data.stats;
  const isBanned = !!u.banned;
  const successRate = data.stats.totalGens > 0 ? Math.round((data.statusBreakdown.success / data.stats.totalGens) * 100) : 100;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70" onClick={onClose}>
      <div className="w-full max-w-xl h-full overflow-y-auto bg-[#0a0a0a] border-l border-white/[0.06]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0a0a0a] border-b border-white/[0.06]">
          <div className="px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#C06F30] to-[#a0522d] flex items-center justify-center text-xl font-black text-white">
                  {(u.name || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-lg flex items-center gap-2">
                    {u.name || "Unknown"}
                    {isBanned && <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">BANNED</span>}
                  </p>
                  <p className="text-sm text-white/40">@{u.username || "—"}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* Quick Actions */}
          <div className="px-6 pb-4 flex gap-2">
            <button onClick={handleBan} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${isBanned ? "border-green-500/30 text-green-400 hover:bg-green-500/10" : "border-red-500/30 text-red-400 hover:bg-red-500/10"}`}>
              {isBanned ? "Unban User" : "Ban User"}
            </button>
            <button onClick={() => { setSelectedUser(userId); setShowSubModal(true); }} className="flex-1 py-2 rounded-lg text-xs font-bold border border-[#C06F30]/30 text-[#C06F30] hover:bg-[#C06F30]/10 transition-colors">
              Give Sub
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* User Info Card */}
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-white/30 mb-1">Credits</p>
                <p className="text-xl font-black text-amber-400">{u.credits ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-white/30 mb-1">Member Since</p>
                <p className="text-sm font-semibold text-white/70">{fmtDate(u.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-white/30 mb-1">Last Active</p>
                <p className="text-sm font-semibold text-white/70">{fmtTime(u.lastLoginAt)}</p>
              </div>
              <div>
                <p className="text-xs text-white/30 mb-1">Status</p>
                <p className={`text-sm font-bold ${isBanned ? "text-red-400" : "text-green-400"}`}>{isBanned ? "Banned" : "Active"}</p>
              </div>
            </div>
            {data.subscription && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-bold text-amber-400">{PLAN_LABELS[data.subscription.plan as Plan] || data.subscription.plan}</span>
                  </div>
                  <span className="text-xs text-white/30">Expires: {fmtDate(data.subscription.expiresAt)}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-[#141210] border border-white/[0.06] rounded-lg p-3 text-center">
              <p className="text-xs text-white/30 mb-1">30d</p>
              <p className="text-lg font-black" style={{ color: C }}>{s.totalGens}</p>
            </div>
            <div className="bg-[#141210] border border-white/[0.06] rounded-lg p-3 text-center">
              <p className="text-xs text-white/30 mb-1">7d</p>
              <p className="text-lg font-black text-green-400">{s.recentGens}</p>
            </div>
            <div className="bg-[#141210] border border-white/[0.06] rounded-lg p-3 text-center">
              <p className="text-xs text-white/30 mb-1">All Time</p>
              <p className="text-lg font-black text-purple-400">{s.allTimeGens}</p>
            </div>
            <div className="bg-[#141210] border border-white/[0.06] rounded-lg p-3 text-center">
              <p className="text-xs text-white/30 mb-1">Avg/Day</p>
              <p className="text-lg font-black text-amber-400">{s.avgDailyGens}</p>
            </div>
          </div>

          {/* Insights */}
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wider text-white/40 mb-3 font-semibold">Insights (30d)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-black/20 rounded-lg p-3 border border-white/[0.04]">
                <p className="text-xs text-white/25 mb-1">Top Feature</p>
                <p className="text-sm font-bold text-green-400">{FEATURE_LABELS[s.topFeature ?? ""] ?? s.topFeature ?? "—"}</p>
              </div>
              <div className="bg-black/20 rounded-lg p-3 border border-white/[0.04]">
                <p className="text-xs text-white/25 mb-1">Top Voice</p>
                <p className="text-sm font-bold" style={{ color: C }}>{s.topVoice ?? "—"}</p>
              </div>
              <div className="bg-black/20 rounded-lg p-3 border border-white/[0.04]">
                <p className="text-xs text-white/25 mb-1">Peak Hour</p>
                <p className="text-sm font-bold text-amber-400">{s.peakHour ?? "—"}</p>
              </div>
            </div>
          </Card>

          {/* Success Rate */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">Success Rate (30d)</p>
              <span className={`text-sm font-bold ${successRate >= 90 ? "text-green-400" : successRate >= 70 ? "text-amber-400" : "text-red-400"}`}>
                {successRate}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06]">
              <div className="h-2 rounded-full transition-all" style={{ width: `${successRate}%`, background: successRate >= 90 ? "#4ade80" : successRate >= 70 ? "#fbbf24" : "#ef4444" }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-white/30">
              <span>{data.statusBreakdown.success} success</span>
              <span>{data.statusBreakdown.fail} failed</span>
            </div>
          </Card>

          {/* Hourly Activity */}
          {data.activeHours.length > 0 && (
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-white/40 mb-3 font-semibold">Hourly Activity</p>
              <div className="flex items-end gap-[2px] h-12">
                {Array.from({ length: 24 }, (_, i) => {
                  const hourData = data.activeHours.find((h: any) => h.hour === i);
                  const count = hourData?.count ?? 0;
                  const h = maxHour > 0 ? Math.round((count / maxHour) * 48) : 2;
                  return <div key={i} title={`${i}:00 - ${count}`} className="flex-1 rounded-t bg-[#C06F30]/50 hover:bg-[#C06F30] transition-colors" style={{ height: `${Math.max(h, 2)}px` }} />;
                })}
              </div>
              <div className="flex justify-between text-[10px] text-white/20 mt-1">
                <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
              </div>
            </Card>
          )}

          {/* Daily Activity */}
          {data.daily.length > 0 && (
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-white/40 mb-3 font-semibold">Daily Activity (30d)</p>
              <div className="flex items-end gap-[2px] h-12">
                {data.daily.map((d: any) => {
                  const h = maxDaily > 0 ? Math.round((d.count / maxDaily) * 48) : 2;
                  return <div key={d.date} title={`${d.date}: ${d.count}`} className="flex-1 rounded-t bg-[#C06F30]/50 hover:bg-[#C06F30] transition-colors" style={{ height: `${Math.max(h, 2)}px` }} />;
                })}
              </div>
            </Card>
          )}

          {/* Feature Usage */}
          {data.features.length > 0 && (
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-white/40 mb-3 font-semibold">Feature Usage (30d)</p>
              <div className="space-y-2">
                {data.features.sort((a: any, b: any) => b.count - a.count).map((f: any) => (
                  <div key={f.feature} className="flex items-center gap-3">
                    <div className="w-20 text-xs font-semibold text-white/70 truncate">{FEATURE_LABELS[f.feature] ?? f.feature}</div>
                    <div className="flex-1 h-2 rounded-full bg-white/[0.06]">
                      <div className="h-2 rounded-full bg-green-400" style={{ width: `${Math.round((f.count / s.totalGens) * 100)}%` }} />
                    </div>
                    <div className="text-xs font-bold text-white/50 w-8">{f.count}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Voice Usage */}
          {data.voices.length > 0 && (
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-white/40 mb-3 font-semibold">Voice Usage (30d)</p>
              <div className="space-y-2">
                {data.voices.sort((a: any, b: any) => b.count - a.count).slice(0, 6).map((v: any) => (
                  <div key={v.name} className="flex items-center gap-3">
                    <div className="w-20 text-xs font-semibold text-white/70 truncate">{v.name}</div>
                    <div className="flex-1 h-2 rounded-full bg-white/[0.06]">
                      <div className="h-2 rounded-full" style={{ width: `${Math.round((v.count / maxVoice) * 100)}%`, background: "#C06F30" }} />
                    </div>
                    <div className="text-xs font-bold text-white/50 w-8">{v.count}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recent Activity */}
          {data.recentLogs.length > 0 && (
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-white/40 mb-3 font-semibold">Recent Activity</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.recentLogs.map((log: any) => (
                  <div key={log.id} className="flex items-center gap-2 py-2 border-b border-white/[0.04] last:border-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.status === "fail" ? "bg-red-400" : "bg-green-400"}`} />
                    <span className="text-xs text-white/40 w-10">{FEATURE_LABELS[log.feature ?? "tts"]?.substring(0, 3) ?? "TTS"}</span>
                    <span className="text-xs text-white/60 truncate flex-1">{log.character || log.voice || "—"}</span>
                    <span className="text-xs text-white/30">{log.charCount}c</span>
                    <span className="text-xs text-white/20 flex-shrink-0">{fmtTime(log.createdAt)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Credit History */}
          {(userCredits?.length ?? 0) > 0 && (
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-white/40 mb-3 font-semibold flex items-center gap-2">
                <History className="w-4 h-4" /> Credit History
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {userCredits?.slice(0, 10).map((t: any) => {
                  const isPos = t.amount > 0;
                  return (
                    <div key={t.id} className="flex items-center gap-2 text-xs py-2 border-b border-white/[0.04] last:border-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPos ? "bg-green-400" : "bg-amber-400"}`} />
                      <span className="text-white/40 w-20 truncate capitalize">{(t.type || "").replace("_", " ")}</span>
                      <span className="text-white/30 truncate flex-1">{t.description}</span>
                      <span className={`font-bold ${isPos ? "text-green-400" : "text-amber-500"}`}>{isPos ? "+" : ""}{t.amount}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Chars & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-xs text-white/30 mb-1">Total Characters (30d)</p>
              <p className="text-lg font-black text-blue-400">{s.totalChars.toLocaleString()}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-white/30 mb-1">Total Duration (30d)</p>
              <p className="text-lg font-black text-amber-400">{fmtDuration(s.totalDurationMs)}</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const [tab, setTab] = useState<MainTab>("overview");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("starter");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("kpay" as "kpay" | "wave" | "cbpay" | "ayapay" | "bank" | "cash" | "free");
  const [showSubModal, setShowSubModal] = useState(false);
  const [timeframe, setTimeframe] = useState<TimeFrame>("month");
  const [userDrawer, setUserDrawer] = useState<{ id: string; name: string } | null>(null);
  const [revenueMonth, setRevenueMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [tz, setTz] = useState<string>("UTC");
  const [toast, setToast] = useState("");
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const [autoTrialEnabled, setAutoTrialEnabled] = useState(false);
  const [autoTrialDays, setAutoTrialDays] = useState(7);
  const [trialCredits, setTrialCredits] = useState(15);
  const [maintenanceModeEnabled, setMaintenanceModeEnabled] = useState(false);
  const [trialStartDate, setTrialStartDate] = useState("");
  const [trialEndDate, setTrialEndDate] = useState("");
  const [trialEnabled, setTrialEnabled] = useState(false);

  const { data: me } = trpc.auth.me.useQuery();
  const { data: usersData, refetch } = trpc.admin.getUsers.useQuery(undefined, { refetchInterval: 3000 });
  const users = usersData?.users;
  const { data: analytics } = trpc.admin.getAnalytics.useQuery({ month: revenueMonth });
  const { data: health } = trpc.admin.getServerHealth.useQuery(undefined, { refetchInterval: 30000 });
  const { data: voiceStats } = trpc.adminStats.getVoiceStats.useQuery({ timeframe });
  const { data: generationOverview } = trpc.adminStats.getGenerationOverview.useQuery();
  const { data: errorData, refetch: refetchErrors } = trpc.adminStats.getErrorLogs.useQuery({ limit: 50, onlyUnresolved: false });
  const { data: churnData } = trpc.adminStats.getChurnStats.useQuery();
  const { data: onlineStats } = trpc.adminStats.onlineUsers.useQuery(undefined, { refetchInterval: 60000 });
  const { data: topUsersData } = trpc.adminStats.getTopUsers.useQuery({ days: 30, limit: 20 });
  const { data: settingsData } = trpc.settings.get.useQuery(undefined);

  useEffect(() => {
    if (!settingsData) return;
    const d = settingsData;
    setAutoTrialEnabled(d.auto_trial_enabled === 'true');
    setAutoTrialDays(Number(d.auto_trial_days) || 7);
    setTrialCredits(Number(d.trial_credits) || 15);
    setTrialStartDate(d.trial_start_date || "");
    setTrialEndDate(d.trial_end_date || "");
    setTrialEnabled(d.trial_enabled === 'true');
    setMaintenanceModeEnabled(d.maintenance_mode === 'true');
  }, [settingsData]);

  const logoutMutation = trpc.auth.logout.useMutation({ onSuccess: () => { window.location.href = "/login"; } });
  const giveSub = trpc.admin.giveSubscription.useMutation({
    onSuccess: () => { refetch(); setShowSubModal(false); setSelectedUser(null); setNote(""); setPaymentMethod("kpay"); },
    onError: (error) => showToast("Error: " + error.message),
  });
  const cancelSub = trpc.admin.cancelSubscription.useMutation({ onSuccess: () => refetch() });
  const setRole = trpc.admin.setRole.useMutation({ onSuccess: () => refetch() });
  const banUser = trpc.admin.banUser.useMutation({ onSuccess: () => refetch() });
  const utils = trpc.useUtils();
  const updateSettings = trpc.settings.update.useMutation({ onSuccess: () => utils.settings.get.invalidate() });
  const updateSettingsBulk = trpc.settings.updateBulk.useMutation({ onSuccess: () => utils.settings.get.invalidate() });
  const resolveError = trpc.adminStats.resolveError.useMutation({ onSuccess: () => refetchErrors() });
  const dismissFailedGen = trpc.adminStats.dismissFailedGen.useMutation({ onSuccess: () => refetchErrors() });
  const deleteSystemLog = trpc.adminStats.deleteSystemLog.useMutation({ onSuccess: () => refetchErrors() });
  const deleteAllFailedGens = trpc.adminStats.deleteAllFailedGens.useMutation({ onSuccess: () => refetchErrors() });
  const resolveAllErrors = trpc.adminStats.resolveAllErrors.useMutation({ onSuccess: () => refetchErrors() });
  const deleteAllSystemLogs = trpc.adminStats.deleteAllSystemLogs.useMutation({ onSuccess: () => refetchErrors() });
  const deleteUser = trpc.admin.deleteUser.useMutation({ onSuccess: () => refetch() });

  if (me?.role !== "admin")
    return <div className="min-h-screen bg-black flex items-center justify-center"><p className="text-red-400 font-bold">Access Denied</p></div>;

  const fmtTime = (d: any) => !d ? "Never" : new Date(d).toLocaleString("en-US", { timeZone: tz, day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
  const fmtDate = (d: any) => !d ? "—" : new Date(d).toLocaleDateString("en-US", { timeZone: tz, day: "2-digit", month: "short", year: "numeric" });
  const fmtUptime = (s: number) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return `${h}h ${m}m`; };
  const fmtMMK = (v: number) => `${(v ?? 0).toLocaleString()} MMK`;

  const usersArray = Array.isArray(users) ? users : [];
  const adminUsers = usersArray.filter((u: any) => u.role === "admin");
  const normalUsers = usersArray.filter((u: any) => u.role !== "admin");
  const filteredUsers = normalUsers.filter((u: any) =>
    (u.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (u.username ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const systemLogsArray = Array.isArray(errorData?.systemLogs) ? errorData.systemLogs : [];
  const totalErrors = (errorData?.failedGenerations?.length ?? 0) + systemLogsArray.filter((l: any) => !l.resolved).length;

  const maxVoice = Math.max(...(voiceStats?.voices?.map((v: any) => v.count) ?? [1]));

  const tabs: { id: MainTab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "reports", label: "Errors", icon: Bug },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen text-white" style={{ background: C_BG }}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-red-500 text-white text-xs font-bold">
          {toast}
        </div>
      )}

      {/* User Drawer */}
      {userDrawer && <UserDetailDrawer userId={userDrawer.id} userName={userDrawer.name} onClose={() => setUserDrawer(null)} tz={tz} />}

      {/* Sub Modal */}
      {showSubModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowSubModal(false)}>
          <div className="bg-[#141210] border border-white/[0.06] rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-4" style={{ color: C }}>Give Subscription</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/30 mb-1 block">Plan</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(PLAN_LABELS) as Plan[]).map(p => (
                    <button key={p} onClick={() => setSelectedPlan(p)} className={`text-xs px-3 py-2 rounded-lg border transition-all ${selectedPlan === p ? "border-[#C06F30] bg-[#C06F30]/10 text-[#C06F30] font-bold" : "border-white/[0.06] text-white/50 hover:border-white/20"}`}>
                      {PLAN_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-white/30 mb-1 block">Note</label>
                <input value={note} onChange={e => setNote(e.target.value)} className="w-full bg-black/30 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-white/20" placeholder="Optional note..." />
              </div>
              <div>
                <label className="text-xs text-white/30 mb-1 block">Payment Method</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className="w-full bg-black/30 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white">
                  <option value="kpay">KBZ Pay</option>
                  <option value="wave">Wave Pay</option>
                  <option value="cbpay">CB Pay</option>
                  <option value="ayapay">AYA Pay</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="free">Free / Promo</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowSubModal(false)} className="flex-1 px-4 py-2 rounded-lg border border-white/[0.06] text-white/50 text-sm hover:bg-white/5">Cancel</button>
                <button onClick={() => giveSub.mutate({ userId: selectedUser, plan: selectedPlan, days: 3650, note, paymentMethod })} className="flex-1 px-4 py-2 rounded-lg font-bold text-sm" style={{ background: C, color: "#fff" }}>Give Sub</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" style={{ color: C }} />
          <span className="font-bold text-base" style={{ color: C }}>LUMIX Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-white/30" />
            {(["UTC", "Asia/Yangon", "Asia/Bangkok"] as const).map(t => (
              <button key={t} onClick={() => setTz(t)} className={`text-xs px-2 py-1 rounded font-bold ${tz === t ? "text-white bg-white/10" : "text-white/30 hover:text-white/50"}`}>
                {t === "UTC" ? "UTC" : t === "Asia/Yangon" ? "MM" : "TH"}
              </button>
            ))}
          </div>
          <button onClick={() => logoutMutation.mutate()} className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 px-2 py-1 rounded transition-colors">
            <LogOut className="w-4 h-4" /> Exit
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-white/[0.06]">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all -mb-px ${tab === id ? "border-[#C06F30] text-[#C06F30]" : "border-transparent text-white/30 hover:text-white/50"}`}>
              <Icon className="w-4 h-4" /> {label}
              {id === "reports" && totalErrors > 0 && <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{totalErrors}</span>}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <div className="space-y-5">
            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Total Users" value={analytics?.totalUsers ?? 0} sub={`${analytics?.activeSubs ?? 0} active subs`} />
              <Stat label="Online Now" value={onlineStats?.onlineCount ?? 0} color="#4ade80" sub="Active in last 15min" />
              <Stat label="Gens (Month)" value={generationOverview?.thisMonth ?? 0} color={C} sub={`${generationOverview?.today ?? 0} today`} />
              <Stat label="Revenue" value={fmtMMK(analytics?.revenue ?? 0)} color={C_GOLD} sub={revenueMonth} />
            </div>

            {/* Peak Hours + Feature Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">Peak Hours (24h)</p>
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                {generationOverview?.activeHours?.length === 0 ? (
                  <p className="text-sm text-white/25 text-center py-4">No data yet</p>
                ) : (
                  <div className="flex items-end gap-[2px] h-16">
                    {Array.from({ length: 24 }, (_, i) => {
                      const hourData = generationOverview?.activeHours?.find((h: any) => h.hour === i);
                      const count = hourData?.count ?? 0;
                      const maxHour = Math.max(...(generationOverview?.activeHours?.map((h: any) => h.count) ?? [1]));
                      const h = maxHour > 0 ? Math.round((count / maxHour) * 64) : 3;
                      const isCurrentHour = new Date().getHours() === i;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            title={`${i}:00 - ${count} gens`}
                            className={`w-full rounded-t transition-colors ${isCurrentHour ? "bg-amber-400" : "bg-[#C06F30]/60 hover:bg-[#C06F30]"}`}
                            style={{ height: `${Math.max(h, 3)}px` }}
                          />
                          {i % 6 === 0 && <span className="text-[8px] text-white/20">{i}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">Feature Breakdown (30d)</p>
                  <Activity className="w-4 h-4" style={{ color: C }} />
                </div>
                {voiceStats?.features?.length === 0 ? (
                  <p className="text-sm text-white/25 text-center py-4">No feature data</p>
                ) : (
                  <div className="space-y-2">
                    {voiceStats?.features?.slice(0, 5).map((f: any) => {
                      const total = voiceStats?.total ?? 1;
                      const pct = Math.round((f.count / total) * 100);
                      const colors = ["#4ade80", "#60a5fa", "#f472b6", "#a78bfa", "#fbbf24"];
                      return (
                        <div key={f.feature} className="flex items-center gap-3">
                          <div className="w-16 text-xs font-semibold text-white/70 truncate">{FEATURE_LABELS[f.feature] ?? f.feature}</div>
                          <div className="flex-1 h-2 rounded-full bg-white/[0.06]">
                            <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: colors[voiceStats?.features?.indexOf(f) % colors.length] }} />
                          </div>
                          <div className="text-xs font-bold w-12 text-right text-white/50">{pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Voice Stats */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">Voice Usage</p>
                <div className="flex gap-1">
                  {(["week", "month", "year", "all"] as TimeFrame[]).map(tf => (
                    <button key={tf} onClick={() => setTimeframe(tf)} className={`text-xs px-2 py-1 rounded font-bold uppercase ${timeframe === tf ? "bg-white/10 text-white" : "text-white/25 hover:text-white/40"}`}>{tf}</button>
                  ))}
                </div>
              </div>
              {voiceStats?.allVoicesRanked?.slice(0, 8).map((v: any) => (
                <MiniBar key={v.name} label={v.displayName} count={v.count} max={maxVoice} color={v.isCharacter ? "#a78bfa" : C} />
              ))}
            </Card>

            {/* Revenue Breakdown + Server Health */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">Revenue Breakdown</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { const [y, m] = revenueMonth.split("-").map(Number); const d = new Date(y, m - 2, 1); setRevenueMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }} className="p-1 hover:bg-white/5 rounded"><ChevronLeft className="w-4 h-4 text-white/30" /></button>
                    <span className="text-xs text-white/30 font-mono w-16 text-center">{revenueMonth}</span>
                    <button onClick={() => { const [y, m] = revenueMonth.split("-").map(Number); const d = new Date(y, m, 1); setRevenueMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }} className="p-1 hover:bg-white/5 rounded"><ChevronRight className="w-4 h-4 text-white/30" /></button>
                  </div>
                </div>
                {(analytics?.planCounts ?? []).length === 0 ? (
                  <p className="text-sm text-white/25 text-center py-6">No subscriptions this month</p>
                ) : (
                  <>
                    {(analytics?.planCounts ?? []).map((p: any) => (
                      <div key={p.plan} className="flex justify-between items-center py-2.5 border-b border-white/[0.04] last:border-0">
                        <div>
                          <span className="text-base font-semibold">{PLAN_LABELS[p.plan as Plan] ?? p.plan}</span>
                          <span className="text-sm text-white/30 ml-2">× {p.count}</span>
                        </div>
                        <span className="font-bold text-amber-500">{fmtMMK((PLAN_PRICE[p.plan as Plan] ?? 0) * p.count)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-3 mt-1 border-t border-white/[0.06]">
                      <span className="text-sm text-white/40 font-semibold">Total</span>
                      <span className="font-black text-amber-500 text-xl">{fmtMMK(analytics?.revenue ?? 0)}</span>
                    </div>
                  </>
                )}
              </Card>

              <Card className="p-5">
                <p className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-3">Server Health</p>
                <div className="grid grid-cols-2 gap-3">
                  {[{ label: "Memory", value: `${health?.memory?.used ?? 0} MB`, color: "text-yellow-400" }, { label: "Heap", value: `${health?.memory?.heap ?? 0} MB`, color: "text-yellow-400" }, { label: "Disk", value: health?.disk ?? "—", color: "text-blue-400" }, { label: "Uptime", value: fmtUptime(health?.uptime ?? 0), color: "text-green-400" }].map(({ label, value, color }) => (
                    <div key={label} className="bg-black/20 rounded-lg p-3 text-center border border-white/[0.04]">
                      <p className="text-xs text-white/25 mb-1">{label}</p>
                      <p className={`text-base font-black ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Top Users + Plan Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5 md:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">Top Users (30d)</p>
                  <Crown className="w-4 h-4 text-amber-400" />
                </div>
                {(() => {
                  const topUsers = topUsersData?.users ?? [];
                  const fallbackUsers = (churnData?.activeUsers ?? []).map((u: any) => ({ id: u.id, name: u.name, username: u.username, totalGens: u.totalGens }));
                  const users = topUsers.length > 0 ? topUsers : fallbackUsers;
                  
                  if (users.length === 0) {
                    return <p className="text-sm text-white/25 text-center py-4">No user data</p>;
                  }
                  
                  return (
                    <div className="space-y-2">
                      {users.slice(0, 8).map((u: any, i: number) => (
                        <div key={u.id} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-400 text-black" : i === 1 ? "bg-white/20 text-white" : i === 2 ? "bg-amber-600 text-white" : "bg-white/[0.06] text-white/30"}`}>
                            {i + 1}
                          </div>
                          <button onClick={() => setUserDrawer({ id: u.id, name: u.name })} className="flex-1 text-left hover:opacity-70 transition-opacity">
                            <span className="text-sm font-semibold">{u.name}</span>
                            <span className="text-xs text-white/30 ml-2">@{u.username || "—"}</span>
                          </button>
                          <div className="text-right">
                            <span className="text-sm font-bold" style={{ color: C }}>{u.totalGens}</span>
                            <span className="text-xs text-white/30 ml-1">gens</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">Plan Distribution</p>
                  <Users className="w-4 h-4" style={{ color: C }} />
                </div>
                {(analytics?.planCounts ?? []).length === 0 ? (
                  <p className="text-sm text-white/25 text-center py-4">No subscriptions</p>
                ) : (
                  <div className="space-y-3">
                    {(analytics?.planCounts ?? []).map((p: any) => {
                      const total = analytics?.totalUsers ?? 1;
                      const pct = Math.round((p.count / total) * 100);
                      const colors: Record<string, string> = { pro: "#a78bfa", creator: "#4ade80", starter: "#60a5fa", trial: "#fbbf24" };
                      return (
                        <div key={p.plan} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: colors[p.plan] ?? "#666" }} />
                          <span className="text-sm font-semibold flex-1">{PLAN_LABELS[p.plan as Plan] ?? p.plan}</span>
                          <span className="text-sm font-bold" style={{ color: colors[p.plan] ?? C }}>{p.count}</span>
                        </div>
                      );
                    })}
                    <div className="pt-3 mt-2 border-t border-white/[0.06]">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/40">Free Users</span>
                        <span className="font-bold text-white/60">{(analytics?.totalUsers ?? 0) - (analytics?.activeSubs ?? 0)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <div className="space-y-5">
            {/* Admin Section */}
            {adminUsers.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-3">Admin Users</p>
                <div className="space-y-2">
                  {adminUsers.map((user: any) => (
                    <Card key={user.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-bold text-base flex items-center gap-2">
                            {user.name ?? "—"}
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#C06F30]/15 text-[#C06F30] font-bold border border-[#C06F30]/25">ADMIN</span>
                          </p>
                          <p className="text-sm text-white/25">@{user.username || "—"} · ID: {user.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {user.id !== me?.userId && (
                          <button onClick={() => { if (confirm(`Remove admin rights from ${user.name}?`)) setRole.mutate({ userId: user.id, role: "user" }); }} className="text-sm px-3 py-1.5 rounded border border-[#C06F30]/30 text-[#C06F30] hover:bg-[#C06F30]/10 transition-colors font-semibold">
                            Remove Admin
                          </button>
                        )}
                        {user.id === me?.userId && (
                          <span className="text-sm text-white/20">You</span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Regular Users */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="w-full pl-9 pr-4 py-2.5 bg-[#141210] border border-white/[0.06] rounded-lg text-base text-white placeholder-white/20 focus:outline-none focus:border-white/15" />
                </div>
                <span className="text-sm text-white/30">{filteredUsers.length} users</span>
              </div>

              <Card>
                <table className="w-full text-base">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-white/30">
                      <th className="text-left p-4 font-semibold">User</th>
                      <th className="text-left p-4 font-semibold">Plan</th>
                      <th className="text-center p-4 font-semibold">Gens</th>
                      <th className="text-left p-4 font-semibold">Last Active</th>
                      <th className="text-center p-4 font-semibold">Credits</th>
                      <th className="text-left p-4 font-semibold">Status</th>
                      <th className="text-left p-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user: any) => {
                      const isBanned = !!user.banned;
                      const fb = user.featureBreakdown as Record<string, number> | undefined;
                      return (
                        <tr key={user.id} className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${isBanned ? "opacity-40" : ""}`}>
                          <td className="p-4">
                            <button onClick={() => setUserDrawer({ id: user.id, name: user.name ?? "—" })} className="text-left hover:opacity-80 transition-opacity">
                              <p className="font-semibold text-base">{user.name ?? "—"}</p>
                              <p className="text-xs text-white/25">@{user.username || "—"}</p>
                            </button>
                          </td>
                          <td className="p-4">
                            {user.subscription ? (
                              <span className="text-xs px-2.5 py-1 rounded bg-green-500/10 text-green-400 font-bold">{PLAN_LABELS[user.subscription.plan as Plan] ?? user.subscription.plan}</span>
                            ) : (
                              <span className="text-xs px-2.5 py-1 rounded bg-white/[0.04] text-white/30 font-bold">Free</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <span className="font-bold text-base" style={{ color: C }}>{user.genCount ?? 0}</span>
                            {fb && user.genCount > 0 && (
                              <p className="text-[10px] text-white/20 mt-1">
                                {Object.entries(fb).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, c]) => `${FEATURE_LABELS[f] ?? f}:${c}`).join(" · ")}
                              </p>
                            )}
                          </td>
                          <td className="p-4 text-sm text-white/30">{fmtTime(user.lastLoginAt)}</td>
                          <td className="p-4 text-center">
                            <span className="text-sm font-bold text-amber-400">{user.credits ?? 0}</span>
                          </td>
                          <td className="p-4">
                            {isBanned ? (
                              <span className="text-xs px-2.5 py-1 rounded bg-red-500/10 text-red-400 font-bold">BANNED</span>
                            ) : (
                              <span className="text-xs px-2.5 py-1 rounded bg-green-500/10 text-green-400 font-bold">ACTIVE</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-1.5 flex-wrap">
                              <button onClick={() => { setSelectedUser(user.id); setShowSubModal(true); }} className="text-xs px-2.5 py-1.5 rounded border border-[#C06F30]/30 text-[#C06F30] hover:bg-[#C06F30]/10 transition-colors font-semibold">Sub</button>
                              {user.subscription && <button onClick={() => cancelSub.mutate({ userId: user.id })} className="text-xs px-2.5 py-1.5 rounded border border-white/[0.06] text-white/30 hover:text-white/60 transition-colors">Cancel</button>}
                              <button onClick={() => banUser.mutate({ userId: user.id, ban: !isBanned })} className={`text-xs px-2.5 py-1.5 rounded border transition-colors font-semibold ${isBanned ? "border-green-500/30 text-green-400 hover:bg-green-500/10" : "border-red-500/30 text-red-400 hover:bg-red-500/10"}`}>{isBanned ? "Unban" : "Ban"}</button>
                              <button onClick={() => { if (confirm("Delete user permanently?")) deleteUser.mutate({ userId: user.id }); }} className="text-xs px-2.5 py-1.5 rounded border border-red-500/20 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && <p className="text-base text-white/20 text-center py-8">No users found</p>}
              </Card>
            </div>
          </div>
        )}

        {/* ── REPORTS TAB ── */}
        {tab === "reports" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Stat label="Failed Gens" value={errorData?.failedGenerations?.length ?? 0} color="#ef4444" />
              <Stat label="System Logs" value={systemLogsArray.length} color="#f59e0b" />
              <Stat label="Unresolved" value={systemLogsArray.filter((l: any) => !l.resolved).length} color="#facc15" />
            </div>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">Failed Generations</p>
                {(errorData?.failedGenerations?.length ?? 0) > 0 && (
                  <button onClick={() => { if (confirm("Clear all failed generations?")) deleteAllFailedGens.mutate(); }} className="text-xs text-red-400 hover:text-red-300 transition-colors">Clear All</button>
                )}
              </div>
              {(!errorData?.failedGenerations?.length) ? (
                <p className="text-sm text-white/25 text-center py-6">No failed generations</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {errorData?.failedGenerations?.map((e: any) => (
                    <div key={e.id} className="flex items-center gap-3 text-sm py-2.5 border-b border-white/[0.04] last:border-0">
                      <span className="text-white/30 w-20 truncate">{FEATURE_LABELS[e.feature] ?? e.feature}</span>
                      <span className="text-red-400 truncate flex-1">{e.errorMsg}</span>
                      <span className="text-white/20 flex-shrink-0">{fmtTime(e.createdAt)}</span>
                      <button onClick={() => dismissFailedGen.mutate({ id: e.id })} className="text-white/20 hover:text-white/60 transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">System Logs</p>
                <div className="flex gap-2">
                  {(systemLogsArray.filter((l: any) => !l.resolved).length > 0) && (
                    <button onClick={() => { if (confirm("Resolve all errors?")) resolveAllErrors.mutate(); }} className="text-xs text-green-400 hover:text-green-300 transition-colors">Resolve All</button>
                  )}
                  {(systemLogsArray.length > 0) && (
                    <button onClick={() => { if (confirm("Delete all system logs?")) deleteAllSystemLogs.mutate(); }} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete All</button>
                  )}
                </div>
              </div>
              {systemLogsArray.length === 0 ? (
                <p className="text-sm text-white/25 text-center py-6">No system logs</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {systemLogsArray.map((log: any) => (
                    <div key={log.id} className={`flex items-center gap-3 text-sm py-2.5 border-b border-white/[0.04] last:border-0 ${log.resolved ? "opacity-40" : ""}`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.severity === "critical" ? "bg-red-500" : log.severity === "warning" ? "bg-yellow-500" : "bg-blue-400"}`} />
                      <span className="text-white/30 w-20 truncate">{log.errorCode ?? "error"}</span>
                      <span className="text-white/50 truncate flex-1">{log.errorMessage}</span>
                      <span className="text-white/20 flex-shrink-0">{fmtTime(log.createdAt)}</span>
                      {!log.resolved ? (
                        <button onClick={() => resolveError.mutate({ errorId: log.id })} className="text-green-400 hover:text-green-300 transition-colors"><Check className="w-4 h-4" /></button>
                      ) : (
                        <Check className="w-4 h-4 text-white/10" />
                      )}
                      <button onClick={() => deleteSystemLog.mutate({ id: log.id })} className="text-white/20 hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === "settings" && (
          <div className="max-w-xl space-y-4">
            <Card className="p-5">
              <p className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-4">Trial Settings</p>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={autoTrialEnabled} onChange={e => setAutoTrialEnabled(e.target.checked)} className="accent-[#C06F30] w-4 h-4" />
                  <span className="text-base">Auto-grant trial on first login</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/30 block mb-1">Trial Credits</label>
                    <input type="number" value={trialCredits} onChange={e => setTrialCredits(Number(e.target.value))} className="w-full bg-black/30 border border-white/[0.06] rounded-lg px-3 py-2 text-base" />
                  </div>
                  <div>
                    <label className="text-xs text-white/30 block mb-1">Trial Days</label>
                    <input type="number" value={autoTrialDays} onChange={e => setAutoTrialDays(Number(e.target.value))} className="w-full bg-black/30 border border-white/[0.06] rounded-lg px-3 py-2 text-base" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/30 block mb-1">Start Date</label>
                    <input type="date" value={trialStartDate} onChange={e => setTrialStartDate(e.target.value)} className="w-full bg-black/30 border border-white/[0.06] rounded-lg px-3 py-2 text-base" />
                  </div>
                  <div>
                    <label className="text-xs text-white/30 block mb-1">End Date</label>
                    <input type="date" value={trialEndDate} onChange={e => setTrialEndDate(e.target.value)} className="w-full bg-black/30 border border-white/[0.06] rounded-lg px-3 py-2 text-base" />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={trialEnabled} onChange={e => setTrialEnabled(e.target.checked)} className="accent-[#C06F30] w-4 h-4" />
                  <span className="text-base">Trial period enabled</span>
                </label>
              </div>
            </Card>

            <Card className="p-5">
              <p className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-4">System</p>
              <label className="flex items-center gap-2 cursor-pointer mb-4">
                <input type="checkbox" checked={maintenanceModeEnabled} onChange={e => setMaintenanceModeEnabled(e.target.checked)} className="accent-[#C06F30] w-4 h-4" />
                <span className="text-base">Maintenance Mode</span>
              </label>
              <button
                onClick={() => {
                  updateSettingsBulk.mutate({
                    auto_trial_enabled: String(autoTrialEnabled),
                    auto_trial_days: String(autoTrialDays),
                    trial_credits: String(trialCredits),
                    trial_start_date: trialStartDate,
                    trial_end_date: trialEndDate,
                    trial_enabled: String(trialEnabled),
                    maintenance_mode: String(maintenanceModeEnabled),
                  });
                  showToast("Settings saved!");
                }}
                className="w-full py-3 rounded-lg font-bold text-base transition-opacity hover:opacity-90"
                style={{ background: C, color: "#fff" }}
              >
                Save Settings
              </button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
