export type UserRole = "user" | "super_admin";
export type UserTier = "free" | "pro" | "enterprise";
export type TripType = "one_way" | "round_trip";
export type CabinClass = "economy" | "premium_economy" | "business" | "first";
export type SupportedCurrency = "INR" | "USD" | "EUR" | "GBP" | "AED" | "SGD";
export type RouteStatus = "active" | "paused" | "expired" | "failed";

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  tier: UserTier;
  custom_tracker_limit: number | null; // null = tier default, -1 = unlimited, >=0 = exact custom limit
  tier_notes?: string | null;
  is_banned: boolean;
  telegram_chat_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserQuota {
  tier: UserTier;
  effective_limit: number;
  current_count: number;
  is_unlimited: boolean;
  remaining: number;
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

export type NotificationType = "price_drop" | "status_update" | "test" | "system";
export type NotificationDeliveryStatus = "pending" | "sent" | "failed" | "skipped";

export interface NotificationLog {
  id: string;
  user_id: string;
  tracker_id: string | null;
  route_id: string | null;
  notification_type: NotificationType;
  previous_price: number | null;
  current_price: number | null;
  currency: string | null;
  delivery_status: NotificationDeliveryStatus;
  sent_at: string | null;
  error_message: string | null;
  idempotency_key: string | null;
  telegram_message_id: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  tracked_flights?: {
    origin: string;
    destination: string;
    departure_date: string;
    target_price: number;
    currency: string;
  } | null;
  monitored_routes?: {
    origin: string;
    destination: string;
    last_airline: string | null;
    last_booking_url: string | null;
  } | null;
}

export type AIScope = "user" | "admin";
export type AIMessageRole = "user" | "assistant" | "system" | "tool";

export interface AIConversation {
  id: string;
  user_id: string;
  title: string;
  scope: AIScope;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: AIMessageRole;
  content: string;
  tool_calls?: Record<string, unknown>[] | null;
  tool_results?: Record<string, unknown>[] | null;
  created_at: string;
}

export interface AIUsageLog {
  id: string;
  user_id: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  tool_execution_count: number;
  latency_ms: number;
  status: "success" | "error" | "rate_limited" | "quota_exhausted";
  error_message?: string | null;
  created_at: string;
}

export interface AIQuotaResult {
  allowed: boolean;
  reason?: "kill_switch_active" | "account_banned" | "quota_exceeded";
  message?: string;
  used_today?: number;
  remaining?: number;
  limit?: number;
}


