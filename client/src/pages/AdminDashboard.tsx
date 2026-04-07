import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Users, Crown, Clock, Plus, Shield, Settings, Search, LogOut, BarChart3, Ban, CheckCircle, Activity, Zap, HardDrive, Server, DollarSign } from "lucide-react";

type Plan = "trial" | "1month" | "3month" | "6month" | "lifetime";
type Tab = "analytics" | "users" | "admins" | "settings";

const PLAN_LABELS: Record<Plan, string> = {
  trial: "Trial", "1month": "1 Month", "3month": "3 Months", "6month": "6 Months", lifetime: "Lifetime",
};

const PLAN_PRICE: Record<Plan, number> = {
  trial: 0, "1month": 5, "3month": 12, "6month": 20, lifetime: 50,
};

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("analytics");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("1month");
  const [trialDays, setTrialDays] = useState(3);
  const [note, setNote] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [autoTrialEnabled, setAutoTrialEnabled] = useState(true);
  const [autoTrialDays, setAutoTrialDays] = useState(7);

  const { data: me } = trpc.auth.me.useQuery();
  const { data: users, refetch } = trpc.admin.getUsers.useQuery();
  const { data: analytics } = trpc.admin.getAnalytics.useQuery();
  const { data: health } = trpc.admin.getServerHealth.useQuery(undefined, { refetchInterval: 30000 });
  const { data: siteSettings } = trpc.settings.get.useQuery(undefined, {
    onSuccess: (d) => { setAutoTrialEnabled(d.autoTrialEnabled); setAutoTrialDays(d.autoTrialDays); },
  });

  const logoutMutation = trpc.auth.logout.useMutation({ onSuccess: () => { window.location.href = "/login"; } });
  const giveSub = trpc.admin.giveSubscription.useMutation({ onSuccess: () => { refetch(); setShowConfirm(false); setSelectedUser(null); setNote(""); } });
  const cancelSub = trpc.admin.cancelSubscription.useMutation({ onSuccess: () => refetch() });
  const setRole = trpc.admin.setRole.useMutation({ onSuccess: () => refetch() });
  const banUser = trpc.admin.banUser.useMutation({ onSuccess: () => refetch() });
  const updateSettings = trpc.settings.update.useMutation();

  if (me?.role !== "admin") return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-red-500 text-xl font-bold">Access Denied</p>
    </div>
  );

  const fmt = (d: any) => !d ? "—" : new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const fmtTime = (d: any) => !d ? "Never" : new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const daysLeft = (d: any) => !d ? null : Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000));
  const fmtUptime = (s: number) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return `${h}h ${m}m`; };

  const normalUsers = users?.filter(u => u.role !== "admin") ?? [];
  const adminUsers = users?.filter(u => u.role === "admin") ?? [];
  const filteredUsers = normalUsers.filter(u =>
    (u.telegramFirstName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (u.telegramUsername ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const activeSubs = normalUsers.filter(u => u.subscription).length;
  const totalRevenue = analytics?.planCounts?.reduce((sum: number, p: any) => sum + (PLAN_PRICE[p.plan as Plan] ?? 0) * p.count, 0) ?? 0;
  const C = "oklch(0.65 0.25 310)";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex items-center justify-between px-6 py-3 border-b border-[oklch(0.2_0.02_280_/_60%)] bg-[oklch(0.05_0.01_280_/_80%)]">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" style={{ color: C }} />
          <span className="font-black uppercase tracking-widest text-sm" style={{ color: C }}>Admin Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/tts" className="text-xs px-3 py-1 border border-[oklch(0.2_0.02_280_/_60%)] opacity-60 hover:opacity-100 transition-all uppercase tracking-wider">TTS Page</a>
          <button onClick={() => logoutMutation.mutate()} className="flex items-center gap-1 text-xs px-3 py-1 border border-red-500/50 text-red-400 hover:bg-red-500/20 transition-all uppercase tracking-wider">
            <LogOut className="w-3 h-3" /> Logout
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Users", value: normalUsers.length, icon: Users, color: "text-blue-400" },
            { label: "Active Subs", value: activeSubs, icon: Crown, color: "text-green-400" },
            { label: "Generations Today", value: analytics?.generations?.today ?? 0, icon: Zap, color: "text-yellow-400" },
            { label: "Est. Revenue", value: `$${totalRevenue}`, icon: DollarSign, color: "text-purple-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="border border-[oklch(0.2_0.02_280_/_60%)] p-4 bg-[oklch(0.08_0.01_280_/_50%)]">
              <div className={`flex items-center gap-2 mb-1 opacity-60 ${color}`}><Icon className="w-4 h-4" /><span className="text-xs uppercase tracking-wider">{label}</span></div>
              <p className={`text-3xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[oklch(0.2_0.02_280_/_60%)]">
          {([
            { id: "analytics", label: "Analytics", icon: BarChart3 },
            { id: "users", label: "Users", icon: Users },
            { id: "admins", label: "Admins", icon: Shield },
            { id: "settings", label: "Settings", icon: Settings },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-all -mb-px ${tab === id ? "border-[oklch(0.65_0.25_310)] text-[oklch(0.65_0.25_310)]" : "border-transparent opacity-50 hover:opacity-80"}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Analytics Tab */}
        {tab === "analytics" && (
          <div className="space-y-4">
            <div className="border border-[oklch(0.2_0.02_280_/_60%)] bg-[oklch(0.08_0.01_280_/_50%)] p-6">
              <h3 className="font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: C }}><Activity className="w-4 h-4" /> TTS Generations</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Today", value: analytics?.generations?.today ?? 0 },
                  { label: "This Week", value: analytics?.generations?.week ?? 0 },
                  { label: "This Month", value: analytics?.generations?.month ?? 0 },
                  { label: "All Time", value: analytics?.generations?.total ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="border border-[oklch(0.2_0.02_280_/_40%)] p-4 text-center">
                    <p className="text-xs opacity-50 uppercase tracking-wider mb-2">{label}</p>
                    <p className="text-2xl font-black" style={{ color: C }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-[oklch(0.2_0.02_280_/_60%)] bg-[oklch(0.08_0.01_280_/_50%)] p-6">
                <h3 className="font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-purple-400"><DollarSign className="w-4 h-4" /> Revenue (Active Subs)</h3>
                <div className="space-y-2">
                  {analytics?.planCounts?.map((p: any) => (
                    <div key={p.plan} className="flex justify-between items-center border-b border-[oklch(0.2_0.02_280_/_20%)] pb-2">
                      <div><span className="text-sm font-bold">{PLAN_LABELS[p.plan as Plan] ?? p.plan}</span><span className="text-xs opacity-40 ml-2">× {p.count} users</span></div>
                      <span className="font-bold text-purple-400">${(PLAN_PRICE[p.plan as Plan] ?? 0) * p.count}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-bold uppercase text-xs">Total</span>
                    <span className="font-black text-purple-400 text-lg">${totalRevenue}</span>
                  </div>
                </div>
              </div>

              <div className="border border-[oklch(0.2_0.02_280_/_60%)] bg-[oklch(0.08_0.01_280_/_50%)] p-6">
                <h3 className="font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-blue-400"><HardDrive className="w-4 h-4" /> Characters Processed</h3>
                <p className="text-3xl font-black text-blue-400">{((analytics?.chars?.total ?? 0) / 1000).toFixed(1)}K</p>
                <p className="text-xs opacity-40 mt-1 mb-4">total characters</p>
                <h3 className="font-bold uppercase tracking-wider mb-2 flex items-center gap-2 text-green-400"><Users className="w-4 h-4" /> Active Users</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-[oklch(0.2_0.02_280_/_40%)] p-3 text-center">
                    <p className="text-xs opacity-50 mb-1">Today</p>
                    <p className="text-xl font-black text-green-400">{analytics?.activeUsers?.today ?? 0}</p>
                  </div>
                  <div className="border border-[oklch(0.2_0.02_280_/_40%)] p-3 text-center">
                    <p className="text-xs opacity-50 mb-1">This Week</p>
                    <p className="text-xl font-black text-green-400">{analytics?.activeUsers?.week ?? 0}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-[oklch(0.2_0.02_280_/_60%)] bg-[oklch(0.08_0.01_280_/_50%)] p-6">
              <h3 className="font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-green-400"><Server className="w-4 h-4" /> Server Health <span className="text-xs font-normal opacity-40">(30s)</span></h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Memory Used", value: `${health?.memory?.used ?? 0} MB`, color: "text-yellow-400" },
                  { label: "Heap Used", value: `${health?.memory?.heap ?? 0} MB`, color: "text-yellow-400" },
                  { label: "Disk", value: health?.disk ?? "—", color: "text-blue-400" },
                  { label: "Uptime", value: fmtUptime(health?.uptime ?? 0), color: "text-green-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="border border-[oklch(0.2_0.02_280_/_40%)] p-4 text-center">
                    <p className="text-xs opacity-50 uppercase tracking-wider mb-2">{label}</p>
                    <p className={`text-lg font-black ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <div>
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or username..."
                className="w-full pl-9 pr-4 py-2 bg-[oklch(0.08_0.01_280)] border border-[oklch(0.2_0.02_280_/_60%)] text-sm focus:outline-none focus:border-[oklch(0.65_0.25_310)]" />
            </div>
            <div className="border border-[oklch(0.2_0.02_280_/_60%)] bg-[oklch(0.08_0.01_280_/_50%)] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[oklch(0.2_0.02_280_/_60%)] opacity-60 text-xs uppercase tracking-wider">
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Username</th>
                    <th className="text-left p-3">Plan</th>
                    <th className="text-left p-3">Days</th>
                    <th className="text-left p-3">Gens</th>
                    <th className="text-left p-3">Last Active</th>
                    <th className="text-left p-3">Joined</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => {
                    const days = daysLeft(user.subscription?.expiresAt);
                    const isBanned = !!(user as any).bannedAt;
                    const genCount = (user as any).genCount ?? 0;
                    const lastActive = (user as any).lastActive;
                    return (
                      <tr key={user.id} className={`border-b border-[oklch(0.2_0.02_280_/_20%)] hover:bg-[oklch(0.1_0.01_280_/_50%)] ${isBanned ? "opacity-40" : ""}`}>
                        <td className="p-3 font-medium">{user.telegramFirstName ?? "—"}</td>
                        <td className="p-3 opacity-60">@{user.telegramUsername ?? "—"}</td>
                        <td className="p-3">
                          {user.subscription ? <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 font-bold uppercase">{user.subscription.plan}</span>
                          : <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 font-bold">No Sub</span>}
                        </td>
                        <td className="p-3">
                          {days !== null ? <span className={`text-xs font-bold ${days <= 3 ? "text-red-400" : days <= 7 ? "text-yellow-400" : "text-green-400"}`}>{days}d</span> : "—"}
                        </td>
                        <td className="p-3 text-center"><span className="font-bold" style={{ color: C }}>{genCount}</span></td>
                        <td className="p-3 text-xs opacity-60">{fmtTime(lastActive)}</td>
                        <td className="p-3 text-xs opacity-60">{fmt(user.createdAt)}</td>
                        <td className="p-3">
                          {isBanned ? <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 font-bold">BANNED</span>
                          : <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 font-bold">ACTIVE</span>}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1 flex-wrap">
                            <button onClick={() => { setSelectedUser(user.id); setShowConfirm(true); }}
                              className="flex items-center gap-1 text-xs px-2 py-1 border border-[oklch(0.65_0.25_310)] text-[oklch(0.65_0.25_310)] hover:bg-[oklch(0.65_0.25_310_/_20%)] transition-all">
                              <Plus className="w-3 h-3" /> Sub
                            </button>
                            {user.subscription && (
                              <button onClick={() => { if (confirm("Cancel?")) cancelSub.mutate({ userId: user.id }); }}
                                className="text-xs px-2 py-1 border border-red-500/50 text-red-400 hover:bg-red-500/20 transition-all">Cancel</button>
                            )}
                            <button onClick={() => { if (confirm(isBanned ? "Unban?" : "Ban?")) banUser.mutate({ userId: user.id, ban: !isBanned }); }}
                              className={`flex items-center gap-1 text-xs px-2 py-1 border transition-all ${isBanned ? "border-green-500/50 text-green-400 hover:bg-green-500/20" : "border-orange-500/50 text-orange-400 hover:bg-orange-500/20"}`}>
                              {isBanned ? <><CheckCircle className="w-3 h-3" />Unban</> : <><Ban className="w-3 h-3" />Ban</>}
                            </button>
                            <button onClick={() => { if (confirm("Make admin?")) setRole.mutate({ userId: user.id, role: "admin" }); }}
                              className="text-xs px-2 py-1 border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20 transition-all">Admin</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && <tr><td colSpan={9} className="p-6 text-center opacity-40">No users found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Admins Tab */}
        {tab === "admins" && (
          <div className="border border-[oklch(0.2_0.02_280_/_60%)] bg-[oklch(0.08_0.01_280_/_50%)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[oklch(0.2_0.02_280_/_60%)] opacity-60 text-xs uppercase tracking-wider">
                  <th className="text-left p-3">Name</th><th className="text-left p-3">Username</th><th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map(user => (
                  <tr key={user.id} className="border-b border-[oklch(0.2_0.02_280_/_20%)]">
                    <td className="p-3 font-medium">{user.telegramFirstName ?? "—"}</td>
                    <td className="p-3 opacity-60">@{user.telegramUsername ?? "—"}</td>
                    <td className="p-3">
                      {user.id !== me?.userId
                        ? <button onClick={() => { if (confirm("Remove admin?")) setRole.mutate({ userId: user.id, role: "user" }); }}
                            className="text-xs px-2 py-1 border border-red-500/50 text-red-400 hover:bg-red-500/20 transition-all">Remove Admin</button>
                        : <span className="text-xs opacity-40">You</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Settings Tab */}
        {tab === "settings" && (
          <div className="border border-[oklch(0.2_0.02_280_/_60%)] bg-[oklch(0.08_0.01_280_/_50%)] p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">Auto Trial on Registration</p>
                <p className="text-xs opacity-50 mt-1">New user register လုပ်တာနဲ့ auto trial ပေးမည်</p>
              </div>
              <button onClick={() => setAutoTrialEnabled(!autoTrialEnabled)}
                className={`relative w-12 h-6 rounded-full transition-all duration-200 ${autoTrialEnabled ? "bg-[oklch(0.65_0.25_310)]" : "bg-gray-600"}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${autoTrialEnabled ? "left-7" : "left-1"}`} />
              </button>
            </div>
            <div>
              <p className="font-bold mb-3">Trial Duration</p>
              <div className="flex items-center gap-3">
                <input type="number" min={1} max={365} value={autoTrialDays} onChange={e => setAutoTrialDays(Number(e.target.value))}
                  className="w-20 bg-[oklch(0.05_0.01_280)] border border-[oklch(0.2_0.02_280_/_60%)] p-2 text-center font-bold text-[oklch(0.65_0.25_310)] focus:outline-none" />
                <span className="text-sm opacity-60">days</span>
                <div className="flex gap-2">
                  {[1, 3, 7, 14, 30].map(d => (
                    <button key={d} onClick={() => setAutoTrialDays(d)}
                      className={`px-3 py-1 text-xs font-bold border transition-all ${autoTrialDays === d ? "border-[oklch(0.65_0.25_310)] text-[oklch(0.65_0.25_310)] bg-[oklch(0.65_0.25_310_/_20%)]" : "border-[oklch(0.2_0.02_280_/_60%)] opacity-60 hover:opacity-100"}`}>
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => updateSettings.mutate({ autoTrialEnabled, autoTrialDays })} disabled={updateSettings.isPending}
              className="px-6 py-2 font-bold uppercase text-sm text-black disabled:opacity-50" style={{ background: C }}>
              {updateSettings.isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}
      </div>

      {/* Give Subscription Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[oklch(0.08_0.01_280)] border border-[oklch(0.2_0.02_280_/_60%)] p-6 w-full max-w-md">
            <h3 className="font-bold uppercase tracking-wider mb-4" style={{ color: C }}>Give Subscription</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider opacity-70 block mb-2">Plan</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(PLAN_LABELS) as Plan[]).map(plan => (
                    <button key={plan} onClick={() => setSelectedPlan(plan)}
                      className={`py-2 px-3 border text-sm font-bold uppercase transition-all ${selectedPlan === plan ? "border-[oklch(0.65_0.25_310)] bg-[oklch(0.65_0.25_310_/_20%)] text-[oklch(0.65_0.25_310)]" : "border-[oklch(0.2_0.02_280_/_60%)] opacity-70 hover:opacity-100"}`}>
                      {PLAN_LABELS[plan]}
                    </button>
                  ))}
                </div>
              </div>
              {selectedPlan === "trial" && (
                <div>
                  <label className="text-xs uppercase tracking-wider opacity-70 block mb-2">Trial Days</label>
                  <input type="number" min={1} max={365} value={trialDays} onChange={e => setTrialDays(Number(e.target.value))}
                    className="w-full bg-[oklch(0.05_0.01_280)] border border-[oklch(0.2_0.02_280_/_60%)] p-2 text-sm focus:outline-none text-center font-bold text-[oklch(0.65_0.25_310)]" />
                </div>
              )}
              <div>
                <label className="text-xs uppercase tracking-wider opacity-70 block mb-2">Note (optional)</label>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Paid via KPay"
                  className="w-full bg-[oklch(0.05_0.01_280)] border border-[oklch(0.2_0.02_280_/_60%)] p-2 text-sm focus:outline-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { if (!selectedUser) return; giveSub.mutate({ userId: selectedUser, plan: selectedPlan, trialDays, note }); }}
                  disabled={giveSub.isPending} className="flex-1 py-2 font-bold uppercase text-sm text-black flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: C }}>
                  {giveSub.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Confirm
                </button>
                <button onClick={() => setShowConfirm(false)} className="flex-1 py-2 border border-[oklch(0.2_0.02_280_/_60%)] font-bold uppercase text-sm hover:opacity-70">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
