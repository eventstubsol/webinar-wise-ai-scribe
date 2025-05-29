
export const calculateROI = (revenue: number, cost: number): number => {
  if (cost === 0) return 0;
  return ((revenue - cost) / cost) * 100;
};

export const calculatePaybackPeriod = (cost: number, monthlyRevenue: number): number => {
  if (monthlyRevenue === 0) return Infinity;
  return cost / monthlyRevenue;
};
