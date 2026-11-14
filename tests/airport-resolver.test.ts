import { describe, it, expect } from "vitest";
import { resolveAirportCode, getAirportDetails } from "@/lib/flights/airport-resolver";

describe("AeroDrop Airport Resolver Suite", () => {
  it("resolves direct uppercase and lowercase 3-letter IATA codes", () => {
    expect(resolveAirportCode("DEL")).toBe("DEL");
    expect(resolveAirportCode("del")).toBe("DEL");
    expect(resolveAirportCode("BOM")).toBe("BOM");
    expect(resolveAirportCode("pat")).toBe("PAT");
    expect(resolveAirportCode("dxb")).toBe("DXB");
    expect(resolveAirportCode("lhr")).toBe("LHR");
  });

  it("resolves Indian city names and colloquial aliases to correct IATA codes", () => {
    expect(resolveAirportCode("delhi")).toBe("DEL");
    expect(resolveAirportCode("New Delhi")).toBe("DEL");
    expect(resolveAirportCode("mumbai")).toBe("BOM");
    expect(resolveAirportCode("bombay")).toBe("BOM");
    expect(resolveAirportCode("patna")).toBe("PAT");
    expect(resolveAirportCode("bangalore")).toBe("BLR");
    expect(resolveAirportCode("bengaluru")).toBe("BLR");
    expect(resolveAirportCode("calcutta")).toBe("CCU");
    expect(resolveAirportCode("kolkata")).toBe("CCU");
    expect(resolveAirportCode("madras")).toBe("MAA");
    expect(resolveAirportCode("chennai")).toBe("MAA");
  });

  it("resolves international major hubs", () => {
    expect(resolveAirportCode("dubai")).toBe("DXB");
    expect(resolveAirportCode("singapore")).toBe("SIN");
    expect(resolveAirportCode("london")).toBe("LHR");
    expect(resolveAirportCode("heathrow")).toBe("LHR");
    expect(resolveAirportCode("new york")).toBe("JFK");
    expect(resolveAirportCode("nyc")).toBe("JFK");
    expect(resolveAirportCode("san francisco")).toBe("SFO");
  });

  it("returns null or graceful fallback on invalid strings", () => {
    expect(resolveAirportCode("")).toBeNull();
    expect(resolveAirportCode(null)).toBeNull();
    expect(resolveAirportCode("xyznonexistent123")).toBeNull();
  });

  it("returns complete airport metadata for verified IATA codes", () => {
    const del = getAirportDetails("DEL");
    expect(del).not.toBeNull();
    expect(del?.city).toBe("New Delhi");
    expect(del?.country).toBe("India");

    const bom = getAirportDetails("BOM");
    expect(bom).not.toBeNull();
    expect(bom?.city).toBe("Mumbai");
  });
});
