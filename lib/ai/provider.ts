import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { AI_CONFIG } from "./config";

/**
 * Provider-Independent AI Model Factory
 * 
 * Supports zero-cost Google Gemini free tier by default, with seamless
 * abstraction for future provider migration (Anthropic, OpenAI, Ollama).
 */

class AIProviderRegistry {
  private googleInstance: ReturnType<typeof createGoogleGenerativeAI> | null = null;

  public getGoogleClient() {
    if (this.googleInstance) return this.googleInstance;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.warn(
        "AeroDrop AI: Neither GEMINI_API_KEY nor GOOGLE_GENERATIVE_AI_API_KEY is configured in the environment."
      );
    }

    this.googleInstance = createGoogleGenerativeAI({
      apiKey: apiKey || "MISSING_KEY",
    });

    return this.googleInstance;
  }

  public getModel(modelName: string = AI_CONFIG.defaultModel) {
    const google = this.getGoogleClient();
    return google(modelName);
  }

  public isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  }
}

export const aiProvider = new AIProviderRegistry();
