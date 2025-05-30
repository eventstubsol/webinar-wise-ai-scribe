
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";

interface WebinarActionsProps {
  hasLikelyMissingAttendeeData: boolean;
  fixing: boolean;
  syncing: boolean;
  onFixCounts: () => void;
  onRefresh: () => void;
}

const WebinarActions = ({ 
  hasLikelyMissingAttendeeData, 
  fixing, 
  syncing, 
  onFixCounts, 
  onRefresh 
}: WebinarActionsProps) => {
  return (
    <div className="flex items-center space-x-2">
      {hasLikelyMissingAttendeeData && (
        <Button 
          onClick={onFixCounts}
          disabled={fixing}
          variant="outline"
          size="sm"
          className="flex items-center space-x-2 text-orange-600 border-orange-200 hover:bg-orange-50"
        >
          <AlertCircle className={`w-4 h-4 ${fixing ? 'animate-spin' : ''}`} />
          <span>Fix Attendee Counts</span>
        </Button>
      )}
      <Button 
        onClick={onRefresh}
        disabled={syncing}
        variant="outline"
        size="sm"
        className="flex items-center space-x-2"
      >
        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
        <span>Sync from Zoom</span>
      </Button>
    </div>
  );
};

export default WebinarActions;
