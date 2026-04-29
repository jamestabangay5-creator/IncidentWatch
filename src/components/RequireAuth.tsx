import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth" });
    else if (admin && !isAdmin) navigate({ to: "/dashboard" });
  }, [user, loading, isAdmin, admin, navigate]);

  if (loading || !user || (admin && !isAdmin)) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Loading…</div>
    );
  }
  return <>{children}</>;
}