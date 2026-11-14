import { describe, expect, it } from "vitest";
import {
  AIRPORT_TIMEZONES,
  addDaysToDateOnly,
  calculateFlightTimeline,
  compareDateOnly,
  formatCalendarDate,
  getAirportTimeZone,
  getDaysInMonth,
  getLocalDateString,
  getTodayDateString,
  getTomorrowDateString,
  isDateInPast,
  isLeapYear,
  parseDateOnly,
  validateFlightMatchesRequestedDate,
} from "@/lib/dates/flight-datetime";

describe("AeroDrop Flight Date & Timezone Engine (Phase 1)", () => {
  describe("IATA Airport Timezone Resolution", () => {
    it("resolves Indian domestic airports strictly to Asia/Kolkata", () => {
      expect(getAirportTimeZone("DEL")).toBe("Asia/Kolkata");
      expect(getAirportTimeZone("BOM")).toBe("Asia/Kolkata");
      expect(getAirportTimeZone("PAT")).toBe("Asia/Kolkata");
      expect(getAirportTimeZone("BLR")).toBe("Asia/Kolkata");
      expect(getAirportTimeZone("HYD")).toBe("Asia/Kolkata");
      expect(getAirportTimeZone("CCU")).toBe("Asia/Kolkata");
    });

    it("resolves major international hubs accurately", () => {
      expect(getAirportTimeZone("DXB")).toBe("Asia/Dubai");
      expect(getAirportTimeZone("SIN")).toBe("Asia/Singapore");
      expect(getAirportTimeZone("LHR")).toBe("Europe/London");
      expect(getAirportTimeZone("JFK")).toBe("America/New_York");
      expect(getAirportTimeZone("LAX")).toBe("America/Los_Angeles");
      expect(getAirportTimeZone("HND")).toBe("Asia/Tokyo");
      expect(getAirportTimeZone("SYD")).toBe("Australia/Sydney");
    });

    it("falls back gracefully for unknown codes", () => {
      expect(getAirportTimeZone("XYZ")).toBe("Asia/Kolkata");
      expect(getAirportTimeZone("")).toBe("Asia/Kolkata");
    });
  });

  describe("Calendar Date Math (Never through UTC conversions)", () => {
    it("correctly parses YYYY-MM-DD components", () => {
      const parts = parseDateOnly("2026-11-15");
      expect(parts).toEqual({ year: 2026, month: 11, day: 15 });
    });

    it("adds days within the same month", () => {
      expect(addDaysToDateOnly("2026-11-14", 1)).toBe("2026-11-15");
      expect(addDaysToDateOnly("2026-11-14", 7)).toBe("2026-11-21");
    });

    it("handles month boundaries forward and backward", () => {
      // November has 30 days
      expect(addDaysToDateOnly("2026-11-30", 1)).toBe("2026-12-01");
      expect(addDaysToDateOnly("2026-12-01", -1)).toBe("2026-11-30");

      // January has 31 days
      expect(addDaysToDateOnly("2026-01-31", 1)).toBe("2026-02-01");
    });

    it("handles year boundaries forward and backward", () => {
      expect(addDaysToDateOnly("2026-12-31", 1)).toBe("2027-01-01");
      expect(addDaysToDateOnly("2027-01-01", -1)).toBe("2026-12-31");
    });

    it("respects leap years accurately", () => {
      // 2024 is a leap year (February has 29 days)
      expect(isLeapYear(2024)).toBe(true);
      expect(getDaysInMonth(2024, 2)).toBe(29);
      expect(addDaysToDateOnly("2024-02-28", 1)).toBe("2024-02-29");
      expect(addDaysToDateOnly("2024-02-29", 1)).toBe("2024-03-01");

      // 2026 is NOT a leap year (February has 28 days)
      expect(isLeapYear(2026)).toBe(false);
      expect(getDaysInMonth(2026, 2)).toBe(28);
      expect(addDaysToDateOnly("2026-02-28", 1)).toBe("2026-03-01");
    });

    it("calculates tomorrow relative to specified timezone without UTC drift", () => {
      const fixedDate = new Date("2026-11-14T18:30:00Z"); // 00:00 IST on Nov 15th
      const istDate = getLocalDateString(fixedDate, "Asia/Kolkata");
      const utcDate = getLocalDateString(fixedDate, "UTC");

      expect(istDate).toBe("2026-11-15");
      expect(utcDate).toBe("2026-11-14");
    });

    it("compares calendar dates safely", () => {
      expect(compareDateOnly("2026-11-14", "2026-11-15")).toBe(-1);
      expect(compareDateOnly("2026-11-15", "2026-11-15")).toBe(0);
      expect(compareDateOnly("2026-11-16", "2026-11-15")).toBe(1);
    });

    it("formats calendar dates without shifting days", () => {
      expect(formatCalendarDate("2026-11-15")).toBe("Sun, 15 Nov 2026");
      expect(formatCalendarDate("2026-12-25")).toBe("Fri, 25 Dec 2026");
    });
  });

  describe("Flight Timeline & Overnight (+1) Handling", () => {
    it("handles same-day domestic flights (DEL -> PAT)", () => {
      const timeline = calculateFlightTimeline({
        departureIso: "2026-11-15T09:40:00+05:30",
        durationMinutes: 100,
        originIata: "DEL",
        destinationIata: "PAT",
      });

      expect(timeline.departureDateOnly).toBe("2026-11-15");
      expect(timeline.departureTimeLocal).toBe("09:40");
      expect(timeline.arrivalDateOnly).toBe("2026-11-15");
      expect(timeline.arrivalTimeLocal).toBe("11:20");
      expect(timeline.dayDifference).toBe(0);
      expect(timeline.isOvernight).toBe(false);
      expect(timeline.durationFormatted).toBe("1h 40m");
    });

    it("detects overnight domestic red-eye flights departing close to midnight", () => {
      const timeline = calculateFlightTimeline({
        departureIso: "2026-11-15T23:30:00+05:30",
        durationMinutes: 120, // arrives at 01:30 next day
        originIata: "DEL",
        destinationIata: "BLR",
      });

      expect(timeline.departureDateOnly).toBe("2026-11-15");
      expect(timeline.departureTimeLocal).toBe("23:30");
      expect(timeline.arrivalDateOnly).toBe("2026-11-16");
      expect(timeline.arrivalTimeLocal).toBe("01:30");
      expect(timeline.dayDifference).toBe(1);
      expect(timeline.isOvernight).toBe(true);
    });

    it("handles international long-haul flights crossing multiple timezones (DEL -> LHR)", () => {
      // DEL departs 14:00 IST (08:30 UTC), 9h flight -> arrives 17:30 GMT (London is UTC in Nov)
      const timeline = calculateFlightTimeline({
        departureIso: "2026-11-15T14:00:00+05:30",
        durationMinutes: 570, // 9h 30m
        originIata: "DEL",
        destinationIata: "LHR",
      });

      expect(timeline.departureDateOnly).toBe("2026-11-15");
      expect(timeline.departureTimeLocal).toBe("14:00");
      expect(timeline.originTimeZone).toBe("Asia/Kolkata");
      expect(timeline.destinationTimeZone).toBe("Europe/London");
      expect(timeline.arrivalDateOnly).toBe("2026-11-15");
      expect(timeline.arrivalTimeLocal).toBe("18:00"); // 14:00 IST - 5:30 + 9:30 = 18:00 GMT
      expect(timeline.isOvernight).toBe(false);
    });

    it("detects overnight international flights arriving next day (DEL -> SIN)", () => {
      // DEL departs 23:00 IST (17:30 UTC), 5h 30m flight -> arrives 07:00 SGT (UTC+8) next day
      const timeline = calculateFlightTimeline({
        departureIso: "2026-11-15T23:00:00+05:30",
        durationMinutes: 330,
        originIata: "DEL",
        destinationIata: "SIN",
      });

      expect(timeline.departureDateOnly).toBe("2026-11-15");
      expect(timeline.departureTimeLocal).toBe("23:00");
      expect(timeline.arrivalDateOnly).toBe("2026-11-16");
      expect(timeline.arrivalTimeLocal).toBe("07:00");
      expect(timeline.dayDifference).toBe(1);
      expect(timeline.isOvernight).toBe(true);
    });
  });

  describe("Flight Date Match Validation (Zero Fallback Leakage)", () => {
    it("validates when flight departure matches requested calendar date", () => {
      const match = validateFlightMatchesRequestedDate(
        "2026-11-15T09:40:00+05:30",
        "2026-11-15",
        "DEL",
      );
      expect(match).toBe(true);
    });

    it("rejects provider fallback flights from a different date or month", () => {
      // If user searched for Nov 15, reject a cached flight from Dec 15!
      const mismatchMonth = validateFlightMatchesRequestedDate(
        "2026-12-15T07:25:00+05:30",
        "2026-11-15",
        "DEL",
      );
      expect(mismatchMonth).toBe(false);

      // If user searched for Nov 15, reject Nov 16
      const mismatchDay = validateFlightMatchesRequestedDate(
        "2026-11-16T06:20:00+05:30",
        "2026-11-15",
        "DEL",
      );
      expect(mismatchDay).toBe(false);
    });
  });
});
