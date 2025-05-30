
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { WebinarStatus } from '@/types/sync';

interface WebinarData {
  id: string;
  title: string;
  host_name: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  attendees_count: number | null;
  registrants_count: number | null;
  status: WebinarStatus;
}

interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export const usePaginatedWebinarData = (pageSize: number = 20) => {
  const { user } = useAuth();
  const [webinars, setWebinars] = useState<WebinarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    pageSize,
    totalCount: 0,
    totalPages: 0,
  });

  const fetchWebinars = async (page: number = 1, size: number = pageSize) => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      // Update webinar status before fetching
      await supabase.rpc('update_webinar_status');
      
      // Get total count first
      const { count, error: countError } = await supabase
        .from('webinars')
        .select('id', { count: 'exact', head: true });

      if (countError) {
        throw countError;
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / size);
      const offset = (page - 1) * size;

      // Fetch paginated webinars
      const { data: webinarsData, error: webinarsError } = await supabase
        .from('webinars')
        .select('id, title, host_name, start_time, end_time, duration_minutes, attendees_count, registrants_count, status')
        .order('created_at', { ascending: false })
        .range(offset, offset + size - 1);

      if (webinarsError) {
        console.error('Error fetching webinars:', webinarsError);
        throw new Error(`Failed to fetch webinars: ${webinarsError.message}`);
      }

      const transformedWebinars = (webinarsData || []).map(w => ({
        id: w.id,
        title: w.title || 'Untitled Webinar',
        host_name: w.host_name,
        start_time: w.start_time,
        end_time: w.end_time,
        duration_minutes: w.duration_minutes,
        attendees_count: w.attendees_count || 0,
        registrants_count: w.registrants_count || 0,
        status: w.status as WebinarStatus,
      }));

      setWebinars(transformedWebinars);
      setPagination({
        currentPage: page,
        pageSize: size,
        totalCount,
        totalPages,
      });

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch webinar data';
      setError(errorMessage);
      console.error('Error in usePaginatedWebinarData:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebinars(1, pageSize);
  }, [user, pageSize]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchWebinars(page, pagination.pageSize);
    }
  };

  const goToNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      goToPage(pagination.currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (pagination.currentPage > 1) {
      goToPage(pagination.currentPage - 1);
    }
  };

  const changePageSize = (newSize: number) => {
    fetchWebinars(1, newSize);
  };

  const refreshData = async () => {
    await fetchWebinars(pagination.currentPage, pagination.pageSize);
  };

  return { 
    webinars, 
    loading, 
    error, 
    pagination,
    goToPage,
    goToNextPage,
    goToPrevPage,
    changePageSize,
    refreshData,
  };
};
