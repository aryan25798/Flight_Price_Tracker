/**
 * OAG Aviation Intelligence Adapter
 * Interfaces with official OAG REST APIs:
 * - Flight Info Instances API (Schedules, Terminal info, Aircraft Equipment, Codeshares)
 * - Flight Info Connections API (Multi-leg routing, transfer points, elapsed time)
 * - Platform Master Data API (Airlines, Airports, Equipment)
 */

export interface OAGFlightDetails {
  carrierIata: string;
  carrierIcao?: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
  departureTimeLocal?: string;
  arrivalTimeLocal?: string;
  elapsedMinutes?: number;
  aircraftIata?: string;
  aircraftIcao?: string;
  aircraftName?: string;
  distanceKm?: number;
  distanceMiles?: number;
  codeshares?: string[];
  flightType?: string;
}

export interface OAGConnectionOption {
  origin: string;
  destination: string;
  elapsedMinutes: number;
  daysOfOperation: string[];
  departureCity?: string;
  arrivalCity?: string;
}

// Global IATA/ICAO aircraft dictionary for immediate display resolution
const AIRCRAFT_NAME_MAP: Record<string, string> = {
  // Airbus Narrowbody
  "32Q": "Airbus A321neo",
  "A21N": "Airbus A321neo",
  "32N": "Airbus A320neo",
  "A20N": "Airbus A320neo",
  "320": "Airbus A320-200",
  "A320": "Airbus A320-200",
  "321": "Airbus A321-200",
  "A321": "Airbus A321-200",
  "319": "Airbus A319",
  "A319": "Airbus A319",
  "223": "Airbus A220-300",
  "BCS3": "Airbus A220-300",
  "221": "Airbus A220-100",
  "BCS1": "Airbus A220-100",

  // Airbus Widebody
  "359": "Airbus A350-900",
  "A359": "Airbus A350-900",
  "351": "Airbus A350-1000",
  "A35K": "Airbus A350-1000",
  "333": "Airbus A330-300",
  "A333": "Airbus A330-300",
  "332": "Airbus A330-200",
  "A332": "Airbus A330-200",
  "339": "Airbus A330-900neo",
  "A339": "Airbus A330-900neo",
  "388": "Airbus A380-800",
  "A388": "Airbus A380-800",

  // Boeing Narrowbody
  "738": "Boeing 737-800",
  "B738": "Boeing 737-800",
  "739": "Boeing 737-900",
  "B739": "Boeing 737-900",
  "737": "Boeing 737-700",
  "B737": "Boeing 737-700",
  "73H": "Boeing 737 MAX 8",
  "B38M": "Boeing 737 MAX 8",
  "7M8": "Boeing 737 MAX 8",
  "7M9": "Boeing 737 MAX 9",
  "B39M": "Boeing 737 MAX 9",

  // Boeing Widebody
  "77W": "Boeing 777-300ER",
  "B77W": "Boeing 777-300ER",
  "772": "Boeing 777-200LR",
  "B772": "Boeing 777-200LR",
  "788": "Boeing 787-8 Dreamliner",
  "B788": "Boeing 787-8 Dreamliner",
  "789": "Boeing 787-9 Dreamliner",
  "B789": "Boeing 787-9 Dreamliner",
  "78X": "Boeing 787-10 Dreamliner",
  "B78X": "Boeing 787-10 Dreamliner",
  "744": "Boeing 744-400",
  "748": "Boeing 747-8 Intercontinental",

  // Regional Turboprops & Jets
  "AT7": "ATR 72-600",
  "AT76": "ATR 72-600",
  "AT4": "ATR 42-600",
  "DH4": "De Havilland Dash 8-400",
  "DH8D": "De Havilland Dash 8-400",
  "E75": "Embraer E175",
  "E75L": "Embraer E175",
  "E90": "Embraer E190",
  "E190": "Embraer E190",
  "E95": "Embraer E195",
  "E195": "Embraer E195",
  "295": "Embraer E195-E2",
};

// In-memory cache for OAG queries to eliminate redundant API requests and respect limits
const instanceCache = new Map<string, { data: OAGFlightDetails | null; expiry: number }>();
const routeCache = new Map<string, { data: OAGFlightDetails[]; expiry: number }>();
const connectionCache = new Map<string, { data: OAGConnectionOption[]; expiry: number }>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export class OAGAdapter {
  private static getFlightInfoKey(): string | null {
    return (
      process.env.OAG_FLIGHT_INFO_KEY ||
      process.env.OAG_API_KEY ||
      null
    );
  }

  private static getConnectionsKey(): string | null {
    return (
      process.env.OAG_FLIGHT_CONNECTIONS_KEY ||
      this.getFlightInfoKey() ||
      null
    );
  }

  private static getMasterDataKey(): string | null {
    return (
      process.env.OAG_MASTER_DATA_KEY ||
      this.getFlightInfoKey() ||
      null
    );
  }

  public static isFlightInfoConfigured(): boolean {
    return Boolean(this.getFlightInfoKey());
  }

  public static isConnectionsConfigured(): boolean {
    return Boolean(this.getConnectionsKey());
  }

  public static isMasterDataConfigured(): boolean {
    return Boolean(this.getMasterDataKey());
  }

  /**
   * Resolve aircraft code to a clean passenger-friendly equipment name.
   */
  public static resolveAircraftName(iataCode?: string, icaoCode?: string): string {
    if (iataCode && AIRCRAFT_NAME_MAP[iataCode.toUpperCase()]) {
      return AIRCRAFT_NAME_MAP[iataCode.toUpperCase()];
    }
    if (icaoCode && AIRCRAFT_NAME_MAP[icaoCode.toUpperCase()]) {
      return AIRCRAFT_NAME_MAP[icaoCode.toUpperCase()];
    }
    if (iataCode && icaoCode) {
      return `${icaoCode} / ${iataCode}`;
    }
    return iataCode || icaoCode || "Commercial Jet";
  }

  /**
   * Look up exact scheduled flight details (terminal, aircraft, distance, codeshares)
   * for a specific carrier and flight number.
   */
  public static async lookupFlightDetails(params: {
    carrierCode: string;
    flightNumber: string | number;
    departureDate: string;
  }): Promise<OAGFlightDetails | null> {
    const key = this.getFlightInfoKey();
    if (!key) return null;

    const carrier = params.carrierCode.trim().toUpperCase();
    const cleanFlightNumber = String(params.flightNumber).replace(/^[A-Za-z0-9]{2}\s*/, "").replace(/\D/g, "");
    if (!cleanFlightNumber) return null;

    const cacheKey = `inst_${carrier}_${cleanFlightNumber}_${params.departureDate}`;
    const cached = instanceCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    try {
      const url = `https://api.oag.com/flight-instances?CarrierCode=${encodeURIComponent(carrier)}&FlightNumber=${encodeURIComponent(cleanFlightNumber)}&DepartureDateTime=${encodeURIComponent(params.departureDate)}&CodeType=IATA&version=v2`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Subscription-Key": key,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        // Cache negative result briefly to avoid hammering
        instanceCache.set(cacheKey, { data: null, expiry: Date.now() + 10 * 60 * 1000 });
        return null;
      }

      const body = await res.json();
      const instance = body.data?.[0];
      if (!instance) {
        instanceCache.set(cacheKey, { data: null, expiry: Date.now() + 10 * 60 * 1000 });
        return null;
      }

      const aircraftIata = instance.aircraftType?.iata || "";
      const aircraftIcao = instance.aircraftType?.icao || "";
      const aircraftName = this.resolveAircraftName(aircraftIata, aircraftIcao);

      const details: OAGFlightDetails = {
        carrierIata: instance.carrier?.iata || carrier,
        carrierIcao: instance.carrier?.icao,
        flightNumber: String(instance.flightNumber || cleanFlightNumber),
        departureAirport: instance.departure?.airport?.iata || "",
        arrivalAirport: instance.arrival?.airport?.iata || "",
        departureTerminal: instance.departure?.terminal ? `Terminal ${instance.departure.terminal}` : undefined,
        arrivalTerminal: instance.arrival?.terminal ? `Terminal ${instance.arrival.terminal}` : undefined,
        departureTimeLocal: instance.departure?.time?.local,
        arrivalTimeLocal: instance.arrival?.time?.local,
        elapsedMinutes: instance.elapsedTime,
        aircraftIata,
        aircraftIcao,
        aircraftName,
        distanceKm: instance.distance?.accumulatedGreatCircleKilometers,
        distanceMiles: instance.distance?.accumulatedGreatCircleMiles,
        codeshares: Array.isArray(instance.codeshare?.marketingFlights)
          ? instance.codeshare.marketingFlights.map((m: { code: string; serviceNumber: string }) => `${m.code} ${m.serviceNumber}`)
          : undefined,
        flightType: instance.flightType,
      };

      instanceCache.set(cacheKey, { data: details, expiry: Date.now() + CACHE_TTL_MS });
      return details;
    } catch {
      return null;
    }
  }

  /**
   * Look up all scheduled flights on a given route from OAG Flight Info.
   */
  public static async lookupRouteInstances(params: {
    origin: string;
    destination: string;
    departureDate: string;
  }): Promise<OAGFlightDetails[]> {
    const key = this.getFlightInfoKey();
    if (!key) return [];

    const origin = params.origin.trim().toUpperCase();
    const destination = params.destination.trim().toUpperCase();
    const cacheKey = `route_${origin}_${destination}_${params.departureDate}`;

    const cached = routeCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    try {
      const url = `https://api.oag.com/flight-instances?DepartureAirport=${encodeURIComponent(origin)}&ArrivalAirport=${encodeURIComponent(destination)}&DepartureDateTime=${encodeURIComponent(params.departureDate)}&CodeType=IATA&version=v2`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Subscription-Key": key,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        routeCache.set(cacheKey, { data: [], expiry: Date.now() + 10 * 60 * 1000 });
        return [];
      }

      const body = await res.json();
      if (!Array.isArray(body.data)) {
        return [];
      }

      const flights: OAGFlightDetails[] = body.data.map((instance: any) => {
        const aircraftIata = instance.aircraftType?.iata || "";
        const aircraftIcao = instance.aircraftType?.icao || "";
        const aircraftName = this.resolveAircraftName(aircraftIata, aircraftIcao);

        return {
          carrierIata: instance.carrier?.iata || "",
          carrierIcao: instance.carrier?.icao,
          flightNumber: String(instance.flightNumber || ""),
          departureAirport: instance.departure?.airport?.iata || origin,
          arrivalAirport: instance.arrival?.airport?.iata || destination,
          departureTerminal: instance.departure?.terminal ? `Terminal ${instance.departure.terminal}` : undefined,
          arrivalTerminal: instance.arrival?.terminal ? `Terminal ${instance.arrival.terminal}` : undefined,
          departureTimeLocal: instance.departure?.time?.local,
          arrivalTimeLocal: instance.arrival?.time?.local,
          elapsedMinutes: instance.elapsedTime,
          aircraftIata,
          aircraftIcao,
          aircraftName,
          distanceKm: instance.distance?.accumulatedGreatCircleKilometers,
          distanceMiles: instance.distance?.accumulatedGreatCircleMiles,
          codeshares: Array.isArray(instance.codeshare?.marketingFlights)
            ? instance.codeshare.marketingFlights.map((m: { code: string; serviceNumber: string }) => `${m.code} ${m.serviceNumber}`)
            : undefined,
          flightType: instance.flightType,
        };
      });

      routeCache.set(cacheKey, { data: flights, expiry: Date.now() + CACHE_TTL_MS });
      return flights;
    } catch {
      return [];
    }
  }

  /**
   * Look up multi-leg connection routes via OAG Flight Info Connections API.
   */
  public static async lookupConnections(params: {
    origin: string;
    destination: string;
    departureDate: string;
  }): Promise<OAGConnectionOption[]> {
    const key = this.getConnectionsKey();
    if (!key) return [];

    const origin = params.origin.trim().toUpperCase();
    const destination = params.destination.trim().toUpperCase();
    const cacheKey = `conn_${origin}_${destination}_${params.departureDate}`;

    const cached = connectionCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    try {
      const url = `https://api.oag.com/flight-connections?DepartureAirport=${encodeURIComponent(origin)}&ArrivalAirport=${encodeURIComponent(destination)}&DepartureDate=${encodeURIComponent(params.departureDate)}&version=v1`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Subscription-Key": key,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        connectionCache.set(cacheKey, { data: [], expiry: Date.now() + 10 * 60 * 1000 });
        return [];
      }

      const body = await res.json();
      if (!Array.isArray(body.data)) {
        return [];
      }

      const connections: OAGConnectionOption[] = body.data.slice(0, 10).map((c: any) => ({
        origin: c.departure?.airport?.iata || origin,
        destination: c.arrival?.airport?.iata || destination,
        elapsedMinutes: c.elapsedTime || 0,
        daysOfOperation: Array.isArray(c.daysOfOperation) ? c.daysOfOperation : [],
        departureCity: c.departure?.cityCode,
        arrivalCity: c.arrival?.cityCode,
      }));

      connectionCache.set(cacheKey, { data: connections, expiry: Date.now() + CACHE_TTL_MS });
      return connections;
    } catch {
      return [];
    }
  }
}
