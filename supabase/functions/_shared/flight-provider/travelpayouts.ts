import { z } from "https://esm.sh/zod@3.24.2";
import {
  type FlightProvider,
  FlightProviderError,
  type FlightSearchQuery,
  type NormalizedFlightOffer,
  type ProviderCapabilities,
} from "./types.ts";

const TravelpayoutsOfferSchema = z.object({
  origin: z.string().min(2).max(4),
  destination: z.string().min(2).max(4),
  price: z.number().positive(),
  airline: z.string().optional(),
  flight_number: z.union([z.string(), z.number()]).optional(),
  departure_at: z.string(),
  return_at: z.string().optional(),
  transfers: z.number().int().nonnegative().optional(),
  link: z.string().optional(),
});

const TravelpayoutsResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(TravelpayoutsOfferSchema).default([]),
  currency: z.string().optional(),
  error: z.string().optional(),
});

type TravelpayoutsResponse = z.infer<typeof TravelpayoutsResponseSchema>;

export class TravelpayoutsProvider implements FlightProvider {
  private readonly apiToken: string;
  private readonly marker: string | undefined;
  private readonly timeoutMs: number;
  private readonly cache = new Map<string, NormalizedFlightOffer | null>();

  constructor(options?: { apiToken?: string; marker?: string; timeoutMs?: number }) {
    const token = options?.apiToken ?? Deno.env.get("TRAVELPAYOUTS_API_TOKEN");
    if (!token) {
      throw new FlightProviderError("TRAVELPAYOUTS_API_TOKEN is not configured", false);
    }
    this.apiToken = token;
    this.marker = options?.marker ?? Deno.env.get("TRAVELPAYOUTS_MARKER");
    this.timeoutMs = options?.timeoutMs ?? 8000;
  }

  getProviderName(): string {
    return "travelpayouts";
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsPassengerFilter: false,
      supportsCabinFilter: false,
      isCachedData: true,
    };
  }

  async searchFlights(query: FlightSearchQuery): Promise<NormalizedFlightOffer | null> {
    if (this.cache.has(query.routeKey)) {
      return this.cache.get(query.routeKey) ?? null;
    }

    const url = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
    url.searchParams.set("origin", query.origin.toUpperCase());
    url.searchParams.set("destination", query.destination.toUpperCase());
    url.searchParams.set("departure_at", query.departureDate);
    url.searchParams.set("one_way", query.tripType === "one_way" ? "true" : "false");
    if (query.tripType === "round_trip" && query.returnDate) {
      url.searchParams.set("return_at", query.returnDate);
    }
    url.searchParams.set("currency", query.currency.toLowerCase());
    url.searchParams.set("sorting", "price");
    url.searchParams.set("limit", "10");
    url.searchParams.set("unique", "false");

    const maxAttempts = 2;
    let lastError: FlightProviderError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "X-Access-Token": this.apiToken,
            "Accept": "application/json",
          },
          signal: controller.signal,
        });

        if (res.status === 429) {
          lastError = new FlightProviderError("Travelpayouts rate limit exceeded (429)", true, 429);
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }
          throw lastError;
        }

        if (res.status >= 500) {
          lastError = new FlightProviderError(`Travelpayouts server error (${res.status})`, true, res.status);
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 800));
            continue;
          }
          throw lastError;
        }

        if (!res.ok) {
          const bodyText = await res.text().catch(() => "");
          throw new FlightProviderError(
            `Travelpayouts HTTP ${res.status}: ${bodyText.slice(0, 200)}`,
            false,
            res.status,
          );
        }

        const rawJson = await res.json();
        const validated = this.validateResponse(rawJson);
        const normalized = this.normalizeResponse(validated, query);
        this.cache.set(query.routeKey, normalized);
        return normalized;
      } catch (err) {
        if (err instanceof FlightProviderError) {
          if (!err.retryable || attempt >= maxAttempts) throw err;
          lastError = err;
        } else if (err instanceof DOMException && err.name === "AbortError") {
          lastError = new FlightProviderError("Travelpayouts request timed out", true, 504);
          if (attempt >= maxAttempts) throw lastError;
        } else {
          lastError = new FlightProviderError(
            err instanceof Error ? err.message : "Network error calling Travelpayouts",
            true,
          );
          if (attempt >= maxAttempts) throw lastError;
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new FlightProviderError("Travelpayouts request failed", true);
  }

  validateResponse(raw: unknown): TravelpayoutsResponse {
    const parsed = TravelpayoutsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new FlightProviderError(
        `Invalid Travelpayouts response format: ${parsed.error.issues[0]?.message ?? "schema mismatch"}`,
        false,
      );
    }

    if (!parsed.data.success) {
      throw new FlightProviderError(
        `Travelpayouts API error: ${parsed.data.error ?? "unknown error"}`,
        false,
      );
    }

    return parsed.data;
  }

  normalizeResponse(raw: TravelpayoutsResponse, query: FlightSearchQuery): NormalizedFlightOffer | null {
    if (!raw.data || raw.data.length === 0) {
      return null;
    }

    // Select lowest valid price offer
    const sorted = [...raw.data].sort((a, b) => a.price - b.price);
    const best = sorted[0];

    return {
      price: best.price,
      currency: (raw.currency ?? query.currency).toUpperCase(),
      airline: best.airline ?? null,
      flightNumber: best.flight_number !== undefined ? String(best.flight_number) : null,
      departureAt: best.departure_at,
      returnAt: best.return_at ?? null,
      transfers: best.transfers ?? null,
      bookingUrl: this.getBookingUrl(best.link, query),
      provider: this.getProviderName(),
    };
  }

  getBookingUrl(rawLink: string | undefined | null, query: FlightSearchQuery): string | null {
    if (!rawLink) {
      return null;
    }

    try {
      const target = rawLink.startsWith("http")
        ? new URL(rawLink)
        : new URL(rawLink.startsWith("/") ? rawLink : `/${rawLink}`, "https://www.aviasales.com");

      if (target.protocol !== "https:") {
        return null;
      }

      if (this.marker && !target.searchParams.has("marker")) {
        target.searchParams.set("marker", this.marker);
      }

      if (!target.searchParams.has("currency")) {
        target.searchParams.set("currency", query.currency.toLowerCase());
      }

      return target.toString();
    } catch {
      return null;
    }
  }
}
