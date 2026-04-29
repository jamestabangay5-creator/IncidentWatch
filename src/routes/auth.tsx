import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Shield, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — SafeTrace" }] }),
  component: AuthPage,
});

const signupSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  contact_number: z.string().trim().min(7).max(20),
  password: z.string().min(8).max(128),
});

function AuthPage() {
  const { user, isAdmin, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
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
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/40 mb-4 hover:scale-110 transition-transform duration-300">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white">Welcome to SafeTrace</h1>
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

            {/* Sign in */}
            <TabsContent value="login">
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
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300/60 hover:text-blue-200 transition-colors"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full mt-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white border-0 shadow-lg shadow-blue-500/30 hover:shadow-blue-400/40 hover:scale-[1.02] transition-all duration-200"
                  disabled={busy}
                >
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            {/* Create account */}
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                {[
                  { id: "su-name",    name: "full_name",       label: "Full name",      type: "text",     placeholder: "Juan dela Cruz" },
                  { id: "su-email",   name: "email",           label: "Email",          type: "email",    placeholder: "you@example.com" },
                  { id: "su-contact", name: "contact_number",  label: "Contact number", type: "tel",      placeholder: "+63 912 345 6789" },
                ].map((f) => (
                  <div key={f.id}>
                    <Label htmlFor={f.id} className="text-blue-100 text-sm">{f.label}</Label>
                    <Input
                      id={f.id} name={f.name} type={f.type} required
                      placeholder={f.placeholder}
                      className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-blue-300/40 focus:border-blue-400 focus:ring-blue-400/30 transition-colors"
                    />
                  </div>
                ))}
                <div>
                  <Label htmlFor="su-password" className="text-blue-100 text-sm">Password <span className="text-blue-300/50">(min 8 chars)</span></Label>
                  <div className="relative mt-1">
                    <Input
                      id="su-password" name="password" type={showPwReg ? "text" : "password"} required
                      className="bg-white/10 border-white/20 text-white placeholder:text-blue-300/40 focus:border-blue-400 focus:ring-blue-400/30 pr-10 transition-colors"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwReg((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300/60 hover:text-blue-200 transition-colors"
                    >
                      {showPwReg ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full mt-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white border-0 shadow-lg shadow-blue-500/30 hover:shadow-blue-400/40 hover:scale-[1.02] transition-all duration-200"
                  disabled={busy}
                >
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
