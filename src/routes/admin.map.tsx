import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Map, Clock, Eye, EyeOff } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { HotspotMap, type MapPoint } from "@/components/HotspotMap";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/map")({
  head: () => ({ meta: [{ title: "Hotspot Map — SafeTrace" }] }),
  component: () => (
    <RequireAuth admin>
      <AdminMap />
    </RequireAuth>
  ),
});

// How many days a Resolved report stays visible on the map
const RESOLVED_TTL_DAYS = 7;

interface RawPoint extends MapPoint {
  resolved_at?: string | null;
}

function daysAgo(isoDate: string): number {
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

function daysRemaining(isoDate: string): number {
  return Math.max(0, RESOLVED_TTL_DAYS - daysAgo(isoDate));
}

function AdminMap() {
  const [allPoints, setAllPoints] = useState<RawPoint[]>([]);
  const [heat, setHeat] = useState(true);
  const [showResolved, setShowResolved] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "reports"));
        setAllPoints(
          snap.docs.map((d) => {
            const r = d.data();
            const resolvedAt = r.resolved_at?.toDate?.()?.toISOString() ?? null;
            return {
              id: d.id,
              lat: r.latitude,
              lng: r.longitude,
              title: r.incident_type,
              status: r.status,
              description: r.description,
              incident_date: r.incident_date,
              image_url: r.image_url ?? null,
              resolved_at: resolvedAt,
            };
          }),
        );
      } catch (err) {
        console.error("Failed to load map points:", err);
      }
    })();
  }, []);

  // Resolved reports that are still within the TTL window
  const activeResolved = allPoints.filter(
    (p) => p.status === "Resolved" && p.resolved_at && daysAgo(p.resolved_at) <= RESOLVED_TTL_DAYS,
  );

  // Resolved reports that have expired (past TTL)
  const expiredCount = allPoints.filter(
    (p) => p.status === "Resolved" && (!p.resolved_at || daysAgo(p.resolved_at) > RESOLVED_TTL_DAYS),
  ).length;

  // Points shown on map
  const visiblePoints = allPoints.filter((p) => {
    if (p.status === "Resolved") {
      // Exclude if no resolved_at (legacy) or past TTL
      if (!p.resolved_at || daysAgo(p.resolved_at) > RESOLVED_TTL_DAYS) return false;
      // Exclude if user toggled resolved off
      if (!showResolved) return false;
    }
    return true;
  });

  const pendingCount  = allPoints.filter((p) => p.status === "Pending").length;
  const verifiedCount = allPoints.filter((p) => p.status === "Verified").length;
  const resolvedCount = activeResolved.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white">
        <div className="container mx-auto px-4 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Map className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-blue-300/70 text-sm font-medium">Admin</p>
                <h1 className="text-3xl font-extrabold tracking-tight">Hotspot Map</h1>
                <p className="text-blue-200/50 text-sm mt-0.5">{visiblePoints.length} reports plotted</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Heatmap toggle */}
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-xl px-4 py-2 border border-white/20">
                <Switch id="heat" checked={heat} onCheckedChange={setHeat} />
                <Label htmlFor="heat" className="text-white text-sm cursor-pointer">Heatmap</Label>
              </div>

              {/* Resolved toggle */}
              <button
                onClick={() => setShowResolved((v) => !v)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 border text-sm font-medium transition-all duration-200 ${
                  showResolved
                    ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30"
                    : "bg-white/10 border-white/20 text-white/60 hover:bg-white/20"
                }`}
              >
                {showResolved ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Resolved ({resolvedCount})
              </button>
            </div>
          </div>

          {/* Status summary bar */}
          <div className="mt-5 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-amber-400/15 border border-amber-400/30 rounded-lg px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-amber-300 text-xs font-medium">{pendingCount} Pending</span>
            </div>
            <div className="flex items-center gap-2 bg-blue-400/15 border border-blue-400/30 rounded-lg px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-blue-300 text-xs font-medium">{verifiedCount} Verified</span>
            </div>
            <div className="flex items-center gap-2 bg-emerald-400/15 border border-emerald-400/30 rounded-lg px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-emerald-300 text-xs font-medium">{resolvedCount} Resolved (visible)</span>
            </div>
            {expiredCount > 0 && (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                <Clock className="h-3 w-3 text-white/40" />
                <span className="text-white/40 text-xs">{expiredCount} expired off map</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TTL info banner */}
      <div className="container mx-auto px-4 pt-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex flex-wrap items-center gap-3">
          <Clock className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700">
            <span className="font-semibold">Resolved reports</span> stay on the map for{" "}
            <span className="font-bold">{RESOLVED_TTL_DAYS} days</span> after resolution, then are automatically hidden.
          </p>
          {/* Per-report countdown badges */}
          {activeResolved.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1 w-full">
              {activeResolved.map((p) => (
                <Badge
                  key={p.id}
                  variant="outline"
                  className="text-xs border-emerald-300 text-emerald-700 bg-white gap-1"
                >
                  <Clock className="h-2.5 w-2.5" />
                  {p.title} — {daysRemaining(p.resolved_at!).toFixed(1)}d left
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="container mx-auto px-4 py-4">
        <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-200">
          <HotspotMap points={visiblePoints} showHeatmap={heat} height={580} />
        </div>
      </div>
    </div>
  );
}
