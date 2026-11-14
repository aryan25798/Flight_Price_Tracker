import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { AI_CONFIG } from "./config";

/**
 * High-Speed Multi-Provider AI Model Factory
 * 
 * Supports:
 * 1. Groq LPU (Ultra-low latency ~150ms TTFT, 500-800 tokens/sec, generous free tier)
 * 2. Google Gemini Free Tier (gemini-3.5-flash-lite)
 * 
 * Implements intelligent priority routing and zero-cost failover.
 */

class AIProviderRegistry {
  private googleInstance: ReturnType<typeof createGoogleGenerativeAI> | null = null;
  private groqInstance: ReturnType<typeof createGroq> | null = null;

  public getGroqClient() {
    if (this.groqInstance) return this.groqInstance;

    const rawKey = process.env.GROQ_API_KEY || "";
    const apiKey = rawKey.replace(/^["']|["']$/g, "").trim();

    this.groqInstance = createGroq({
      apiKey: apiKey || "MISSING_GROQ_KEY",
    });

    return this.groqInstance;
  }

  public getGoogleClient() {
    if (this.googleInstance) return this.googleInstance;

    const rawKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
    const apiKey = rawKey.replace(/^["']|["']$/g, "").trim();

    this.googleInstance = createGoogleGenerativeAI({
      apiKey: apiKey || "MISSING_KEY",
    });

    return this.googleInstance;
  }

  public hasGroq(): boolean {
    const rawKey = process.env.GROQ_API_KEY || "";
    return Boolean(rawKey.replace(/^["']|["']$/g, "").trim());
  }

  public hasGoogle(): boolean {
    const rawKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
    return Boolean(rawKey.replace(/^["']|["']$/g, "").trim());
  }

  public isConfigured(): boolean {
    return this.hasGroq() || this.hasGoogle();
  }

  public getActiveProvider(): "groq" | "google" {
    return this.hasGroq() ? "groq" : "google";
  }

  public getModel(modelName?: string) {
    if (this.hasGroq()) {
      const groqClient = this.getGroqClient();
      return groqClient(modelName || AI_CONFIG.groqModel);
    }
    const google = this.getGoogleClient();
    return google(modelName || AI_CONFIG.defaultModel);
  }

  public getFallbackModel() {
    if (this.hasGroq()) {
      // Fallback within Groq to fast 8b or across to Google if configured
      if (this.hasGoogle()) {
        const google = this.getGoogleClient();
        return { provider: "google" as const, modelId: AI_CONFIG.defaultModel, model: google(AI_CONFIG.defaultModel) };
      }
      const groqClient = this.getGroqClient();
      return { provider: "groq" as const, modelId: AI_CONFIG.groqFastModel, model: groqClient(AI_CONFIG.groqFastModel) };
    }

    const google = this.getGoogleClient();
    return { provider: "google" as const, modelId: AI_CONFIG.fallbackModel, model: google(AI_CONFIG.fallbackModel) };
  }
}

export const aiProvider = new AIProviderRegistry();
