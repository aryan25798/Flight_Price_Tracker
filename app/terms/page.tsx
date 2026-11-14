import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle2, AlertTriangle, Scale, Zap, ShieldAlert } from "lucide-react";
import { AeroDropLogo } from "@/components/brand/aerodrop-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export const metadata: Metadata = {
  title: "Terms of Service · AeroDrop",
  description:
    "AeroDrop Terms of Service: Understanding your rights, responsibilities, airline fare monitoring disclosures, and usage policies.",
};

export default function TermsOfServicePage() {
  const lastUpdated = "November 14, 2026";

  return (
    <div className="min-h-screen flex flex-col ambient-night-mesh selection:bg-sky-500/25">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[#060913]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <AeroDropLogo variant="full" size="md" href="/" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted-foreground)] hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-white/5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-10">
        {/* Title Block */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <Scale className="h-3.5 w-3.5" />
            <span>AeroDrop Platform Usage Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)]">
            Terms of Service
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Effective Date: <span className="font-semibold text-slate-300">{lastUpdated}</span> · Version 2.0
          </p>
        </div>

        {/* Section 1: Acceptance */}
        <section className="space-y-3 rounded-2xl glass-surface-1 p-6 border border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <FileText className="h-4 w-4 text-sky-400" />
            1. Acceptance of Terms
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            By creating an account, accessing, or using <strong>AeroDrop</strong> (&ldquo;the Service&rdquo;), you agree to be legally bound by these Terms of Service. If you do not agree with any part of these terms, you must not use or access the Service.
          </p>
        </section>

        {/* Section 2: Platform Purpose & Fare Disclaimer */}
        <section className="space-y-4 rounded-2xl glass-surface-1 p-6 border border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            2. Platform Purpose &amp; Airline Price Disclaimers
          </h2>
          <div className="space-y-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
            <p>
              AeroDrop is an autonomous travel intelligence and fare monitoring tool designed to assist consumers in identifying flight price fluctuations. <strong>AeroDrop is not an airline, online travel agency (OTA), or ticket reseller:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-slate-200">Price Volatility:</strong> Airline prices fluctuate in real time according to dynamic airline yield management algorithms. AeroDrop reflects prices observed during our scheduled 4-hour polling scans. We cannot guarantee that a price observed by our radar will remain available when you navigate to the booking provider.
              </li>
              <li>
                <strong className="text-slate-200">No Booking Responsibility:</strong> All ticket bookings, payments, ticket issuance, cancellations, and baggage policies occur directly with the airline or third-party travel merchant. AeroDrop is not liable for transactions conducted on third-party sites.
              </li>
              <li>
                <strong className="text-slate-200">Informational Use Only:</strong> Notifications and historical price analytics are provided for informational decision support only.
              </li>
            </ul>
          </div>
        </section>

        {/* Section 3: User Accounts & Fair Use */}
        <section className="space-y-4 rounded-2xl glass-surface-1 p-6 border border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-400" />
            3. Account Responsibilities &amp; Fair Use
          </h2>
          <div className="space-y-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
            <p>
              To safeguard system reliability for all users, you agree to comply with our fair-use standards:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Account Confidentiality:</strong> You are solely responsible for maintaining the confidentiality of your authentication credentials. Notify us immediately of unauthorized account access.
              </li>
              <li>
                <strong>Automated Scraping &amp; Abuse:</strong> You agree not to reverse-engineer, systematically scrape, or deploy automated bots against our API endpoints. Requests are rate-limited to 30 requests per minute per IP.
              </li>
              <li>
                <strong>Tier Quotas:</strong> Accounts are subject to tier limitations (Free, Pro, Enterprise) governing active concurrent trackers and daily AI Copilot interactions. Creating duplicate accounts to circumvent limits is prohibited.
              </li>
            </ul>
          </div>
        </section>

        {/* Section 4: AI Copilot Governance */}
        <section className="space-y-4 rounded-2xl glass-surface-1 p-6 border border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            4. AI Copilot Terms of Use
          </h2>
          <div className="space-y-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
            <p>
              AeroDrop Copilot is powered by large language model technology. When interacting with the Copilot:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                You agree not to attempt prompt injection, jailbreaking, or using the assistant to generate malicious queries.
              </li>
              <li>
                The AI Copilot does not possess legal, financial, or contractual authority. Any flight recommendations or trend forecasts are estimates based on available historical data.
              </li>
              <li>
                Actions proposed by the AI (such as creating or removing flight monitors) require your manual confirmation before taking effect.
              </li>
            </ul>
          </div>
        </section>

        {/* Section 5: Termination & Liability */}
        <section className="space-y-4 rounded-2xl glass-surface-1 p-6 border border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-400" />
            5. Limitation of Liability &amp; Termination
          </h2>
          <div className="space-y-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
            <p>
              To the maximum extent permitted by applicable law, AeroDrop and its operators shall not be liable for any indirect, incidental, punitive, or consequential damages arising from missing a fare, flight delays, price changes, or third-party airline disputes.
            </p>
            <p>
              We reserve the right to suspend or terminate accounts that violate our security guidelines, engage in abuse, or perform unauthorized scanning. You may terminate your account at any time via self-service account deletion in Settings.
            </p>
          </div>
        </section>

        {/* Section 6: Contact */}
        <section className="space-y-3 rounded-2xl glass-surface-1 p-6 border border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)]">6. Contact Information</h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            For questions or legal correspondence regarding these Terms:
          </p>
          <div className="p-3 bg-slate-900/60 rounded-xl border border-[var(--border)] font-mono text-xs text-sky-300">
            legal@aerodrop.app · terms@aerodrop.app
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[#050811] py-8 px-4 text-center text-xs text-[var(--muted-foreground)]">
        <p>© 2026 AeroDrop. All rights reserved. Autonomous Flight Fare Intelligence.</p>
      </footer>
    </div>
  );
}
