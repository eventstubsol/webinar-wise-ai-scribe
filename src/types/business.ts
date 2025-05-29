
export interface BusinessMetrics {
  id: string;
  webinar_id: string;
  organization_id: string;
  production_cost: number;
  marketing_cost: number;
  platform_cost: number;
  total_cost: number;
  direct_revenue: number;
  attributed_revenue: number;
  pipeline_value: number;
  leads_generated: number;
  qualified_leads: number;
  conversion_rate: number;
  roi_percentage: number;
  cost_per_attendee: number;
  cost_per_lead: number;
  attribution_model: string;
  attribution_window_days: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessMetricsInput {
  webinar_id: string;
  production_cost?: number;
  marketing_cost?: number;
  platform_cost?: number;
  direct_revenue?: number;
  attributed_revenue?: number;
  pipeline_value?: number;
  leads_generated?: number;
  qualified_leads?: number;
  attribution_model?: string;
  attribution_window_days?: number;
}

export interface AggregatedBusinessMetrics {
  totalCost: number;
  totalRevenue: number;
  totalLeads: number;
  totalQualifiedLeads: number;
  averageROI: number;
  averageConversionRate: number;
  totalWebinars: number;
  netProfit: number;
  overallROI: number;
}
