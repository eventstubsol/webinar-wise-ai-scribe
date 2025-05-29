
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioIcon, Users, Activity, Clock, RefreshCw } from "lucide-react";
import { useRealtimeWebinars } from "@/hooks/useRealtimeWebinars";
import { useWebinarData } from "@/hooks/useWebinarData";
import { formatDistanceToNow } from "date-fns";

const RealtimeDashboard = () => {
  const { 
    liveStatuses, 
    recentEvents, 
    liveParticipants,
    loading,
    getLiveWebinarsCount,
    getTotalActiveParticipants,
    refreshData
  } = useRealtimeWebinars();

  const { webinars } = useWebinarData();

  const liveWebinarsCount = getLiveWebinarsCount();
  const totalActiveParticipants = getTotalActiveParticipants();

  const getWebinarTitle = (webinarId: string) => {
    const webinar = webinars.find(w => w.id === webinarId);
    return webinar?.title || 'Unknown Webinar';
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'webinar_started':
        return <RadioIcon className="w-4 h-4 text-green-500" />;
      case 'webinar_ended':
        return <RadioIcon className="w-4 h-4 text-red-500" />;
      case 'participant_joined':
        return <Users className="w-4 h-4 text-blue-500" />;
      case 'participant_left':
        return <Users className="w-4 h-4 text-gray-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getEventDescription = (event: any) => {
    switch (event.event_type) {
      case 'webinar_started':
        return 'Webinar started';
      case 'webinar_ended':
        return 'Webinar ended';
      case 'participant_joined':
        return `${event.event_data?.object?.participant?.user_name || 'Participant'} joined`;
      case 'participant_left':
        return `${event.event_data?.object?.participant?.user_name || 'Participant'} left`;
      default:
        return event.event_type.replace('_', ' ');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-300 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Real-time Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Live Webinars</p>
                <p className="text-2xl font-bold text-green-600">{liveWebinarsCount}</p>
              </div>
              <RadioIcon className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Participants</p>
                <p className="text-2xl font-bold text-blue-600">{totalActiveParticipants}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Recent Events</p>
                <p className="text-2xl font-bold text-purple-600">{recentEvents.length}</p>
              </div>
              <Activity className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Webinars */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <RadioIcon className="w-5 h-5 text-green-500" />
            <span>Live Webinars</span>
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshData}
            className="flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </Button>
        </CardHeader>
        <CardContent>
          {liveStatuses.filter(status => status.is_live).length > 0 ? (
            <div className="space-y-4">
              {liveStatuses.filter(status => status.is_live).map((status) => (
                <div key={status.id} className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <Badge variant="outline" className="bg-green-100 text-green-800">
                        LIVE
                      </Badge>
                    </div>
                    <div>
                      <h4 className="font-medium">{getWebinarTitle(status.webinar_id)}</h4>
                      <p className="text-sm text-gray-600">
                        {status.current_participants} participants • 
                        Peak: {status.peak_participants} • 
                        Started {status.started_at ? formatDistanceToNow(new Date(status.started_at), { addSuffix: true }) : 'recently'}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <RadioIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Live Webinars</h3>
              <p className="text-gray-500">
                Live webinars will appear here when they start
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Recent Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentEvents.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentEvents.slice(0, 20).map((event) => (
                <div key={event.id} className="flex items-center space-x-3 py-2 border-b last:border-b-0">
                  {getEventIcon(event.event_type)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{getEventDescription(event)}</span>
                      <span className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{getWebinarTitle(event.webinar_id)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Recent Activity</h3>
              <p className="text-gray-500">
                Real-time events will appear here as they happen
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Participants */}
      {liveParticipants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Active Participants</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveParticipants.slice(0, 12).map((participant) => (
                <div key={participant.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium truncate">{participant.participant_name}</h4>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                  <p className="text-sm text-gray-600 truncate">{participant.participant_email}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {getWebinarTitle(participant.webinar_id)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Joined {formatDistanceToNow(new Date(participant.joined_at), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RealtimeDashboard;
