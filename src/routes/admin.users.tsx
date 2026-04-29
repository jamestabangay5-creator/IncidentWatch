import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { User, Mail, Phone, Calendar, ShieldCheck } from "lucide-react";
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
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Users</h1>
      <p className="text-muted-foreground mt-1">Manage account access.</p>

      {loading ? (
        <div className="mt-8 text-center text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No users found.
        </div>
      ) : (
        <>
          {/* ── Mobile: card list (hidden on md+) ── */}
          <div className="mt-6 grid gap-3 md:hidden">
            {rows.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-border bg-card p-4 space-y-3"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-sm truncate">{p.full_name}</p>
                        {p.is_admin && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                            Admin
                          </Badge>
                        )}
                      </div>
                      <Badge
                        variant={p.is_active ? "default" : "destructive"}
                        className="text-[10px] px-1.5 py-0 mt-0.5"
                      >
                        {p.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                  {!p.is_admin && (
                    <Button
                      size="sm"
                      variant={p.is_active ? "outline" : "default"}
                      onClick={() => toggle(p)}
                      className="shrink-0 text-xs"
                    >
                      {p.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{p.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{p.contact_number ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Joined {p.created_at ? format(new Date(p.created_at), "PP") : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop: table (hidden below md) ── */}
          <div className="mt-6 hidden md:block rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </div>
                        <span>{p.full_name}</span>
                        {p.is_admin && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                            Admin
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.contact_number ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.created_at ? format(new Date(p.created_at), "PP") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={p.is_active ? "default" : "destructive"}>
                        {p.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!p.is_admin && (
                        <Button size="sm" variant="outline" onClick={() => toggle(p)}>
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
  );
}
