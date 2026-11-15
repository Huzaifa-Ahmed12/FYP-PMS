"use client";
import { useState, type ReactNode } from "react";
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { Button, EmptyState, Input, Skeleton } from "./ui";

export function DataTable<T>({ data, columns, searchPlaceholder = "Search…", pageSize = 8, toolbar, onRowClick, loading, emptyTitle = "Nothing to show" }: {
  data: T[]; columns: ColumnDef<T>[]; searchPlaceholder?: string; pageSize?: number; toolbar?: ReactNode;
  onRowClick?: (row: T) => void; loading?: boolean; emptyTitle?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filter, setFilter] = useState("");
  const table = useReactTable({
    data, columns, state: { sorting, globalFilter: filter }, onSortingChange: setSorting, onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize } },
  });
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <div className="relative w-full max-w-xs"><Search size={15} className="absolute left-3 top-3 opacity-60" aria-hidden /><Input aria-label="Search table" className="pl-9" placeholder={searchPlaceholder} value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
        {toolbar}
      </div>
      <div className="overflow-x-auto rounded-lg border border-ink/25">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink text-paper">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>{hg.headers.map((h) => (
                <th key={h.id} className="whitespace-nowrap px-3 py-2 font-semibold">
                  {h.column.getCanSort() ? (
                    <button className="inline-flex items-center gap-1" onClick={h.column.getToggleSortingHandler()}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getIsSorted() === "asc" ? <ArrowUp size={12} /> : h.column.getIsSorted() === "desc" ? <ArrowDown size={12} /> : null}
                    </button>
                  ) : flexRender(h.column.columnDef.header, h.getContext())}
                </th>))}</tr>
            ))}
          </thead>
          <tbody>
            {loading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={columns.length} className="p-2"><Skeleton className="h-6 w-full" /></td></tr>)
              : table.getRowModel().rows.map((r) => (
                <tr key={r.id} onClick={() => onRowClick?.(r.original)} className={`border-t border-ink/15 odd:bg-ink/[0.03] ${onRowClick ? "cursor-pointer hover:bg-accent/20" : ""}`}>
                  {r.getVisibleCells().map((c) => <td key={c.id} className="px-3 py-2 align-middle">{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}
                </tr>))}
          </tbody>
        </table>
        {!loading && table.getRowModel().rows.length === 0 && <div className="p-4"><EmptyState title={emptyTitle} text="Try changing the search or filters." /></div>}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs print:hidden">
        <span>{table.getFilteredRowModel().rows.length} record(s)</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>Prev</Button>
          <span>Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}</span>
          <Button size="sm" variant="outline" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Next</Button>
        </div>
      </div>
    </div>
  );
}