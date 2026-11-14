import { z } from "zod";
import { compareDateOnly, isDateInPast } from "@/lib/dates/flight-datetime";

export const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"] as const;
export const CABIN_CLASSES = ["economy", "premium_economy", "business", "first"] as const;

export const CreateTrackerSchema = z
  .object({
    origin: z
      .string()
      .trim()
      .length(3, "Select a valid 3-letter IATA airport")
      .transform((v) => v.toUpperCase()),
    destination: z
      .string()
      .trim()
      .length(3, "Select a valid 3-letter IATA airport")
      .transform((v) => v.toUpperCase()),
    departureDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Valid departure date required"),
    returnDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Valid return date required")
      .optional()
      .nullable()
      .or(z.literal("")),
    tripType: z.enum(["one_way", "round_trip"]),
    adults: z.coerce.number().int().min(1).max(9),
    children: z.coerce.number().int().min(0).max(8),
    infants: z.coerce.number().int().min(0).max(9),
    cabinClass: z.enum(CABIN_CLASSES),
    currency: z.enum(SUPPORTED_CURRENCIES),
    targetPrice: z.coerce
      .number()
      .positive("Target price must be greater than 0")
      .max(10_000_000, "Target price is too high"),
  })
  .refine((data) => data.origin !== data.destination, {
    message: "Origin and destination airports must be different",
    path: ["destination"],
  })
  .refine((data) => data.adults + data.children + data.infants <= 9, {
    message: "Total passengers cannot exceed 9",
    path: ["adults"],
  })
  .refine((data) => data.infants <= data.adults, {
    message: "Infants cannot exceed number of adults",
    path: ["infants"],
  })
  .refine(
    (data) => !isDateInPast(data.departureDate),
    {
      message: "Departure date cannot be in the past",
      path: ["departureDate"],
    },
  )
  .refine(
    (data) => {
      if (data.tripType === "round_trip") {
        return Boolean(data.returnDate) && compareDateOnly(data.returnDate ?? "", data.departureDate) >= 0;
      }
      return true;
    },
    {
      message: "Return date must be on or after departure date",
      path: ["returnDate"],
    },
  );

export type CreateTrackerInput = z.infer<typeof CreateTrackerSchema>;

export const LoginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const SignupSchema = LoginSchema.extend({
  confirmPassword: z.string().min(6, "Confirm your password"),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});
