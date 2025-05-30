
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { usePaginatedWebinarData } from "@/hooks/usePaginatedWebinarData";
import { useZoomIntegration } from "@/hooks/useZoomIntegration";
import { useAttendeeCountFix } from "@/hooks/useAttendeeCountFix";
import { useRealtimeWebinars } from "@/hooks/useRealtimeWebinars";
import WebinarsPagination from "./WebinarsPagination";
import MissingDataBanner from "./webinars/MissingDataBanner";
import WebinarActions from "./webinars/WebinarActions";
import WebinarCard from "./webinars/WebinarCard";
import WebinarsEmptyState from "./webinars/WebinarsEmptyState";

interface WebinarsListProps {
  filters: {
    search: string;
    dateRange: { from?: Date; to?: Date };
    status: string;
  };
}

const WebinarsList = ({ filters }: WebinarsListProps) => {
  const { webinars, loading, pagination, goToPage, changePageSize, refreshData } = usePaginatedWebinarData(20);
  const { syncing, syncWebinarData } = useZoomIntegration();
  const { fixing, fixAllAttendeeCounts } = useAttendeeCountFix();
  const { getWebinarStatus } = useRealtimeWebinars();

  const filteredWebinars = webinars.filter((webinar) => {
    // Search filter
    if (filters.search) {
      const searchMatch = webinar.title.toLowerCase().includes(filters.search.toLowerCase()) ||
             webinar.host_name?.toLowerCase().includes(filters.search.toLowerCase());
      if (!searchMatch) return false;
    }

    // Status filter - now using database status
    if (filters.status !== 'all') {
      if (webinar.status !== filters.status) return false;
    }

    return true;
  });

  // **IMPROVED LOGIC**: Only show warning for completed webinars that clearly have missing attendee data
  const webinarsWithMissingAttendeeData = webinars.filter(w => 
    w.status === 'completed' && 
    (w.registrants_count || 0) > 0 && 
    (w.attendees_count || 0) === 0
  );

  const hasLikelyMissingAttendeeData = webinarsWithMissingAttendeeData.length > 0;
  const hasFilters = filters.search || filters.status !== 'all';

  const handleRefresh = async () => {
    await syncWebinarData();
    await refreshData();
  };

  const handleFixCounts = async () => {
    console.log('Starting comprehensive attendee count fix...');
    const result = await fixAllAttendeeCounts();
    if (result) {
      console.log('Count fix completed, refreshing data...');
      await refreshData();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Loading webinars...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {pagination.totalCount} Webinar{pagination.totalCount !== 1 ? 's' : ''}
          {filteredWebinars.length !== webinars.length && 
            ` (${filteredWebinars.length} filtered)`
          }
        </h2>
        <WebinarActions
          hasLikelyMissingAttendeeData={hasLikelyMissingAttendeeData}
          fixing={fixing}
          syncing={syncing}
          onFixCounts={handleFixCounts}
          onRefresh={handleRefresh}
        />
      </div>

      <MissingDataBanner missingDataCount={webinarsWithMissingAttendeeData.length} />

      {filteredWebinars.length > 0 ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredWebinars.map((webinar) => (
              <WebinarCard 
                key={webinar.id} 
                webinar={webinar} 
                getWebinarStatus={getWebinarStatus}
              />
            ))}
          </div>

          <WebinarsPagination
            pagination={pagination}
            onPageChange={goToPage}
            onPageSizeChange={changePageSize}
            loading={syncing}
          />
        </>
      ) : (
        <WebinarsEmptyState 
          hasFilters={hasFilters}
          syncing={syncing}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
};

export default WebinarsList;
