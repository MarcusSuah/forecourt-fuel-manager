import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  Fuel,
  Droplets,
  BarChart3,
  Bell,
  ShieldCheck,
  TrendingDown,
  Activity,
  Truck,
  Gauge,
  ChevronRight,
} from "lucide-react";

export default function FuelInventoryGuide() {
  return (
    <>
      <Helmet>
        <title>
          Fuel Inventory Management Software — Real-Time Tank Monitoring |
          Forecourt MS
        </title>
        <meta
          name="description"
          content="Stop fuel loss with real-time tank monitoring, automated variance reporting, and instant low-stock alerts. Forecourt MS is the fuel inventory management software built for petrol station operators in Liberia."
        />
        <link
          rel="canonical"
          href="https://forecourt-ms.lovable.app/features/fuel-inventory-management"
        />
        <meta
          property="og:title"
          content="Fuel Inventory Management Software — Real-Time Tank Monitoring"
        />
        <meta
          property="og:description"
          content="Stop fuel loss with real-time tank monitoring, automated variance reporting, and instant low-stock alerts. Built for petrol station operators in Liberia."
        />
        <meta
          property="og:url"
          content="https://forecourt-ms.lovable.app/features/fuel-inventory-management"
        />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline:
              "Fuel Inventory Management Software — Real-Time Tank Monitoring",
            description:
              "Stop fuel loss with real-time tank monitoring, automated variance reporting, and instant low-stock alerts.",
            author: { "@type": "Organization", name: "Forecourt MS" },
            publisher: {
              "@type": "Organization",
              name: "Forecourt MS",
            },
          })}
        </script>
      </Helmet>

      <header className="w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Fuel className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="font-bold text-lg text-foreground">
              Forecourt MS
            </span>
          </Link>
          <Link
            to="/login"
            className="text-sm font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-background pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />
          </div>
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
              Fuel Inventory Management Software That Catches Every Drop
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              Real-time tank monitoring, automated variance reporting, and
              instant alerts built for multi-branch petrol station operators
              across Liberia.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              >
                Get Started
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <span className="text-sm text-muted-foreground">
                Free to try — no credit card required
              </span>
            </div>
          </div>
        </section>

        {/* Problem statement */}
        <section className="bg-muted/40 py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground">
                Why Fuel Inventory Disappears Silently
              </h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                Fuel theft, meter drift, temperature expansion, and delivery
                shortfalls drain margins before you notice. Spreadsheets and
                manual dips hide problems for days.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="bg-card border border-border rounded-xl p-6">
                <TrendingDown className="h-8 w-8 text-destructive mb-4" aria-hidden="true" />
                <h3 className="font-semibold text-foreground mb-2">
                  Unexplained Variance
                </h3>
                <p className="text-sm text-muted-foreground">
                  The gap between what you sold and what left the tank often
                  grows to 3–5% before anyone flags it.
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-6">
                <Activity className="h-8 w-8 text-warning mb-4" aria-hidden="true" />
                <h3 className="font-semibold text-foreground mb-2">
                  Late Alerts
                </h3>
                <p className="text-sm text-muted-foreground">
                  By the time a low-stock warning reaches a manager, the station
                  is already on reserve or dry.
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-6">
                <ShieldCheck className="h-8 w-8 text-primary mb-4" aria-hidden="true" />
                <h3 className="font-semibold text-foreground mb-2">
                  No Audit Trail
                </h3>
                <p className="text-sm text-muted-foreground">
                  Without structured dip readings and meter reconciliations,
                  proving theft or delivery errors is nearly impossible.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground">
                How Forecourt MS Solves It
              </h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                From tank dipping to shift reconciliation, every litre is
                tracked, compared, and accounted for automatically.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Gauge className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Real-Time Tank Level Monitoring
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Record dip readings per tank, per shift. Visual status
                    indicators show green, amber, or red levels so attendants
                    know instantly which product needs attention.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-accent" aria-hidden="true" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Automated Low-Stock & Critical Alerts
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Set branch-specific thresholds. The system sends scoped
                    alerts to admins, supervisors, and dealers the moment a tank
                    hits your defined warning or critical level.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Shift-Level Variance Reporting
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Compare opening stock, deliveries, sales from pump meters,
                    and closing dips in one report. Instantly spot where
                    variance exceeds acceptable limits.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Truck className="h-5 w-5 text-accent" aria-hidden="true" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Delivery Audit Trail
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Log every supplier delivery with vehicle, driver, and
                    quantity. Tank levels auto-increment on confirmation,
                    creating a full replenishment history.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Droplets className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Pump-to-Tank Mapping
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Link any pump to one or more tanks. Track exactly which
                    product is dispensed where, eliminating confusion between PMS
                    and AGO across multiple nozzles.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Reconciliation Alerts
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Automated alerts flag cash, stock, and meter mismatches in
                    real time so supervisors can investigate while the shift
                    is still fresh.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section className="bg-muted/40 py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl font-bold text-foreground text-center mb-12">
              A Typical Day With Forecourt MS
            </h2>
            <div className="space-y-8 relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
              {[
                {
                  title: "Morning dip & shift handover",
                  body: "The attendant records opening tank levels. The system auto-carries over the previous shift’s closing stock, so nothing is re-typed.",
                },
                {
                  title: "Sales entry with meter readings",
                  body: "Each transaction captures pump meter start and end readings. Sales are tied to the active shift, attendant, and branch automatically.",
                },
                {
                  title: "Live inventory indicators",
                  body: "Managers see colour-coded tank levels across every branch. Critical thresholds trigger push and in-app alerts before stock runs out.",
                },
                {
                  title: "Shift close & variance check",
                  body: "At shift end, closing dips and meter totals generate a variance report. Discrepancies are highlighted in red for immediate review.",
                },
              ].map((step, i) => (
                <div key={i} className="relative flex gap-6 pl-2">
                  <div className="flex-shrink-0 z-10">
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </div>
                  </div>
                  <div className="pt-1.5">
                    <h3 className="font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl font-bold text-foreground">
              Start Tracking Every Litre Today
            </h2>
            <p className="mt-4 text-muted-foreground">
              Join petrol station operators across Liberia who use Forecourt MS
              to eliminate silent fuel loss and protect their margins.
            </p>
            <div className="mt-8">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              >
                Create Your Free Account
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Already using Forecourt MS?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Sign in here
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-muted/30 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Fuel className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm text-muted-foreground">
              Forecourt MS — Liberia Fuel Management
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Forecourt Management System
          </p>
        </div>
      </footer>
    </>
  );
}
