import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FilePlus2, ListChecks, Clock, ShieldCheck, ArrowRight, FileText } from "lucide-react";
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
    {
      label: "Total reports", value: stats.total, icon: ListChecks,
      gradient: "from-blue-500 to-indigo-600", bg: "from-blue-500/10 to-indigo-500/10",
    },
    {
      label: "Pending", value: stats.pending, icon: Clock,
      gradient: "from-amber-400 to-orange-500", bg: "from-amber-400/10 to-orange-500/10",
    },
    {
      label: "Verified", value: stats.verified, icon: ShieldCheck,
      gradient: "from-cyan-400 to-blue-500", bg: "from-cyan-400/10 to-blue-500/10",
    },
    {
      label: "Resolved", value: stats.resolved, icon: ShieldCheck,
      gradient: "from-emerald-400 to-green-600", bg: "from-emerald-400/10 to-green-600/10",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Hero banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white">
        <div className="container mx-auto px-4 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-blue-300/80 text-sm font-medium">Welcome back</p>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-1">
                {name || "Citizen"} 👋
              </h1>
              <p className="text-blue-200/60 text-sm mt-1">Here's an overview of your reports.</p>
            </div>
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white border-0 shadow-lg shadow-blue-500/30 hover:scale-105 transition-all duration-200"
            >
              <Link to="/report/new">
                <FilePlus2 className="mr-1.5 h-4 w-4" /> Submit new report
              </Link>
            </Button>
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
                shadow-sm hover:shadow-lg hover:scale-[1.03] hover:-translate-y-0.5
                transition-all duration-300 cursor-default`}
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

        {/* Quick actions */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          <h2 className="font-bold text-slate-800 mb-4 text-lg">Quick actions</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Link
              to="/reports"
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/50 p-4 hover:border-blue-300 hover:shadow-md hover:scale-[1.02] transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">View my reports</p>
                  <p className="text-xs text-slate-500">See all your submissions</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all duration-200" />
            </Link>

            <Link
              to="/report/new"
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-cyan-50/50 p-4 hover:border-cyan-300 hover:shadow-md hover:scale-[1.02] transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <FilePlus2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">Submit a report</p>
                  <p className="text-xs text-slate-500">Report a new incident</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-cyan-500 group-hover:translate-x-1 transition-all duration-200" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
