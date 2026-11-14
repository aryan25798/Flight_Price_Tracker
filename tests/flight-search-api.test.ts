import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as searchGET, POST as searchPOST } from "@/app/api/flights/search/route";
import { POST as revalidatePOST } from "@/app/api/flights/revalidate/route";
import { getTomorrowDateString } from "@/lib/dates/flight-datetime";

describe("AeroDrop Flight Search & Revalidation API Endpoints (Phase 4)", () => {
  const tomorrow = getTomorrowDateString();

  it("GET /api/flights/search validates required parameters", async () => {
    const req = new NextRequest("http://localhost:3000/api/flights/search");
    const res = await searchGET(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain("required parameters");
  });

  it("GET /api/flights/search returns normalized search results with pagination", async () => {
    const url = `http://localhost:3000/api/flights/search?origin=DEL&destination=BOM&departureDate=${tomorrow}&adults=1&pageSize=10&page=1`;
    const req = new NextRequest(url);
    const res = await searchGET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.sessionId).toBeDefined();
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(10);
    expect(Array.isArray(json.offers)).toBe(true);
  });

  it("POST /api/flights/search executes advanced queries with sorting and filters", async () => {
    const req = new NextRequest("http://localhost:3000/api/flights/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: "delhi",
        destination: "patna",
        departureDate: tomorrow,
        sortBy: "cheapest",
        adults: 2,
        cabinClass: "economy",
      }),
    });

    const res = await searchPOST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.query.origin).toBe("DEL");
    expect(json.query.destination).toBe("PAT");
    expect(json.query.adults).toBe(2);
  });

  it("POST /api/flights/revalidate checks price accuracy and status", async () => {
    const req = new NextRequest("http://localhost:3000/api/flights/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: "DEL",
        destination: "BOM",
        departureDate: tomorrow,
        expectedPrice: 5000,
      }),
    });

    const res = await revalidatePOST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toBeDefined();
    expect(typeof json.revalidated).toBe("boolean");
    expect(json.status).toBeDefined();
  });
});
