
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Clock, ExternalLink } from "lucide-react";
import { WebinarStatus } from "@/types/sync";
import WebinarStatusBadge from "./WebinarStatusBadge";

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

interface WebinarCardProps {
  webinar: WebinarData;
  getWebinarStatus: (id: string) => any;
}

const WebinarCard = ({ webinar, getWebinarStatus }: WebinarCardProps) => {
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

  const getParticipantInfo = () => {
    if (webinar.status === 'completed' && webinar.attendees_count === 0 && webinar.registrants_count && webinar.registrants_count > 0) {
      return (
        <span className="text-orange-600">
          Missing attendee data • {webinar.registrants_count} registered
        </span>
      );
    } else if (webinar.status === 'upcoming' || webinar.status === 'scheduled') {
      return (
        <span>
          {webinar.registrants_count || 0} registered
        </span>
      );
    } else {
      return (
        <span>
          {webinar.attendees_count || 0} attendees
          {webinar.registrants_count && ` (${webinar.registrants_count} registered)`}
        </span>
      );
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg leading-tight">{webinar.title}</CardTitle>
          <WebinarStatusBadge 
            status={webinar.status} 
            webinarId={webinar.id} 
            getWebinarStatus={getWebinarStatus} 
          />
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
            {getParticipantInfo()}
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

        {getWebinarMetrics(webinar.id)}

        <div className="pt-2">
          <Button variant="outline" size="sm" className="w-full flex items-center space-x-2">
            <ExternalLink className="w-4 h-4" />
            <span>View Details</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WebinarCard;
