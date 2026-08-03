import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Nexus" }] }),
  component: AuthPage,
});

const signupSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  contact_number: z.string().trim().min(7).max(20),
  password: z.string().min(8).max(128),
});

// Google "G" SVG icon
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-white/15" />
      <span className="text-xs text-blue-300/50 font-medium">{label}</span>
      <div className="flex-1 h-px bg-white/15" />
    </div>
  );
}

function AuthPage() {
  const { user, isAdmin, loading, signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPwReg, setShowPwReg] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: isAdmin ? "/admin" : "/dashboard" });
    }
  }, [user, isAdmin, loading, navigate]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await signIn(String(fd.get("email")), String(fd.get("password")));
      toast.success("Signed in");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found")) {
        toast.error("Invalid email or password");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
      toast.success("Signed in with Google");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      if (msg.includes("popup-closed-by-user") || msg.includes("cancelled-popup-request")) {
        // User closed the popup — not an error
      } else {
        toast.error(msg);
      }
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      full_name: fd.get("full_name"),
      email: fd.get("email"),
      contact_number: fd.get("contact_number"),
      password: fd.get("password"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    try {
      await signUp(parsed.data);
      toast.success("Account created. Welcome!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign up failed";
      if (msg.includes("email-already-in-use")) {
        toast.error("An account with this email already exists");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl animate-pulse [animation-delay:1.5s]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo + heading */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg shadow-blue-500/40 mb-4 hover:scale-110 transition-transform duration-300 overflow-hidden">
            <img src="/icons/nexus-logo.jpg" alt="Nexus logo" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-3xl font-extrabold text-white">Welcome to Nexus</h1>
          <p className="text-blue-200/70 mt-1 text-sm">Secure incident reporting for citizens & officials.</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-blue-900/40 p-7">
          <Tabs defaultValue="login">
            <TabsList className="grid grid-cols-2 mb-6 bg-white/10 rounded-xl p-1">
              <TabsTrigger
                value="login"
                className="rounded-lg text-blue-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
              >
                Sign in
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="rounded-lg text-blue-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
              >
                Create account
              </TabsTrigger>
            </TabsList>

            {/* ── Sign in ── */}
            <TabsContent value="login">
              {/* Google sign-in */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleBusy}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/20 bg-white text-slate-700 font-semibold text-sm py-2.5 hover:bg-slate-50 hover:scale-[1.02] active:scale-100 transition-all duration-200 shadow-sm disabled:opacity-60"
              >
                {googleBusy ? (
                  <span className="h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                Continue with Google
              </button>

              <Divider label="or sign in with email" />

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="li-email" className="text-blue-100 text-sm">Email</Label>
                  <Input
                    id="li-email" name="email" type="email" required
                    className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-blue-300/40 focus:border-blue-400 focus:ring-blue-400/30 transition-colors"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="li-password" className="text-blue-100 text-sm">Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="li-password" name="password" type={showPw ? "text" : "password"} required
                      className="bg-white/10 border-white/20 text-white placeholder:text-blue-300/40 focus:border-blue-400 focus:ring-blue-400/30 pr-10 transition-colors"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300/60 hover:text-blue-200 transition-colors">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit"
                  className="w-full mt-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white border-0 shadow-lg shadow-blue-500/30 hover:scale-[1.02] transition-all duration-200"
                  disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            {/* ── Create account ── */}
            <TabsContent value="signup">
              {/* Google sign-up */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleBusy}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/20 bg-white text-slate-700 font-semibold text-sm py-2.5 hover:bg-slate-50 hover:scale-[1.02] active:scale-100 transition-all duration-200 shadow-sm disabled:opacity-60"
              >
                {googleBusy ? (
                  <span className="h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                Sign up with Google
              </button>

              <Divider label="or create with email" />

              <form onSubmit={handleSignup} className="space-y-4">
                {[
                  { id: "su-name",    name: "full_name",      label: "Full name",      type: "text",  placeholder: "Juan dela Cruz" },
                  { id: "su-email",   name: "email",          label: "Email",          type: "email", placeholder: "you@example.com" },
                  { id: "su-contact", name: "contact_number", label: "Contact number", type: "tel",   placeholder: "+63 912 345 6789" },
                ].map((f) => (
                  <div key={f.id}>
                    <Label htmlFor={f.id} className="text-blue-100 text-sm">{f.label}</Label>
                    <Input id={f.id} name={f.name} type={f.type} required placeholder={f.placeholder}
                      className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-blue-300/40 focus:border-blue-400 focus:ring-blue-400/30 transition-colors" />
                  </div>
                ))}
                <div>
                  <Label htmlFor="su-password" className="text-blue-100 text-sm">
                    Password <span className="text-blue-300/50">(min 8 chars)</span>
                  </Label>
                  <div className="relative mt-1">
                    <Input id="su-password" name="password" type={showPwReg ? "text" : "password"} required
                      className="bg-white/10 border-white/20 text-white placeholder:text-blue-300/40 focus:border-blue-400 focus:ring-blue-400/30 pr-10 transition-colors"
                      placeholder="••••••••" />
                    <button type="button" onClick={() => setShowPwReg((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300/60 hover:text-blue-200 transition-colors">
                      {showPwReg ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit"
                  className="w-full mt-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white border-0 shadow-lg shadow-blue-500/30 hover:scale-[1.02] transition-all duration-200"
                  disabled={busy}>
                  {busy ? "Creating…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
