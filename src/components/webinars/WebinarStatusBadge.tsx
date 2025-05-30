
import { Badge } from "@/components/ui/badge";
import { WebinarStatus } from "@/types/sync";

interface WebinarStatusBadgeProps {
  status: WebinarStatus;
  webinarId: string;
  getWebinarStatus: (id: string) => any;
}

const WebinarStatusBadge = ({ status, webinarId, getWebinarStatus }: WebinarStatusBadgeProps) => {
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

export default WebinarStatusBadge;
