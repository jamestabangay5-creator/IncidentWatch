import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { User, Mail, Phone, Calendar, ShieldCheck, Users as UsersIcon } from "lucide-react";
import {
  collection,
  getDocs,
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

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users — SafeTrace" }] }),
  component: () => (
    <RequireAuth admin>
      <Users />
    </RequireAuth>
  ),
});

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  contact_number: string | null;
  is_active: boolean;
  created_at: string;
  is_admin: boolean;
}

function Users() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const snap = await getDocs(collection(db, "profiles"));
      const sorted = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          // Check if this user has admin role
          let is_admin = false;
          try {
            const roleSnap = await getDoc(doc(db, "user_role", d.id));
            if (roleSnap.exists()) {
              const raw = roleSnap.data().roles;
              const roles: string[] = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
              is_admin = roles.includes("admin");
            }
          } catch {
            // non-fatal
          }
          return {
            id: d.id,
            full_name: data.full_name,
            email: data.email,
            contact_number: data.contact_number ?? null,
            is_active: data.is_active ?? true,
            created_at: data.created_at?.toDate?.()?.toISOString() ?? "",
            is_admin,
          };
        }),
      );
      setRows(sorted.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch (err) {
      toast.error("Failed to load users");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggle(p: ProfileRow) {
    if (p.is_admin) {
      toast.error("Admin accounts cannot be deactivated.");
      return;
    }
    const next = !p.is_active;
    try {
      await updateDoc(doc(db, "profiles", p.id), {
        is_active: next,
        updated_at: serverTimestamp(),
      });
      await addDoc(collection(db, "audit_logs"), {
        actor_id: user?.uid,
        action: next ? "user.activate" : "user.deactivate",
        target_type: "user",
        target_id: p.id,
        created_at: serverTimestamp(),
      });
      toast.success(`User ${next ? "activated" : "deactivated"}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white">
        <div className="container mx-auto px-4 py-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <UsersIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Users</h1>
              <p className="text-blue-200/60 text-sm mt-0.5">Manage account access.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-16 text-center">
            <p className="text-slate-500">No users found.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {rows.map((p) => (
                <div key={p.id} className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
                  <div className={`h-1 w-full ${p.is_admin ? "bg-gradient-to-r from-indigo-500 to-purple-600" : p.is_active ? "bg-gradient-to-r from-emerald-400 to-green-500" : "bg-red-400"}`} />
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${p.is_admin ? "from-indigo-500 to-purple-600" : "from-blue-500 to-cyan-500"} flex items-center justify-center shrink-0 shadow-sm`}>
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-slate-800 text-sm truncate">{p.full_name}</p>
                            {p.is_admin && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-indigo-300 text-indigo-700 bg-indigo-50">Admin</Badge>}
                          </div>
                          <Badge variant={p.is_active ? "default" : "destructive"} className="text-[10px] px-1.5 py-0 mt-0.5">
                            {p.is_active ? "Active" : "Disabled"}
                          </Badge>
                        </div>
                      </div>
                      {!p.is_admin && (
                        <Button
                          size="sm"
                          onClick={() => toggle(p)}
                          className={`shrink-0 text-xs ${p.is_active
                            ? "border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50"
                            : "bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0"
                          } transition-all duration-200`}
                          variant={p.is_active ? "outline" : "default"}
                        >
                          {p.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1.5 text-sm text-slate-500">
                      <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-blue-400 shrink-0" /><span className="truncate">{p.email}</span></div>
                      <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-blue-400 shrink-0" /><span>{p.contact_number ?? "—"}</span></div>
                      <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-blue-400 shrink-0" /><span>Joined {p.created_at ? format(new Date(p.created_at), "PP") : "—"}</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-slate-50 to-blue-50/50 border-b border-slate-200">
                  <tr>
                    {["Name", "Email", "Contact", "Joined", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 hover:bg-blue-50/30 transition-colors duration-150">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${p.is_admin ? "from-indigo-500 to-purple-600" : "from-blue-500 to-cyan-500"} flex items-center justify-center shrink-0 shadow-sm`}>
                            <ShieldCheck className="h-4 w-4 text-white" />
                          </div>
                          <span>{p.full_name}</span>
                          {p.is_admin && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-indigo-300 text-indigo-700 bg-indigo-50">Admin</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{p.email}</td>
                      <td className="px-4 py-3 text-slate-500">{p.contact_number ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{p.created_at ? format(new Date(p.created_at), "PP") : "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={p.is_active ? "default" : "destructive"}>{p.is_active ? "Active" : "Disabled"}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!p.is_admin && (
                          <Button
                            size="sm" onClick={() => toggle(p)}
                            className={`${p.is_active
                              ? "border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50"
                              : "bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0"
                            } transition-all duration-200 hover:scale-105`}
                            variant={p.is_active ? "outline" : "default"}
                          >
                            {p.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
