import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteErrorPage } from "@/pages/route-error-page";
import { isRouteErrorResponse, useRouteError } from "react-router";

vi.mock("react-router", async importOriginal => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useRouteError: vi.fn(),
    isRouteErrorResponse: vi.fn(),
  };
});

const mockedUseRouteError = vi.mocked(useRouteError);
const mockedIsRouteErrorResponse = vi.mocked(isRouteErrorResponse);

describe("RouteErrorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders status and statusText for route error responses", () => {
    mockedUseRouteError.mockReturnValue({
      status: 404,
      statusText: "Not Found",
    } as ReturnType<typeof useRouteError>);
    mockedIsRouteErrorResponse.mockReturnValue(true);

    render(<RouteErrorPage />);

    expect(screen.getByText("404 Not Found")).toBeTruthy();
  });

  it("renders message from Error instances", () => {
    mockedUseRouteError.mockReturnValue(
      new Error("Loader crashed") as ReturnType<typeof useRouteError>
    );
    mockedIsRouteErrorResponse.mockReturnValue(false);

    render(<RouteErrorPage />);

    expect(screen.getByText("Loader crashed")).toBeTruthy();
  });

  it("falls back to generic message for unknown errors", () => {
    mockedUseRouteError.mockReturnValue({ foo: "bar" } as never);
    mockedIsRouteErrorResponse.mockReturnValue(false);

    render(<RouteErrorPage />);

    expect(
      screen.getByText("Something went wrong while loading this route.")
    ).toBeTruthy();
  });
});
