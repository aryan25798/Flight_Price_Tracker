import { streamText, stepCountIs, type ModelMessage } from "ai";
import { createClient, getAuthenticatedProfile } from "@/lib/supabase/server";
import { aiProvider } from "./provider";
import { AI_CONFIG, USER_COPILOT_SYSTEM_PROMPT, ADMIN_COPILOT_SYSTEM_PROMPT } from "./config";
import { buildUserTools } from "./tools/user-tools";
import { buildAdminTools } from "./tools/admin-tools";
import { SlidingWindowRateLimiter } from "@/lib/rate-limiter";
import type { AIScope } from "@/types/database";

const aiRateLimiter = new SlidingWindowRateLimiter(
  AI_CONFIG.rateLimits.rpmPerUser,
  60_000
);

export interface OrchestratorParams {
  messages: ModelMessage[];
  scope?: AIScope;
  conversationId?: string;
}

export async function orchestrateAIChat({
  messages,
  scope = "user",
  conversationId,
}: OrchestratorParams) {
  // 1. Authenticate & extract verified user identity
  const { user, profile } = await getAuthenticatedProfile();
  const supabase = await createClient();

  // 2. Enforce sliding-window rate limit (10 req/min per user)
  const rateLimit = aiRateLimiter.check(`ai_user_${user.id}`);
  if (!rateLimit.allowed) {
    throw new Error(
      `Rate limit exceeded. Please wait ${rateLimit.retryAfterSeconds} seconds before sending another message.`
    );
  }

  // 3. Atomically check quota and kill-switch in database
  const { data: quotaCheck, error: quotaErr } = await supabase.rpc("check_and_record_ai_quota", {
    p_user_id: user.id,
    p_provider: AI_CONFIG.providerName,
    p_model: AI_CONFIG.defaultModel,
  });

  if (quotaErr) {
    console.error("Quota RPC check error:", quotaErr);
  } else if (quotaCheck && !quotaCheck.allowed) {
    throw new Error(quotaCheck.message || "AI interactions are currently unavailable.");
  }

  // 4. Determine scope and build authorized tool suite
  const isAdminScope = scope === "admin" && profile.role === "super_admin";
  const systemPrompt = isAdminScope
    ? ADMIN_COPILOT_SYSTEM_PROMPT
    : USER_COPILOT_SYSTEM_PROMPT;

  const userTools = buildUserTools({ user, profile, supabase });
  const adminTools = isAdminScope
    ? buildAdminTools({ user, profile, supabase })
    : {};

  const tools = {
    ...userTools,
    ...adminTools,
  };

  // 5. Truncate conversation history to guard context window
  const boundedMessages = messages.slice(-AI_CONFIG.maxHistoryMessages);

  // 6. Verify provider readiness
  if (!aiProvider.isConfigured()) {
    throw new Error(
      "AeroDrop AI is not configured. Please supply a GROQ_API_KEY or GEMINI_API_KEY in your environment configuration."
    );
  }

  const activeProvider = aiProvider.getActiveProvider();
  const activeModelId = activeProvider === "groq" ? AI_CONFIG.groqModel : AI_CONFIG.defaultModel;
  const model = aiProvider.getModel(activeModelId);

  // 7. Execute streaming inference with tool calling
  const startTime = Date.now();
  const streamResult = streamText({
    model,
    system: systemPrompt,
    messages: boundedMessages,
    tools,
    stopWhen: stepCountIs(AI_CONFIG.maxToolHopsPerTurn),
    maxOutputTokens: AI_CONFIG.maxOutputTokens,
    temperature: AI_CONFIG.temperature,
    onFinish: async ({ usage }) => {
      const latencyMs = Date.now() - startTime;
      try {
        await supabase.from("ai_usage_logs").insert({
          user_id: user.id,
          provider: activeProvider,
          model: activeModelId,
          prompt_tokens: usage?.inputTokens ?? 0,
          completion_tokens: usage?.outputTokens ?? 0,
          latency_ms: latencyMs,
          status: "success",
        });
      } catch (err) {
        console.warn("Failed to record async usage log:", err);
      }
    },
  });

  return streamResult;
}
