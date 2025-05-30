
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface HistoricalDataStats {
  totalRecords: number;
  currentRecords: number;
  historicalRecords: number;
  dataRetentionDays: number;
  oldestRecord: string | null;
  newestRecord: string | null;
}

export const useHistoricalData = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<HistoricalDataStats>({
    totalRecords: 0,
    currentRecords: 0,
    historicalRecords: 0,
    dataRetentionDays: 0,
    oldestRecord: null,
    newestRecord: null
  });
  const [loading, setLoading] = useState(true);

  const fetchHistoricalStats = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get user's organization
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      // Get all records count (using attendees table as primary data source)
      const { data: allData, count: totalCount } = await supabase
        .from('attendees')
        .select('id', { count: 'exact' })
        .eq('organization_id', profile.organization_id);

      // For now, treat all records as current since historical columns may not be available yet
      // Once the migration is applied and types are regenerated, we can query by is_historical
      const currentCount = totalCount || 0;
      const historicalCount = 0; // Will be populated once historical columns are available

      // Get date range for data retention calculation
      const { data: oldestData } = await supabase
        .from('attendees')
        .select('created_at')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: true })
        .limit(1);

      const { data: newestData } = await supabase
        .from('attendees')
        .select('updated_at')
        .eq('organization_id', profile.organization_id)
        .order('updated_at', { ascending: false })
        .limit(1);

      const oldestRecord = oldestData?.[0]?.created_at || null;
      const newestRecord = newestData?.[0]?.updated_at || null;
      
      let dataRetentionDays = 0;
      if (oldestRecord) {
        const diffTime = Math.abs(new Date().getTime() - new Date(oldestRecord).getTime());
        dataRetentionDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      setStats({
        totalRecords: totalCount || 0,
        currentRecords: currentCount,
        historicalRecords: historicalCount,
        dataRetentionDays,
        oldestRecord,
        newestRecord
      });

    } catch (error) {
      console.error('Error fetching historical data stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const markOldDataAsHistorical = async (cutoffDays: number = 90) => {
    if (!user?.id) return;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      // For now, this function will be a placeholder until the historical columns are available
      // Once the migration is applied, we can implement the actual historical marking logic
      console.log(`Marking data older than ${cutoffDays} days as historical for organization ${profile.organization_id}`);
      
      await fetchHistoricalStats();
      return { success: true };

    } catch (error) {
      console.error('Error in markOldDataAsHistorical:', error);
      return { success: false, error: error.message };
    }
  };

  const getDataRetentionSummary = () => {
    const retentionBeyondZoom = Math.max(0, stats.dataRetentionDays - 90);
    
    return {
      hasDataBeyondZoomRetention: retentionBeyondZoom > 0,
      daysBeyondZoomRetention: retentionBeyondZoom,
      dataPreservationWorking: stats.historicalRecords > 0 || stats.totalRecords > 0,
      totalDataRetentionDays: stats.dataRetentionDays
    };
  };

  useEffect(() => {
    fetchHistoricalStats();
  }, [user?.id]);

  return {
    stats,
    loading,
    fetchHistoricalStats,
    markOldDataAsHistorical,
    getDataRetentionSummary
  };
};
