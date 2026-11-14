/**
 * AeroDrop High-Precision Flight Date & Timezone Engine (Phase 1)
 *
 * Provides deterministic calendar date math, IATA airport timezone resolution,
 * overnight flight (+1 / +2 days) detection, and date-only validation.
 *
 * CRITICAL ARCHITECTURAL SAFEGUARDS:
 * - NEVER passes date-only (YYYY-MM-DD) strings through `new Date(str)` UTC conversions.
 * - NEVER uses `toISOString().slice(0, 10)` to derive local calendar dates.
 * - Accurately derives origin and destination airport local times and day transitions.
 */

// Mapping of major domestic and international IATA airport codes to standard IANA timezones
export const AIRPORT_TIMEZONES: Record<string, string> = {
  // India (All Indian airports strictly observe India Standard Time - UTC+05:30)
  DEL: "Asia/Kolkata",
  BOM: "Asia/Kolkata",
  BLR: "Asia/Kolkata",
  MAA: "Asia/Kolkata",
  HYD: "Asia/Kolkata",
  CCU: "Asia/Kolkata",
  COK: "Asia/Kolkata",
  AMD: "Asia/Kolkata",
  GOI: "Asia/Kolkata",
  GOX: "Asia/Kolkata",
  PNQ: "Asia/Kolkata",
  JAI: "Asia/Kolkata",
  LKO: "Asia/Kolkata",
  ATQ: "Asia/Kolkata",
  IXC: "Asia/Kolkata",
  PAT: "Asia/Kolkata",
  BBI: "Asia/Kolkata",
  VNS: "Asia/Kolkata",
  SXR: "Asia/Kolkata",
  IXB: "Asia/Kolkata",
  GAU: "Asia/Kolkata",
  TRV: "Asia/Kolkata",
  CCJ: "Asia/Kolkata",
  IDR: "Asia/Kolkata",
  NAG: "Asia/Kolkata",
  UDR: "Asia/Kolkata",
  IXR: "Asia/Kolkata",
  VTZ: "Asia/Kolkata",
  IXM: "Asia/Kolkata",
  IXJ: "Asia/Kolkata",
  IXZ: "Asia/Kolkata",
  IXA: "Asia/Kolkata",
  IXE: "Asia/Kolkata",
  BDQ: "Asia/Kolkata",
  STV: "Asia/Kolkata",
  TIR: "Asia/Kolkata",
  RPR: "Asia/Kolkata",
  DED: "Asia/Kolkata",
  BHO: "Asia/Kolkata",

  // Middle East
  DXB: "Asia/Dubai",
  AUH: "Asia/Dubai",
  SHJ: "Asia/Dubai",
  DOH: "Asia/Qatar",
  BAH: "Asia/Bahrain",
  KWI: "Asia/Kuwait",
  MCT: "Asia/Muscat",
  RUH: "Asia/Riyadh",
  JED: "Asia/Riyadh",
  DMM: "Asia/Riyadh",
  AMM: "Asia/Amman",
  BEY: "Asia/Beirut",
  TLV: "Asia/Jerusalem",

  // Southeast Asia & Far East
  SIN: "Asia/Singapore",
  BKK: "Asia/Bangkok",
  DMK: "Asia/Bangkok",
  HKT: "Asia/Bangkok",
  KUL: "Asia/Kuala_Lumpur",
  PEN: "Asia/Kuala_Lumpur",
  CGK: "Asia/Jakarta",
  DPS: "Asia/Makassar",
  MNL: "Asia/Manila",
  HAN: "Asia/Ho_Chi_Minh",
  SGN: "Asia/Ho_Chi_Minh",
  HKG: "Asia/Hong_Kong",
  MFM: "Asia/Macau",
  TPE: "Asia/Taipei",
  KHH: "Asia/Taipei",
  NRT: "Asia/Tokyo",
  HND: "Asia/Tokyo",
  KIX: "Asia/Tokyo",
  ICN: "Asia/Seoul",
  GMP: "Asia/Seoul",
  PEK: "Asia/Shanghai",
  PKX: "Asia/Shanghai",
  PVG: "Asia/Shanghai",
  SHA: "Asia/Shanghai",
  CAN: "Asia/Shanghai",
  SZX: "Asia/Shanghai",

  // Europe & UK
  LHR: "Europe/London",
  LGW: "Europe/London",
  STN: "Europe/London",
  MAN: "Europe/London",
  EDI: "Europe/London",
  CDG: "Europe/Paris",
  ORY: "Europe/Paris",
  FRA: "Europe/Berlin",
  MUC: "Europe/Berlin",
  BER: "Europe/Berlin",
  AMS: "Europe/Amsterdam",
  BRU: "Europe/Brussels",
  ZRH: "Europe/Zurich",
  GVA: "Europe/Zurich",
  VIE: "Europe/Vienna",
  FCO: "Europe/Rome",
  MXP: "Europe/Rome",
  MAD: "Europe/Madrid",
  BCN: "Europe/Madrid",
  LIS: "Europe/Lisbon",
  OPO: "Europe/Lisbon",
  DUB: "Europe/Dublin",
  CPH: "Europe/Copenhagen",
  ARN: "Europe/Stockholm",
  OSL: "Europe/Oslo",
  HEL: "Europe/Helsinki",
  ATH: "Europe/Athens",
  IST: "Europe/Istanbul",
  SAW: "Europe/Istanbul",

  // North America
  JFK: "America/New_York",
  EWR: "America/New_York",
  LGA: "America/New_York",
  BOS: "America/New_York",
  IAD: "America/New_York",
  DCA: "America/New_York",
  PHL: "America/New_York",
  MIA: "America/New_York",
  MCO: "America/New_York",
  ATL: "America/New_York",
  YYZ: "America/Toronto",
  YUL: "America/Toronto",
  ORD: "America/Chicago",
  DFW: "America/Chicago",
  IAH: "America/Chicago",
  MSP: "America/Chicago",
  DEN: "America/Denver",
  SLC: "America/Denver",
  PHX: "America/Phoenix",
  LAX: "America/Los_Angeles",
  SFO: "America/Los_Angeles",
  SEA: "America/Los_Angeles",
  SAN: "America/Los_Angeles",
  LAS: "America/Los_Angeles",
  PDX: "America/Los_Angeles",
  YVR: "America/Vancouver",
  YYC: "America/Edmonton",
  HNL: "Pacific/Honolulu",
  ANC: "America/Anchorage",

  // Australia & New Zealand
  SYD: "Australia/Sydney",
  MEL: "Australia/Melbourne",
  BNE: "Australia/Brisbane",
  PER: "Australia/Perth",
  ADL: "Australia/Adelaide",
  AKL: "Pacific/Auckland",
  CHC: "Pacific/Auckland",

  // Africa & South America
  JNB: "Africa/Johannesburg",
  CPT: "Africa/Johannesburg",
  NBO: "Africa/Nairobi",
  CAI: "Africa/Cairo",
  GRU: "America/Sao_Paulo",
  EZE: "America/Argentina/Buenos_Aires",
  BOG: "America/Bogota",
  SCL: "America/Santiago",
};

/**
 * Returns the IANA timezone identifier for an airport IATA code.
 * Defaults to Asia/Kolkata for unrecognized domestic/global codes if unspecified.
 */
export function getAirportTimeZone(iata: string | null | undefined): string {
  if (!iata) return "Asia/Kolkata";
  const code = iata.trim().toUpperCase();
  return AIRPORT_TIMEZONES[code] || "Asia/Kolkata";
}

/**
 * Derives a pure ISO date-only string (YYYY-MM-DD) for a specific moment in a given timezone.
 * Uses Intl.DateTimeFormat with 'en-CA' locale which outputs YYYY-MM-DD strictly.
 * NEVER leaks UTC day slippage.
 */
export function getLocalDateString(date: Date = new Date(), timeZone = "Asia/Kolkata"): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date);
  } catch {
    // Deterministic fallback if invalid timezone passed
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}

/**
 * Resolves today's calendar date in the specified timezone.
 * Defaults to Asia/Kolkata (IST).
 */
export function getTodayDateString(timeZone = "Asia/Kolkata"): string {
  return getLocalDateString(new Date(), timeZone);
}

/**
 * Resolves tomorrow's calendar date in the specified timezone.
 * Guarantees that if today is 2026-11-14, tomorrow is 2026-11-15.
 */
export function getTomorrowDateString(timeZone = "Asia/Kolkata"): string {
  const todayStr = getTodayDateString(timeZone);
  return addDaysToDateOnly(todayStr, 1);
}

/**
 * Parses a YYYY-MM-DD string into numeric parts without Date object instantiation.
 */
export function parseDateOnly(dateStr: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) {
    throw new Error(`Invalid date-only format: "${dateStr}". Expected YYYY-MM-DD.`);
  }
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10),
  };
}

/**
 * Validates whether a year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the number of days in a given month and year.
 */
export function getDaysInMonth(year: number, month: number): number {
  const daysPerMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return daysPerMonth[month - 1] ?? 30;
}

/**
 * Safely adds or subtracts days to/from a YYYY-MM-DD string.
 * Handles month boundaries, leap years, and year boundaries with zero UTC conversion bugs.
 */
export function addDaysToDateOnly(dateStr: string, daysToAdd: number): string {
  const { year, month, day } = parseDateOnly(dateStr);
  let curYear = year;
  let curMonth = month;
  let curDay = day + daysToAdd;

  if (daysToAdd >= 0) {
    while (curDay > getDaysInMonth(curYear, curMonth)) {
      curDay -= getDaysInMonth(curYear, curMonth);
      curMonth += 1;
      if (curMonth > 12) {
        curMonth = 1;
        curYear += 1;
      }
    }
  } else {
    while (curDay < 1) {
      curMonth -= 1;
      if (curMonth < 1) {
        curMonth = 12;
        curYear -= 1;
      }
      curDay += getDaysInMonth(curYear, curMonth);
    }
  }

  const mm = String(curMonth).padStart(2, "0");
  const dd = String(curDay).padStart(2, "0");
  return `${curYear}-${mm}-${dd}`;
}

/**
 * Compares two YYYY-MM-DD strings.
 * Returns -1 if d1 < d2, 0 if d1 === d2, 1 if d1 > d2.
 */
export function compareDateOnly(d1: string, d2: string): number {
  if (d1 === d2) return 0;
  return d1 < d2 ? -1 : 1;
}

/**
 * Checks whether a given travel date string is in the past relative to the user's / airport's timezone.
 */
export function isDateInPast(dateStr: string, timeZone = "Asia/Kolkata"): boolean {
  const today = getTodayDateString(timeZone);
  return compareDateOnly(dateStr, today) < 0;
}

/**
 * Formats a YYYY-MM-DD string into human-friendly travel text (e.g. "Sun, 15 Nov 2026").
 * Does not shift calendar dates.
 */
export function formatCalendarDate(
  dateStr: string,
  options: { includeWeekday?: boolean; shortMonth?: boolean } = { includeWeekday: true, shortMonth: true },
): string {
  try {
    const { year, month, day } = parseDateOnly(dateStr);
    // Use UTC noon to safely extract weekday name without local timezone boundary shifting
    const utcRef = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const weekday = options.includeWeekday
      ? utcRef.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }) + ", "
      : "";
    const monthName = utcRef.toLocaleDateString("en-US", {
      month: options.shortMonth ? "short" : "long",
      timeZone: "UTC",
    });
    return `${weekday}${day} ${monthName} ${year}`;
  } catch {
    return dateStr;
  }
}

export interface FlightTimelineDetails {
  departureDateOnly: string;
  departureTimeLocal: string;
  arrivalDateOnly: string;
  arrivalTimeLocal: string;
  originTimeZone: string;
  destinationTimeZone: string;
  durationMinutes: number;
  durationFormatted: string;
  dayDifference: number; // 0 = same day, 1 = overnight (+1), 2 = +2 days, -1 = across dateline
  isOvernight: boolean;
}

/**
 * Accurately analyzes departure and arrival timestamps between origin and destination airports.
 * Calculates exact local times in each respective airport timezone and detects overnight flights.
 */
export function calculateFlightTimeline(params: {
  departureIso: string;
  arrivalIso?: string | null;
  durationMinutes?: number;
  originIata: string;
  destinationIata: string;
}): FlightTimelineDetails {
  const { departureIso, arrivalIso, durationMinutes: passedDuration, originIata, destinationIata } = params;

  const originTz = getAirportTimeZone(originIata);
  const destTz = getAirportTimeZone(destinationIata);

  const depDate = new Date(departureIso);
  if (Number.isNaN(depDate.getTime())) {
    throw new Error(`Invalid departure timestamp: "${departureIso}"`);
  }

  // Derive departure local details
  const departureDateOnly = getLocalDateString(depDate, originTz);
  const depTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: originTz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const departureTimeLocal = depTimeFormatter.format(depDate);

  // Derive arrival local details
  let arrDate: Date;
  let durationMinutes = passedDuration ?? 0;

  if (arrivalIso) {
    arrDate = new Date(arrivalIso);
    if (!Number.isNaN(arrDate.getTime()) && !passedDuration) {
      durationMinutes = Math.max(0, Math.round((arrDate.getTime() - depDate.getTime()) / 60_000));
    }
  } else if (passedDuration && passedDuration > 0) {
    arrDate = new Date(depDate.getTime() + passedDuration * 60_000);
  } else {
    // Default fallback: 2 hour flight
    durationMinutes = 120;
    arrDate = new Date(depDate.getTime() + 120 * 60_000);
  }

  const arrivalDateOnly = getLocalDateString(arrDate, destTz);
  const arrTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: destTz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const arrivalTimeLocal = arrTimeFormatter.format(arrDate);

  // Calculate day difference between departure date and arrival date
  const depParts = parseDateOnly(departureDateOnly);
  const arrParts = parseDateOnly(arrivalDateOnly);
  const depUtcRef = Date.UTC(depParts.year, depParts.month - 1, depParts.day);
  const arrUtcRef = Date.UTC(arrParts.year, arrParts.month - 1, arrParts.day);
  const dayDifference = Math.round((arrUtcRef - depUtcRef) / (86400 * 1000));

  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  const durationFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return {
    departureDateOnly,
    departureTimeLocal,
    arrivalDateOnly,
    arrivalTimeLocal,
    originTimeZone: originTz,
    destinationTimeZone: destTz,
    durationMinutes,
    durationFormatted,
    dayDifference,
    isOvernight: dayDifference > 0,
  };
}

/**
 * Strict validator: checks whether a returned flight's departure matches the requested YYYY-MM-DD.
 * Prevents provider fallback dates (e.g. December flight for a November query) from being presented to the user.
 */
export function validateFlightMatchesRequestedDate(
  flightDepartureIso: string,
  requestedDateOnly: string,
  originIata?: string,
): boolean {
  if (!flightDepartureIso || !requestedDateOnly) return false;
  const originTz = getAirportTimeZone(originIata);
  const depDate = new Date(flightDepartureIso);
  if (Number.isNaN(depDate.getTime())) return false;
  const actualDateOnly = getLocalDateString(depDate, originTz);
  return actualDateOnly === requestedDateOnly.trim();
}
