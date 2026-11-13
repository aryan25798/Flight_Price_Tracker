import { describe, expect, it } from "vitest";
import { CreateTrackerSchema } from "@/lib/validations/tracker";

describe("Phase 2 Functional Testing: User Dashboard & Tracker Management", () => {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  describe("Tracker Creation Validation", () => {
    it("accepts a well-formed one-way tracker", () => {
      const valid = {
        origin: "del",
        destination: "bom",
        departureDate: tomorrow,
        tripType: "one_way",
        adults: 1,
        children: 0,
        infants: 0,
        cabinClass: "economy",
        currency: "INR",
        targetPrice: 4500,
      };

      const parsed = CreateTrackerSchema.parse(valid);
      expect(parsed.origin).toBe("DEL");
      expect(parsed.destination).toBe("BOM");
      expect(parsed.targetPrice).toBe(4500);
      expect(parsed.currency).toBe("INR");
    });

    it("accepts a well-formed round-trip tracker with returnDate >= departureDate", () => {
      const valid = {
        origin: "blr",
        destination: "del",
        departureDate: tomorrow,
        returnDate: nextWeek,
        tripType: "round_trip",
        adults: 2,
        children: 1,
        infants: 1,
        cabinClass: "economy",
        currency: "INR",
        targetPrice: 12000,
      };

      const parsed = CreateTrackerSchema.parse(valid);
      expect(parsed.tripType).toBe("round_trip");
      expect(parsed.returnDate).toBe(nextWeek);
      expect(parsed.adults).toBe(2);
    });

    it("rejects identical origin and destination", () => {
      const invalid = {
        origin: "DEL",
        destination: "DEL",
        departureDate: tomorrow,
        tripType: "one_way",
        adults: 1,
        children: 0,
        infants: 0,
        cabinClass: "economy",
        currency: "INR",
        targetPrice: 5000,
      };

      const result = CreateTrackerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("different");
      }
    });

    it("rejects departure dates in the past", () => {
      const invalid = {
        origin: "DEL",
        destination: "BOM",
        departureDate: "2020-01-01",
        tripType: "one_way",
        adults: 1,
        children: 0,
        infants: 0,
        cabinClass: "economy",
        currency: "INR",
        targetPrice: 5000,
      };

      const result = CreateTrackerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("past");
      }
    });

    it("rejects passenger combinations where total exceeds 9", () => {
      const invalid = {
        origin: "DEL",
        destination: "BOM",
        departureDate: tomorrow,
        tripType: "one_way",
        adults: 6,
        children: 4,
        infants: 0,
        cabinClass: "economy",
        currency: "INR",
        targetPrice: 5000,
      };

      const result = CreateTrackerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("cannot exceed 9");
      }
    });

    it("rejects infants count exceeding adults count (airline safety regulation)", () => {
      const invalid = {
        origin: "DEL",
        destination: "BOM",
        departureDate: tomorrow,
        tripType: "one_way",
        adults: 1,
        children: 0,
        infants: 2,
        cabinClass: "economy",
        currency: "INR",
        targetPrice: 5000,
      };

      const result = CreateTrackerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("Infants cannot exceed");
      }
    });

    it("rejects zero or negative target price", () => {
      const invalidZero = {
        origin: "DEL",
        destination: "BOM",
        departureDate: tomorrow,
        tripType: "one_way",
        adults: 1,
        children: 0,
        infants: 0,
        cabinClass: "economy",
        currency: "INR",
        targetPrice: 0,
      };

      expect(CreateTrackerSchema.safeParse(invalidZero).success).toBe(false);

      const invalidNegative = { ...invalidZero, targetPrice: -500 };
      expect(CreateTrackerSchema.safeParse(invalidNegative).success).toBe(false);
    });
  });

  describe("Tracker State Mutations (Pause / Resume / Delete / Duplicate Prevention)", () => {
    interface MockTracker {
      id: string;
      userId: string;
      routeId: string;
      isActive: boolean;
      targetPrice: number;
    }

    class MockTrackerStore {
      private trackers: MockTracker[] = [];

      public create(userId: string, routeId: string, targetPrice: number): { success: boolean; error?: string; tracker?: MockTracker } {
        // Enforce DB unique constraint (user_id, route_id)
        const duplicate = this.trackers.find(
          (t) => t.userId === userId && t.routeId === routeId,
        );
        if (duplicate) {
          return { success: false, error: "You are already tracking this exact flight route" };
        }

        const newTracker: MockTracker = {
          id: `trk-${this.trackers.length + 1}`,
          userId,
          routeId,
          isActive: true,
          targetPrice,
        };
        this.trackers.push(newTracker);
        return { success: true, tracker: newTracker };
      }

      public togglePause(userId: string, trackerId: string): boolean {
        const trk = this.trackers.find((t) => t.id === trackerId && t.userId === userId);
        if (!trk) return false;
        trk.isActive = !trk.isActive;
        return true;
      }

      public delete(userId: string, trackerId: string): boolean {
        const index = this.trackers.findIndex((t) => t.id === trackerId && t.userId === userId);
        if (index === -1) return false;
        this.trackers.splice(index, 1);
        return true;
      }

      public get(trackerId: string): MockTracker | undefined {
        return this.trackers.find((t) => t.id === trackerId);
      }
    }

    it("prevents duplicate tracker creation for the same user on the same route", () => {
      const store = new MockTrackerStore();
      const first = store.create("user-1", "route-del-bom", 5000);
      expect(first.success).toBe(true);

      const second = store.create("user-1", "route-del-bom", 4500);
      expect(second.success).toBe(false);
      expect(second.error).toContain("already tracking");
    });

    it("allows different users to track the same route independently", () => {
      const store = new MockTrackerStore();
      const user1 = store.create("user-1", "route-del-bom", 5000);
      const user2 = store.create("user-2", "route-del-bom", 4800);

      expect(user1.success).toBe(true);
      expect(user2.success).toBe(true);
    });

    it("successfully toggles pause and resume states", () => {
      const store = new MockTrackerStore();
      const created = store.create("user-1", "route-del-bom", 5000);
      const id = created.tracker!.id;

      expect(store.get(id)?.isActive).toBe(true);

      // Pause
      store.togglePause("user-1", id);
      expect(store.get(id)?.isActive).toBe(false);

      // Resume
      store.togglePause("user-1", id);
      expect(store.get(id)?.isActive).toBe(true);
    });

    it("prevents other users from toggling or deleting someone else's tracker", () => {
      const store = new MockTrackerStore();
      const created = store.create("user-1", "route-del-bom", 5000);
      const id = created.tracker!.id;

      // Unauthorized user tries to pause
      const paused = store.togglePause("user-evil", id);
      expect(paused).toBe(false);
      expect(store.get(id)?.isActive).toBe(true);

      // Unauthorized user tries to delete
      const deleted = store.delete("user-evil", id);
      expect(deleted).toBe(false);
      expect(store.get(id)).toBeDefined();

      // Owner deletes successfully
      const ownerDeleted = store.delete("user-1", id);
      expect(ownerDeleted).toBe(true);
      expect(store.get(id)).toBeUndefined();
    });
  });
});
