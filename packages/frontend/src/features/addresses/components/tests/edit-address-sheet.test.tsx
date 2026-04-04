import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { EditAddressSheet } from "@/features/addresses/components/edit-address-sheet";
import { useUpdateAddressMutation } from "@/features/addresses/hooks/use-addresses";

vi.mock("@/features/addresses/hooks/use-addresses", () => ({
  useUpdateAddressMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    promise: vi.fn(),
  },
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SheetDescription: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props}>{children}</p>
  ),
  SheetFooter: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SheetHeader: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SheetTitle: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props}>{children}</h2>
  ),
}));

const mockedUseUpdateAddressMutation = vi.mocked(useUpdateAddressMutation);
const mockedToastPromise = vi.mocked(toast.promise);

const updateMutation = {
  isPending: false,
  mutateAsync: vi.fn(),
};

const baseAddress = {
  id: "address-1",
  address: "hello@example.com",
  localPart: "hello",
  domain: "example.com",
  allowedFromDomains: [],
  maxReceivedEmailCount: null,
  maxReceivedEmailAction: null,
  createdAt: null,
  createdAtMs: null,
  expiresAt: null,
  expiresAtMs: null,
  lastReceivedAt: null,
  lastReceivedAtMs: null,
};

const renderEditAddressSheet = (onOpenChange = vi.fn()) =>
  render(
    <EditAddressSheet
      address={baseAddress as never}
      domains={["example.com"]}
      open
      onOpenChange={onOpenChange}
    />
  );

describe("EditAddressSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMutation.mutateAsync.mockReset();
    mockedToastPromise.mockImplementation(((
      promise: PromiseLike<unknown> | (() => PromiseLike<unknown>)
    ) => ({
      unwrap: () =>
        typeof promise === "function"
          ? Promise.resolve(promise())
          : Promise.resolve(promise),
    })) as typeof toast.promise);
  });

  it("only shows the username change warning when the username is edited", () => {
    mockedUseUpdateAddressMutation.mockReturnValue(
      updateMutation as unknown as ReturnType<typeof useUpdateAddressMutation>
    );

    renderEditAddressSheet();

    expect(
      screen.queryByText("Changing the username replaces this address")
    ).toBeNull();
    expect(
      screen.queryByLabelText(
        "I understand the consequences of changing username."
      )
    ).toBeNull();

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "hello-2" },
    });

    expect(
      screen.getByText("Changing the username replaces this address")
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        "I understand the consequences of changing username."
      )
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "hello" },
    });

    expect(
      screen.queryByText("Changing the username replaces this address")
    ).toBeNull();
  });

  it("blocks submit until the username change is acknowledged", async () => {
    updateMutation.mutateAsync.mockResolvedValue(undefined);
    mockedUseUpdateAddressMutation.mockReturnValue(
      updateMutation as unknown as ReturnType<typeof useUpdateAddressMutation>
    );

    renderEditAddressSheet();

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "hello-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateMutation.mutateAsync).not.toHaveBeenCalled()
    );
    expect(
      screen.getByText(
        "You must confirm that changing the username disables the old address"
      )
    ).toBeTruthy();
  });

  it("allows submit without the extra acknowledgment when the username is unchanged", async () => {
    const onOpenChange = vi.fn();

    updateMutation.mutateAsync.mockResolvedValue(undefined);
    mockedUseUpdateAddressMutation.mockReturnValue(
      updateMutation as unknown as ReturnType<typeof useUpdateAddressMutation>
    );
    renderEditAddressSheet(onOpenChange);

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
        addressId: "address-1",
        payload: {
          localPart: "hello",
          domain: "example.com",
          ttlMinutes: null,
          allowedFromDomains: [],
          maxReceivedEmailCount: null,
          maxReceivedEmailAction: undefined,
        },
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits after the username change is acknowledged", async () => {
    const onOpenChange = vi.fn();

    updateMutation.mutateAsync.mockResolvedValue(undefined);
    mockedUseUpdateAddressMutation.mockReturnValue(
      updateMutation as unknown as ReturnType<typeof useUpdateAddressMutation>
    );
    renderEditAddressSheet(onOpenChange);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "hello-2" },
    });
    fireEvent.click(
      screen.getByLabelText(
        "I understand the consequences of changing username."
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
        addressId: "address-1",
        payload: {
          localPart: "hello-2",
          domain: "example.com",
          ttlMinutes: null,
          allowedFromDomains: [],
          maxReceivedEmailCount: null,
          maxReceivedEmailAction: undefined,
        },
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
