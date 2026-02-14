import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EmailAddress } from "@/lib/api";
import { cn } from "@/lib/utils";

const RECENT_ROWS_LIMIT = 8;

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatDateTime = (value: string | null) => {
  if (!value) return "Never";
  return dateTimeFormatter.format(new Date(value));
};

type ActivityRow = {
  id: string;
  address: string;
  createdAt: string | null;
  createdAtMs: number | null;
  lastReceivedAt: string | null;
  lastReceivedAtMs: number | null;
  recentActivityMs: number;
  expiresAt: string | null;
};

const toTimestamp = (value: string | null, fallback: number | null) => {
  if (fallback !== null && !Number.isNaN(fallback)) return fallback;
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const getLifecycleBadge = (expiresAt: string | null) => {
  if (!expiresAt) {
    return <Badge variant="secondary">Active</Badge>;
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return <Badge variant="outline">Expiring</Badge>;
  }

  if (expiresAtMs <= Date.now()) {
    return <Badge variant="destructive">Expired</Badge>;
  }

  return <Badge variant="outline">Expires {formatDateTime(expiresAt)}</Badge>;
};

type RecentAddressActivityCardProps = {
  addresses: EmailAddress[];
  errorMessage: string | null;
  isLoading: boolean;
};

const getSortIcon = (direction: false | "asc" | "desc") => {
  if (direction === "asc") return <ArrowUp className="size-3.5" />;
  if (direction === "desc") return <ArrowDown className="size-3.5" />;
  return <ArrowUpDown className="size-3.5 text-muted-foreground" />;
};

export const RecentAddressActivityCard = ({
  addresses,
  errorMessage,
  isLoading,
}: RecentAddressActivityCardProps) => {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "recentActivityMs", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const cycleSorting = React.useCallback(
    (columnId: string, direction: false | "asc" | "desc") => {
      if (direction === false) {
        setSorting([{ id: columnId, desc: false }]);
        return;
      }

      if (direction === "asc") {
        setSorting([{ id: columnId, desc: true }]);
        return;
      }

      setSorting([]);
    },
    []
  );

  const recentRows = React.useMemo<ActivityRow[]>(() => {
    const allRows = addresses.map(address => {
      const createdAtMs = toTimestamp(address.createdAt, address.createdAtMs);
      const lastReceivedAtMs = toTimestamp(
        address.lastReceivedAt,
        address.lastReceivedAtMs
      );
      const recentActivityMs =
        lastReceivedAtMs ?? createdAtMs ?? Number.NEGATIVE_INFINITY;

      return {
        id: address.id,
        address: address.address,
        createdAt: address.createdAt,
        createdAtMs,
        lastReceivedAt: address.lastReceivedAt,
        lastReceivedAtMs,
        recentActivityMs,
        expiresAt: address.expiresAt,
      };
    });

    return allRows
      .sort((left, right) => right.recentActivityMs - left.recentActivityMs)
      .slice(0, RECENT_ROWS_LIMIT);
  }, [addresses]);

  const columns = React.useMemo<ColumnDef<ActivityRow>[]>(
    () => [
      {
        accessorKey: "address",
        header: ({ column }) => {
          const sortDirection = column.getIsSorted();
          return (
            <Button
              className={cn(
                "-ml-2",
                sortDirection
                  ? "bg-muted hover:bg-muted"
                  : "text-muted-foreground"
              )}
              size="sm"
              variant="ghost"
              onClick={() => cycleSorting(column.id, sortDirection)}
            >
              Address
              {getSortIcon(sortDirection)}
            </Button>
          );
        },
        cell: ({ row }) => (
          <div className="max-w-2xs truncate font-mono text-xs sm:text-sm">
            {row.original.address}
          </div>
        ),
      },
      {
        accessorFn: row => row.recentActivityMs,
        id: "recentActivityMs",
        header: ({ column }) => {
          const sortDirection = column.getIsSorted();
          return (
            <Button
              className={cn(
                "-ml-2",
                sortDirection
                  ? "bg-muted hover:bg-muted"
                  : "text-muted-foreground"
              )}
              size="sm"
              variant="ghost"
              onClick={() => cycleSorting(column.id, sortDirection)}
            >
              Last Activity
              {getSortIcon(sortDirection)}
            </Button>
          );
        },
        cell: ({ row }) =>
          row.original.lastReceivedAt ? (
            formatDateTime(row.original.lastReceivedAt)
          ) : (
            <span className="text-muted-foreground">No email yet</span>
          ),
      },
      {
        accessorKey: "createdAtMs",
        header: ({ column }) => {
          const sortDirection = column.getIsSorted();
          return (
            <Button
              className={cn(
                "-ml-2",
                sortDirection
                  ? "bg-muted hover:bg-muted"
                  : "text-muted-foreground"
              )}
              size="sm"
              variant="ghost"
              onClick={() => cycleSorting(column.id, sortDirection)}
            >
              Created
              {getSortIcon(sortDirection)}
            </Button>
          );
        },
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
      {
        accessorKey: "expiresAt",
        header: "Status",
        cell: ({ row }) => getLifecycleBadge(row.original.expiresAt),
      },
    ],
    [cycleSorting]
  );

  const table = useReactTable({
    data: recentRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    state: {
      columnFilters,
      sorting,
    },
  });

  const addressFilterValue =
    (table.getColumn("address")?.getFilterValue() as string) ?? "";

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="text-md">Recent Address Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            <span>Loading activity...</span>
          </div>
        ) : errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : recentRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No addresses yet. Create one to begin.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <Input
                value={addressFilterValue}
                onChange={event =>
                  table.getColumn("address")?.setFilterValue(event.target.value)
                }
                className={cn(
                  "w-full sm:max-w-xs",
                  addressFilterValue &&
                    "border-primary/50 bg-muted/40 ring-1 ring-primary/25"
                )}
                placeholder="Filter by address..."
              />
              <p className="text-xs text-muted-foreground">
                Showing {table.getRowModel().rows.length} of {recentRows.length}{" "}
                recent addresses ({addresses.length} total)
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-border/70">
              <Table className="min-w-[640px]">
                <TableHeader>
                  {table.getHeaderGroups().map(headerGroup => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length > 0 ? (
                    table.getRowModel().rows.map(row => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map(cell => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        className="h-20 text-center text-muted-foreground"
                        colSpan={columns.length}
                      >
                        No addresses match this filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
