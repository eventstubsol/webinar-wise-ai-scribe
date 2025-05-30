
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface MissingDataBannerProps {
  missingDataCount: number;
}

const MissingDataBanner = ({ missingDataCount }: MissingDataBannerProps) => {
  if (missingDataCount === 0) return null;

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardContent className="pt-6">
        <div className="flex items-center space-x-2 text-orange-800">
          <AlertCircle className="w-5 h-5" />
          <div>
            <p className="font-medium">Missing Attendee Data Detected</p>
            <p className="text-sm text-orange-700">
              {missingDataCount} completed webinar{missingDataCount > 1 ? 's have' : ' has'} registration data but no attendee records. 
              Click "Fix Attendee Counts" to recalculate or sync from Zoom to get participant data.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MissingDataBanner;
