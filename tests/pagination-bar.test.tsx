import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaginationBar } from "@/components/ui/pagination-bar";

describe("AeroDrop Global Application-Wide Pagination Suite", () => {
  it("renders correct item count text and active page button", () => {
    render(
      <PaginationBar
        page={1}
        pageSize={10}
        total={45}
        itemLabel="trackers"
      />
    );

    expect(screen.getByText(/Showing/i)).toBeInTheDocument();
    expect(screen.getByText(/trackers/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
  });

  it("triggers onPageChange when page button or next/prev is clicked", () => {
    const handlePageChange = vi.fn();
    render(
      <PaginationBar
        page={2}
        pageSize={10}
        total={50}
        onPageChange={handlePageChange}
        itemLabel="routes"
      />
    );

    const page3Btn = screen.getByRole("button", { name: "Page 3" });
    fireEvent.click(page3Btn);
    expect(handlePageChange).toHaveBeenCalledWith(3);

    const prevBtn = screen.getByRole("button", { name: "Prev" });
    fireEvent.click(prevBtn);
    expect(handlePageChange).toHaveBeenCalledWith(1);

    const nextBtn = screen.getByRole("button", { name: "Next" });
    fireEvent.click(nextBtn);
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it("renders Next.js links when createPageUrl is supplied", () => {
    render(
      <PaginationBar
        page={1}
        pageSize={15}
        total={45}
        createPageUrl={(p) => `/dashboard/trackers?page=${p}&status=active`}
        itemLabel="trackers"
      />
    );

    const page2Button = screen.getByRole("button", { name: "Page 2" });
    const page2Link = page2Button.closest("a");
    expect(page2Link).toHaveAttribute("href", "/dashboard/trackers?page=2&status=active");

    const nextButton = screen.getByRole("button", { name: "Next" });
    const nextLink = nextButton.closest("a");
    expect(nextLink).toHaveAttribute("href", "/dashboard/trackers?page=2&status=active");
  });

  it("disables Prev button on page 1 and Next button on last page", () => {
    const { rerender } = render(
      <PaginationBar
        page={1}
        pageSize={10}
        total={30}
        itemLabel="users"
      />
    );

    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled();

    rerender(
      <PaginationBar
        page={3}
        pageSize={10}
        total={30}
        itemLabel="users"
      />
    );

    expect(screen.getByRole("button", { name: "Prev" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("handles page size selector when options and callback are passed", () => {
    const handlePageSizeChange = vi.fn();
    render(
      <PaginationBar
        page={1}
        pageSize={10}
        total={50}
        pageSizeOptions={[10, 25, 50]}
        onPageSizeChange={handlePageSizeChange}
        itemLabel="logs"
      />
    );

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "25" } });
    expect(handlePageSizeChange).toHaveBeenCalledWith(25);
  });

  it("displays 0 to 0 of 0 when total is 0", () => {
    render(
      <PaginationBar
        page={1}
        pageSize={10}
        total={0}
        itemLabel="results"
      />
    );

    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
