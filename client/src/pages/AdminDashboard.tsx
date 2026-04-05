import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Users, Crown, Clock, Plus, Shield, Settings, Search, LogOut } from "lucide-react";
import { useLocation } from "wouter";

type Plan = "trial" | "1month" | "3month" | "6month" | "lifetime";
type Tab = "users" | "admins" | "settings";

const PLAN_LABELS: Record<Plan, string> = {
  trial: "Trial",
  "1month": "1 Month",
  "3month": "3 Months",
  "6month": "6 Months",
  lifetime: "Lifetime",
};

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("users");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("1month");
  const [trialDays, setTrialDays] = useState(3);
  const [note, setNote] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [autoTrialEnabled, setAutoTrialEnabled] = useState(true);
  const [autoTrialDays, setAutoTrialDays] = useState(7);
  const [, navigate] = useLocation();

  const { data: me } = trpc.auth.me.useQuery();
  const { data: users, refetch } = trpc.admin.getUsers.useQuery();
  const { data: siteSettings } = trpc.settings.get.useQuery(undefined, {
    onSuccess: (d) => {
      setAutoTrialEnabled(d.autoTrialEnabled);
      setAutoTrialDays(d.autoTrialDays);
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/login"; },
  });
  const giveSub = trpc.admin.giveSubscription.useMutation({
    onSuccess: () => { refetch(); setShowConfirm(false); setSelectedUser(null); setNote(""); },
  });
  const cancelSub = trpc.admin.cancelSubscription.useMutation({
    onSuccess: () => refetch(),
  });
  const setRole = trpc.admin.setRole.useMutation({
    onSuccess: () => refetch(),
  });
  const updateSettings = trpc.settings.update.useMutation();

  if (me?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-red-500 text-xl font-bold">Access Denied</p>
      </div>
    );
  }

  const formatDate = (d: Date | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const daysLeft = (d: Date | null | undefined) => {
    if (!d) return null;
    const days = Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000));
    return days;
  };

  const handleGive = () => {
    if (!selectedUser) return;
    giveSub.mutate({ userId: selectedUser, plan: selectedPlan, trialDays, note });
  };

  const normalUsers = users?.filter(u => u.role !== "admin") ?? [];
  const adminUsers = users?.filter(u => u.role === "admin") ?? [];
  const filteredUsers = normalUsers.filter(u =>
    (u.telegramFirstName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (u.telegramUsername ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const activeSubs = normalUsers.filter(u => u.subscription).length;
  const expired = normalUsers.filter(u => !u.subscription).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[oklch(0.2_0.02_280_/_60%)] bg-[oklch(0.05_0.01_280_/_80%)]">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" style={{ color: "oklch(0.65 0.25 310)" }} />
          <span className="font-black uppercase tracking-widest text-sm" style={{ color: "oklch(0.65 0.25 310)" }}>
            Admin Dashboard
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/tts" className="text-xs px-3 py-1 border border-[oklch(0.2_0.02_280_/_60%)] opacity-60 hover:opacity-100 transition-all uppercase tracking-wider">
            TTS Page
          </a>
          <button onClick={() => logoutMutation.mutate()}
            className="flex items-center gap-1 text-xs px-3 py-1 border border-red-500/50 text-red-400 hover:bg-red-500/20 transition-all uppercase tracking-wider">
            <LogOut className="w-3 h-3" /> Logout
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total Users", value: normalUsers.length, icon: Users },
            { label: "Active Subs", value: activeSubs, icon: Crown },
            { label: "Expired", value: expired, icon: Clock },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="border border-[oklch(0.2_0.02_280_/_60%)] p-4 bg-[oklch(0.08_0.01_280_/_50%)]">
              <div className="flex items-center gap-2 mb-1 opacity-60">
                <Icon className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-3xl font-black" style={{ color: "oklch(0.65 0.25 310)" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[oklch(0.2_0.02_280_/_60%)]">
          {([
            { id: "users", label: "Users", icon: Users },
            { id: "admins", label: "Admins", icon: Shield },
            { id: "settings", label: "Settings", icon: Settings },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-all -mb-px ${
                tab === id
                  ? "border-[oklch(0.65_0.25_310)] text-[oklch(0.65_0.25_310)]"
                  : "border-transparent opacity-50 hover:opacity-80"
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {tab === "users" && (
          <div>
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or username..."
                className="w-full pl-9 pr-4 py-2 bg-[oklch(0.08_0.01_280)] border border-[oklch(0.2_0.02_280_/_60%)] text-sm focus:outline-none focus:border-[oklch(0.65_0.25_310)]" />
            </div>
            <div className="border border-[oklch(0.2_0.02_280_/_60%)] bg-[oklch(0.08_0.01_280_/_50%)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[oklch(0.2_0.02_280_/_60%)] opacity-60 text-xs uppercase tracking-wider">
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Username</th>
                    <th className="text-left p-3">Plan</th>
                    <th className="text-left p-3">Expires</th>
                    <th className="text-left p-3">Days Left</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => {
                    const days = daysLeft(user.subscription?.expiresAt);
                    return (
                      <tr key={user.id} className="border-b border-[oklch(0.2_0.02_280_/_20%)] hover:bg-[oklch(0.1_0.01_280_/_50%)]">
                        <td className="p-3 font-medium">{user.telegramFirstName ?? "—"}</td>
                        <td className="p-3 opacity-60">@{user.telegramUsername ?? "—"}</td>
                        <td className="p-3">
                          {user.subscription ? (
                            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded font-bold uppercase">
                              {user.subscription.plan}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded font-bold">No Sub</span>
                          )}
                        </td>
                        <td className="p-3 opacity-60 text-xs">{formatDate(user.subscription?.expiresAt)}</td>
                        <td className="p-3">
                          {days !== null ? (
                            <span className={`text-xs font-bold ${days <= 3 ? "text-red-400" : days <= 7 ? "text-yellow-400" : "text-green-400"}`}>
                              {days}d
                            </span>
                          ) : "—"}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button onClick={() => { setSelectedUser(user.id); setShowConfirm(true); }}
                              className="flex items-center gap-1 text-xs px-2 py-1 border border-[oklch(0.65_0.25_310)] text-[oklch(0.65_0.25_310)] hover:bg-[oklch(0.65_0.25_310_/_20%)] transition-all">
                              <Plus className="w-3 h-3" /> Give
                            </button>
                            {user.subscription && (
                              <button onClick={() => { if (confirm("Cancel subscription?")) cancelSub.mutate({ userId: user.id }); }}
                                className="text-xs px-2 py-1 border border-red-500/50 text-red-400 hover:bg-red-500/20 transition-all">
                                Cancel
                              </button>
                            )}
                            <button onClick={() => { if (confirm("Make admin?")) setRole.mutate({ userId: user.id, role: "admin" }); }}
                              className="text-xs px-2 py-1 border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20 transition-all">
                              Admin
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center opacity-40">No users found</td></tr>
                  )}
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
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Username</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map(user => (
                  <tr key={user.id} className="border-b border-[oklch(0.2_0.02_280_/_20%)]">
                    <td className="p-3 font-medium">{user.telegramFirstName ?? "—"}</td>
                    <td className="p-3 opacity-60">@{user.telegramUsername ?? "—"}</td>
                    <td className="p-3">
                      {user.id !== me?.userId && (
                        <button onClick={() => { if (confirm("Remove admin?")) setRole.mutate({ userId: user.id, role: "user" }); }}
                          className="text-xs px-2 py-1 border border-red-500/50 text-red-400 hover:bg-red-500/20 transition-all">
                          Remove Admin
                        </button>
                      )}
                      {user.id === me?.userId && <span className="text-xs opacity-40">You</span>}
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
                <input type="number" min={1} max={365} value={autoTrialDays}
                  onChange={e => setAutoTrialDays(Number(e.target.value))}
                  className="w-20 bg-[oklch(0.05_0.01_280)] border border-[oklch(0.2_0.02_280_/_60%)] p-2 text-center font-bold text-[oklch(0.65_0.25_310)] focus:outline-none focus:border-[oklch(0.65_0.25_310)]" />
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
            <button onClick={() => updateSettings.mutate({ autoTrialEnabled, autoTrialDays })}
              disabled={updateSettings.isPending}
              className="px-6 py-2 font-bold uppercase text-sm text-black transition-all disabled:opacity-50"
              style={{ background: "oklch(0.65 0.25 310)" }}>
              {updateSettings.isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}
      </div>

      {/* Give Subscription Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[oklch(0.08_0.01_280)] border border-[oklch(0.2_0.02_280_/_60%)] p-6 w-full max-w-md">
            <h3 className="font-bold uppercase tracking-wider mb-4" style={{ color: "oklch(0.65 0.25 310)" }}>
              Give Subscription
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider opacity-70 block mb-2">Plan</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(PLAN_LABELS) as Plan[]).map(plan => (
                    <button key={plan} onClick={() => setSelectedPlan(plan)}
                      className={`py-2 px-3 border text-sm font-bold uppercase transition-all ${
                        selectedPlan === plan
                          ? "border-[oklch(0.65_0.25_310)] bg-[oklch(0.65_0.25_310_/_20%)] text-[oklch(0.65_0.25_310)]"
                          : "border-[oklch(0.2_0.02_280_/_60%)] opacity-70 hover:opacity-100"
                      }`}>
                      {PLAN_LABELS[plan]}
                    </button>
                  ))}
                </div>
              </div>
              {selectedPlan === "trial" && (
                <div>
                  <label className="text-xs uppercase tracking-wider opacity-70 block mb-2">Trial Days</label>
                  <div className="flex items-center gap-3">
                    <input type="number" min={1} max={365} value={trialDays}
                      onChange={e => setTrialDays(Number(e.target.value))}
                      className="w-full bg-[oklch(0.05_0.01_280)] border border-[oklch(0.2_0.02_280_/_60%)] p-2 text-sm focus:outline-none focus:border-[oklch(0.65_0.25_310)] text-center font-bold text-[oklch(0.65_0.25_310)]" />
                    <span className="text-sm opacity-70 whitespace-nowrap">days</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[1, 3, 7, 14, 30].map(d => (
                      <button key={d} onClick={() => setTrialDays(d)}
                        className={`flex-1 py-1 text-xs font-bold border transition-all ${trialDays === d ? "border-[oklch(0.65_0.25_310)] text-[oklch(0.65_0.25_310)] bg-[oklch(0.65_0.25_310_/_20%)]" : "border-[oklch(0.2_0.02_280_/_60%)] opacity-60 hover:opacity-100"}`}>
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs uppercase tracking-wider opacity-70 block mb-2">Note (optional)</label>
                <input value={note} onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Paid via KPay"
                  className="w-full bg-[oklch(0.05_0.01_280)] border border-[oklch(0.2_0.02_280_/_60%)] p-2 text-sm focus:outline-none focus:border-[oklch(0.65_0.25_310)]" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleGive} disabled={giveSub.isPending}
                  className="flex-1 py-2 font-bold uppercase text-sm text-black flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: "oklch(0.65 0.25 310)" }}>
                  {giveSub.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Confirm
                </button>
                <button onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2 border border-[oklch(0.2_0.02_280_/_60%)] font-bold uppercase text-sm hover:opacity-70">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
