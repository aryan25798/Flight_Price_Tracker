import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock, Eye, Database, Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { AeroDropLogo } from "@/components/brand/aerodrop-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export const metadata: Metadata = {
  title: "Privacy Policy · AeroDrop",
  description:
    "AeroDrop Privacy Policy: Learn how we collect, protect, process, and respect your personal flight intelligence data.",
};

export default function PrivacyPolicyPage() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>GDPR &amp; CCPA Compliant Privacy Standards</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)]">
            Privacy Policy
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Last Updated: <span className="font-semibold text-slate-300">{lastUpdated}</span> · Version 2.0
          </p>
        </div>

        {/* Section 1: Introduction */}
        <section className="space-y-3 rounded-2xl glass-surface-1 p-6 border border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <Eye className="h-4 w-4 text-sky-400" />
            1. Introduction &amp; Commitment to Privacy
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Welcome to <strong>AeroDrop</strong> (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), operated as an autonomous flight fare intelligence and alert platform. We value the privacy of our users (&ldquo;you&rdquo;) and are committed to maintaining transparent, secure, and minimal data practices. This Privacy Policy outlines what information we collect, how it is used, how AI is governed, and how you retain full control over your personal data under the General Data Protection Regulation (GDPR) and California Consumer Privacy Act (CCPA).
          </p>
        </section>

        {/* Section 2: Data Collection */}
        <section className="space-y-4 rounded-2xl glass-surface-1 p-6 border border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <Database className="h-4 w-4 text-indigo-400" />
            2. Information We Collect
          </h2>
          <div className="space-y-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
            <p>
              We adhere strictly to the principle of <em>data minimization</em>. We only collect the minimal information necessary to deliver automated flight tracking alerts:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-slate-200">Account Credentials:</strong> Your email address and cryptographically hashed passwords managed via Supabase Authentication. Passwords are never stored in plaintext.
              </li>
              <li>
                <strong className="text-slate-200">Flight Trackers &amp; Preferences:</strong> Origin airport codes (e.g. DEL), destination codes (e.g. BOM), target fare thresholds, cabin class, trip type, departure/return dates, and tracked currency.
              </li>
              <li>
                <strong className="text-slate-200">Notification Tokens:</strong> Your Telegram Chat ID (when linking our bot via secure single-use token), custom SMTP delivery email address, and W3C Web Push device subscription endpoints.
              </li>
              <li>
                <strong className="text-slate-200">Technical Diagnostic Logs:</strong> Anonymized HTTP request metadata, IP addresses for sliding-window abuse prevention (30 req/min), and error traces for service reliability.
              </li>
            </ul>
          </div>
        </section>

        {/* Section 3: AI Copilot & Privacy Architecture */}
        <section className="space-y-4 rounded-2xl glass-surface-1 p-6 border border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            3. AI Intelligence &amp; Model Privacy
          </h2>
          <div className="space-y-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
            <p>
              AeroDrop integrates cloud-hosted Large Language Model intelligence (AeroDrop Copilot) to help travelers analyze price volatility and manage tracking. Our AI architecture is engineered with <strong>Zero-Trust Security</strong>:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>No Direct Database Access:</strong> The AI model has no direct connection to our PostgreSQL database, credentials, or Supabase service roles.
              </li>
              <li>
                <strong>PII Sanitization:</strong> Passwords, payment data, personal names, and API keys are never forwarded to AI providers.
              </li>
              <li>
                <strong>Allowlisted Tool Execution:</strong> The model can only request structured, allowlisted backend tools. All tools independently authenticate your session (<code className="text-xs bg-slate-800 px-1 py-0.5 rounded font-mono">auth.uid()</code>) and enforce Row Level Security (RLS).
              </li>
              <li>
                <strong>Explicit User Confirmation:</strong> The AI model cannot execute write operations (e.g. creating or deleting trackers) autonomously without your explicit interactive confirmation.
              </li>
            </ul>
          </div>
        </section>

        {/* Section 4: Third-Party Integrations */}
        <section className="space-y-4 rounded-2xl glass-surface-1 p-6 border border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-emerald-400" />
            4. Third-Party Services &amp; Affiliate Disclosure
          </h2>
          <div className="space-y-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
            <p>
              To offer real-time airline metasearch and multi-channel notifications, AeroDrop communicates with verified third-party providers:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Flight Data &amp; Affiliate Partners:</strong> Flight fares are queried via the Travelpayouts / Aviasales data API. Booking links may include our affiliate marker (<code className="text-xs bg-slate-800 px-1 py-0.5 rounded font-mono">804763</code>), allowing us to earn a small commission at no additional cost to you when you complete a booking on an airline or travel agency site.
              </li>
              <li>
                <strong>Telegram Bot API:</strong> When enabled, automated fare alerts are dispatched to Telegram servers using your authorized Chat ID.
              </li>
              <li>
                <strong>Hosting &amp; Storage:</strong> Our application is hosted on Vercel (Edge &amp; Serverless infrastructure) with databases hosted on Supabase (AWS eu-central / us-east).
              </li>
            </ul>
          </div>
        </section>

        {/* Section 5: User Rights & Account Deletion */}
        <section className="space-y-4 rounded-2xl glass-surface-1 p-6 border border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <Lock className="h-4 w-4 text-rose-400" />
            5. Your Rights: Access, Export &amp; Erasure (GDPR Article 17)
          </h2>
          <div className="space-y-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
            <p>
              Regardless of your jurisdiction, AeroDrop grants you comprehensive control over your personal data:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-slate-200">Right to Rectification:</strong> You may update your notification email, target prices, and route preferences at any time in your Dashboard.
              </li>
              <li>
                <strong className="text-slate-200">Right to Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> You may permanently and irreversibly delete your entire account, all associated trackers, price history records, notification archives, and push subscriptions directly via <Link href="/dashboard/settings" className="text-sky-400 underline underline-offset-2">Dashboard Settings</Link>.
              </li>
              <li>
                <strong className="text-slate-200">No Sale of Personal Data:</strong> We never sell, rent, monetize, or trade your personal information to data brokers or third-party advertisers.
              </li>
            </ul>
          </div>
        </section>

        {/* Section 6: Contact */}
        <section className="space-y-3 rounded-2xl glass-surface-1 p-6 border border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            6. Contact &amp; Data Protection Officer
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            If you have questions, inquiries, or privacy complaints regarding this policy or our data practices, contact our Data Protection Officer at:
          </p>
          <div className="p-3 bg-slate-900/60 rounded-xl border border-[var(--border)] font-mono text-xs text-sky-300">
            privacy@aerodrop.app · support@aerodrop.app
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
