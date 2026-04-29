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
  head: () => ({ meta: [{ title: "Manage Reports — SafeTrace" }] }),
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
  Resolved: [],   // final — no further changes
  Rejected: [],   // final — no further changes
};

const statusColor: Record<string, string> = {
  Pending:  "bg-yellow-100 text-yellow-800 border-yellow-300",
  Verified: "bg-blue-100 text-blue-800 border-blue-300",
  Resolved: "bg-green-100 text-green-800 border-green-300",
  Rejected: "bg-red-100 text-red-800 border-red-300",
};

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
                description: data.description,
                image_url: data.image_url ?? null,
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
    <div className="container mx-auto px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Admin</p>
          <h1 className="text-3xl font-bold tracking-tight">Manage reports</h1>
          {!loading && !error && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {rows.length} total · live updates enabled
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
            Loading reports…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
            <p className="text-sm font-medium text-destructive mb-1">Failed to load reports</p>
            <p className="text-xs text-muted-foreground mb-4">{error}</p>
            <p className="text-xs text-muted-foreground">
              Check Firestore Rules — the <code>reports</code> collection must allow read for authenticated users.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Retry
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            No reports{filter !== "All" ? ` with status "${filter}"` : ""}.
          </div>
        ) : (
          visible.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{r.incident_type}</h3>
                    <Badge variant="outline" className={statusColor[r.status]}>
                      {r.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    By {r.reporter_name} ({r.reporter_email}) ·{" "}
                    {format(new Date(r.incident_date), "PPP")}
                  </p>
                  <p className="mt-2 text-sm">{r.description}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}
                    </span>
                    {r.hash_value && (
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Hash className="h-3 w-3" /> {r.hash_value.slice(0, 32)}…
                      </span>
                    )}
                  </div>
                  {/* Navigation buttons */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button size="sm" variant="outline" type="button" className="gap-1.5 text-primary border-primary/40 hover:bg-primary/10">
                        <Navigation className="h-3.5 w-3.5" />
                        Navigate
                      </Button>
                    </a>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button size="sm" variant="outline" type="button" className="gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        View on map
                      </Button>
                    </a>
                  </div>
                  {r.image_url && (
                    <img
                      src={r.image_url}
                      alt="evidence"
                      className="mt-2 h-24 rounded-md border border-border object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-2 min-w-[160px]">
                  {ALLOWED_TRANSITIONS[r.status]?.length === 0 ? (
                    <span className="text-xs text-muted-foreground text-right italic px-1">
                      No further actions
                    </span>
                  ) : (
                    (ALLOWED_TRANSITIONS[r.status] ?? []).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={
                          s === "Resolved"
                            ? "default"
                            : s === "Rejected"
                            ? "destructive"
                            : "outline"
                        }
                        onClick={() => updateStatus(r.id, s)}
                      >
                        Mark {s}
                      </Button>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
