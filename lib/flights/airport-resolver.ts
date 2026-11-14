import airportsData from "@/public/data/airports.json";
import type { Airport } from "@/types/database";

const airportsList: Airport[] = airportsData as Airport[];

// Common colloquial city/airport alias dictionary
const CITY_ALIASES: Record<string, string> = {
  bombay: "BOM",
  mumbai: "BOM",
  delhi: "DEL",
  "new delhi": "DEL",
  bangalore: "BLR",
  bengaluru: "BLR",
  calcutta: "CCU",
  kolkata: "CCU",
  madras: "MAA",
  chennai: "MAA",
  patna: "PAT",
  hyderabad: "HYD",
  ahmedabad: "AMD",
  pune: "PNQ",
  goa: "GOI",
  "north goa": "GOX",
  jaipur: "JAI",
  lucknow: "LKO",
  amritsar: "ATQ",
  chandigarh: "IXC",
  varanasi: "VNS",
  benares: "VNS",
  banaras: "VNS",
  srinagar: "SXR",
  bagdogra: "IXB",
  siliguri: "IXB",
  guwahati: "GAU",
  trivandrum: "TRV",
  thiruvananthapuram: "TRV",
  kochi: "COK",
  cochin: "COK",
  kozhikode: "CCJ",
  calicut: "CCJ",
  indore: "IDR",
  nagpur: "NAG",
  udaipur: "UDR",
  ranchi: "IXR",
  visakhapatnam: "VTZ",
  vizag: "VTZ",
  coimbatore: "CJB",
  madurai: "IXM",
  bhubaneswar: "BBI",
  dubai: "DXB",
  "abu dhabi": "AUH",
  sharjah: "SHJ",
  doha: "DOH",
  singapore: "SIN",
  bangkok: "BKK",
  london: "LHR",
  heathrow: "LHR",
  gatwick: "LGW",
  paris: "CDG",
  frankfurt: "FRA",
  amsterdam: "AMS",
  "new york": "JFK",
  nyc: "JFK",
  jfk: "JFK",
  newark: "EWR",
  chicago: "ORD",
  "san francisco": "SFO",
  "los angeles": "LAX",
  tokyo: "HND",
  toronto: "YYZ",
  sydney: "SYD",
  melbourne: "MEL",
};

/**
 * Resolves a city name, airport name, or IATA code to a standardized 3-letter IATA code.
 * E.g. "delhi" -> "DEL", "bombay" -> "BOM", "PATNA" -> "PAT", "del" -> "DEL".
 */
export function resolveAirportCode(input?: string | null): string | null {
  if (!input) return null;
  const clean = input.trim().toLowerCase();
  if (!clean) return null;

  // Direct alias check
  if (CITY_ALIASES[clean]) {
    return CITY_ALIASES[clean];
  }

  // Exact 3-letter IATA check
  if (clean.length === 3) {
    const uppercase = clean.toUpperCase();
    const match = airportsList.find((a) => a.iata === uppercase);
    if (match) return match.iata;
    // Allow uppercase 3-letter code even if not in standard dictionary
    if (/^[A-Z]{3}$/.test(uppercase)) return uppercase;
  }

  // City exact/starts-with check
  const cityMatch = airportsList.find(
    (a) =>
      a.city.toLowerCase() === clean ||
      a.name.toLowerCase().includes(clean) ||
      clean.includes(a.city.toLowerCase())
  );
  if (cityMatch) return cityMatch.iata;

  // Fallback: strip punctuation and test tokens
  const tokens = clean.replace(/[^a-z0-9\s]/g, "").split(/\s+/);
  for (const token of tokens) {
    if (token.length >= 3) {
      if (CITY_ALIASES[token]) return CITY_ALIASES[token];
      const match = airportsList.find((a) => a.city.toLowerCase() === token);
      if (match) return match.iata;
    }
  }

  return null;
}

/**
 * Returns the airport metadata for an IATA code.
 */
export function getAirportDetails(iata?: string | null): Airport | null {
  if (!iata) return null;
  const upper = iata.trim().toUpperCase();
  return airportsList.find((a) => a.iata === upper) || null;
}
