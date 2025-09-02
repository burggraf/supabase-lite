/**
 * Calculates the optimal pagination range for display
 * @param currentPage - The current active page (1-based)
 * @param totalPages - Total number of pages
 * @param maxVisible - Maximum number of page buttons to show (default: 5)
 * @returns Array of page numbers to display
 */
export function getPaginationRange(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 5
): number[] {
  // If total pages is less than or equal to maxVisible, show all pages
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  // Calculate the range around the current page
  const halfVisible = Math.floor(maxVisible / 2)
  let start = Math.max(1, currentPage - halfVisible)
  let end = Math.min(totalPages, currentPage + halfVisible)

  // Adjust if we're near the beginning
  if (currentPage <= halfVisible) {
    start = 1
    end = maxVisible
  }
  
  // Adjust if we're near the end
  if (currentPage + halfVisible >= totalPages) {
    start = totalPages - maxVisible + 1
    end = totalPages
  }

  // Generate the range
  const range: number[] = []
  for (let i = start; i <= end; i++) {
    range.push(i)
  }

  return range
}

/**
 * Determines if we should show ellipsis before or after the pagination range
 */
export function getPaginationMeta(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 5
) {
  const range = getPaginationRange(currentPage, totalPages, maxVisible)
  const showStartEllipsis = range[0] > 2
  const showEndEllipsis = range[range.length - 1] < totalPages - 1

  return {
    range,
    showStartEllipsis,
    showEndEllipsis,
    showFirstPage: range[0] > 1,
    showLastPage: range[range.length - 1] < totalPages
  }
}