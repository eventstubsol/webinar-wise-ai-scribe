
export function getDateRange(daysBack: number = 180): { from: string; to: string } {
  const today = new Date()
  const fromDate = new Date(today)
  fromDate.setDate(today.getDate() - daysBack)
  
  // Format dates as yyyy-MM-dd for Zoom API
  const from = fromDate.toISOString().split('T')[0]
  const to = today.toISOString().split('T')[0]
  
  return { from, to }
}

export function formatDateForZoom(date: Date): string {
  return date.toISOString().split('T')[0]
}
