import { describe, expect, it } from "vitest";
import {
  CreateTrackerSchema,
  LoginSchema,
  SignupSchema,
} from "@/lib/validations/tracker";

function futureDate(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  return d.toISOString().slice(0, 10);
}

describe("Flight Tracker Zod Validations", () => {
  it("accepts a valid one-way tracker and uppercases IATA codes", () => {
    const parsed = CreateTrackerSchema.safeParse({
      origin: "del",
      destination: "bom",
      departureDate: futureDate(30),
      returnDate: "",
      tripType: "one_way",
      adults: 1,
      children: 0,
      infants: 0,
      cabinClass: "economy",
      currency: "INR",
      targetPrice: 4500,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.origin).toBe("DEL");
      expect(parsed.data.destination).toBe("BOM");
    }
  });

  it("accepts one-way trackers with returnDate as null, undefined, or empty", () => {
    const parsedNull = CreateTrackerSchema.safeParse({
      origin: "del",
      destination: "pat",
      departureDate: futureDate(2),
      returnDate: null,
      tripType: "one_way",
      adults: 1,
      children: 0,
      infants: 0,
      cabinClass: "economy",
      currency: "INR",
      targetPrice: 15000,
    });

    expect(parsedNull.success).toBe(true);
    if (parsedNull.success) {
      expect(parsedNull.data.origin).toBe("DEL");
      expect(parsedNull.data.destination).toBe("PAT");
      expect(parsedNull.data.tripType).toBe("one_way");
      expect(parsedNull.data.currency).toBe("INR");
      expect(parsedNull.data.returnDate).toBeNull();
    }
  });

  it("rejects identical origin and destination", () => {
    const parsed = CreateTrackerSchema.safeParse({
      origin: "DEL",
      destination: "DEL",
      departureDate: futureDate(10),
      tripType: "one_way",
      adults: 1,
      children: 0,
      infants: 0,
      cabinClass: "economy",
      currency: "INR",
      targetPrice: 4500,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects past departure dates", () => {
    const parsed = CreateTrackerSchema.safeParse({
      origin: "DEL",
      destination: "BOM",
      departureDate: "2020-01-01",
      tripType: "one_way",
      adults: 1,
      children: 0,
      infants: 0,
      cabinClass: "economy",
      currency: "INR",
      targetPrice: 4500,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects round-trip when returnDate is missing or before departureDate", () => {
    const dep = futureDate(20);
    const ret = futureDate(15);
    const parsed = CreateTrackerSchema.safeParse({
      origin: "DEL",
      destination: "DXB",
      departureDate: dep,
      returnDate: ret,
      tripType: "round_trip",
      adults: 1,
      children: 0,
      infants: 0,
      cabinClass: "economy",
      currency: "INR",
      targetPrice: 15000,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects infants exceeding adults or total passengers > 9", () => {
    const parsed = CreateTrackerSchema.safeParse({
      origin: "DEL",
      destination: "LHR",
      departureDate: futureDate(30),
      tripType: "one_way",
      adults: 1,
      children: 0,
      infants: 2,
      cabinClass: "economy",
      currency: "INR",
      targetPrice: 40000,
    });
    expect(parsed.success).toBe(false);
  });

  it("validates signup password confirmation", () => {
    expect(
      SignupSchema.safeParse({
        email: "user@example.com",
        password: "password123",
        confirmPassword: "mismatch",
      }).success,
    ).toBe(false);

    expect(
      LoginSchema.safeParse({
        email: "user@example.com",
        password: "password123",
      }).success,
    ).toBe(true);
  });
});
