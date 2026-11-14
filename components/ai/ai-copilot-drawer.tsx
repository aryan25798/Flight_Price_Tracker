"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  Compass,
  CornerDownLeft,
  ExternalLink,
  Flame,
  LineChart,
  Loader2,
  Maximize2,
  Minimize2,
  PanelRightClose,
  Plane,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AIActionCard, type ActionProposal } from "./ai-action-card";
import { cn } from "@/lib/utils";
import type { Profile, AIScope } from "@/types/database";

interface ClientMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: { name: string; args?: unknown }[];
  proposals?: ActionProposal[];
  createdAt: Date;
}

interface AICopilotDrawerProps {
  profile: Profile;
  isOpen: boolean;
  onClose: () => void;
  initialScope?: AIScope;
}

export function formatChatContent(content: string): string {
  if (!content) return "";
  let text = content;

  // 1. Strip orphan raw token fragments or long affiliate tracking hashes
  text = text.replace(/^[a-f0-9-]{16,}&[^\s\n]+/gm, "");

  // 2. Transform raw pipe tables or collapsed pipe tables (| Detail | What I need ||... or | Col | Col |) into clean structured bullet lists
  if (text.includes("||") || (text.includes("|") && text.includes("---"))) {
    const lines = text.split("\n");
    const processedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("||") || (line.startsWith("|") && line.endsWith("|"))) {
        const segments = line.split(/\|\|\s*/).map((s) => s.trim()).filter(Boolean);
        for (const seg of segments) {
          if (seg.includes("---") || /\|\s*(?:detail|what i need|field|attribute|parameter)\s*\|/i.test(seg)) {
            continue;
          }
          const cells = seg
            .split("|")
            .map((c) => c.trim())
            .filter(Boolean);

          if (cells.length >= 2) {
            processedLines.push(`• **${cells[0]}**: ${cells.slice(1).join(" — ")}`);
          } else if (cells.length === 1) {
            processedLines.push(`• **${cells[0]}**`);
          }
        }
      } else {
        processedLines.push(line);
      }
    }
    text = processedLines.join("\n");
  }

  // 3. Convert bulleted portal links (e.g. • Google Flights:\nhttps://...) into clean markdown links
  text = text.replace(
    /(?:[•*-]\s*)?(Google Flights|Skyscanner|MakeMyTrip|EaseMyTrip|Kayak|Aviasales|Airline Direct):?\s*\n?\s*(https?:\/\/[^\s\)]+)/gi,
    (_match, portal, url) => `• [Compare on ${portal}](${url})`
  );

  return text;
}

export function AICopilotDrawer({
  profile,
  isOpen,
  onClose,
  initialScope = "user",
}: AICopilotDrawerProps) {
  const router = useRouter();
  const [scope, setScope] = React.useState<AIScope>(
    profile.role === "super_admin" ? initialScope : "user"
  );
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ClientMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content:
        scope === "admin"
          ? "Welcome, Administrator. I am your **AeroDrop Telemetry Copilot**. Ask me to inspect system health, recent 4-hour cron polling cycles, external provider error rates, or user directory metrics."
          : "Hello! I am your **AeroDrop Flight Intelligence Copilot**. Ask me about your tracked flight fares, price drop volatility, potential savings, or ask me to set up a new flight tracker.",
      createdAt: new Date(),
    },
  ]);

  const [mounted, setMounted] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior,
      });
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
    }
  }, []);

  // Restore conversation memory from sessionStorage on client mount
  React.useEffect(() => {
    setMounted(true);
    try {
      const storageKey = `aerodrop_chat_context_${scope}`;
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {}
  }, [scope]);

  // Persist conversation memory into sessionStorage as turns progress
  React.useEffect(() => {
    if (mounted && messages.length > 0) {
      try {
        const storageKey = `aerodrop_chat_context_${scope}`;
        sessionStorage.setItem(storageKey, JSON.stringify(messages));
      } catch {}
    }
  }, [messages, mounted, scope]);

  // When drawer opens, immediately snap to the bottom (where the user left off)
  React.useEffect(() => {
    if (isOpen) {
      // 1. Immediate instant jump to prevent any flash of the top messages
      scrollToBottom("auto");
      // 2. Microtask snap after DOM painting settles
      const timer1 = setTimeout(() => {
        scrollToBottom("auto");
      }, 50);
      // 3. Smooth touch-up after markdown fonts and images finish loading
      const timer2 = setTimeout(() => {
        scrollToBottom("smooth");
      }, 150);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [isOpen, scrollToBottom]);

  // Smooth auto-scroll when new messages arrive or loading state toggles
  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        scrollToBottom("smooth");
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages, loading, isOpen, scrollToBottom]);

  // Focus input when opened
  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const quickPrompts =
    scope === "admin"
      ? [
          "Check overall system health",
          "Show recent polling runs",
          "What is our external API error rate?",
          "How many active users & trackers exist?",
        ]
      : [
          "Show my cheapest flight",
          "How much money have I saved?",
          "Explain recent price changes",
          "Are any of my trackers below target?",
        ];

  async function handleSendMessage(promptText?: string) {
    const textToSend = (promptText ?? input).trim();
    if (!textToSend || loading) return;

    setInput("");
    setErrorText(null);

    const userMessage: ClientMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: textToSend,
      createdAt: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Map client messages to simple UIMessage format for /api/ai/chat
      const formattedForApi = newMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        parts: [{ type: "text" as const, text: m.content }],
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: formattedForApi,
          scope,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned ${res.status}`);
      }

      // Stream the response reader
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body stream");

      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantId = `assistant-${Date.now()}`;
      const foundProposals: ActionProposal[] = [];

      // Add temporary placeholder for assistant
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: new Date(),
        },
      ]);

      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          
          // Parse lines in AI SDK UI message stream (supports both SSE data: and legacy formats)
          const lines = chunk.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith("data: ")) {
              const payload = trimmed.slice(6).trim();
              if (payload === "[DONE]") continue;

              try {
                const parsed = JSON.parse(payload);
                const textDelta =
                  typeof parsed.delta === "string"
                    ? parsed.delta
                    : typeof parsed.textDelta === "string"
                    ? parsed.textDelta
                    : typeof parsed.text === "string"
                    ? parsed.text
                    : null;

                if (textDelta) {
                  assistantContent += textDelta;
                } else if (
                  (parsed.type === "tool-output-available" || parsed.type === "tool-result") &&
                  (parsed.output?.type === "action_proposal" || parsed.result?.type === "action_proposal")
                ) {
                  const proposal = (parsed.output || parsed.result) as ActionProposal;
                  foundProposals.push(proposal);
                } else if (parsed.type === "error") {
                  setErrorText(parsed.errorText || "AI processing error.");
                  if (!assistantContent) {
                    assistantContent = `⚠️ ${parsed.errorText || "AI request failed."}`;
                  }
                }
              } catch {}
            } else if (trimmed.startsWith("0:")) {
              // Legacy AI SDK text chunk: 0:"..."
              try {
                const textPart = JSON.parse(trimmed.slice(2));
                if (typeof textPart === "string") {
                  assistantContent += textPart;
                }
              } catch {}
            } else if (trimmed.startsWith("9:")) {
              // Legacy AI SDK tool result: 9:{...}
              try {
                const toolData = JSON.parse(trimmed.slice(2));
                if (toolData?.result?.type === "action_proposal") {
                  foundProposals.push(toolData.result as ActionProposal);
                }
              } catch {}
            } else if (!trimmed.includes(":") && trimmed.length > 0) {
              // Direct text fallback
              assistantContent += trimmed + "\n";
            }
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: assistantContent,
                    proposals: foundProposals.length > 0 ? foundProposals : undefined,
                  }
                : m
            )
          );
        }
      }

      // Guarantee no blank bubbles if streaming completed with tool proposals or empty text
      if (!assistantContent && foundProposals.length > 0) {
        assistantContent = "I have prepared the following flight action proposal based on your request. Please review and confirm below:";
      } else if (!assistantContent) {
        assistantContent = "I analyzed your request. To look up live airline fares or set up an autonomous price radar, please share your travel date (e.g., tomorrow or YYYY-MM-DD) and your target alert price.";
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: assistantContent,
                proposals: foundProposals.length > 0 ? foundProposals : undefined,
              }
            : m
        )
      );
    } catch (err) {
      const e = err as Error;
      setErrorText(e.message || "Failed to get AI response.");
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ **AI Service Notice**: ${e.message || "Unable to complete query."}`,
          createdAt: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  function clearHistory() {
    try {
      const storageKey = `aerodrop_chat_context_${scope}`;
      sessionStorage.removeItem(storageKey);
    } catch {}
    setMessages([
      {
        id: "cleared-1",
        role: "assistant",
        content: "Conversation history cleared. How can I assist your flight tracking today?",
        createdAt: new Date(),
      },
    ]);
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-end transition-opacity duration-200",
        isOpen
          ? "bg-slate-950/70 backdrop-blur-sm opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      )}
      aria-hidden={!isOpen}
    >
      {/* Click outside to close on mobile backdrop */}
      <div className="flex-1 hidden sm:block" onClick={onClose} aria-hidden="true" />

      {/* Slide-over Flyout Panel */}
      <div
        className={cn(
          "flex flex-col w-full sm:w-[460px] md:w-[480px] h-full bg-[#080d1a]/95 backdrop-blur-2xl border-l border-white/10 shadow-[-10px_0_40px_rgba(0,0,0,0.6)] overflow-hidden transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Drawer Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-white/10 px-4 py-3.5 bg-slate-950/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500/20 to-blue-600/30 border border-sky-400/40 text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.25)]">
              <Sparkles className="h-4 w-4" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-sm text-white tracking-tight">
                  AeroDrop Copilot
                </h3>
                <span className="text-[9px] font-mono font-bold text-sky-400 bg-sky-950/70 border border-sky-500/30 px-1.5 py-0.5 rounded-full">
                  2.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <span className="inline-block w-1 h-1 rounded-full bg-emerald-400" />
                {scope === "admin" ? "Administrative Telemetry Deck" : "Live Flight Radar Intelligence"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {profile.role === "super_admin" && (
              <button
                type="button"
                onClick={() => setScope(scope === "user" ? "admin" : "user")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer",
                  scope === "admin"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                    : "bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/25"
                )}
                title="Switch AI Context Scope"
              >
                {scope === "admin" ? "Admin Mode" : "User Mode"}
              </button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={clearHistory}
              title="Clear Conversation"
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close Copilot"
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Message Stream Body */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-5 text-xs sm:text-sm"
        >
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex flex-col gap-1 items-end ml-auto max-w-[85%] group">
                <div className="bg-gradient-to-r from-blue-600 to-sky-600 text-white rounded-2xl rounded-tr-xs px-4 py-2.5 shadow-[0_4px_16px_rgba(37,99,235,0.25)] border border-blue-400/30 text-[13px] font-medium leading-relaxed break-words">
                  {m.content}
                </div>
                <span className="text-[10px] text-slate-500 pr-1">You</span>
              </div>
            ) : (
              <div key={m.id} className="flex gap-2.5 items-start mr-auto max-w-[94%]">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/10 border border-sky-400/30 text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.15)] mt-0.5">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[11px] font-bold text-slate-300">AeroDrop Copilot</span>
                    <span className="text-[9px] font-mono text-sky-400/90 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-500/20">
                      Grounded
                    </span>
                  </div>

                  <div className="rounded-2xl rounded-tl-xs p-4 bg-slate-900/90 border border-white/10 text-[13px] leading-relaxed shadow-[0_8px_32px_rgba(0,0,0,0.36)] text-slate-200 break-words">
                    {m.content ? (
                      <div className="prose prose-invert max-w-none text-slate-200 text-[13px] leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ href, children }) => {
                              const rawHref = href || "";
                              const textContent = React.Children.toArray(children)
                                .map((c) => (typeof c === "string" ? c : ""))
                                .join("")
                                .trim();

                              const isRawUrl =
                                !textContent ||
                                textContent.startsWith("http://") ||
                                textContent.startsWith("https://") ||
                                textContent.length > 35;

                              let label = textContent;
                              let badgeStyle = "bg-sky-950/70 hover:bg-sky-900 border-sky-400/30 hover:border-sky-400 text-sky-300 hover:text-white";
                              let iconColor = "text-sky-400";

                              const lower = rawHref.toLowerCase();
                              if (lower.includes("google.com/travel/flights") || lower.includes("google.com/flights")) {
                                if (isRawUrl) label = "Compare on Google Flights";
                                badgeStyle = "bg-blue-950/80 hover:bg-blue-900/90 border-blue-500/40 hover:border-blue-400 text-blue-300 hover:text-white";
                                iconColor = "text-blue-400";
                              } else if (lower.includes("skyscanner")) {
                                if (isRawUrl) label = "Compare on Skyscanner";
                                badgeStyle = "bg-sky-950/80 hover:bg-sky-900/90 border-sky-500/40 hover:border-sky-400 text-sky-300 hover:text-white";
                                iconColor = "text-sky-400";
                              } else if (lower.includes("makemytrip")) {
                                if (isRawUrl) label = "Compare on MakeMyTrip";
                                badgeStyle = "bg-rose-950/80 hover:bg-rose-900/90 border-rose-500/40 hover:border-rose-400 text-rose-300 hover:text-white";
                                iconColor = "text-rose-400";
                              } else if (lower.includes("easemytrip")) {
                                if (isRawUrl) label = "Compare on EaseMyTrip";
                                badgeStyle = "bg-emerald-950/80 hover:bg-emerald-900/90 border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-white";
                                iconColor = "text-emerald-400";
                              } else if (lower.includes("kayak")) {
                                if (isRawUrl) label = "Compare on Kayak";
                                badgeStyle = "bg-amber-950/80 hover:bg-amber-900/90 border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-white";
                                iconColor = "text-amber-400";
                              } else if (lower.includes("aviasales")) {
                                if (isRawUrl) label = "View Flight Deal on Aviasales";
                                badgeStyle = "bg-indigo-950/80 hover:bg-indigo-900/90 border-indigo-500/40 hover:border-indigo-400 text-indigo-300 hover:text-white";
                                iconColor = "text-indigo-400";
                              } else if (isRawUrl) {
                                try {
                                  const u = new URL(rawHref);
                                  label = `Open ${u.hostname.replace(/^www\./, "")}`;
                                } catch {
                                  label = "View Flight Offer";
                                }
                              }

                              return (
                                <a
                                  href={rawHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    "inline-flex items-center gap-1.5 px-3 py-1.5 my-1 rounded-xl border font-medium text-xs transition-all shadow-xs group no-underline",
                                    badgeStyle
                                  )}
                                >
                                  <Plane className={cn("h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform shrink-0", iconColor)} />
                                  <span className="truncate max-w-[240px] sm:max-w-[300px]">{label}</span>
                                  <ExternalLink className="h-3 w-3 opacity-70 group-hover:opacity-100 shrink-0 ml-0.5" />
                                </a>
                              );
                            },
                            p: ({ children }) => (
                              <p className="mb-2.5 last:mb-0 leading-relaxed text-slate-200 font-normal">
                                {children}
                              </p>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-semibold text-white tracking-wide">
                                {children}
                              </strong>
                            ),
                            em: ({ children }) => (
                              <em className="text-slate-300 italic">{children}</em>
                            ),
                            ul: ({ children }) => (
                              <ul className="my-2.5 pl-4 space-y-1.5 list-disc marker:text-sky-400">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="my-2.5 pl-4 space-y-1.5 list-decimal marker:text-sky-400">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="text-[13px] text-slate-200 pl-0.5 leading-relaxed">
                                {children}
                              </li>
                            ),
                            code: ({ children }) => (
                              <code className="font-mono text-[11px] bg-sky-950/70 text-sky-300 px-1.5 py-0.5 rounded border border-sky-500/25">
                                {children}
                              </code>
                            ),
                            h1: ({ children }) => (
                              <h3 className="font-bold text-sm text-white mt-3 mb-1.5">{children}</h3>
                            ),
                            h2: ({ children }) => (
                              <h4 className="font-bold text-sm text-white mt-3 mb-1.5">{children}</h4>
                            ),
                            h3: ({ children }) => (
                              <h5 className="font-semibold text-xs text-sky-300 mt-2 mb-1">{children}</h5>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-2 border-sky-500/40 pl-3 my-2 text-slate-400 text-xs italic">
                                {children}
                              </blockquote>
                            ),
                            table: ({ children }) => (
                              <div className="my-3 w-full overflow-x-auto rounded-xl border border-white/10 bg-slate-950/60 shadow-xs">
                                <table className="w-full text-left text-xs border-collapse divide-y divide-white/10">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-slate-900/90 text-[11px] font-bold text-sky-400">
                                {children}
                              </thead>
                            ),
                            tbody: ({ children }) => (
                              <tbody className="divide-y divide-white/5 text-slate-200">
                                {children}
                              </tbody>
                            ),
                            tr: ({ children }) => (
                              <tr className="hover:bg-white/5 transition-colors">
                                {children}
                              </tr>
                            ),
                            th: ({ children }) => (
                              <th className="px-3 py-2 font-semibold">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="px-3 py-2 text-slate-300">
                                {children}
                              </td>
                            ),
                          }}
                        >
                          {formatChatContent(m.content)}
                        </ReactMarkdown>
                      </div>
                    ) : m.role === "assistant" && loading ? (
                      <div className="flex items-center gap-2 py-1 text-slate-400 text-xs">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-400" />
                        </span>
                        <span className="text-[12px] text-slate-400">Consulting live flight radar &amp; database...</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-xs">No response received.</span>
                    )}

                    {/* Structured Interactive Action Proposals */}
                    {m.proposals && m.proposals.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                        {m.proposals.map((prop, pIdx) => (
                          <AIActionCard
                            key={pIdx}
                            proposal={prop}
                            onResolved={() => router.refresh()}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          )}

          {loading && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-slate-900/60 border border-white/10 p-3 text-xs text-slate-400 mr-auto max-w-[90%]">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400 shrink-0" />
              <span className="truncate">Analyzing flight radar telemetry &amp; querying database tools...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestions Chips */}
        {messages.length <= 2 && (
          <div className="shrink-0 px-4 py-3 border-t border-white/10 bg-slate-950/60 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Suggested Radar Prompts:
            </span>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(q)}
                  className="rounded-xl border border-white/10 bg-slate-900/70 hover:bg-slate-800 hover:border-sky-500/40 px-3 py-1.5 text-xs text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="h-3 w-3 text-sky-400 shrink-0" />
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Control Deck */}
        <div className="shrink-0 p-3.5 border-t border-white/10 bg-slate-950/90 backdrop-blur-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="rounded-2xl border border-white/10 focus-within:border-sky-500/50 focus-within:ring-2 focus-within:ring-sky-500/20 bg-slate-900/80 p-2.5 transition-all shadow-inner flex flex-col gap-2"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                scope === "admin"
                  ? "Ask about system health, crons, users, or API errors..."
                  : "Ask about your flights, target prices, or 'Track DEL to LHR'..."
              }
              rows={2}
              className="w-full resize-none bg-transparent px-1.5 py-0.5 text-xs sm:text-[13px] text-white placeholder:text-slate-500 focus:outline-none min-h-[44px] max-h-32 leading-relaxed"
            />
            <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-[9px] text-slate-400 border border-slate-700">↵ Enter</kbd> to send
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || loading}
                className="h-8 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md gap-1.5 transition-all cursor-pointer disabled:opacity-30 disabled:bg-slate-800"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <span>Send</span>
                    <Send className="h-3 w-3" />
                  </>
                )}
              </Button>
            </div>
          </form>

          <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
            <Shield className="h-3 w-3 text-sky-400/80" />
            <span>Grounded strictly in verified database tools &amp; RLS policies</span>
          </div>
        </div>
      </div>
    </div>
  );
}
