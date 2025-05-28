
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Clock, RefreshCw, ExternalLink } from "lucide-react";
import { useWebinarData } from "@/hooks/useWebinarData";
import { useZoomIntegration } from "@/hooks/useZoomIntegration";

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

  const filteredWebinars = webinars.filter((webinar) => {
    if (filters.search) {
      return webinar.title.toLowerCase().includes(filters.search.toLowerCase()) ||
             webinar.host_name?.toLowerCase().includes(filters.search.toLowerCase());
    }
    return true;
  });

  const getWebinarStatus = (webinar: any) => {
    const now = new Date();
    const startTime = webinar.start_time ? new Date(webinar.start_time) : null;
    const endTime = webinar.end_time ? new Date(webinar.end_time) : null;

    if (!startTime) return 'scheduled';
    if (startTime > now) return 'upcoming';
    if (endTime && endTime < now) return 'completed';
    return 'in_progress';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Upcoming</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">In Progress</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Scheduled</Badge>;
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
          {filteredWebinars.map((webinar) => {
            const status = getWebinarStatus(webinar);
            return (
              <Card key={webinar.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg leading-tight">{webinar.title}</CardTitle>
                    {getStatusBadge(status)}
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
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No webinars found</h3>
            <p className="text-gray-500 mb-4">
              {filters.search 
                ? "Try adjusting your search or filters"
                : "Connect your Zoom account and sync data to see webinars here"
              }
            </p>
            {!filters.search && (
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
