
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

      // Get current (active) records
      const { data: currentData, count: currentCount } = await supabase
        .from('attendees')
        .select('id', { count: 'exact' })
        .eq('organization_id', profile.organization_id)
        .eq('is_historical', false);

      // Get historical records
      const { data: historicalData, count: historicalCount } = await supabase
        .from('attendees')
        .select('id', { count: 'exact' })
        .eq('organization_id', profile.organization_id)
        .eq('is_historical', true);

      // Get date range
      const { data: dateRange } = await supabase
        .from('attendees')
        .select('created_at')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: true })
        .limit(1);

      const { data: newestData } = await supabase
        .from('attendees')
        .select('last_zoom_sync')
        .eq('organization_id', profile.organization_id)
        .order('last_zoom_sync', { ascending: false })
        .limit(1);

      const oldestRecord = dateRange?.[0]?.created_at || null;
      const newestRecord = newestData?.[0]?.last_zoom_sync || null;
      
      let dataRetentionDays = 0;
      if (oldestRecord) {
        const diffTime = Math.abs(new Date().getTime() - new Date(oldestRecord).getTime());
        dataRetentionDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      setStats({
        totalRecords: (currentCount || 0) + (historicalCount || 0),
        currentRecords: currentCount || 0,
        historicalRecords: historicalCount || 0,
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

      // Mark old records as historical if they haven't been synced recently
      const { error } = await supabase
        .from('attendees')
        .update({ 
          is_historical: true,
          zoom_data_available: false 
        })
        .eq('organization_id', profile.organization_id)
        .eq('is_historical', false)
        .lt('last_zoom_sync', cutoffDate.toISOString());

      if (error) {
        console.error('Error marking old data as historical:', error);
        return { success: false, error: error.message };
      }

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
      dataPreservationWorking: stats.historicalRecords > 0,
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
