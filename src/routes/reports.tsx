import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { MapPin, Hash, Navigation, ZoomIn, FileText } from "lucide-react";
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

const statusStyle: Record<string, { badge: string; dot: string }> = {
  Pending:  { badge: "bg-amber-100 text-amber-800 border-amber-300",   dot: "bg-amber-400" },
  Verified: { badge: "bg-blue-100 text-blue-800 border-blue-300",      dot: "bg-blue-500" },
  Resolved: { badge: "bg-emerald-100 text-emerald-800 border-emerald-300", dot: "bg-emerald-500" },
  Rejected: { badge: "bg-red-100 text-red-800 border-red-300",         dot: "bg-red-500" },
};

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <img
        src={src} alt="evidence full size"
        className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white bg-white/20 backdrop-blur rounded-full h-10 w-10 flex items-center justify-center hover:bg-white/30 transition-colors text-lg"
        aria-label="Close"
      >✕</button>
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
      const snap = await getDocs(query(collection(db, "reports"), where("user_id", "==", user.uid)));
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white">
        <div className="container mx-auto px-4 py-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">My Reports</h1>
          </div>
          <p className="text-blue-200/60 text-sm mt-1 ml-13">All reports you've submitted with their blockchain seals.</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-16 text-center">
            <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No reports yet</p>
            <p className="text-slate-400 text-sm mt-1">Submit your first incident report to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {rows.map((r) => {
              const style = statusStyle[r.status] ?? statusStyle.Pending;
              return (
                <div
                  key={r.id}
                  className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                >
                  {/* Colored top accent bar */}
                  <div className={`h-1 w-full ${style.dot} opacity-60`} />

                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-block h-2 w-2 rounded-full ${style.dot}`} />
                          <h3 className="font-bold text-slate-800">{r.incident_type}</h3>
                          <Badge variant="outline" className={style.badge}>{r.status}</Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {format(new Date(r.incident_date), "PPP")} · submitted{" "}
                          {r.created_at ? format(new Date(r.created_at), "PP") : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="mt-3 text-sm text-slate-600 leading-relaxed">{r.description}</p>

                    {/* Image */}
                    {r.image_url && (
                      <div className="mt-3 relative group/img w-fit">
                        <img
                          src={r.image_url} alt="evidence"
                          className="h-40 w-auto max-w-full rounded-xl border border-slate-200 object-cover cursor-pointer hover:opacity-90 hover:scale-[1.02] transition-all duration-200"
                          onClick={() => setLightboxSrc(r.image_url)}
                        />
                        <button
                          onClick={() => setLightboxSrc(r.image_url)}
                          className="absolute top-2 right-2 bg-black/50 text-white rounded-lg px-2 py-1 text-xs flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity"
                        >
                          <ZoomIn className="h-3 w-3" /> View full
                        </button>
                      </div>
                    )}

                    {/* Location + hash */}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-blue-400" />
                        {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                      </span>
                      {r.hash_value && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Hash className="h-3 w-3 text-slate-400" />
                          {r.hash_value.slice(0, 24)}…
                        </span>
                      )}
                    </div>

                    {/* Navigation */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}`}
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-400 hover:to-cyan-400 hover:scale-105 shadow-sm shadow-blue-500/20 transition-all duration-200"
                      >
                        <Navigation className="h-3 w-3" /> Navigate
                      </a>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`}
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:scale-105 transition-all duration-200"
                      >
                        <MapPin className="h-3 w-3" /> View on map
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
