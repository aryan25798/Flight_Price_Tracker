import { convertToModelMessages, type UIMessage } from "ai";
import { orchestrateAIChat } from "@/lib/ai/orchestrator";
import { getAuthenticatedProfile } from "@/lib/supabase/server";
import type { AIScope } from "@/types/database";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // 1. Verify user authentication session
    const { user, profile } = await getAuthenticatedProfile();
    if (profile.is_banned) {
      return new Response(JSON.stringify({ error: "Account suspended." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Parse request payload
    const body = await req.json().catch(() => ({}));
    const { messages, scope = "user", conversationId } = body as {
      messages?: UIMessage[];
      scope?: AIScope;
      conversationId?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Security guard: Admin scope requires super_admin
    if (scope === "admin" && profile.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Super-admin privilege required." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4. Convert UI messages to model messages
    const modelMessages = await convertToModelMessages(messages);

    // 5. Orchestrate AI inference & tool calling
    const streamResult = await orchestrateAIChat({
      messages: modelMessages,
      scope,
      conversationId,
    });

    return streamResult.toUIMessageStreamResponse();
  } catch (error) {
    const err = error as Error;
    console.error("AeroDrop AI chat route error:", err);
    return new Response(JSON.stringify({ error: err.message || "Failed to process AI chat" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
