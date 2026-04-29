import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ListChecks, Clock, ShieldCheck, CheckCircle2, FileDown, Calendar, Map, Users, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { toast } from "sonner";
import { collection, getDocs, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard — SafeTrace" }] }),
  component: () => <RequireAuth admin><AdminDashboard /></RequireAuth>,
});

function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, pending: 0, verified: 0, resolved: 0 });
  const [exporting, setExporting] = useState(false);
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDay.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "reports"),
      (snap) => {
        const list = snap.docs.map((d) => d.data());
        setStats({
          total: list.length,
          pending: list.filter((r) => r.status === "Pending").length,
          verified: list.filter((r) => r.status === "Verified").length,
          resolved: list.filter((r) => r.status === "Resolved").length,
        });
      },
      (err) => { toast.error("Failed to load stats"); console.error(err); },
    );
    return () => unsub();
  }, []);

  async function exportPDF() {
    if (!startDate || !endDate) { toast.error("Please select both dates"); return; }
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    if (start > end) { toast.error("Start date must be before end date"); return; }
    setExporting(true);
    try {
      const snap = await getDocs(query(collection(db, "reports"), orderBy("created_at", "desc")));
      const data = snap.docs.map((d) => d.data()).filter((r) => {
        const ts = r.created_at?.toDate?.();
        return ts && ts >= start && ts <= end;
      });
      if (data.length === 0) { toast.error("No reports in selected range"); setExporting(false); return; }
      const doc = new jsPDF();
      doc.setFontSize(16); doc.text("SafeTrace — Incident Report", 14, 18);
      doc.setFontSize(10);
      doc.text(`Period: ${format(start, "PPP")} – ${format(end, "PPP")}`, 14, 25);
      doc.text(`Total: ${data.length} reports`, 14, 31);
      autoTable(doc, {
        startY: 38,
        head: [["Date", "Type", "Status", "Location", "Description"]],
        body: data.map((r) => [
          format(new Date(r.incident_date), "PP"), r.incident_type, r.status,
          `${Number(r.latitude).toFixed(3)}, ${Number(r.longitude).toFixed(3)}`,
          String(r.description).slice(0, 80),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 138] },
      });
      doc.save(`safetrace-${format(start, "yyyy-MM-dd")}-to-${format(end, "yyyy-MM-dd")}.pdf`);
      toast.success(`Exported ${data.length} reports`);
    } catch (err) { toast.error("Export failed"); console.error(err); }
    finally { setExporting(false); }
  }

  const cards = [
    { label: "Total reports", value: stats.total,    icon: ListChecks,   gradient: "from-blue-500 to-indigo-600",   bg: "from-blue-500/10 to-indigo-500/10" },
    { label: "Pending",       value: stats.pending,  icon: Clock,        gradient: "from-amber-400 to-orange-500",  bg: "from-amber-400/10 to-orange-500/10" },
    { label: "Verified",      value: stats.verified, icon: ShieldCheck,  gradient: "from-cyan-400 to-blue-500",     bg: "from-cyan-400/10 to-blue-500/10" },
    { label: "Resolved",      value: stats.resolved, icon: CheckCircle2, gradient: "from-emerald-400 to-green-600", bg: "from-emerald-400/10 to-green-600/10" },
  ];

  const navCards = [
    { to: "/admin/reports", icon: FileText, label: "Manage reports",  desc: "Approve, reject, and update statuses.", gradient: "from-blue-500 to-indigo-600",   glow: "shadow-blue-500/20" },
    { to: "/admin/map",     icon: Map,      label: "Hotspot map",     desc: "Heatmap & cluster visualization.",      gradient: "from-cyan-500 to-blue-600",     glow: "shadow-cyan-500/20" },
    { to: "/admin/users",   icon: Users,    label: "Users",           desc: "Activate or deactivate accounts.",      gradient: "from-indigo-500 to-purple-600",  glow: "shadow-indigo-500/20" },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white">
        <div className="container mx-auto px-4 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-blue-300/70 text-sm font-medium">Admin Console</p>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-1">System Overview</h1>
              <p className="text-blue-200/50 text-sm mt-1">Real-time incident monitoring dashboard.</p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button className="bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur gap-2 hover:scale-105 transition-all duration-200">
                  <Calendar className="h-4 w-4" /> Export PDF
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-3">
                  <p className="font-semibold text-sm text-slate-800">Export date range</p>
                  <div>
                    <Label htmlFor="export-start" className="text-xs text-slate-600">Start date</Label>
                    <Input id="export-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} max={endDate} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="export-end" className="text-xs text-slate-600">End date</Label>
                    <Input id="export-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} max={now.toISOString().slice(0, 10)} className="mt-1" />
                  </div>
                  <Button onClick={exportPDF} disabled={exporting} className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white border-0">
                    <FileDown className="mr-1 h-4 w-4" />
                    {exporting ? "Generating…" : "Generate PDF"}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 -mt-6">
          {cards.map((c) => (
            <div
              key={c.label}
              className={`group rounded-2xl border border-white/60 bg-gradient-to-br ${c.bg} bg-white/80 backdrop-blur p-5
                shadow-sm hover:shadow-lg hover:scale-[1.03] hover:-translate-y-0.5 transition-all duration-300 cursor-default`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-500">{c.label}</span>
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                  <c.icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className={`text-4xl font-black bg-gradient-to-r ${c.gradient} bg-clip-text text-transparent`}>
                {c.value}
              </div>
            </div>
          ))}
        </div>

        {/* Navigation cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {navCards.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`group relative rounded-2xl border border-slate-200 bg-white p-6 overflow-hidden
                hover:border-transparent hover:shadow-xl ${n.glow} hover:scale-[1.02] hover:-translate-y-0.5
                transition-all duration-300`}
            >
              {/* Gradient background on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${n.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
              <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${n.gradient} flex items-center justify-center shadow-md mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <n.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">{n.label}</h3>
              <p className="text-sm text-slate-500 mt-1">{n.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
