import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Hash, MapPin, RefreshCw, Navigation } from "lucide-react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Manage Reports — Nexus" }] }),
  component: () => (
    <RequireAuth admin>
      <ManageReports />
    </RequireAuth>
  ),
});

interface Row {
  id: string;
  user_id: string;
  incident_type: string;
  description: string;
  image_url: string | null;
  reporter_photo?: string | null;
  latitude: number;
  longitude: number;
  status: string;
  incident_date: string;
  created_at: string;
  hash_value?: string;
  reporter_name?: string;
  reporter_email?: string;
}

const STATUSES = ["Pending", "Verified", "Resolved", "Rejected"] as const;

// Valid transitions — terminal states (Resolved, Rejected) have no allowed next steps
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  Pending:  ["Verified", "Rejected"],
  Verified: ["Resolved", "Rejected"],
  Resolved: [],
  Rejected: [],
};

const statusColor: Record<string, string> = {
  Pending:  "bg-yellow-100 text-yellow-800 border-yellow-300",
  Verified: "bg-blue-100 text-blue-800 border-blue-300",
  Resolved: "bg-green-100 text-green-800 border-green-300",
  Rejected: "bg-red-100 text-red-800 border-red-300",
};

// Color coding by incident type severity
const INCIDENT_COLOR: Record<string, { bar: string; badge: string; bg: string }> = {
  // Critical / violent
  "Rape":                      { bar: "bg-red-700",    badge: "bg-red-100 text-red-800 border-red-400",       bg: "bg-red-50/40" },
  "Homicide / Murder":         { bar: "bg-red-700",    badge: "bg-red-100 text-red-800 border-red-400",       bg: "bg-red-50/40" },
  "Physical injury / Assault": { bar: "bg-red-500",    badge: "bg-red-100 text-red-700 border-red-300",       bg: "bg-red-50/30" },
  "Child abuse":               { bar: "bg-red-600",    badge: "bg-red-100 text-red-800 border-red-400",       bg: "bg-red-50/40" },
  "Sexual harassment":         { bar: "bg-rose-500",   badge: "bg-rose-100 text-rose-800 border-rose-300",    bg: "bg-rose-50/30" },
  // High severity
  "Theft / Robbery":           { bar: "bg-orange-500", badge: "bg-orange-100 text-orange-800 border-orange-300", bg: "bg-orange-50/30" },
  "Burglary":                  { bar: "bg-orange-500", badge: "bg-orange-100 text-orange-800 border-orange-300", bg: "bg-orange-50/30" },
  "Illegal drugs":             { bar: "bg-orange-600", badge: "bg-orange-100 text-orange-800 border-orange-400", bg: "bg-orange-50/40" },
  "Stalking":                  { bar: "bg-orange-400", badge: "bg-orange-100 text-orange-700 border-orange-300", bg: "bg-orange-50/20" },
  "Kidnapping":                { bar: "bg-red-700",    badge: "bg-red-100 text-red-800 border-red-400",       bg: "bg-red-50/40" },
  // Medium severity
  "Fire incident":             { bar: "bg-amber-500",  badge: "bg-amber-100 text-amber-800 border-amber-300", bg: "bg-amber-50/30" },
  "Medical emergency":         { bar: "bg-amber-500",  badge: "bg-amber-100 text-amber-800 border-amber-300", bg: "bg-amber-50/30" },
  "Road accident":             { bar: "bg-amber-400",  badge: "bg-amber-100 text-amber-700 border-amber-300", bg: "bg-amber-50/20" },
  "Missing person":            { bar: "bg-amber-500",  badge: "bg-amber-100 text-amber-800 border-amber-300", bg: "bg-amber-50/30" },
  "Domestic disturbance":      { bar: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-800 border-yellow-300", bg: "bg-yellow-50/30" },
  "Scam / Fraud":              { bar: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-800 border-yellow-300", bg: "bg-yellow-50/30" },
  "Cyber harassment":          { bar: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-700 border-yellow-300", bg: "bg-yellow-50/20" },
  // Lower severity
  "Vandalism":                 { bar: "bg-blue-400",   badge: "bg-blue-100 text-blue-700 border-blue-300",    bg: "bg-blue-50/20" },
  "Public disturbance":        { bar: "bg-blue-400",   badge: "bg-blue-100 text-blue-700 border-blue-300",    bg: "bg-blue-50/20" },
  "Noise complaint":           { bar: "bg-sky-400",    badge: "bg-sky-100 text-sky-700 border-sky-300",       bg: "bg-sky-50/20" },
  "Animal bite":               { bar: "bg-teal-400",   badge: "bg-teal-100 text-teal-700 border-teal-300",    bg: "bg-teal-50/20" },
  "Drunk and disorderly":      { bar: "bg-purple-400", badge: "bg-purple-100 text-purple-700 border-purple-300", bg: "bg-purple-50/20" },
  "Not sure / Other":          { bar: "bg-slate-400",  badge: "bg-slate-100 text-slate-700 border-slate-300", bg: "bg-slate-50/20" },
};

function getIncidentStyle(type: string) {
  return INCIDENT_COLOR[type] ?? { bar: "bg-slate-400", badge: "bg-slate-100 text-slate-700 border-slate-300", bg: "" };
}

function ManageReports() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);

    // Real-time listener — updates instantly when any report is added/changed
    const unsub = onSnapshot(
      collection(db, "reports"),
      async (snap) => {
        try {
          const reports = await Promise.all(
            snap.docs.map(async (d) => {
              const data = d.data();

              // Fetch reporter profile (non-fatal if missing)
              let reporter_name = "Unknown";
              let reporter_email = "—";
              try {
                const profileSnap = await getDoc(doc(db, "profiles", data.user_id));
                if (profileSnap.exists()) {
                  reporter_name = profileSnap.data().full_name ?? "Unknown";
                  reporter_email = profileSnap.data().email ?? "—";
                }
              } catch {
                // profile fetch failure is non-fatal
              }

              return {
                id: d.id,
                user_id: data.user_id,
                incident_type: data.incident_type,
                description: data.description ?? "",
                image_url: data.image_url ?? null,
                reporter_photo: data.reporter_photo ?? null,
                latitude: data.latitude,
                longitude: data.longitude,
                status: data.status,
                incident_date: data.incident_date,
                created_at: data.created_at?.toDate?.()?.toISOString() ?? "",
                hash_value: data.hash_value,
                reporter_name,
                reporter_email,
              } as Row;
            }),
          );

          // Sort newest first client-side
          setRows(reports.sort((a, b) => b.created_at.localeCompare(a.created_at)));
          setLoading(false);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          setError(msg);
          toast.error(`Failed to process reports: ${msg}`);
          setLoading(false);
        }
      },
      (err) => {
        // Firestore permission error surfaces here
        const msg = err.message ?? "Permission denied";
        setError(msg);
        toast.error(`Failed to load reports: ${msg}`);
        console.error("[admin.reports] Firestore error:", err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  async function updateStatus(id: string, status: string) {
    const r = rows.find((x) => x.id === id);
    if (!r) return;

    // Guard: enforce transition rules
    const allowed = ALLOWED_TRANSITIONS[r.status] ?? [];
    if (!allowed.includes(status)) {
      toast.error(`Cannot change status from "${r.status}" to "${status}"`);
      return;
    }

    try {
      await updateDoc(doc(db, "reports", id), {
        status,
        updated_at: serverTimestamp(),
        // Store resolved_at timestamp so the map can apply a TTL filter
        ...(status === "Resolved" ? { resolved_at: serverTimestamp() } : {}),
      });

      await addDoc(collection(db, "audit_logs"), {
        actor_id: user?.uid,
        action: "report.status_change",
        target_type: "report",
        target_id: id,
        details: { new_status: status },
        created_at: serverTimestamp(),
      });

      const notifyR = r;
      if (notifyR) {
        await addDoc(collection(db, "notifications"), {
          user_id: notifyR.user_id,
          message: `Your report "${notifyR.incident_type}" was updated to ${status}.`,
          read: false,
          created_at: serverTimestamp(),
        });
      }

      toast.success(`Status updated to ${status}`);
      // No need to call load() — onSnapshot updates automatically
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  const visible = filter === "All" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white">
        <div className="container mx-auto px-4 py-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-blue-300/70 text-sm font-medium">Admin</p>
              <h1 className="text-3xl font-extrabold tracking-tight">Manage Reports</h1>
              {!loading && !error && (
                <p className="text-blue-200/50 text-sm mt-0.5">
                  {rows.length} total · <span className="text-emerald-400">● live</span>
                </p>
              )}
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-44 bg-white/10 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <p className="text-sm font-semibold text-red-600 mb-1">Failed to load reports</p>
              <p className="text-xs text-slate-500 mb-4">{error}</p>
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                <RefreshCw className="h-3 w-3 mr-1" /> Retry
              </Button>
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-16 text-center">
              <p className="text-slate-500 font-medium">No reports{filter !== "All" ? ` with status "${filter}"` : ""}.</p>
            </div>
          ) : (
            visible.map((r) => {
              const incStyle = getIncidentStyle(r.incident_type);
              return (
              <div key={r.id} className={`group rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden ${incStyle.bg} bg-white`}>
                {/* Top bar: incident type color */}
                <div className={`h-1.5 w-full ${incStyle.bar}`} />
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-800">{r.incident_type}</h3>
                        {/* Incident type badge */}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${incStyle.badge}`}>
                          {r.incident_type}
                        </span>
                        {/* Status badge */}
                        <Badge variant="outline" className={statusColor[r.status]}>{r.status}</Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        By {r.reporter_name} ({r.reporter_email}) · {format(new Date(r.incident_date), "PPP")}
                      </p>
                      {r.description && (
                        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{r.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-blue-400" />
                          {Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}
                        </span>
                        {r.hash_value && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Hash className="h-3 w-3" /> {r.hash_value.slice(0, 32)}…
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer">
                          <Button size="sm" type="button" className="gap-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white border-0 shadow-sm hover:scale-105 transition-all duration-200">
                            <Navigation className="h-3.5 w-3.5" /> Navigate
                          </Button>
                        </a>
                        <a href={`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" type="button" className="gap-1.5 hover:scale-105 transition-all duration-200">
                            <MapPin className="h-3.5 w-3.5" /> View on map
                          </Button>
                        </a>
                      </div>
                      {/* Reporter profile photo */}
                      {(r as Row & { reporter_photo?: string }).reporter_photo && (
                        <div className="mt-3 flex items-center gap-2">
                          <img
                            src={(r as Row & { reporter_photo?: string }).reporter_photo}
                            alt="reporter"
                            className="h-8 w-8 rounded-full object-cover border border-slate-200"
                          />
                          <span className="text-xs text-slate-400">Reporter photo</span>
                        </div>
                      )}
                      {r.image_url && (
                        <img src={r.image_url} alt="evidence" className="mt-3 h-28 rounded-xl border border-slate-200 object-cover shadow-sm hover:scale-[1.02] transition-transform duration-200 cursor-pointer" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2 min-w-[160px]">
                      {ALLOWED_TRANSITIONS[r.status]?.length === 0 ? (
                        <span className="text-xs text-slate-400 text-right italic px-1">No further actions</span>
                      ) : (
                        (ALLOWED_TRANSITIONS[r.status] ?? []).map((s) => (
                          <Button key={s} size="sm"
                            className={
                              s === "Resolved"
                                ? "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white border-0 shadow-sm hover:scale-105 transition-all duration-200"
                                : s === "Rejected"
                                ? "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white border-0 shadow-sm hover:scale-105 transition-all duration-200"
                                : "border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:scale-105 transition-all duration-200"
                            }
                            onClick={() => updateStatus(r.id, s)}>
                            Mark {s}
                          </Button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
