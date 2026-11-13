import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AirportAutocomplete } from "@/components/airports/airport-autocomplete";

describe("AirportAutocomplete", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => [
        { iata: "DEL", name: "Indira Gandhi International Airport", city: "New Delhi", country: "India" },
        { iata: "BOM", name: "Chhatrapati Shivaji Maharaj International Airport", city: "Mumbai", country: "India" },
      ],
    }) as unknown as typeof fetch;
  });

  it("filters airports by city/IATA and selects an option on click", async () => {
    const onChange = vi.fn();
    render(
      <AirportAutocomplete
        id="origin-test"
        label="Origin Airport"
        value=""
        onChange={onChange}
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Mumbai" } });

    await waitFor(() => {
      expect(screen.getByText("BOM")).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByText("BOM"));
    expect(onChange).toHaveBeenCalledWith("BOM");
  });
});
