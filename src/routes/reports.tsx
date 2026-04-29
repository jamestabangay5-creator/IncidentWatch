import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { MapPin, Hash, Navigation, ZoomIn } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "My Reports — SafeTrace" }] }),
  component: () => (
    <RequireAuth>
      <MyReports />
    </RequireAuth>
  ),
});

interface ReportRow {
  id: string;
  incident_type: string;
  description: string;
  image_url: string | null;
  latitude: number;
  longitude: number;
  status: string;
  incident_date: string;
  created_at: string;
  hash_value?: string;
}

const statusColor: Record<string, string> = {
  Pending:  "bg-yellow-100 text-yellow-800 border-yellow-300",
  Verified: "bg-blue-100 text-blue-800 border-blue-300",
  Resolved: "bg-green-100 text-green-800 border-green-300",
  Rejected: "bg-red-100 text-red-800 border-red-300",
};

// ── Lightbox for full-size image view ────────────────────────────────────────
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <img
        src={src}
        alt="evidence full size"
        className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white bg-black/50 rounded-full h-9 w-9 flex items-center justify-center text-lg hover:bg-black/70 transition-colors"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
}

function MyReports() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const snap = await getDocs(
        query(collection(db, "reports"), where("user_id", "==", user.uid)),
      );
      const sorted = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            incident_type: data.incident_type,
            description: data.description,
            image_url: data.image_url ?? null,
            latitude: data.latitude,
            longitude: data.longitude,
            status: data.status,
            incident_date: data.incident_date,
            created_at: data.created_at?.toDate?.()?.toISOString() ?? "",
            hash_value: data.hash_value,
          };
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      setRows(sorted);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">My reports</h1>
      <p className="text-muted-foreground mt-1">All reports you've submitted with their blockchain seals.</p>

      {loading ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          You haven't submitted any reports yet.
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-5 hover:shadow-[var(--shadow-elevated)] transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{r.incident_type}</h3>
                    <Badge variant="outline" className={statusColor[r.status]}>
                      {r.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(r.incident_date), "PPP")} · submitted{" "}
                    {r.created_at ? format(new Date(r.created_at), "PP") : "—"}
                  </p>
                </div>
              </div>

              {/* Description */}
              <p className="mt-3 text-sm">{r.description}</p>

              {/* Inline image — click to expand */}
              {r.image_url && (
                <div className="mt-3 relative group w-fit">
                  <img
                    src={r.image_url}
                    alt="evidence"
                    className="h-40 w-auto max-w-full rounded-lg border border-border object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setLightboxSrc(r.image_url)}
                  />
                  <button
                    onClick={() => setLightboxSrc(r.image_url)}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-md px-2 py-1 text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ZoomIn className="h-3 w-3" /> View full
                  </button>
                </div>
              )}

              {/* Location + hash */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                </span>
                {r.hash_value && (
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Hash className="h-3 w-3" /> {r.hash_value.slice(0, 24)}…
                  </span>
                )}
              </div>

              {/* Navigation buttons */}
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                >
                  <Navigation className="h-3 w-3" /> Navigate
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <MapPin className="h-3 w-3" /> View on map
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  );
}
