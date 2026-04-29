import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ListChecks, Clock, ShieldCheck, CheckCircle2, FileDown, Calendar } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard — SafeTrace" }] }),
  component: () => (
    <RequireAuth admin>
      <AdminDashboard />
    </RequireAuth>
  ),
});

function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, pending: 0, verified: 0, resolved: 0 });
  const [exporting, setExporting] = useState(false);

  // Default to current month
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDay.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "reports"),
      (snap) => {
        const list = snap.docs.map((d) => d.data());
        setStats({
          total: list.length,
          pending: list.filter((r) => r.status === "Pending").length,
          verified: list.filter((r) => r.status === "Verified").length,
          resolved: list.filter((r) => r.status === "Resolved").length,
        });
      },
      (err) => {
        toast.error("Failed to load stats");
        console.error(err);
      },
    );
    return () => unsub();
  }, []);

  async function exportPDF() {
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates");
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // include the entire end day

    if (start > end) {
      toast.error("Start date must be before end date");
      return;
    }

    setExporting(true);
    try {
      const snap = await getDocs(
        query(collection(db, "reports"), orderBy("created_at", "desc")),
      );
      const data = snap.docs
        .map((d) => d.data())
        .filter((r) => {
          const ts = r.created_at?.toDate?.();
          return ts && ts >= start && ts <= end;
        });

      if (data.length === 0) {
        toast.error("No reports found in the selected date range");
        setExporting(false);
        return;
      }

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("SafeTrace — Incident Report", 14, 18);
      doc.setFontSize(10);
      doc.text(`Period: ${format(start, "PPP")} – ${format(end, "PPP")}`, 14, 25);
      doc.text(`Total: ${data.length} reports`, 14, 31);

      autoTable(doc, {
        startY: 38,
        head: [["Date", "Type", "Status", "Location", "Description"]],
        body: data.map((r) => [
          format(new Date(r.incident_date), "PP"),
          r.incident_type,
          r.status,
          `${Number(r.latitude).toFixed(3)}, ${Number(r.longitude).toFixed(3)}`,
          String(r.description).slice(0, 80),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [40, 60, 120] },
      });

      doc.save(`safetrace-${format(start, "yyyy-MM-dd")}-to-${format(end, "yyyy-MM-dd")}.pdf`);
      toast.success(`Exported ${data.length} reports`);
    } catch (err) {
      toast.error("Export failed");
      console.error(err);
    } finally {
      setExporting(false);
    }
  }

  const cards = [
    { label: "Total reports", value: stats.total, icon: ListChecks, color: "text-primary" },
    { label: "Pending", value: stats.pending, icon: Clock, color: "text-warning" },
    { label: "Verified", value: stats.verified, icon: ShieldCheck, color: "text-accent" },
    { label: "Resolved", value: stats.resolved, icon: CheckCircle2, color: "text-success" },
  ];

  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Admin Console</p>
          <h1 className="text-3xl font-bold tracking-tight">System overview</h1>
        </div>

        {/* Export with date range picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              Export PDF
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-3">
              <div>
                <Label htmlFor="export-start" className="text-xs">Start date</Label>
                <Input
                  id="export-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate}
                />
              </div>
              <div>
                <Label htmlFor="export-end" className="text-xs">End date</Label>
                <Input
                  id="export-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <Button onClick={exportPDF} disabled={exporting} className="w-full">
                <FileDown className="mr-1 h-4 w-4" />
                {exporting ? "Generating…" : "Generate PDF"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <div className="text-3xl font-bold mt-2">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Link to="/admin/reports" className="rounded-xl border border-border bg-card p-6 hover:shadow-[var(--shadow-elevated)] transition-shadow">
          <h3 className="font-semibold">Manage reports</h3>
          <p className="text-sm text-muted-foreground mt-1">Approve, reject, and update statuses.</p>
        </Link>
        <Link to="/admin/map" className="rounded-xl border border-border bg-card p-6 hover:shadow-[var(--shadow-elevated)] transition-shadow">
          <h3 className="font-semibold">Hotspot map</h3>
          <p className="text-sm text-muted-foreground mt-1">Heatmap & cluster visualization.</p>
        </Link>
        <Link to="/admin/users" className="rounded-xl border border-border bg-card p-6 hover:shadow-[var(--shadow-elevated)] transition-shadow">
          <h3 className="font-semibold">Users</h3>
          <p className="text-sm text-muted-foreground mt-1">Activate or deactivate accounts.</p>
        </Link>
      </div>
    </div>
  );
}
