import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, MapPin, Lock, Activity, ArrowRight, FileCheck2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 min-h-screen text-white">

      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-32 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl animate-pulse [animation-delay:1s]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl animate-pulse [animation-delay:2s]" />
      </div>

      {/* Hero */}
      <section className="relative container mx-auto px-4 pt-24 pb-28">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur px-4 py-1.5 text-xs font-medium text-blue-200 mb-8 animate-fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Secure reporting · Verified by authorities
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05] animate-fade-in [animation-delay:0.1s]">
            Report incidents.
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent animate-gradient-x">
              Map the truth.
            </span>
          </h1>

          <p className="mt-6 text-lg text-blue-100/80 max-w-2xl leading-relaxed animate-fade-in [animation-delay:0.2s]">
            A secure digital reporting platform where every submission is sealed
            into a tamper-evident ledger and visualized on an interactive heatmap
            to surface emerging hotspots.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap gap-4 animate-fade-in [animation-delay:0.3s]">
            <Button
              size="lg"
              asChild
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white border-0 shadow-lg shadow-blue-500/30 hover:shadow-blue-400/40 hover:scale-105 transition-all duration-200"
            >
              <Link to="/auth">
                Get started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-white/30 text-white bg-white/10 hover:bg-white/20 backdrop-blur hover:scale-105 transition-all duration-200"
            >
              <Link to="/auth">Admin sign in</Link>
            </Button>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-24 grid sm:grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in [animation-delay:0.4s]">
          {[
            { icon: Lock,      title: "Immutable ledger",  desc: "Each report sealed with SHA-256 + previous hash.", gradient: "from-blue-500/20 to-indigo-500/20" },
            { icon: MapPin,    title: "Geospatial pins",   desc: "Pick any incident location on a live map.",         gradient: "from-cyan-500/20 to-blue-500/20" },
            { icon: Activity,  title: "Hotspot heatmap",   desc: "Cluster visualization for emerging risk areas.",    gradient: "from-indigo-500/20 to-purple-500/20" },
            { icon: FileCheck2,title: "Audit-ready PDFs",  desc: "One-click date-range export for officials.",        gradient: "from-emerald-500/20 to-cyan-500/20" },
          ].map((f) => (
            <div
              key={f.title}
              className={`group rounded-2xl border border-white/10 bg-gradient-to-br ${f.gradient} backdrop-blur p-5
                hover:border-white/25 hover:scale-[1.03] hover:shadow-xl hover:shadow-blue-900/40
                transition-all duration-300 cursor-default`}
            >
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center mb-4 group-hover:bg-white/20 transition-colors">
                <f.icon className="h-5 w-5 text-blue-300" />
              </div>
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="text-sm text-blue-200/70 mt-1 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative border-t border-white/10 bg-white/5 backdrop-blur">
        <div className="container mx-auto px-4 py-20">
          <h2 className="text-center text-2xl font-bold text-white mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n: "01", t: "Sign up",  d: "Create an account with your contact details.", color: "from-blue-500 to-cyan-500" },
              { n: "02", t: "Submit",   d: "Pin the location, describe the incident, attach a photo.", color: "from-cyan-500 to-indigo-500" },
              { n: "03", t: "Track",    d: "See your report's status and verification chain in real time.", color: "from-indigo-500 to-purple-500" },
            ].map((s, i) => (
              <div key={s.n} className="group relative flex flex-col items-start">
                <div className={`text-6xl font-black bg-gradient-to-r ${s.color} bg-clip-text text-transparent mb-3 group-hover:scale-110 transition-transform duration-300`}>
                  {s.n}
                </div>
                <h3 className="text-xl font-semibold text-white">{s.t}</h3>
                <p className="text-blue-200/70 mt-1 leading-relaxed">{s.d}</p>
                {i < 2 && (
                  <ChevronRight className="hidden md:block absolute -right-4 top-6 h-6 w-6 text-white/20" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/10 py-8">
        <div className="container mx-auto px-4 flex items-center justify-between text-sm text-blue-300/60">
          <div className="flex items-center gap-2 font-semibold text-blue-200">
            <Shield className="h-4 w-4" /> SafeTrace
          </div>
          <div>© {new Date().getFullYear()} · Capstone Project</div>
        </div>
      </footer>
    </div>
  );
}
