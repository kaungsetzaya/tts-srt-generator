import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Users,
  Crown,
  Clock,
  Plus,
  Shield,
  Settings,
  Search,
  LogOut,
  BarChart3,
  Ban,
  CheckCircle,
  Check,
  Activity,
  Zap,
  HardDrive,
  Server,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Mic,
  FileVideo,
  AlertTriangle,
  TrendingDown,
  UserCheck,
  UserX,
  Bug,
  RefreshCw,
  X,
  Circle,
  Info,
  Banknote,
  CreditCard,
  Calendar,
  Trash2,
  Sparkles,
  History,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

type Plan =
  | "trial"
  | "starter"
  | "creator"
  | "pro";
type MainTab = "analytics" | "users" | "reports" | "transactions" | "settings";
type TimeFrame = "week" | "month" | "year" | "all";
type PaymentMethod =
  | "kpay"
  | "wave"
  | "cbpay"
  | "ayapay"
  | "bank"
  | "cash"
  | "free";

const PLAN_LABELS: Record<Plan, string> = {
  trial: "Trial (15cr)",
  starter: "Starter Pack (50cr)",
  creator: "Creator Pack (200cr)",
  pro: "Pro Pack (500cr)",
};
const PLAN_PRICE: Record<Plan, number> = {
  trial: 0,
  starter: 15000,
  creator: 35000,
  pro: 75000,
};
const PLAN_CREDITS: Record<Plan, number> = {
  trial: 15,
  starter: 50,
  creator: 200,
  pro: 500,
};
const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  kpay: "KBZ Pay",
  wave: "Wave Pay",
  cbpay: "CB Pay",
  ayapay: "AYA Pay",
  bank: "Bank Transfer",
  cash: "Cash",
  free: "Free / Promo",
};
const FEATURE_LABELS: Record<string, string> = {
  tts: "TTS Generator",
  video_upload: "Video Upload",
  video_link: "Video Link",
};
const FEATURE_ICONS: Record<string, any> = {
  tts: Mic,
  video_upload: FileVideo,
  video_link: FileVideo,
};

// ── Accent colors ──────────────────────────────────────────────
const C = "#C06F30"; // copper
const C_GOLD = "#F4B34F"; // gold
const C_BG = "#070707"; // deep black background
const cardBg = "linear-gradient(145deg, rgba(20,18,16,0.95) 0%, rgba(14,12,10,0.98) 100%)"; // rich dark card
const border = "rgba(192,111,48,0.2)";
const glassBorder = "rgba(244,179,79,0.08)";
const cardShadow = "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)";

function StatBox({
  label,
  value,
  color = C,
  sub,
  icon,
}: {
  label: string;
  value: any;
  color?: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{ background: cardBg, borderColor: border, boxShadow: cardShadow }}
      className="border p-5 rounded-2xl relative overflow-hidden group hover:border-opacity-60 transition-all"
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 0%, ${color}08, transparent 70%)` }}
      />
      <p className="text-[10px] uppercase tracking-[0.2em] opacity-40 mb-3 font-medium">
        {label}
      </p>
      <p className="text-3xl font-black tracking-tight" style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-[11px] opacity-30 mt-1.5 font-medium">{sub}</p>}
    </div>
  );
}

function MiniBar({
  label,
  count,
  max,
  color = C,
}: {
  label: string;
  count: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-28 text-xs font-bold truncate opacity-80">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-white/5">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="text-xs font-black w-10 text-right" style={{ color }}>
        {count}
      </div>
      <div className="text-xs opacity-30 w-8 text-right">{pct}%</div>
    </div>
  );
}

// ── User Detail Drawer ─────────────────────────────────────────
function UserDetailDrawer({
  userId,
  userName,
  onClose,
}: {
  userId: string;
  userName: string;
  onClose: () => void;
}) {
  const { data, isLoading } = trpc.adminStats.getUserDetail.useQuery(
    { userId },
    { refetchInterval: 3000 }
  );

  const fmtDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };
  // Use user's real timezone (auto-detected)
  const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fmtTime = (d: any) =>
    !d
      ? "—"
      : new Date(d).toLocaleString("en-US", {
          timeZone: userTZ,
          day: "2-digit",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

  const maxVoice = Math.max(...(data?.voices?.map(v => v.count) ?? [1]));
  const maxHour = Math.max(...(data?.activeHours?.map(h => h.count) ?? [1]));
  const maxDaily = Math.max(...(data?.daily?.map(d => d.count) ?? [1]));

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl h-full overflow-y-auto"
        style={{ background: C_BG, borderLeft: `1px solid ${border}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: border, background: C_BG }}
        >
          <div>
            <p className="font-black text-lg" style={{ color: C }}>
              {userName}
            </p>
            <p className="text-xs opacity-40">30-day activity breakdown</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: C }} />
          </div>
        ) : !data ? (
          <div className="p-8 text-center opacity-40">No data available</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Total Gens (30d)" value={data.totalGens} />
              <StatBox
                label="Last 7 Days"
                value={data.recentGens}
                color="#4ade80"
              />
              <StatBox
                label="Total Characters"
                value={`${(data.totalChars / 1000).toFixed(1)}K`}
                color="#60a5fa"
              />
              <StatBox
                label="Total Audio Duration"
                value={fmtDuration(data.totalDurationMs)}
                color={C_GOLD}
              />
            </div>

            {/* Success / Fail */}
            <div
              style={{ background: cardBg, borderColor: border }}
              className="border rounded-xl p-5"
            >
              <p className="font-bold uppercase tracking-wider text-xs mb-4 opacity-60">
                Processing Status
              </p>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-sm font-bold text-green-400">
                    {data.statusBreakdown.success} Success
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="text-sm font-bold text-red-400">
                    {data.statusBreakdown.fail} Failed
                  </span>
                </div>
                <div className="ml-auto text-xs opacity-40">
                  {data.totalGens > 0
                    ? `${Math.round((data.statusBreakdown.success / data.totalGens) * 100)}% success rate`
                    : "—"}
                </div>
              </div>
              {data.statusBreakdown.fail > 0 && (
                <div className="mt-4 h-2 rounded-full bg-red-500/30">
                  <div
                    className="h-2 rounded-full bg-green-400"
                    style={{
                      width: `${Math.round((data.statusBreakdown.success / data.totalGens) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Feature Usage */}
            <div
              style={{ background: cardBg, borderColor: border }}
              className="border rounded-xl p-5"
            >
              <p className="font-bold uppercase tracking-wider text-xs mb-4 opacity-60">
                Feature Usage
              </p>
              {data.features.map(f => (
                <MiniBar
                  key={f.feature}
                  label={FEATURE_LABELS[f.feature] ?? f.feature}
                  count={f.count}
                  max={data.totalGens}
                />
              ))}
            </div>

            {/* Voice/Character Usage */}
            <div
              style={{ background: cardBg, borderColor: border }}
              className="border rounded-xl p-5"
            >
              <p className="font-bold uppercase tracking-wider text-xs mb-4 opacity-60">
                Voice / Character Usage
              </p>
              {data.voices.length === 0 ? (
                <p className="text-xs opacity-40">No voice data</p>
              ) : (
                data.voices.map(v => (
                  <MiniBar
                    key={v.name}
                    label={v.name}
                    count={v.count}
                    max={maxVoice}
                    color="#C06F30"
                  />
                ))
              )}
            </div>

            {/* Active Hours Heatmap */}
            <div
              style={{ background: cardBg, borderColor: border }}
              className="border rounded-xl p-5"
            >
              <p className="font-bold uppercase tracking-wider text-xs mb-4 opacity-60">
                Active Hours (24h)
              </p>
              <div className="grid grid-cols-12 gap-1">
                {Array.from({ length: 24 }, (_, h) => {
                  const found = data.activeHours.find(a => a.hour === h);
                  const cnt = found?.count ?? 0;
                  const intensity = maxHour > 0 ? cnt / maxHour : 0;
                  return (
                    <div
                      key={h}
                      title={`${h}:00 — ${cnt} gens`}
                      className="flex flex-col items-center gap-1"
                    >
                      <div
                        className="w-full h-8 rounded"
                        style={{
                          background: `rgba(192,111,48,${Math.max(0.05, intensity)})`,
                        }}
                      />
                      {h % 6 === 0 && (
                        <span className="text-[9px] opacity-40">{h}h</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Daily Generations Mini Chart */}
            <div
              style={{ background: cardBg, borderColor: border }}
              className="border rounded-xl p-5"
            >
              <p className="font-bold uppercase tracking-wider text-xs mb-4 opacity-60">
                Daily Generations (30d)
              </p>
              <div className="flex items-end gap-1 h-16">
                {data.daily.map(d => {
                  const h =
                    maxDaily > 0 ? Math.round((d.count / maxDaily) * 64) : 4;
                  return (
                    <div
                      key={d.date}
                      title={`${d.date}: ${d.count}`}
                      className="flex-1 rounded-t transition-all hover:opacity-80"
                      style={{
                        height: `${h}px`,
                        background: C,
                        minHeight: "4px",
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Recent Logs */}
            <div
              style={{ background: cardBg, borderColor: border }}
              className="border rounded-xl p-5"
            >
              <p className="font-bold uppercase tracking-wider text-xs mb-4 opacity-60">
                Recent Activity Logs
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.recentLogs.map(log => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 text-xs py-2 border-b border-white/5"
                  >
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${log.status === "fail" ? "bg-red-400" : "bg-green-400"}`}
                    />
                    <span className="opacity-50 w-8">
                      {FEATURE_LABELS[log.feature ?? "tts"]?.substring(0, 3)}
                    </span>
                    <span className="font-mono opacity-60">
                      {log.voice ?? log.character ?? "—"}
                    </span>
                    <span className="opacity-40">{log.charCount}c</span>
                    {log.durationMs ? (
                      <span className="opacity-40">
                        {fmtDuration(log.durationMs)}
                      </span>
                    ) : null}
                    {log.status === "fail" && (
                      <span className="text-red-400 truncate flex-1">
                        {log.errorMsg}
                      </span>
                    )}
                    <span className="ml-auto opacity-30 flex-shrink-0">
                      {fmtTime(log.createdAt)}
                    </span>
                  </div>
                ))}
                {data.recentLogs.length === 0 && (
                  <p className="text-xs opacity-40 text-center py-4">
                    No recent activity
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── USAGE HISTORY TAB ───────────────────────────── */}
        {tab === "transactions" && (
          <div className="space-y-5">
             <div className="flex items-center justify-between">
              <h2 className="font-black uppercase tracking-widest text-lg flex items-center gap-2" style={{ color: C }}>
                <History className="w-5 h-5" /> Credit Usage History
              </h2>
              <button
                onClick={() => refetchTransactions()}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border rounded-lg opacity-60 hover:opacity-100 transition-all font-bold"
                style={{ borderColor: border }}
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            <div className="border rounded-xl overflow-hidden shadow-2xl" style={{ background: cardBg, borderColor: border }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b uppercase tracking-wider opacity-40" style={{ borderColor: border, background: "rgba(255,255,255,0.02)" }}>
                    <th className="text-left p-4">Time</th>
                    <th className="text-left p-4">User</th>
                    <th className="text-left p-4">Type</th>
                    <th className="text-left p-4">Description</th>
                    <th className="text-right p-4">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions?.map((t: any) => {
                    const isPositive = t.amount > 0;
                    return (
                      <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-4 opacity-40 whitespace-nowrap">{new Date(t.createdAt).toLocaleString("en-GB", { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'})}</td>
                        <td className="p-4">
                           <div className="flex flex-col">
                             <span className="font-bold">{t.userName}</span>
                             <span className="text-[10px] opacity-30">@{t.userUsername}</span>
                           </div>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: "rgba(255,255,255,0.1)" }}>
                            {t.type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-4 opacity-60 max-w-xs truncate">{t.description}</td>
                        <td className="p-4 text-right">
                          <div className={`flex items-center justify-end gap-1 font-black ${isPositive ? "text-green-400" : "text-amber-500"}`}>
                             {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                             <span className="text-sm">{isPositive ? "+" : ""}{t.amount}</span>
                             <span className="text-[10px] opacity-40 font-normal">credits</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!transactions?.length && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center opacity-30 italic">No transactions found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const [tab, setTab] = useState<MainTab>("analytics");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("starter");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("kpay");
  const [transactionId, setTransactionId] = useState("");
  const [showSubModal, setShowSubModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "info";
  }>({ show: false, title: "", message: "", onConfirm: () => {} });
  const [autoTrialEnabled, setAutoTrialEnabled] = useState(false);
  const [autoTrialDays, setAutoTrialDays] = useState(7);
  const [trialCredits, setTrialCredits] = useState(15);
  const [maintenanceModeEnabled, setMaintenanceModeEnabled] = useState(false);
  const [timeframe, setTimeframe] = useState<TimeFrame>("month");
  const [userDrawer, setUserDrawer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [churnTab, setChurnTab] = useState<"active" | "inactive">("active");
  const [revenueMonth, setRevenueMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [paymentSlipBase64, setPaymentSlipBase64] = useState("");
  const [paymentSlipPreview, setPaymentSlipPreview] = useState("");

  const getDefaultDays = (plan: Plan): number => {
    return 3650; // Lifetime (10 years) for credit-based system
  };

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
  };

  const { data: me } = trpc.auth.me.useQuery();
  const { data: users, refetch } = trpc.admin.getUsers.useQuery(undefined, {
    refetchInterval: 3000,
  });
  const { data: analytics } = trpc.admin.getAnalytics.useQuery();
  const { data: health } = trpc.admin.getServerHealth.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const { data: voiceStats, refetch: refetchVoice } =
    trpc.adminStats.getVoiceStats.useQuery({ timeframe });
  const { data: generationOverview } =
    trpc.adminStats.getGenerationOverview.useQuery();
  const { data: errorData, refetch: refetchErrors } =
    trpc.adminStats.getErrorLogs.useQuery({ limit: 50, onlyUnresolved: false });
  const { data: churnData } = trpc.adminStats.getChurnStats.useQuery();
  const { data: onlineStats } = trpc.adminStats.onlineUsers.useQuery(
    undefined,
    { refetchInterval: 60000 }
  );
  const { data: transactions, refetch: refetchTransactions } = trpc.admin.getTransactions.useQuery(undefined, {
    enabled: tab === "transactions"
  });
  const [trialStartDate, setTrialStartDate] = useState("");
  const [trialEndDate, setTrialEndDate] = useState("");
  const [trialEnabled, setTrialEnabled] = useState(false);
  const { data: settingsData } = trpc.settings.get.useQuery(undefined);
  useEffect(() => {
    if (!settingsData) return;
    const d = settingsData;
    setAutoTrialEnabled(d.autoTrialEnabled === 'true' || d.autoTrialEnabled === true);
    setAutoTrialDays(Number(d.autoTrialDays) || 7);
    setTrialCredits(Number(d.trialCredits) || 15);
    setTrialStartDate(d.trialStartDate || "");
    setTrialEndDate(d.trialEndDate || "");
    setTrialEnabled(d.trialEnabled === 'true' || d.trialEnabled === true);
    setMaintenanceModeEnabled(d.maintenanceModeEnabled === 'true' || d.maintenanceModeEnabled === true);
  }, [settingsData]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/login";
    },
  });
  const giveSub = trpc.admin.giveSubscription.useMutation({
    onSuccess: () => {
      refetch();
      setTimeout(() => refetch(), 500);
      setShowSubModal(false);
      setSelectedUser(null);
      setNote("");
      setTransactionId("");
      setPaymentMethod("kpay");
      setPaymentSlipBase64("");
      setPaymentSlipPreview("");
    },
  });
  const cancelSub = trpc.admin.cancelSubscription.useMutation({
    onSuccess: () => refetch(),
  });
  const setRole = trpc.admin.setRole.useMutation({
    onSuccess: () => refetch(),
  });
  const banUser = trpc.admin.banUser.useMutation({
    onSuccess: () => refetch(),
  });
  const queryClient = trpc.useUtils();
  const utils = trpc.useUtils();
  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
    },
  });
  const resolveError = trpc.adminStats.resolveError.useMutation({
    onSuccess: () => refetchErrors(),
  });
  const dismissFailedGen = trpc.adminStats.dismissFailedGen.useMutation({
    onSuccess: () => refetchErrors(),
  });
  const deleteSystemLog = trpc.adminStats.deleteSystemLog.useMutation({
    onSuccess: () => refetchErrors(),
  });
  const deleteAllFailedGens = trpc.adminStats.deleteAllFailedGens.useMutation({
    onSuccess: () => refetchErrors(),
  });
  const resolveAllErrors = trpc.adminStats.resolveAllErrors.useMutation({
    onSuccess: () => refetchErrors(),
  });
  const deleteAllSystemLogs = trpc.adminStats.deleteAllSystemLogs.useMutation({
    onSuccess: () => refetchErrors(),
  });
  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: () => refetch(),
  });

  if (me?.role !== "admin")
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-red-500 text-xl font-bold">Access Denied</p>
      </div>
    );

  // Use user's real timezone (auto-detected by browser)
  const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fmt = (d: any) =>
    !d
      ? "—"
      : new Date(d).toLocaleDateString("en-US", {
          timeZone: userTZ,
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  const fmtTime = (d: any) =>
    !d
      ? "Never"
      : new Date(d).toLocaleString("en-US", {
          timeZone: userTZ,
          day: "2-digit",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
  const daysLeft = (d: any) =>
    !d
      ? null
      : Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000));
  const fmtUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };
  const fmtMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : m > 0 ? `${m}m` : `${s}s`;
  };

  const normalUsers = users?.filter((u: any) => u.role !== "admin") ?? [];
  const adminUsers = users?.filter((u: any) => u.role === "admin") ?? [];
  const filteredUsers = normalUsers.filter(
    (u: any) =>
      (u.telegramFirstName ?? "")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (u.telegramUsername ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const activeSubs = normalUsers.filter((u: any) => u.subscription).length;
  const totalRevenue =
    analytics?.planCounts?.reduce(
      (sum: number, p: any) =>
        sum + (PLAN_PRICE[p.plan as Plan] ?? 0) * p.count,
      0
    ) ?? 0;
  const fmtMMK = (v: number) => `${(v ?? 0).toLocaleString()} MMK`;
  const maxVoice = Math.max(
    ...(voiceStats?.voices?.map((v: any) => v.count) ?? [1])
  );
  const totalErrors =
    (errorData?.failedGenerations?.length ?? 0) +
    (errorData?.systemLogs?.filter((l: any) => !l.resolved).length ?? 0);

  return (
    <div className="min-h-screen text-foreground" style={{ background: C_BG }}>
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full blur-[180px]" style={{ background: "rgba(192,111,48,0.04)" }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full blur-[180px]" style={{ background: "rgba(244,179,79,0.03)" }} />
      </div>

      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* User Detail Drawer */}
      {userDrawer && (
        <UserDetailDrawer
          userId={userDrawer.id}
          userName={userDrawer.name}
          onClose={() => setUserDrawer(null)}
        />
      )}

      {/* Top Bar */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-8 py-4 border-b backdrop-blur-2xl"
        style={{ borderColor: "rgba(192,111,48,0.15)", background: "rgba(7,7,7,0.85)" }}
      >
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" style={{ color: C }} />
          <span
            className="font-black uppercase tracking-widest text-sm"
            style={{ color: C }}
          >
            LUMIX Admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ background: `${C}15`, border: `1px solid ${border}` }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C_GOLD }}>Live</span>
          </div>
          <a
            href="/lumix"
            className="text-[11px] px-4 py-2 border rounded-xl opacity-60 hover:opacity-100 transition-all uppercase tracking-wider font-bold"
            style={{ borderColor: border }}
          >
            App
          </a>
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex items-center gap-1.5 text-[11px] px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 rounded-xl transition-all uppercase tracking-wider font-bold"
          >
            <LogOut className="w-3 h-3" /> Logout
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              {
                label: "🟢 Online Now",
                value: onlineStats?.onlineCount ?? 0,
                color: "#4ade80",
                sub: "Active in last 15min",
              },
              {
                label: "🎙️ TTS (Month)",
                value: analytics?.totalConversions ?? 0,
                color: C,
                sub: `${analytics?.totalConversions ?? 0} total conversions`,
              },
              {
                label: "🎬 Video (Month)",
                value: analytics?.totalConversions ?? 0,
                color: C_GOLD,
                sub: `${analytics?.activeSubs ?? 0} active subs`,
              },
              {
                label: "Total Users",
                value: analytics?.totalUsers ?? 0,
                color: C,
                sub: `${analytics?.activeSubs ?? 0} subscribed`,
              },
            ].map(({ label, value, color, sub }) => (
              <div
                key={label}
                className="border rounded-2xl p-5 relative overflow-hidden group hover:border-opacity-60 transition-all"
                style={{ background: cardBg, borderColor: border, boxShadow: cardShadow }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ background: `radial-gradient(circle at 50% 0%, ${color}08, transparent 70%)` }}
                />
                <p className="text-[10px] uppercase tracking-[0.2em] opacity-40 mb-3 font-medium">
                  {label}
                </p>
                <p className="text-3xl font-black tracking-tight" style={{ color }}>
                  {value}
                </p>
                <p className="text-[11px] opacity-30 mt-1.5 font-medium">{sub}</p>
              </div>
            ))}
          </div>

        {/* Main Tabs */}
        <div
          className="flex gap-1 mb-8 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          {(
            [
              { id: "analytics", label: "Analytics", icon: BarChart3 },
              { id: "users", label: "Users", icon: Users },
              { id: "reports", label: "Error Reports", icon: Bug },
              { id: "transactions", label: "Usage History", icon: History },
              { id: "settings", label: "Settings", icon: Settings },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] border-b-2 transition-all -mb-px ${
                tab === id
                  ? "border-[#C06F30] text-[#C06F30]"
                  : "border-transparent opacity-30 hover:opacity-60"
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
              {id === "reports" && totalErrors > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  {totalErrors}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── ANALYTICS TAB ─────────────────────────────────── */}
        {tab === "analytics" && (
          <div className="space-y-5">
            {/* Generation Overview */}
            <div
              className="border rounded-2xl p-6"
              style={{ background: cardBg, borderColor: border, boxShadow: cardShadow }}
            >
              <h3
                className="font-bold uppercase tracking-wider mb-4 flex items-center gap-2"
                style={{ color: C }}
              >
                <Activity className="w-4 h-4" /> Generation Overview
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Today", value: generationOverview?.today ?? 0 },
                  {
                    label: "This Week",
                    value: generationOverview?.thisWeek ?? 0,
                  },
                  {
                    label: "This Month",
                    value: generationOverview?.thisMonth ?? 0,
                  },
                  {
                    label: "All Time",
                    value: generationOverview?.allTime ?? 0,
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="border rounded-xl p-4 text-center"
                    style={{ borderColor: border }}
                  >
                    <p className="text-xs opacity-40 uppercase tracking-wider mb-2">
                      {label}
                    </p>
                    <p className="text-2xl font-black" style={{ color: C }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Voice / Character Stats with Timeframe */}
            <div
              className="border rounded-xl p-6"
              style={{ background: cardBg, borderColor: border }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3
                  className="font-bold uppercase tracking-wider flex items-center gap-2"
                  style={{ color: C }}
                >
                  <Mic className="w-4 h-4" /> Voice &amp; Character Usage
                </h3>
                <div className="flex gap-1">
                  {(["week", "month", "year", "all"] as TimeFrame[]).map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-3 py-1 text-xs font-bold uppercase rounded-lg border transition-all ${timeframe === tf ? "" : "border-transparent opacity-50 hover:opacity-100"}`}
                      style={{
                        background: timeframe === tf ? C : "transparent",
                        borderColor: timeframe === tf ? C : border,
                        color: "var(--foreground)",
                      }}
                    >
                      {tf === "all"
                        ? "All Time"
                        : `1 ${tf.charAt(0).toUpperCase() + tf.slice(1)}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs uppercase tracking-wider opacity-50 mb-3">
                    Voices Ranked
                  </p>
                  {voiceStats?.voices?.length === 0 && (
                    <p className="text-xs opacity-30">No data</p>
                  )}
                  {voiceStats?.voices?.map((v: any) => (
                    <MiniBar
                      key={v.name}
                      label={v.name}
                      count={v.count}
                      max={maxVoice}
                      color={v.name?.startsWith("[Character]") ? "#F4B34F" : C}
                    />
                  ))}
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider opacity-50 mb-3">
                      Feature Breakdown
                    </p>
                    {voiceStats?.features?.map((f: any) => {
                      const Icon = FEATURE_ICONS[f.feature] ?? Mic;
                      return (
                        <div
                          key={f.feature}
                          className="flex items-center gap-3 py-2 border-b border-white/5"
                        >
                          <Icon className="w-4 h-4 opacity-50" />
                          <span className="text-sm flex-1">
                            {FEATURE_LABELS[f.feature] ?? f.feature}
                          </span>
                          <span
                            className="font-black text-sm"
                            style={{ color: C }}
                          >
                            {f.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div
                      className="border rounded-xl p-3 text-center"
                      style={{ borderColor: border }}
                    >
                      <p className="text-xs opacity-40 mb-1">Total Chars</p>
                      <p className="text-lg font-black text-blue-400">
                        {((voiceStats?.totalChars ?? 0) / 1000).toFixed(1)}K
                      </p>
                    </div>
                    <div
                      className="border rounded-xl p-3 text-center"
                      style={{ borderColor: border }}
                    >
                      <p className="text-xs opacity-40 mb-1">Audio Generated</p>
                    <p className="text-lg font-black" style={{ color: C_GOLD }}>
                        {fmtMs(voiceStats?.totalDurationMs ?? 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Churn Rate + Active/Inactive */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                className="border rounded-xl p-6"
                style={{ background: cardBg, borderColor: border }}
              >
                <h3 className="font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-orange-400">
                  <TrendingDown className="w-4 h-4" /> Churn Rate
                </h3>
                <p className="text-5xl font-black text-orange-400">
                  {churnData?.churnRate ?? 0}%
                </p>
                <p className="text-xs opacity-40 mt-2">
                  Users inactive 14+ days
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <p className="text-xl font-black text-green-400">
                      {churnData?.activeCount ?? 0}
                    </p>
                    <p className="text-xs opacity-40">Active</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black text-red-400">
                      {churnData?.inactiveCount ?? 0}
                    </p>
                    <p className="text-xs opacity-40">Inactive</p>
                  </div>
                </div>
              </div>

              <div
                className="md:col-span-2 border rounded-xl p-6"
                style={{ background: cardBg, borderColor: border }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => setChurnTab("active")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${churnTab === "active" ? "border-green-500 text-green-400 bg-green-500/10" : "border-white/10 opacity-50"}`}
                  >
                    <UserCheck className="w-3 h-3" /> Active Users (
                    {churnData?.activeCount ?? 0})
                  </button>
                  <button
                    onClick={() => setChurnTab("inactive")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${churnTab === "inactive" ? "border-red-500 text-red-400 bg-red-500/10" : "border-white/10 opacity-50"}`}
                  >
                    <UserX className="w-3 h-3" /> Inactive (
                    {churnData?.inactiveCount ?? 0})
                  </button>
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {(churnTab === "active"
                    ? churnData?.activeUsers
                    : churnData?.inactiveUsers
                  )?.map((u: any) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 py-2 border-b border-white/5 text-xs"
                    >
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${churnTab === "active" ? "bg-green-400" : "bg-red-400"}`}
                      />
                      <span className="font-bold w-28 truncate">
                        {u.name ?? "—"}
                      </span>
                      <span className="opacity-40">@{u.username ?? "—"}</span>
                      <span className="ml-auto font-black" style={{ color: C }}>
                        {u.totalGens} gens
                      </span>
                      <span className="opacity-30">
                        {u.lastActive ? fmtTime(u.lastActive) : "Never"}
                      </span>
                    </div>
                  ))}
                  {!(
                    churnTab === "active"
                      ? churnData?.activeUsers
                      : churnData?.inactiveUsers
                  )?.length && (
                    <p className="text-xs opacity-30 text-center py-6">
                      No {churnTab} users
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Revenue + Server Health */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                className="border rounded-xl p-6"
                style={{ background: cardBg, borderColor: border }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold uppercase tracking-wider flex items-center gap-2 text-amber-600">
                    <Banknote className="w-4 h-4" /> Revenue (Active Subs)
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const [y, m] = revenueMonth.split("-").map(Number);
                        const d = new Date(y, m - 2, 1);
                        setRevenueMonth(
                          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
                        );
                      }}
                      className="p-1 hover:bg-white/10 rounded transition-all"
                    >
                      <ChevronLeft className="w-4 h-4 opacity-50" />
                    </button>
                    <span className="text-xs font-bold opacity-60 min-w-[80px] text-center">
                      {(() => {
                        const [y, m] = revenueMonth.split("-");
                        return `${new Date(Number(y), Number(m) - 1).toLocaleString("en", { month: "short" })} ${y}`;
                      })()}
                    </span>
                    <button
                      onClick={() => {
                        const [y, m] = revenueMonth.split("-").map(Number);
                        const d = new Date(y, m, 1);
                        const now = new Date();
                        if (d <= now)
                          setRevenueMonth(
                            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
                          );
                      }}
                      className="p-1 hover:bg-white/10 rounded transition-all"
                    >
                      <ChevronRight className="w-4 h-4 opacity-50" />
                    </button>
                  </div>
                </div>
                {analytics?.planCounts?.map((p: any) => (
                  <div
                    key={p.plan}
                    className="flex justify-between items-center border-b py-2"
                    style={{ borderColor: "rgba(255,255,255,0.05)" }}
                  >
                    <div>
                      <span className="text-sm font-bold">
                        {PLAN_LABELS[p.plan as Plan] ?? p.plan}
                      </span>
                      <span className="text-xs opacity-40 ml-2">
                        × {p.count}
                      </span>
                    </div>
                    <span className="font-bold text-amber-600">
                      {fmtMMK((PLAN_PRICE[p.plan as Plan] ?? 0) * p.count)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-3">
                  <span className="font-bold uppercase text-xs opacity-60">
                    Total Estimated
                  </span>
                  <span className="font-black text-amber-600 text-lg">
                    {fmtMMK(totalRevenue)}
                  </span>
                </div>
              </div>

              <div
                className="border rounded-xl p-6"
                style={{ background: cardBg, borderColor: border }}
              >
                <h3 className="font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-green-400">
                  <Server className="w-4 h-4" /> Server Health{" "}
                  <span className="text-xs font-normal opacity-40">
                    (auto 30s)
                  </span>
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Memory",
                      value: `${health?.memory?.used ?? 0} MB`,
                      color: "text-yellow-400",
                    },
                    {
                      label: "Heap",
                      value: `${health?.memory?.heap ?? 0} MB`,
                      color: "text-yellow-400",
                    },
                    {
                      label: "Disk",
                      value: health?.disk ?? "—",
                      color: "text-blue-400",
                    },
                    {
                      label: "Uptime",
                      value: fmtUptime(health?.uptime ?? 0),
                      color: "text-green-400",
                    },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="border rounded-lg p-3 text-center"
                      style={{ borderColor: border }}
                    >
                      <p className="text-xs opacity-40 mb-1">{label}</p>
                      <p className={`text-base font-black ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── USERS TAB ──────────────────────────────────────── */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or username..."
                className="w-full pl-9 pr-4 py-2.5 border text-sm focus:outline-none rounded-xl"
                style={{ background: cardBg, borderColor: border }}
              />
            </div>

            <div
              className="border rounded-xl overflow-hidden"
              style={{ background: cardBg, borderColor: border }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="border-b text-xs uppercase tracking-wider opacity-50"
                    style={{ borderColor: border }}
                  >
                    <th className="text-left p-3">User</th>
                    <th className="text-left p-3">Plan</th>
                    <th className="text-center p-3">Gens</th>
                    <th className="text-left p-3">Last Active</th>
                    <th className="text-center p-3">Credits</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user: any) => {
                    const isBanned = !!user.banned;
                    const genCount = user.genCount ?? 0;
                    const displayName = user.name ?? "—";
                    const username = user.username ?? "—";
                    return (
                      <tr
                        key={user.id}
                        className={`border-b transition-colors hover:bg-white/5 ${isBanned ? "opacity-40" : ""}`}
                        style={{ borderColor: "rgba(255,255,255,0.05)" }}
                      >
                        <td className="p-3">
                          {/* Clickable name to open detail drawer */}
                          <button
                            onClick={() =>
                              setUserDrawer({ id: user.id, name: displayName })
                            }
                            className="text-left hover:underline group"
                          >
                            <p className="font-bold group-hover:text-[#C06F30] transition-colors">
                              {displayName}
                            </p>
                            <p className="text-xs opacity-40">@{username}</p>
                          </button>
                        </td>
                        <td className="p-3">
                          {user.subscription ? (
                            <span className="text-xs px-2 py-1 rounded-md bg-green-500/20 text-green-400 font-bold uppercase">
                              {PLAN_LABELS[user.subscription.plan as Plan] ??
                                user.subscription.plan}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded-md bg-red-500/20 text-red-400 font-bold">
                              No Sub
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className="font-black text-sm"
                            style={{ color: C }}
                          >
                            {genCount}
                          </span>
                        </td>
                        <td className="p-3 text-xs opacity-50">
                          {fmtTime(user.lastLoginAt)}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className="text-xs font-bold"
                            style={{ color: C_GOLD }}
                          >
                            💰 {user.credits ?? 0}
                          </span>
                        </td>
                        <td className="p-3">
                          {isBanned ? (
                            <span className="text-xs px-2 py-1 rounded-md bg-red-500/20 text-red-400 font-bold">
                              BANNED
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded-md bg-green-500/20 text-green-400 font-bold">
                              ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1 flex-wrap">
                            <button
                              onClick={() => {
                                setSelectedUser(user.id);
                                setShowSubModal(true);
                              }}
                              className="flex items-center gap-1 text-xs px-2 py-1 border rounded-lg transition-all hover:bg-white/10"
                              style={{ borderColor: C, color: C }}
                            >
                              <Plus className="w-3 h-3" /> Sub
                            </button>
                            {user.subscription && (
                              <button
                                onClick={() => {
                                  setConfirmModal({
                                    show: true,
                                    title: "Cancel Subscription",
                                    message:
                                      "Are you sure you want to cancel this user's subscription? This action cannot be undone.",
                                    variant: "danger",
                                    onConfirm: () =>
                                      cancelSub.mutate({ userId: user.id }),
                                  });
                                }}
                                className="text-xs px-2 py-1 border border-red-500/50 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setConfirmModal({
                                  show: true,
                                  title: isBanned ? "Unban User" : "Ban User",
                                  message: isBanned
                                    ? "Are you sure you want to unban this user? They will regain access to the platform."
                                    : "Are you sure you want to ban this user? They will lose access to the platform immediately.",
                                  variant: isBanned ? "info" : "warning",
                                  confirmText: isBanned ? "Unban" : "Ban",
                                  onConfirm: () =>
                                    banUser.mutate({
                                      userId: user.id,
                                      ban: !isBanned,
                                    }),
                                });
                              }}
                              className={`flex items-center gap-1 text-xs px-2 py-1 border rounded-lg transition-all ${isBanned ? "border-green-500/50 text-green-400 hover:bg-green-500/20" : "border-orange-500/50 text-orange-400 hover:bg-orange-500/20"}`}
                            >
                              {isBanned ? (
                                <>
                                  <CheckCircle className="w-3 h-3" />
                                  Unban
                                </>
                              ) : (
                                <>
                                  <Ban className="w-3 h-3" />
                                  Ban
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setConfirmModal({
                                  show: true,
                                  title: "Delete User",
                                  message: `Delete user "${displayName}" (@${username})? This will permanently remove their account, subscriptions, and all generation history. This action cannot be undone.`,
                                  variant: "danger",
                                  confirmText: "Delete",
                                  onConfirm: () =>
                                    deleteUser.mutate({ userId: user.id }),
                                });
                              }}
                              className="flex items-center gap-1 text-xs px-2 py-1 border border-red-600/50 text-red-500 hover:bg-red-600/20 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center opacity-30">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Admins Section */}
            <div
              className="border rounded-xl p-5"
              style={{ background: cardBg, borderColor: border }}
            >
              <h3 className="font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-yellow-400">
                <Shield className="w-4 h-4" /> Admin Accounts
              </h3>
              <div className="space-y-2">
                {adminUsers.map((user: any) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between py-2 border-b border-white/5"
                  >
                    <div>
                      <span className="font-bold">{user.name ?? "—"}</span>
                      <span className="text-xs opacity-40 ml-2">
                        @{user.username ?? "—"}
                      </span>
                    </div>
                    {user.id !== me?.userId ? (
                      <button
                        onClick={() => {
                          if (confirm("Remove admin role?"))
                            setRole.mutate({ userId: user.id, role: "user" });
                        }}
                        className="text-xs px-2 py-1 border border-red-500/50 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                      >
                        Remove Admin
                      </button>
                    ) : (
                      <span className="text-xs opacity-40 italic">You</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ERROR REPORTS TAB ─────────────────────────────── */}
        {tab === "reports" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2
                className="font-black uppercase tracking-widest text-lg flex items-center gap-2"
                style={{ color: C }}
              >
                <Bug className="w-5 h-5" /> Error & Bug Reports
              </h2>
              <button
                onClick={() => refetchErrors()}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border rounded-lg opacity-60 hover:opacity-100 transition-all font-bold"
                style={{ borderColor: border }}
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <StatBox
                label="Failed Jobs"
                value={errorData?.failedGenerations?.length ?? 0}
                color="#f87171"
              />
              <StatBox
                label="System Errors"
                value={errorData?.systemLogs?.length ?? 0}
                color="#fb923c"
              />
              <StatBox
                label="Unresolved"
                value={
                  errorData?.systemLogs?.filter((l: any) => !l.resolved)
                    .length ?? 0
                }
                color="#facc15"
              />
            </div>

            {/* Failed Generations */}
            <div
              className="border rounded-xl p-6"
              style={{ background: cardBg, borderColor: border }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold uppercase tracking-wider flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-4 h-4" /> Failed Generations
                  <span className="text-xs font-normal opacity-40 ml-1">
                    ({errorData?.failedGenerations?.length ?? 0} total)
                  </span>
                </h3>
                {errorData?.failedGenerations && errorData.failedGenerations.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete ALL failed generations?")) {
                        deleteAllFailedGens.mutate();
                      }
                    }}
                    className="text-xs px-3 py-1 border border-red-500/40 text-red-400 hover:bg-red-500/20 rounded-lg transition-all flex items-center gap-1 font-bold"
                  >
                    <X className="w-3 h-3" /> Delete All
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr
                      className="border-b opacity-40 uppercase tracking-wider"
                      style={{ borderColor: border }}
                    >
                      <th className="text-left p-2">Time</th>
                      <th className="text-left p-2">User ID</th>
                      <th className="text-left p-2">Feature</th>
                      <th className="text-left p-2">Error</th>
                      <th className="text-center p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorData?.failedGenerations?.map((e: any) => (
                      <tr
                        key={e.id}
                        className="border-b border-white/5 hover:bg-white/5"
                      >
                        <td className="p-2 opacity-40 whitespace-nowrap">
                          {fmtTime(e.createdAt)}
                        </td>
                        <td className="p-2 font-mono opacity-60">
                          {(e.userId ?? "anon").slice(0, 8)}…
                        </td>
                        <td className="p-2">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                            style={{ background: "rgba(255,255,255,0.1)" }}
                          >
                            {FEATURE_LABELS[e.feature ?? "tts"] ?? e.feature}
                          </span>
                        </td>
                        <td className="p-2 text-red-400 max-w-xs truncate">
                          {e.errorMsg ?? "Unknown error"}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => {
                              if (confirm("Dismiss this error?"))
                                dismissFailedGen.mutate({ id: e.id });
                            }}
                            className="text-xs px-2 py-0.5 border border-red-500/40 text-red-400 hover:bg-red-500/20 rounded transition-all"
                          >
                            <X className="w-3 h-3 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!errorData?.failedGenerations?.length && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center opacity-30">
                          ✓ No failed jobs recorded
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* System Error Logs */}
            <div
              className="border rounded-xl p-6"
              style={{ background: cardBg, borderColor: border }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                <h3 className="font-bold uppercase tracking-wider flex items-center gap-2 text-orange-400">
                  <Info className="w-4 h-4" /> System Error Logs
                </h3>
                {errorData?.systemLogs && errorData.systemLogs.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (confirm("Mark ALL system logs as resolved?")) resolveAllErrors.mutate();
                      }}
                      className="text-xs px-3 py-1 border border-green-500/40 text-green-400 hover:bg-green-500/20 rounded-lg transition-all font-bold flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Resolve All
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete ALL system logs permanently?")) deleteAllSystemLogs.mutate();
                      }}
                      className="text-xs px-3 py-1 border border-red-500/40 text-red-400 hover:bg-red-500/20 rounded-lg transition-all font-bold flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Delete All
                    </button>
                  </div>
                )}
              </div>
              {errorData?.systemLogs?.length === 0 ? (
                <p className="text-xs opacity-30 text-center py-6">
                  No system error logs
                </p>
              ) : (
                errorData?.systemLogs?.map((log: any) => (
                  <div
                    key={log.id}
                    className="border rounded-lg p-4 mb-3"
                    style={{
                      borderColor: log.resolved
                        ? "rgba(74,222,128,0.2)"
                        : "rgba(248,113,113,0.3)",
                      background: log.resolved
                        ? "rgba(74,222,128,0.03)"
                        : "rgba(248,113,113,0.05)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${log.severity === "error" ? "bg-red-500/20 text-red-400" : log.severity === "warn" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"}`}
                        >
                          {log.severity}
                        </span>
                        <span className="text-xs font-mono opacity-50">
                          {log.errorCode}
                        </span>
                        {/* Show source: browser errors vs app errors */}
                        {log.feature && log.feature.startsWith("browser:") ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 font-bold uppercase">
                            🌐 Browser
                          </span>
                        ) : (
                          <span className="text-xs opacity-30">
                            {FEATURE_LABELS[log.feature ?? ""] ?? log.feature}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs opacity-30">
                          {fmtTime(log.createdAt)}
                        </span>
                        {!log.resolved && (
                          <button
                            onClick={() => resolveError.mutate({ id: log.id })}
                            className="text-xs px-2 py-0.5 border border-green-500/50 text-green-400 hover:bg-green-500/20 rounded transition-all"
                          >
                            Resolve
                          </button>
                        )}
                        {log.resolved && (
                          <span className="text-xs text-green-400 opacity-60">
                            ✓ Resolved
                          </span>
                        )}
                        {/* Delete/Dismiss button for system logs */}
                        <button
                          onClick={() => {
                            if (confirm("Delete this error log?"))
                              deleteSystemLog.mutate({ id: log.id });
                          }}
                          className="text-xs px-2 py-0.5 border border-red-500/40 text-red-400 hover:bg-red-500/20 rounded transition-all"
                        >
                          <X className="w-3 h-3 inline" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs opacity-70">{log.errorMessage}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── SETTINGS TAB ──────────────────────────────────── */}
        {tab === "settings" && (
          <div className="space-y-5">
            {/* Auto Trial Settings */}
            <div
              className="border rounded-xl p-6 space-y-6 max-w-xl"
              style={{ background: cardBg, borderColor: border }}
            >
              <h2
                className="font-black uppercase tracking-widest"
                style={{ color: C }}
              >
                Settings
              </h2>

              {/* Maintenance Mode Settings */}
              <div
                className="flex items-center justify-between py-4 border-b border-red-500/20 bg-red-500/5 px-4 rounded-xl mb-4"
              >
                <div>
                  <p className="font-bold text-red-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Under Maintenance Mode
                  </p>
                  <p className="text-xs opacity-60 mt-1 max-w-[250px]">
                    Block non-admin users from accessing the app. Only Admins can bypass this.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const newVal = !maintenanceModeEnabled;
                    if (newVal) {
                      setConfirmModal({
                        show: true,
                        title: "Enable Maintenance Mode?",
                        message: "Standard users will be immediately locked out of the app. Admins will still be able to log in and use this dashboard. Are you absolutely sure?",
                        variant: "danger",
                        confirmText: "Yes, Lock It Down",
                        onConfirm: () => {
                          setMaintenanceModeEnabled(true);
                          updateSettings.mutate({ maintenanceModeEnabled: true });
                          setConfirmModal({ ...confirmModal, show: false });
                        }
                      });
                    } else {
                      setMaintenanceModeEnabled(false);
                      updateSettings.mutate({ maintenanceModeEnabled: false });
                    }
                  }}
                  className={`relative w-11 h-6 rounded-full transition-all ${maintenanceModeEnabled ? "bg-red-500" : "bg-gray-600"}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow ${maintenanceModeEnabled ? "left-6" : "left-0.5"}`}
                  />
                </button>
              </div>
              <div
                className="flex items-center justify-between py-4 border-b"
                style={{ borderColor: border }}
              >
                <div>
                  <p className="font-bold">Auto Trial on Registration</p>
                  <p className="text-xs opacity-50 mt-1">
                    New user register လုပ်တာနဲ့ auto trial ပေးမည်
                  </p>
                </div>
                <button
                  onClick={() => {
                    const newVal = !autoTrialEnabled;
                    setAutoTrialEnabled(newVal);
                    updateSettings.mutate({ autoTrialEnabled: newVal, trialCredits, trialEnabled, trialStartDate, trialEndDate });
                  }}
                  className={`relative w-11 h-6 rounded-full transition-all ${autoTrialEnabled ? "" : "bg-gray-600"}`}
                  style={{ background: autoTrialEnabled ? C : undefined }}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow ${autoTrialEnabled ? "left-6" : "left-0.5"}`}
                  />
                </button>
              </div>
              <div>
                <p className="font-bold mb-3">Trial Credits</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={trialCredits}
                    onChange={e => setTrialCredits(Number(e.target.value))}
                    className="w-24 border p-2 text-center font-bold focus:outline-none rounded-lg"
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      borderColor: border,
                      color: C,
                    }}
                  />
                  <span className="text-sm opacity-60">credits</span>
                </div>
              </div>
              <div className="pt-4 border-t" style={{ borderColor: border }}>
                <p className="font-bold mb-3">
                  Trial Period
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="trialEnabled"
                    checked={trialEnabled}
                    onChange={e => setTrialEnabled(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="trialEnabled" className="text-sm">
                    Enable trial period (users in this period get auto trial credits)
                  </label>
                </div>
                {trialEnabled && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-xs opacity-60 mb-1 block">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={trialStartDate}
                          onChange={e => setTrialStartDate(e.target.value)}
                          className="w-full border p-2 text-sm font-bold rounded-lg"
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            borderColor: border,
                            color: C,
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs opacity-60 mb-1 block">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={trialEndDate}
                          onChange={e => setTrialEndDate(e.target.value)}
                          className="w-full border p-2 text-sm font-bold rounded-lg"
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            borderColor: border,
                            color: C,
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-xs opacity-50">
                      💡 All users who register within this period will receive trial credits automatically.
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={() =>
                  updateSettings.mutate({
                    autoTrialEnabled,
                    trialCredits,
                    trialEnabled,
                    trialStartDate,
                    trialEndDate,
                  })
                }
                disabled={updateSettings.isPending}
                className="px-6 py-2.5 font-bold uppercase text-sm rounded-xl disabled:opacity-50 flex items-center gap-2"
                style={{ background: C, color: "var(--foreground)" }}
              >
                {updateSettings.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}{" "}
                Save Settings
              </button>
            </div>

            {/* ── Voice & Character Usage Per Generation ─── */}
            <div
              className="border rounded-xl p-6"
              style={{ background: cardBg, borderColor: border }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3
                  className="font-black uppercase tracking-widest flex items-center gap-2"
                  style={{ color: C }}
                >
                  <Mic className="w-5 h-5" /> Voice & Character Usage
                </h3>
                <div className="flex gap-1">
                  {(["week", "month", "year", "all"] as TimeFrame[]).map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-3 py-1 text-xs font-bold uppercase rounded-lg border transition-all ${timeframe === tf ? "" : "border-transparent opacity-50 hover:opacity-100"}`}
                      style={{
                        background: timeframe === tf ? C : "transparent",
                        borderColor: timeframe === tf ? C : border,
                        color: "var(--foreground)",
                      }}
                    >
                      {tf === "all"
                        ? "All"
                        : tf === "week"
                          ? "1W"
                          : tf === "month"
                            ? "1M"
                            : "1Y"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total Usage Summary */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div
                  className="border rounded-xl p-4 text-center"
                  style={{ borderColor: border }}
                >
                  <p className="text-xs opacity-40 mb-1 uppercase tracking-wider">
                    Total Generations
                  </p>
                  <p className="text-2xl font-black" style={{ color: C }}>
                    {voiceStats?.total ?? 0}
                  </p>
                </div>
                <div
                  className="border rounded-xl p-4 text-center"
                  style={{ borderColor: border }}
                >
                  <p className="text-xs opacity-40 mb-1 uppercase tracking-wider">
                    Characters Used
                  </p>
                  <p className="text-2xl font-black text-blue-400">
                    {((voiceStats?.totalChars ?? 0) / 1000).toFixed(1)}K
                  </p>
                </div>
                <div
                  className="border rounded-xl p-4 text-center"
                  style={{ borderColor: border }}
                >
                  <p className="text-xs opacity-40 mb-1 uppercase tracking-wider">
                    Audio Duration
                  </p>
                  <p className="text-2xl font-black" style={{ color: C_GOLD }}>
                    {fmtMs(voiceStats?.totalDurationMs ?? 0)}
                  </p>
                </div>
              </div>

              {/* Base Voice Usage (Thiha / Nilar) */}
              <div className="mb-6">
                <p className="text-xs uppercase tracking-wider opacity-50 mb-3 flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: C }}
                  />
                  Base Voice Usage — Thiha & Nilar
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(voiceStats as any)?.baseVoices?.map((v: any) => {
                    const pct =
                      (voiceStats?.total ?? 0) > 0
                        ? Math.round((v.count / (voiceStats?.total ?? 1)) * 100)
                        : 0;
                    const isThiha = v.name === "thiha";
                    const color = isThiha ? C : C_GOLD;
                    return (
                      <div
                        key={v.name}
                        className="border rounded-xl p-4 relative overflow-hidden"
                        style={{ borderColor: `${color}33` }}
                      >
                        {/* Background bar */}
                        <div
                          className="absolute inset-0 opacity-10"
                          style={{
                            background: `linear-gradient(90deg, ${color} ${pct}%, transparent ${pct}%)`,
                          }}
                        />
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ background: color }}
                              />
                              <span
                                className="font-black text-sm"
                                style={{ color }}
                              >
                                {v.displayName}
                              </span>
                              <span className="text-xs opacity-30 font-mono">
                                ({v.name})
                              </span>
                            </div>
                            <span
                              className="font-black text-lg"
                              style={{ color }}
                            >
                              {v.count}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs opacity-50">
                            <span>{(v.chars ?? 0).toLocaleString()} chars</span>
                            <span>{fmtMs(v.durationMs)} audio</span>
                            <span
                              className="ml-auto font-bold"
                              style={{ color }}
                            >
                              {pct}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!(voiceStats as any)?.baseVoices?.length && (
                    <p className="text-xs opacity-30 col-span-2 text-center py-4">
                      No voice data yet
                    </p>
                  )}
                </div>
              </div>

              {/* Character Voice Usage */}
              <div>
                <p className="text-xs uppercase tracking-wider opacity-50 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-600" />
                  Voice Change — Character Usage
                </p>
                {(voiceStats as any)?.characters?.length > 0 ? (
                  <div className="space-y-2">
                    {(voiceStats as any)?.characters?.map((ch: any) => {
                      const maxChar = Math.max(
                        ...((voiceStats as any)?.characters?.map(
                          (c: any) => c.count
                        ) ?? [1])
                      );
                      const pct =
                        maxChar > 0
                          ? Math.round((ch.count / maxChar) * 100)
                          : 0;
                      const isMale = ch.base === "thiha";
                      const color = isMale ? "#C06F30" : "#F4B34F";
                      return (
                        <div
                          key={ch.key}
                          className="border rounded-lg p-3 hover:bg-white/5 transition-all"
                          style={{ borderColor: "rgba(255,255,255,0.05)" }}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                              style={{ background: `${color}22`, color }}
                            >
                              {isMale ? "♂" : "♀"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="font-black text-sm"
                                  style={{ color }}
                                >
                                  {ch.displayName}
                                </span>
                                <span className="text-xs opacity-30 font-mono">
                                  ({ch.key})
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
                                  style={{
                                    background: `${isMale ? C : C_GOLD}22`,
                                    color: isMale ? C : C_GOLD,
                                  }}
                                >
                                  Base: {ch.baseDisplayName}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p
                                className="font-black text-lg"
                                style={{ color }}
                              >
                                {ch.count}
                              </p>
                              <p className="text-[10px] opacity-40">
                                generations
                              </p>
                            </div>
                          </div>
                          {/* Usage bar */}
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: color }}
                            />
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs opacity-40">
                            <span>
                              {(ch.chars ?? 0).toLocaleString()} characters
                            </span>
                            <span>{fmtMs(ch.durationMs)} audio</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className="text-center py-8 border rounded-xl"
                    style={{ borderColor: "rgba(255,255,255,0.05)" }}
                  >
                    <Mic className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs opacity-30">
                      No character voice changes recorded yet
                    </p>
                    <p className="text-[10px] opacity-20 mt-1">
                      Character voices use base voices with AI voice conversion
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Give Subscription Modal */}
      {showSubModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setShowSubModal(false)}
        >
          <div
            className="border rounded-xl p-6 w-full max-w-md m-4 max-h-[90vh] overflow-y-auto"
            style={{ background: cardBg, borderColor: border }}
            onClick={e => e.stopPropagation()}
          >
            <h3
              className="font-bold uppercase tracking-wider mb-4"
              style={{ color: C }}
            >
              Give Subscription
            </h3>
            <div className="space-y-4">
              <div className="rounded-xl p-4 border" style={{ borderColor: border, background: cardBg }}>
                <label className="text-xs uppercase tracking-wider opacity-70 block mb-3 flex items-center gap-2">
                  <Sparkles className="w-3 h-3" style={{ color: C_GOLD }} /> Plan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(PLAN_LABELS) as Plan[]).map(plan => (
                    <button
                      key={plan}
                      onClick={() => handlePlanSelect(plan)}
                      className="py-3 px-2 border text-xs font-bold rounded-xl transition-all relative overflow-hidden"
                      style={{
                        borderColor: selectedPlan === plan ? C : border,
                        background: selectedPlan === plan
                          ? `linear-gradient(135deg, ${C}25 0%, ${C_GOLD}10 100%)`
                          : "rgba(255,255,255,0.02)",
                        color: selectedPlan === plan ? C_GOLD : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {selectedPlan === plan && (
                        <div className="absolute inset-0 bg-gradient-to-r from-[#C06F30]/10 to-transparent" />
                      )}
                      <span className="relative z-10">{PLAN_LABELS[plan]}</span>
                      {PLAN_PRICE[plan] > 0 && (
                        <div className="text-[10px] mt-1 opacity-80">{PLAN_PRICE[plan].toLocaleString()} MMK</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl p-4 border" style={{ borderColor: border, background: cardBg }}>
                <label className="text-xs uppercase tracking-wider opacity-70 block mb-3 flex items-center gap-2">
                  <CreditCard className="w-3 h-3" style={{ color: C }} /> Payment Method{" "}
                  <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map(pm => (
                    <button
                      key={pm}
                      onClick={() => setPaymentMethod(pm)}
                      className="py-2 px-2 border text-xs font-bold rounded-xl transition-all text-center"
                      style={{
                        borderColor: paymentMethod === pm ? C_GOLD : border,
                        background: paymentMethod === pm
                          ? `${C_GOLD}15`
                          : "rgba(255,255,255,0.02)",
                        color: paymentMethod === pm ? C_GOLD : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {PAYMENT_METHODS[pm]}
                    </button>
                  ))}
                </div>
              </div>
              {paymentMethod !== "free" && paymentMethod !== "cash" && (
                <div className="rounded-xl p-4 border" style={{ borderColor: border, background: cardBg }}>
                  <label className="text-xs uppercase tracking-wider opacity-70 block mb-3 flex items-center gap-2">
                    <Banknote className="w-3 h-3" style={{ color: C }} /> Transaction ID{" "}
                    <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={transactionId}
                    onChange={e => setTransactionId(e.target.value)}
                    placeholder="e.g. TXN123456789"
                    className="w-full border p-3 text-sm focus:outline-none rounded-lg font-mono"
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      borderColor: transactionId ? C_GOLD : border,
                      color: C_GOLD,
                    }}
                  />
                </div>
              )}
              {/* Payment Slip Upload */}
              {paymentMethod !== "free" && paymentMethod !== "cash" && (
                <div className="rounded-xl p-4 border" style={{ borderColor: border, background: cardBg }}>
                  <label className="text-xs uppercase tracking-wider opacity-70 block mb-3 flex items-center gap-2">
                    <span style={{ color: C }}>📷</span> Payment Slip
                  </label>
                  <div
                    className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-white/5 transition-all"
                    style={{
                      borderColor: paymentSlipBase64 ? C_GOLD : border,
                      background: paymentSlipBase64 ? `${C_GOLD}08` : "transparent",
                    }}
                    onClick={() => {
                      const inp = document.createElement("input");
                      inp.type = "file";
                      inp.accept = "image/*";
                      inp.onchange = (ev: any) => {
                        const file = ev.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          alert("Slip image max 5MB");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          const base64 = reader.result as string;
                          setPaymentSlipBase64(base64);
                          setPaymentSlipPreview(base64);
                        };
                        reader.readAsDataURL(file);
                      };
                      inp.click();
                    }}
                  >
                    {paymentSlipPreview ? (
                      <div className="space-y-2">
                        <img
                          src={paymentSlipPreview}
                          alt="Payment Slip"
                          className="max-h-40 mx-auto rounded-lg border"
                          style={{ borderColor: border }}
                        />
                        <p className="text-xs text-green-400 font-bold">
                          ✓ Slip uploaded
                        </p>
                        <button
                          onClick={ev => {
                            ev.stopPropagation();
                            setPaymentSlipBase64("");
                            setPaymentSlipPreview("");
                          }}
                          className="text-xs text-red-400 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs opacity-50 mb-1">
                          Click to upload payment screenshot
                        </p>
                        <p className="text-[10px] opacity-30">
                          PNG, JPG (max 5MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs uppercase tracking-wider opacity-70 block mb-2">
                  Note (optional)
                </label>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Additional notes..."
                  className="w-full border p-2 text-sm focus:outline-none rounded-lg"
                  style={{ background: "rgba(0,0,0,0.4)", borderColor: border }}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    if (!selectedUser) return;
                    if (
                      paymentMethod !== "free" &&
                      paymentMethod !== "cash" &&
                      !transactionId.trim()
                    ) {
                      alert(
                        "Transaction ID is required for this payment method."
                      );
                      return;
                    }
                    giveSub.mutate({
                      userId: selectedUser,
                      plan: selectedPlan,
                      days: getDefaultDays(selectedPlan),
                      note:
                        `${transactionId ? `TXN: ${transactionId}` : ""}${note ? ` | ${note}` : ""}`.trim() ||
                        undefined,
                      paymentMethod,
                      paymentSlip: paymentSlipBase64 || undefined,
                    });
                  }}
                  disabled={giveSub.isPending}
                  className="flex-1 py-2.5 font-bold uppercase text-sm flex items-center justify-center gap-2 disabled:opacity-50 rounded-xl"
                  style={{ background: C, color: "var(--foreground)" }}
                >
                  {giveSub.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}{" "}
                  Confirm
                </button>
                <button
                  onClick={() => setShowSubModal(false)}
                  className="flex-1 py-2.5 border font-bold uppercase text-sm hover:opacity-70 rounded-xl"
                  style={{ borderColor: border }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setConfirmModal({ ...confirmModal, show: false })}
        >
          <div
            className="border rounded-2xl p-6 w-full max-w-md m-4"
            style={{
              background: cardBg,
              borderColor: border,
              boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              {confirmModal.variant === "danger" ? (
                <AlertTriangle
                  className="w-6 h-6"
                  style={{ color: "#ef4444" }}
                />
              ) : confirmModal.variant === "warning" ? (
                <AlertTriangle
                  className="w-6 h-6"
                  style={{ color: "#f59e0b" }}
                />
              ) : (
                <Info className="w-6 h-6" style={{ color: C }} />
              )}
              <h3
                className="font-bold uppercase tracking-wider text-lg"
                style={{
                  color:
                    confirmModal.variant === "danger"
                      ? "#ef4444"
                      : confirmModal.variant === "warning"
                        ? "#f59e0b"
                        : C,
                }}
              >
                {confirmModal.title}
              </h3>
            </div>
            <p
              className="text-sm opacity-80 mb-6 leading-relaxed"
              style={{ color: "var(--foreground)" }}
            >
              {confirmModal.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal({ ...confirmModal, show: false });
                }}
                className="flex-1 py-2.5 font-bold uppercase text-sm rounded-xl transition-all"
                style={{
                  background:
                    confirmModal.variant === "danger"
                      ? "#ef4444"
                      : confirmModal.variant === "warning"
                        ? "#f59e0b"
                        : C,
                  color: "#fff",
                }}
              >
                {confirmModal.confirmText || "Confirm"}
              </button>
              <button
                onClick={() =>
                  setConfirmModal({ ...confirmModal, show: false })
                }
                className="flex-1 py-2.5 border font-bold uppercase text-sm hover:opacity-70 rounded-xl transition-all"
                style={{ borderColor: border }}
              >
                {confirmModal.cancelText || "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
