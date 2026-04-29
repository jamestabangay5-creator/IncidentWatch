import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { HotspotMap, type MapPoint } from "@/components/HotspotMap";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/map")({
  head: () => ({ meta: [{ title: "Hotspot Map — SafeTrace" }] }),
  component: () => (
    <RequireAuth admin>
      <AdminMap />
    </RequireAuth>
  ),
});

function AdminMap() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [heat, setHeat] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "reports"));
        setPoints(
          snap.docs.map((d) => {
            const r = d.data();
            return {
              id: d.id,
              lat: r.latitude,
              lng: r.longitude,
              title: r.incident_type,
              status: r.status,
              description: r.description,
              incident_date: r.incident_date,
              image_url: r.image_url ?? null,
            };
          }),
        );
      } catch (err) {
        console.error("Failed to load map points:", err);
      }
    })();
  }, []);

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <p className="text-sm text-muted-foreground">Admin</p>
          <h1 className="text-3xl font-bold tracking-tight">Hotspot map</h1>
          <p className="text-sm text-muted-foreground">{points.length} reports plotted</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="heat" checked={heat} onCheckedChange={setHeat} />
          <Label htmlFor="heat">Heatmap overlay</Label>
        </div>
      </div>
      <HotspotMap points={points} showHeatmap={heat} height={620} />
    </div>
  );
}
