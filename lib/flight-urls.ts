/**
 * Helper to build verified deep-links for major flight search engines & OTAs
 * Supports: Google Flights, Skyscanner, MakeMyTrip, EaseMyTrip, Kayak, and Aviasales.
 */

export interface MultiSiteDealLink {
  id: string;
  name: string;
  tag: string;
  url: string;
  description: string;
  colorClass: string;
}

export function generateMultiSiteComparisonLinks(params: {
  origin: string;
  destination: string;
  departureDate: string; // YYYY-MM-DD
  returnDate?: string | null;
  tripType?: "one_way" | "round_trip";
  adults?: number;
  cabinClass?: string;
  marker?: string;
}): MultiSiteDealLink[] {
  const { origin, destination, departureDate, returnDate, marker = "804763" } = params;
  const orig = origin.toUpperCase();
  const dest = destination.toUpperCase();

  // 1. Google Flights
  const googleQuery = returnDate
    ? `Flights to ${dest} from ${orig} on ${departureDate} through ${returnDate}`
    : `Flights to ${dest} from ${orig} on ${departureDate}`;
  const googleFlightsUrl = `https://www.google.com/travel/flights?q=${encodeURIComponent(googleQuery)}`;

  // 2. Skyscanner India / Global
  // Format YYMMDD for Skyscanner routes
  const depYYMMDD = departureDate ? departureDate.slice(2).replace(/-/g, "") : "";
  const retYYMMDD = returnDate ? returnDate.slice(2).replace(/-/g, "") : "";
  const skyscannerPath = returnDate
    ? `${orig.toLowerCase()}/${dest.toLowerCase()}/${depYYMMDD}/${retYYMMDD}`
    : `${orig.toLowerCase()}/${dest.toLowerCase()}/${depYYMMDD}`;
  const skyscannerUrl = `https://www.skyscanner.co.in/transport/flights/${skyscannerPath}/?adultsv2=1&cabinclass=economy`;

  // 3. MakeMyTrip (India's #1 OTA)
  // Format: DD/MM/YYYY for MMT
  const [depY, depM, depD] = (departureDate || "").split("-");
  const mmtDepDate = depD && depM && depY ? `${depD}/${depM}/${depY}` : departureDate;
  const mmtUrl = `https://www.makemytrip.com/flight/search?itinerary=${orig}-${dest}-${mmtDepDate}&tripType=${returnDate ? "R" : "O"}&paxType=A-1_C-0_I-0&intl=false&cabinClass=E`;

  // 4. EaseMyTrip (Zero convenience fee platform)
  const [emY, emM, emD] = (departureDate || "").split("-");
  const emtDepDate = emD && emM && emY ? `${emD}/${emM}/${emY}` : departureDate;
  const easeMyTripUrl = `https://flight.easemytrip.com/FlightList/Index?srch=${orig}-${dest}-${emtDepDate}&px=1-0-0&cbn=0&ar=undefined&isSplit=false`;

  // 5. Kayak
  const kayakUrl = returnDate
    ? `https://www.kayak.co.in/flights/${orig}-${dest}/${departureDate}/${returnDate}`
    : `https://www.kayak.co.in/flights/${orig}-${dest}/${departureDate}`;

  // 6. Aviasales / Travelpayouts (100+ partner airlines & OTA aggregator)
  const aviasalesUrl = `https://www.aviasales.com/search/${orig}${depYYMMDD}${dest}1?marker=${marker}`;

  return [
    {
      id: "google_flights",
      name: "Google Flights",
      tag: "Live Airline Directs",
      url: googleFlightsUrl,
      description: "Compare real-time airline direct pricing and historical calendar matrices.",
      colorClass: "from-blue-500/20 to-indigo-500/10 text-blue-500 border-blue-500/30",
    },
    {
      id: "skyscanner",
      name: "Skyscanner",
      tag: "Global Metasearch",
      url: skyscannerUrl,
      description: "Aggregates 1,200+ global flight agencies, discounters, and low-cost carriers.",
      colorClass: "from-sky-500/20 to-cyan-500/10 text-sky-500 border-sky-500/30",
    },
    {
      id: "makemytrip",
      name: "MakeMyTrip",
      tag: "Major Indian OTA",
      url: mmtUrl,
      description: "Check exclusive bank cards, cashback coupons, and domestic flash promotions.",
      colorClass: "from-red-500/20 to-orange-500/10 text-red-500 border-red-500/30",
    },
    {
      id: "easemytrip",
      name: "EaseMyTrip",
      tag: "Zero Convenience Fee",
      url: easeMyTripUrl,
      description: "Frequently offers the lowest net checkout total without convenience charges.",
      colorClass: "from-amber-500/20 to-yellow-500/10 text-amber-500 border-amber-500/30",
    },
    {
      id: "kayak",
      name: "Kayak",
      tag: "Fare Forecaster",
      url: kayakUrl,
      description: "Advanced multi-airline hacker fares and rate fluctuation forecasts.",
      colorClass: "from-orange-500/20 to-amber-500/10 text-orange-500 border-orange-500/30",
    },
    {
      id: "aviasales",
      name: "Aviasales Network",
      tag: "100+ OTA Aggregator",
      url: aviasalesUrl,
      description: "AeroDrop's primary scanning source aggregating 100+ ticket providers.",
      colorClass: "from-emerald-500/20 to-teal-500/10 text-emerald-500 border-emerald-500/30",
    },
  ];
}
