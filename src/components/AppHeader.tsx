import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Shield,
  LogOut,
  LayoutDashboard,
  FilePlus2,
  Map,
  Files,
  Menu,
  X,
  Bell,
  BellOff,
  Users,
  ShieldCheck,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";

// ─── nav link helper ────────────────────────────────────────────────────────
function navLinkCls(active: boolean) {
  return `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    active
      ? "bg-primary text-primary-foreground"
      : "text-foreground/80 hover:bg-secondary"
  }`;
}

// ─── mobile drawer link ──────────────────────────────────────────────────────
function MobileLink({
  to,
  active,
  icon: Icon,
  label,
  onClick,
}: {
  to: string;
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-foreground/80 hover:bg-secondary"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

// ─── notification dropdown ───────────────────────────────────────────────────
function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("notif-sound-muted") === "1"; } catch { return false; }
  });
  const ref = useRef<HTMLDivElement>(null);

  // Sync mute flag to window so sounds.ts can read it
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__notifMuted = muted;
  }, [muted]);

  function toggleMute() {
    setMuted((v) => {
      const next = !v;
      try { localStorage.setItem("notif-sound-muted", next ? "1" : "0"); } catch {}
      (window as unknown as Record<string, unknown>).__notifMuted = next;
      return next;
    });
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 hover:bg-secondary transition-colors"
      >
        {muted ? <BellOff className="h-4 w-4 opacity-50" /> : <Bell className="h-4 w-4" />}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-[1002] w-80 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold">Notifications</span>
            <div className="flex items-center gap-2">
              {/* Sound mute toggle */}
              <button
                onClick={toggleMute}
                title={muted ? "Unmute notification sounds" : "Mute notification sounds"}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  muted ? "text-muted-foreground hover:bg-secondary" : "text-primary hover:bg-primary/10"
                }`}
              >
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              {unreadCount > 0 && (
                <button onClick={() => markAllRead()} className="text-xs text-primary hover:underline">
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-secondary/50 transition-colors ${
                    !n.read ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                    <div className={!n.read ? "" : "pl-4"}>
                      <p className="text-sm leading-snug">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(n.created_at), "PPp")}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main header ─────────────────────────────────────────────────────────────
export function AppHeader() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  const userLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Home" },
    { to: "/report/new", icon: FilePlus2, label: "New Report" },
    { to: "/reports", icon: Files, label: "My Reports" },
  ] as const;

  const adminLinks = [
    { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/admin/reports", icon: Files, label: "Reports" },
    { to: "/admin/map", icon: Map, label: "Map" },
    { to: "/admin/users", icon: Users, label: "Users" },
  ] as const;

  const navLinks = isAdmin ? adminLinks : userLinks;

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/" });
  }

  return (
    <>
      {/* ── sticky top bar ── */}
      <header className="sticky top-0 z-[1001] backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-3">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight shrink-0">
            <div className="h-8 w-8 rounded-lg bg-[image:var(--gradient-hero)] flex items-center justify-center shadow-[var(--shadow-glow)]">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden sm:inline">SafeTrace</span>
          </Link>

          {/* Desktop nav */}
          {user && (
            <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
              {navLinks.map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={navLinkCls(
                    to === "/admin" ? path === "/admin" : path.startsWith(to)
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
          )}

          {/* Right side actions */}
          <div className="flex items-center gap-1 shrink-0">
            {user ? (
              <>
                {/* Role badge */}
                {isAdmin && (
                  <Badge variant="outline" className="hidden sm:flex items-center gap-1 text-xs border-primary/40 text-primary">
                    <ShieldCheck className="h-3 w-3" /> Admin
                  </Badge>
                )}

                {/* Notification bell — shown for both users and admins */}
                <NotificationBell />

                {/* Sign out — desktop */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="hidden md:inline-flex"
                >
                  <LogOut className="h-4 w-4 mr-1" /> Sign out
                </Button>

                {/* Hamburger — mobile only */}
                <button
                  onClick={() => setMobileOpen((v) => !v)}
                  aria-label={mobileOpen ? "Close menu" : "Open menu"}
                  className="md:hidden flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 hover:bg-secondary transition-colors"
                >
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/auth">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── mobile drawer overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── mobile drawer panel ── */}
      <div
        className={`fixed top-14 left-0 right-0 z-[1001] md:hidden bg-background border-b border-border shadow-lg transition-all duration-200 ease-in-out ${
          mobileOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <nav className="container mx-auto px-4 py-3 flex flex-col gap-1">
          {navLinks.map(({ to, icon, label }) => (
            <MobileLink
              key={to}
              to={to}
              icon={icon}
              label={label}
              active={to === "/admin" ? path === "/admin" : path.startsWith(to)}
              onClick={() => setMobileOpen(false)}
            />
          ))}

          <div className="mt-2 pt-2 border-t border-border">
            <button
              onClick={() => { setMobileOpen(false); handleSignOut(); }}
              className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          </div>
        </nav>
      </div>
    </>
  );
}
