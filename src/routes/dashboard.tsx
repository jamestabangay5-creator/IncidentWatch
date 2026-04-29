import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FilePlus2, ListChecks, Clock, ShieldCheck } from "lucide-react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SafeTrace" }] }),
  component: () => (
    <RequireAuth>
      <DashboardPage />
    </RequireAuth>
  ),
});

function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, pending: 0, verified: 0, resolved: 0 });
  const [name, setName] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [profileSnap, reportsSnap] = await Promise.all([
        getDoc(doc(db, "profiles", user.uid)),
        getDocs(query(collection(db, "reports"), where("user_id", "==", user.uid))),
      ]);
      setName(profileSnap.data()?.full_name ?? user.displayName ?? "");
      const list = reportsSnap.docs.map((d) => d.data());
      setStats({
        total: list.length,
        pending: list.filter((r) => r.status === "Pending").length,
        verified: list.filter((r) => r.status === "Verified").length,
        resolved: list.filter((r) => r.status === "Resolved").length,
      });
    })();
  }, [user]);

  const cards = [
    { label: "Total reports", value: stats.total, icon: ListChecks, color: "text-primary" },
    { label: "Pending", value: stats.pending, icon: Clock, color: "text-warning" },
    { label: "Verified", value: stats.verified, icon: ShieldCheck, color: "text-accent" },
    { label: "Resolved", value: stats.resolved, icon: ShieldCheck, color: "text-success" },
  ];

  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="text-3xl font-bold tracking-tight">{name || "Citizen"}</h1>
        </div>
        <Button asChild size="lg" className="shadow-[var(--shadow-glow)]">
          <Link to="/report/new">
            <FilePlus2 className="mr-1 h-4 w-4" /> Submit new report
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-border bg-card p-5 hover:shadow-[var(--shadow-elevated)] transition-shadow"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <div className="text-3xl font-bold mt-2">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold mb-2">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link to="/reports">View my reports</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/report/new">Submit a new report</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
