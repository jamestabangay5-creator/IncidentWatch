import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { Toaster } from "@/components/ui/sonner";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "SafeTrace — Blockchain Incident Reporting" },
      { name: "description", content: "Secure, tamper-evident incident reporting with geospatial hotspot mapping." },
      { name: "author", content: "SafeTrace" },
      // PWA meta
      { name: "application-name", content: "SafeTrace" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "SafeTrace" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "theme-color", content: "#3b82f6" },
      { name: "msapplication-TileColor", content: "#0f172a" },
      { name: "msapplication-tap-highlight", content: "no" },
      // Open Graph
      { property: "og:title", content: "SafeTrace — Blockchain Incident Reporting" },
      { property: "og:description", content: "Secure, tamper-evident incident reporting with geospatial hotspot mapping." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      // Apple touch icons
      { rel: "apple-touch-icon", href: "/icons/icon-192x192.png" },
      { rel: "apple-touch-icon", sizes: "152x152", href: "/icons/icon-152x152.png" },
      { rel: "apple-touch-icon", sizes: "144x144", href: "/icons/icon-144x144.png" },
      // Favicon
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icons/icon-96x96.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/icons/icon-72x72.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <AppHeader />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
      <Toaster richColors position="top-right" />
      <PWAInstallPrompt />
    </AuthProvider>
  );
}
