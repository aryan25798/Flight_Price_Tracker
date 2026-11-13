import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

export interface CanonicalRouteParams {
  provider: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  tripType: "one_way" | "round_trip";
  adults: number;
  children: number;
  infants: number;
  cabinClass: string;
  currency: string;
}

// Canonical route key computation matching PostgreSQL compute_route_key()
export function computeCanonicalRouteKey(params: CanonicalRouteParams): string {
  const normalized = {
    adults: params.adults,
    cabin_class: params.cabinClass.trim().toLowerCase(),
    children: params.children,
    currency: params.currency.trim().toUpperCase(),
    departure_date: params.departureDate,
    destination: params.destination.trim().toUpperCase(),
    infants: params.infants,
    origin: params.origin.trim().toUpperCase(),
    provider: params.provider.trim().toLowerCase(),
    return_date: params.returnDate ? params.returnDate : null,
    trip_type: params.tripType.trim().toLowerCase(),
  };

  // Deterministic JSON string representation (sorted keys)
  const canonicalString = JSON.stringify(normalized, Object.keys(normalized).sort());
  return createHash("sha256").update(canonicalString, "utf8").digest("hex");
}

describe("Phase 2 Functional Testing: Flight Monitoring Engine & Deduplication", () => {
  const baseFlight: CanonicalRouteParams = {
    provider: "travelpayouts",
    origin: "DEL",
    destination: "BOM",
    departureDate: "2026-12-15",
    returnDate: null,
    tripType: "one_way",
    adults: 1,
    children: 0,
    infants: 0,
    cabinClass: "economy",
    currency: "INR",
  };

  describe("Deterministic Canonical Hashing", () => {
    it("produces identical SHA-256 keys regardless of input casing or whitespace", () => {
      const key1 = computeCanonicalRouteKey(baseFlight);
      const key2 = computeCanonicalRouteKey({
        ...baseFlight,
        origin: "  del  ",
        destination: " bom ",
        cabinClass: " ECONOMY ",
        currency: "inr",
        provider: "TRAVELPAYOUTS",
      });

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64);
    });
  });

  describe("Critical Multi-User Deduplication Simulation (1, 100, 500, 1,000 Users)", () => {
    interface TrackedSubscription {
      id: string;
      userId: string;
      targetPrice: number;
      routeKey: string;
    }

    interface MonitoredRoute {
      routeKey: string;
      subscribers: TrackedSubscription[];
    }

    class SharedMonitoringEngine {
      private routes = new Map<string, MonitoredRoute>();
      public externalApiCalls = 0;

      public registerSubscription(userId: string, targetPrice: number, params: CanonicalRouteParams): TrackedSubscription {
        const routeKey = computeCanonicalRouteKey(params);
        let route = this.routes.get(routeKey);

        if (!route) {
          route = { routeKey, subscribers: [] };
          this.routes.set(routeKey, route);
        }

        const sub: TrackedSubscription = {
          id: `sub-${Math.random().toString(36).substring(2, 9)}`,
          userId,
          targetPrice,
          routeKey,
        };
        route.subscribers.push(sub);
        return sub;
      }

      public executePollingCycle(mockProviderPrice: number): {
        dispatchedApiCalls: number;
        evaluatedTrackers: number;
        alertsTriggered: number;
      } {
        let evaluatedTrackers = 0;
        let alertsTriggered = 0;

        // Exactly 1 external API call per unique routeKey in this polling cycle
        for (const [_, route] of this.routes.entries()) {
          this.externalApiCalls++;
          // Independent evaluation for every user subscribed to this route
          for (const sub of route.subscribers) {
            evaluatedTrackers++;
            if (mockProviderPrice <= sub.targetPrice) {
              alertsTriggered++;
            }
          }
        }

        return {
          dispatchedApiCalls: this.routes.size,
          evaluatedTrackers,
          alertsTriggered,
        };
      }
    }

    it("verifies 1 user tracking DEL -> BOM triggers exactly 1 API call", () => {
      const engine = new SharedMonitoringEngine();
      engine.registerSubscription("user-1", 5000, baseFlight);

      const result = engine.executePollingCycle(4500);
      expect(result.dispatchedApiCalls).toBe(1);
      expect(result.evaluatedTrackers).toBe(1);
      expect(result.alertsTriggered).toBe(1);
    });

    it("verifies 100 users tracking DEL -> BOM trigger exactly 1 API call", () => {
      const engine = new SharedMonitoringEngine();
      for (let i = 1; i <= 100; i++) {
        // Vary target prices between 4,000 and 6,000
        engine.registerSubscription(`user-${i}`, 4000 + i * 20, baseFlight);
      }

      const result = engine.executePollingCycle(4800);
      expect(result.dispatchedApiCalls).toBe(1);
      expect(result.evaluatedTrackers).toBe(100);
      // Trackers with targetPrice >= 4800 get alerted
      expect(result.alertsTriggered).toBeGreaterThan(0);
      expect(result.alertsTriggered).toBeLessThanOrEqual(100);
    });

    it("verifies 500 users tracking DEL -> BOM trigger exactly 1 API call", () => {
      const engine = new SharedMonitoringEngine();
      for (let i = 1; i <= 500; i++) {
        engine.registerSubscription(`user-${i}`, 5000, baseFlight);
      }

      const result = engine.executePollingCycle(4200);
      expect(result.dispatchedApiCalls).toBe(1);
      expect(result.evaluatedTrackers).toBe(500);
      expect(result.alertsTriggered).toBe(500);
    });

    it("verifies 1,000 users tracking DEL -> BOM trigger exactly 1 API call", () => {
      const engine = new SharedMonitoringEngine();
      for (let i = 1; i <= 1000; i++) {
        engine.registerSubscription(`user-${i}`, 4500, baseFlight);
      }

      const result = engine.executePollingCycle(4400);
      expect(result.dispatchedApiCalls).toBe(1);
      expect(result.evaluatedTrackers).toBe(1000);
      expect(result.alertsTriggered).toBe(1000);
    });
  });

  describe("Isolation of Different Flight Parameter Combinations", () => {
    it("ensures different departure dates generate unique keys and do NOT share results", () => {
      const keyDay1 = computeCanonicalRouteKey({ ...baseFlight, departureDate: "2026-12-15" });
      const keyDay2 = computeCanonicalRouteKey({ ...baseFlight, departureDate: "2026-12-16" });
      expect(keyDay1).not.toBe(keyDay2);
    });

    it("ensures different passenger combinations generate unique keys", () => {
      const solo = computeCanonicalRouteKey({ ...baseFlight, adults: 1 });
      const couple = computeCanonicalRouteKey({ ...baseFlight, adults: 2 });
      const family = computeCanonicalRouteKey({ ...baseFlight, adults: 2, children: 1 });
      expect(solo).not.toBe(couple);
      expect(couple).not.toBe(family);
    });

    it("ensures different cabin classes generate unique keys", () => {
      const economy = computeCanonicalRouteKey({ ...baseFlight, cabinClass: "economy" });
      const business = computeCanonicalRouteKey({ ...baseFlight, cabinClass: "business" });
      const first = computeCanonicalRouteKey({ ...baseFlight, cabinClass: "first" });
      expect(economy).not.toBe(business);
      expect(business).not.toBe(first);
    });

    it("ensures different currencies generate unique keys", () => {
      const inr = computeCanonicalRouteKey({ ...baseFlight, currency: "INR" });
      const usd = computeCanonicalRouteKey({ ...baseFlight, currency: "USD" });
      const eur = computeCanonicalRouteKey({ ...baseFlight, currency: "EUR" });
      expect(inr).not.toBe(usd);
      expect(usd).not.toBe(eur);
    });
  });
});
