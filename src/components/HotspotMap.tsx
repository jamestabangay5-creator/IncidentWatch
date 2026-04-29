import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  status: string;
  description?: string;
  incident_date?: string;
  image_url?: string | null;
}

interface Props {
  points: MapPoint[];
  height?: number;
  showHeatmap?: boolean;
}

// ── status badge colours (inline CSS — no Tailwind inside Leaflet DOM) ───────
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Pending:  { bg: "#fef9c3", color: "#854d0e" },
  Verified: { bg: "#dbeafe", color: "#1e40af" },
  Resolved: { bg: "#dcfce7", color: "#166534" },
  Rejected: { bg: "#fee2e2", color: "#991b1b" },
};

function statusBadge(status: string) {
  const c = STATUS_COLORS[status] ?? { bg: "#f3f4f6", color: "#374151" };
  return `<span style="
    display:inline-block;
    padding:2px 8px;
    border-radius:9999px;
    font-size:11px;
    font-weight:600;
    background:${c.bg};
    color:${c.color};
    border:1px solid ${c.color}33;
    letter-spacing:0.02em;
  ">${status}</span>`;
}

function formatDate(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return iso;
  }
}

function buildPopupHtml(p: MapPoint): string {
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;

  const imageHtml = p.image_url
    ? `<a href="${p.image_url}" target="_blank" rel="noreferrer" style="display:block;margin-top:8px;">
        <img src="${p.image_url}" alt="evidence"
          style="width:100%;max-height:120px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;" />
       </a>`
    : "";

  const descHtml = p.description
    ? `<p style="margin:6px 0 0;font-size:12px;color:#4b5563;line-height:1.5;
                 display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">
        ${p.description}
       </p>`
    : "";

  const dateHtml = p.incident_date
    ? `<p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">
        📅 ${formatDate(p.incident_date)}
       </p>`
    : "";

  const coordsHtml = `<p style="margin:4px 0 0;font-size:11px;color:#9ca3af;font-family:monospace;">
    📍 ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}
  </p>`;

  return `
    <div style="min-width:220px;max-width:260px;font-family:system-ui,sans-serif;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
        <strong style="font-size:14px;color:#111827;line-height:1.3;flex:1;">${p.title}</strong>
        ${statusBadge(p.status)}
      </div>
      ${dateHtml}
      ${coordsHtml}
      ${descHtml}
      ${imageHtml}
      <div style="margin-top:10px;display:flex;gap:6px;">
        <a href="${navUrl}" target="_blank" rel="noreferrer"
          style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:5px;
                 padding:6px 10px;border-radius:6px;font-size:12px;font-weight:600;
                 background:#2563eb;color:#fff;text-decoration:none;
                 border:none;cursor:pointer;transition:background 0.15s;"
          onmouseover="this.style.background='#1d4ed8'"
          onmouseout="this.style.background='#2563eb'">
          🧭 Navigate
        </a>
        <a href="${mapsUrl}" target="_blank" rel="noreferrer"
          style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:5px;
                 padding:6px 10px;border-radius:6px;font-size:12px;font-weight:600;
                 background:#f3f4f6;color:#374151;text-decoration:none;
                 border:1px solid #e5e7eb;cursor:pointer;transition:background 0.15s;"
          onmouseover="this.style.background='#e5e7eb'"
          onmouseout="this.style.background='#f3f4f6'">
          🗺 View map
        </a>
      </div>
    </div>
  `;
}

export function HotspotMap({ points, height = 500, showHeatmap = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const heatRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current).setView([14.5995, 120.9842], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }

    points.forEach((p) => {
      L.marker([p.lat, p.lng])
        .bindPopup(buildPopupHtml(p), {
          maxWidth: 280,
          className: "sentinel-popup",
        })
        .addTo(layer);
    });

    if (showHeatmap && points.length > 0) {
      const heatData = points.map((p) => [p.lat, p.lng, 0.7]) as [number, number, number][];
      const heat = (L as unknown as { heatLayer: (d: unknown[], o: unknown) => L.Layer }).heatLayer(
        heatData,
        { radius: 30, blur: 25, maxZoom: 15 },
      );
      heat.addTo(map);
      heatRef.current = heat;
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [points, showHeatmap]);

  return (
    <>
      {/* Scoped popup styles injected once */}
      <style>{`
        .sentinel-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          padding: 0;
          overflow: hidden;
        }
        .sentinel-popup .leaflet-popup-content {
          margin: 14px;
        }
        .sentinel-popup .leaflet-popup-tip-container {
          margin-top: -1px;
        }
      `}</style>
      <div
        ref={ref}
        style={{ height, width: "100%" }}
        className="rounded-xl overflow-hidden border border-border shadow-sm"
      />
    </>
  );
}
