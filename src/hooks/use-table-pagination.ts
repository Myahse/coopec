import { useEffect, useMemo, useState } from 'react'

const DEFAULT_PAGE_SIZE = 50

export type UseTablePaginationOptions = {
  /** Rows per page once pagination is active (default 50). */
  pageSize?: number
  /** Auto-paginate when the list exceeds this count (default 50). */
  threshold?: number
}

export function useTablePagination<T>(
  items: T[],
  options: UseTablePaginationOptions = {},
) {
  const threshold = options.threshold ?? DEFAULT_PAGE_SIZE
  const initialPageSize = options.pageSize ?? DEFAULT_PAGE_SIZE

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const totalCount = items.length
  const enabled = totalCount > threshold
  const totalPages = enabled ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1

  useEffect(() => {
    setPage(0)
  }, [items])

  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1))
    }
  }, [page, totalPages])

  const pageItems = useMemo(() => {
    if (!enabled) return items
    const start = page * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize, enabled])

  function changePageSize(size: number) {
    setPageSize(size)
    setPage(0)
  }

  return {
    pageItems,
    enabled,
    page,
    pageSize,
    totalCount,
    totalPages,
    setPage,
    setPageSize: changePageSize,
    goNext: () => setPage((p) => Math.min(totalPages - 1, p + 1)),
    goPrev: () => setPage((p) => Math.max(0, p - 1)),
  }
}
