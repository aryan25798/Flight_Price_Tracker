export type UserRole = "user" | "super_admin";
export type TripType = "one_way" | "round_trip";
export type CabinClass = "economy" | "premium_economy" | "business" | "first";
export type SupportedCurrency = "INR" | "USD" | "EUR" | "GBP" | "AED" | "SGD";
export type RouteStatus = "active" | "paused" | "expired" | "failed";

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  is_banned: boolean;
  telegram_chat_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonitoredRoute {
  id: string;
  route_key: string;
  origin: string;
  destination: string;
  departure_date: string;
  return_date: string | null;
  provider: string;
  last_checked_at: string | null;
  next_check_at: string | null;
  last_price: number | null;
  last_airline: string | null;
  last_booking_url: string | null;
  status: RouteStatus;
  failure_count: number;
}

export interface TrackedFlight {
  id: string;
  user_id: string;
  route_id: string;
  origin: string;
  destination: string;
  departure_date: string;
  return_date: string | null;
  trip_type: TripType;
  adults: number;
  children: number;
  infants: number;
  cabin_class: CabinClass;
  currency: SupportedCurrency;
  target_price: number;
  last_seen_price: number | null;
  last_notified_price: number | null;
  last_notified_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  monitored_routes?: {
    last_checked_at: string | null;
    last_airline: string | null;
    last_booking_url: string | null;
    status: RouteStatus;
  } | null;
}

export interface PriceHistoryPoint {
  id: string;
  route_id: string;
  price: number;
  currency: string;
  airline: string | null;
  booking_url: string | null;
  provider: string;
  checked_at: string;
}

export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
}
