import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { ColumnInfo } from '@/types';

interface DataTableProps {
  data: any[];
  columns: ColumnInfo[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  onPaginationChange: (pagination: { pageIndex: number; pageSize: number }) => void;
  onRowClick: (row: any) => void;
  primaryKeyColumn: string;
  globalFilter: string;
}

export function DataTable({
  data,
  columns,
  totalCount,
  pageIndex,
  pageSize,
  onPaginationChange,
  onRowClick,
  primaryKeyColumn: _primaryKeyColumn,
  globalFilter: externalGlobalFilter,
}: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Create table columns with unique IDs
  const tableColumns = useMemo<ColumnDef<any>[]>(() => {
    const usedIds = new Set<string>();
    
    return columns.map((column) => {
      let columnId = column.column_name;
      let counter = 1;
      
      // Ensure unique ID by appending counter if needed
      while (usedIds.has(columnId)) {
        columnId = `${column.column_name}_${counter}`;
        counter++;
      }
      usedIds.add(columnId);
      
      return {
        id: columnId,
        accessorKey: column.column_name,
        header: ({ column: col }) => {
          return (
          <Button
            variant="ghost"
            onClick={() => col.toggleSorting(col.getIsSorted() === 'asc')}
            className="h-8 p-0 font-medium"
          >
            <div className="flex flex-col items-start">
              <span>{column.column_name}</span>
              <span className="text-xs text-muted-foreground font-normal">
                {column.data_type}
                {column.is_primary_key && ' (PK)'}
                {column.is_nullable === 'NO' && ' *'}
              </span>
            </div>
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row, column: _col }) => {
        const value = row.getValue(column.column_name);

        return (
          <div className="p-2 truncate">
            {value === null || value === undefined ? (
              <span className="text-muted-foreground italic">NULL</span>
            ) : column.data_type.includes('bool') ? (
              <span className={value ? 'text-green-600' : 'text-red-600'}>
                {value?.toString()}
              </span>
            ) : (
              value?.toString()
            )}
          </div>
        );
      },
      enableSorting: true,
      enableColumnFilter: true,
    }));
  }, [columns]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      columnFilters,
      globalFilter: externalGlobalFilter,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    pageCount: Math.ceil(totalCount / pageSize),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: (updater) => {
      const newPagination = typeof updater === 'function' 
        ? updater({ pageIndex, pageSize })
        : updater;
      onPaginationChange(newPagination);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
  });

  const startRow = pageIndex * pageSize + 1;
  const endRow = Math.min((pageIndex + 1) * pageSize, totalCount);

  return (
    <div className="h-full flex flex-col">

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="min-w-[150px]">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => onRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="p-0">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between p-4 border-t bg-background">
        <div className="text-sm text-muted-foreground">
          Showing {startRow} to {endRow} of {totalCount} rows
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <select
              value={pageSize}
              onChange={(e) => {
                onPaginationChange({
                  pageIndex: 0,
                  pageSize: Number(e.target.value),
                });
              }}
              className="h-8 w-[70px] rounded border border-input bg-background px-2 text-sm"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
              Page {pageIndex + 1} of {Math.max(1, Math.ceil(totalCount / pageSize))}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => onPaginationChange({ pageIndex: 0, pageSize })}
                disabled={pageIndex === 0}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => onPaginationChange({ pageIndex: pageIndex - 1, pageSize })}
                disabled={pageIndex === 0}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => onPaginationChange({ pageIndex: pageIndex + 1, pageSize })}
                disabled={pageIndex >= Math.ceil(totalCount / pageSize) - 1}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => onPaginationChange({ 
                  pageIndex: Math.ceil(totalCount / pageSize) - 1, 
                  pageSize 
                })}
                disabled={pageIndex >= Math.ceil(totalCount / pageSize) - 1}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}