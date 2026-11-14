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

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new message
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
          
          // Parse lines in AI SDK UI message stream
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("0:")) {
              // Text delta: 0:"hello"
              try {
                const textPart = JSON.parse(line.slice(2));
                if (typeof textPart === "string") {
                  assistantContent += textPart;
                }
              } catch {}
            } else if (line.startsWith("9:")) {
              // Tool result: 9:{"toolName":"...","result":{...}}
              try {
                const toolData = JSON.parse(line.slice(2));
                if (toolData?.result?.type === "action_proposal") {
                  foundProposals.push(toolData.result as ActionProposal);
                }
              } catch {}
            } else if (!line.includes(":") && line.trim().length > 0) {
              // Direct text fallback
              assistantContent += line;
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
    setMessages([
      {
        id: "cleared-1",
        role: "assistant",
        content: "Conversation history cleared. How can I assist your flight tracking today?",
        createdAt: new Date(),
      },
    ]);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Click outside to close on mobile backdrop */}
      <div className="flex-1 hidden sm:block" onClick={onClose} aria-hidden="true" />

      {/* Slide-over Flyout Panel */}
      <div className="flex flex-col w-full sm:w-[440px] sm:max-w-[460px] h-full glass-surface-1 border-l border-[var(--border)] shadow-2xl animate-in slide-in-from-right duration-200 overflow-hidden">
        {/* Drawer Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-[var(--border)] px-4 py-3 bg-[var(--glass-surface-2)]/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-[var(--foreground)] tracking-tight">
                  AeroDrop Copilot
                </span>
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              </div>
              <p className="text-[10px] text-[var(--muted-foreground)]">
                {scope === "admin" ? "Administrative Telemetry Engine" : "Grounded Flight Intelligence"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {profile.role === "super_admin" && (
              <button
                type="button"
                onClick={() => setScope(scope === "user" ? "admin" : "user")}
                className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer",
                  scope === "admin"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
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
              className="h-8 w-8 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close Copilot"
              className="h-8 w-8 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Message Stream Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs sm:text-sm">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex flex-col gap-1.5 max-w-[90%]",
                m.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] px-1">
                {m.role === "user" ? (
                  <>
                    <span>You</span>
                    <User className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    <Bot className="h-3 w-3 text-sky-400" />
                    <span className="font-semibold text-sky-400">AeroDrop Copilot</span>
                  </>
                )}
              </div>

              <div
                className={cn(
                  "rounded-2xl p-3.5 shadow-sm leading-relaxed whitespace-pre-wrap break-words",
                  m.role === "user"
                    ? "bg-sky-500 text-slate-950 font-medium rounded-tr-xs"
                    : "glass-surface-3 border border-[var(--border)] text-[var(--foreground)] rounded-tl-xs"
                )}
              >
                {m.content}

                {/* Structured Interactive Action Proposals */}
                {m.proposals && m.proposals.length > 0 && (
                  <div className="mt-2 space-y-2">
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
          ))}

          {loading && (
            <div className="flex items-center gap-2 rounded-2xl glass-surface-3 border border-[var(--border)] p-3 text-xs text-[var(--muted-foreground)] mr-auto">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
              <span>Analyzing flight radar telemetry & querying database tools...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestions Chips */}
        {messages.length <= 2 && (
          <div className="shrink-0 px-4 py-2 border-t border-[var(--border)]/60 bg-[var(--glass-surface-2)]/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1.5">
              Suggested Prompts:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(q)}
                  className="rounded-lg border border-[var(--border)] glass-surface-3 px-2.5 py-1 text-[11px] text-[var(--foreground)] hover:border-sky-500/50 hover:bg-sky-500/10 cursor-pointer transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Footer */}
        <div className="shrink-0 p-3.5 border-t border-[var(--border)] bg-[var(--glass-surface-2)]/80 backdrop-blur-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <div className="relative flex-1">
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
                rows={1}
                className="w-full resize-none rounded-xl border border-[var(--border)] glass-surface-3 px-3.5 py-2.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-sky-500 min-h-[40px] max-h-32"
              />
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || loading}
              className="h-10 w-10 shrink-0 rounded-xl bg-sky-500 text-slate-950 hover:bg-sky-400 font-bold shadow-md cursor-pointer disabled:opacity-40"
              title="Send Message"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>

          <p className="mt-2 text-center text-[10px] text-[var(--muted-foreground)] opacity-70">
            AeroDrop AI 2.0 · Strictly grounded in verified database tools & RLS policies
          </p>
        </div>
      </div>
    </div>
  );
}
