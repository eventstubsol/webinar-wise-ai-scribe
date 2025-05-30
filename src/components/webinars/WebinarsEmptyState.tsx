
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, RefreshCw } from "lucide-react";

interface WebinarsEmptyStateProps {
  hasFilters: boolean;
  syncing: boolean;
  onRefresh: () => void;
}

const WebinarsEmptyState = ({ hasFilters, syncing, onRefresh }: WebinarsEmptyStateProps) => {
  return (
    <Card>
      <CardContent className="text-center py-8">
        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No webinars found</h3>
        <p className="text-gray-500 mb-4">
          {hasFilters
            ? "Try adjusting your search or filters"
            : "Connect your Zoom account and sync data to see webinars here"
          }
        </p>
        {!hasFilters && (
          <Button onClick={onRefresh} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync Webinars
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default WebinarsEmptyState;
