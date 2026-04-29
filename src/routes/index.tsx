import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, MapPin, Lock, Activity, ArrowRight, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 [background:var(--gradient-glow)] pointer-events-none" />

      <section className="container mx-auto px-4 pt-20 pb-24 relative">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 backdrop-blur px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Secure reporting · Verified by authorities
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
            Report incidents.<br />
            <span className="bg-[image:var(--gradient-hero)] bg-clip-text text-transparent">
              Map the truth.
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            A secure digital reporting platform where every submission is hashed into a blockchain-style ledger
            and visualized on an interactive heatmap to surface emerging hotspots.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild className="shadow-[var(--shadow-glow)]">
              <Link to="/auth">
                Submit a report <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth">Admin sign in</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid md:grid-cols-4 gap-4">
          {[
            { icon: Lock, title: "Immutable ledger", desc: "Each report sealed with SHA-256 + previous hash." },
            { icon: MapPin, title: "Geospatial pins", desc: "Pick any incident location on a live map." },
            { icon: Activity, title: "Hotspot heatmap", desc: "Cluster visualization for emerging risk areas." },
            { icon: FileCheck2, title: "Audit-ready PDFs", desc: "One-click monthly export for officials." },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-card/60 backdrop-blur p-5 hover:shadow-[var(--shadow-elevated)] transition-shadow"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <f.icon className="h-4 w-4" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-secondary/30">
        <div className="container mx-auto px-4 py-16 grid md:grid-cols-3 gap-8">
          {[
            { n: "01", t: "Sign up", d: "Create an account with your contact details." },
            { n: "02", t: "Submit", d: "Pin the location, describe the incident, attach a photo." },
            { n: "03", t: "Track", d: "See your report's status and verification chain in real time." },
          ].map((s) => (
            <div key={s.n}>
              <div className="text-5xl font-bold text-primary/30">{s.n}</div>
              <h3 className="text-xl font-semibold mt-2">{s.t}</h3>
              <p className="text-muted-foreground mt-1">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" /> SafeTrace
          </div>
          <div>© {new Date().getFullYear()} · Capstone Project</div>
        </div>
      </footer>
    </div>
  );
}
