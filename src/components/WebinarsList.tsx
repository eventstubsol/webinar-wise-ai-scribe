import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Clock, RefreshCw, ExternalLink } from "lucide-react";
import { useWebinarData } from "@/hooks/useWebinarData";
import { useZoomIntegration } from "@/hooks/useZoomIntegration";
import { WebinarStatus } from "@/types/sync";
import { useRealtimeWebinars } from "@/hooks/useRealtimeWebinars";

interface WebinarsListProps {
  filters: {
    search: string;
    dateRange: { from?: Date; to?: Date };
    status: string;
  };
}

const WebinarsList = ({ filters }: WebinarsListProps) => {
  const { webinars, loading } = useWebinarData();
  const { syncing, syncWebinarData } = useZoomIntegration();
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

  const getStatusBadge = (status: WebinarStatus, webinarId: string) => {
    const liveStatus = getWebinarStatus(webinarId);
    
    // Show real-time status if available
    if (liveStatus?.is_live) {
      return (
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <Badge variant="outline" className="bg-green-100 text-green-800">
            LIVE
          </Badge>
        </div>
      );
    }

    // Show participant count if available
    if (liveStatus?.current_participants > 0) {
      return (
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-blue-100 text-blue-800">
            {liveStatus.current_participants} active
          </Badge>
          {getOriginalStatusBadge(status)}
        </div>
      );
    }

    return getOriginalStatusBadge(status);
  };

  const getOriginalStatusBadge = (status: WebinarStatus) => {
    switch (status) {
      case 'upcoming':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Upcoming</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'live':
        return <Badge variant="outline" className="bg-red-100 text-red-800">Live</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Scheduled</Badge>;
    }
  };

  const getWebinarMetrics = (webinarId: string) => {
    const liveStatus = getWebinarStatus(webinarId);
    if (!liveStatus) return null;

    return (
      <div className="text-xs text-gray-500 mt-1">
        {liveStatus.peak_participants > 0 && (
          <span>Peak: {liveStatus.peak_participants} participants</span>
        )}
        {liveStatus.started_at && (
          <span className="ml-2">
            Started: {new Date(liveStatus.started_at).toLocaleTimeString()}
          </span>
        )}
      </div>
    );
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
          {filteredWebinars.length} Webinar{filteredWebinars.length !== 1 ? 's' : ''}
        </h2>
        <Button 
          onClick={syncWebinarData}
          disabled={syncing}
          variant="outline"
          size="sm"
          className="flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          <span>Sync from Zoom</span>
        </Button>
      </div>

      {filteredWebinars.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredWebinars.map((webinar) => (
            <Card key={webinar.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg leading-tight">{webinar.title}</CardTitle>
                  {getStatusBadge(webinar.status, webinar.id)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>
                      {webinar.start_time 
                        ? new Date(webinar.start_time).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'Date not set'
                      }
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>
                      {webinar.attendees_count || 0} attendees
                      {webinar.registrants_count && ` (${webinar.registrants_count} registered)`}
                    </span>
                  </div>

                  {webinar.duration_minutes && (
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>{webinar.duration_minutes} minutes</span>
                    </div>
                  )}

                  {webinar.host_name && (
                    <div className="text-gray-600">
                      Host: {webinar.host_name}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <Button variant="outline" size="sm" className="w-full flex items-center space-x-2">
                    <ExternalLink className="w-4 h-4" />
                    <span>View Details</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No webinars found</h3>
            <p className="text-gray-500 mb-4">
              {filters.search || filters.status !== 'all'
                ? "Try adjusting your search or filters"
                : "Connect your Zoom account and sync data to see webinars here"
              }
            </p>
            {!filters.search && filters.status === 'all' && (
              <Button onClick={syncWebinarData} disabled={syncing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sync Webinars
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WebinarsList;
