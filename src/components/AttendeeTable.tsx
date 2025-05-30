
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";
import { useWebinarData } from "@/hooks/useWebinarData";
import { useState } from "react";

const AttendeeTable = () => {
  const { attendees, loading } = useWebinarData();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAttendees = attendees.filter(attendee =>
    attendee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    attendee.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getEngagementBadge = (score: number | null) => {
    if (!score) return <Badge variant="secondary">Unknown</Badge>;
    
    if (score >= 7) {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">High</Badge>;
    } else if (score >= 4) {
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Medium</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Low</Badge>;
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "0m";
    return `${minutes}m`;
  };

  const formatJoinTime = (joinTime: string | null) => {
    if (!joinTime) return "Unknown";
    return new Date(joinTime).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Attendee Details ({filteredAttendees.length})
          </CardTitle>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input 
                placeholder="Search attendees..." 
                className="pl-10 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredAttendees.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {attendees.length === 0 ? "No attendees found" : "No attendees match your search"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Join Time</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Duration</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendees.map((attendee) => (
                  <tr key={attendee.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-gray-900">{attendee.name}</td>
                    <td className="py-3 px-4 text-gray-600">{attendee.email}</td>
                    <td className="py-3 px-4 text-gray-600">{formatJoinTime(attendee.join_time)}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDuration(attendee.duration_minutes)}</td>
                    <td className="py-3 px-4">{getEngagementBadge(attendee.engagement_score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendeeTable;
