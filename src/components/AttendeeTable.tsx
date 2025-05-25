
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";

const AttendeeTable = () => {
  const attendees = [
    { 
      name: "Sarah Johnson", 
      email: "sarah.j@company.com", 
      joinTime: "2:00 PM", 
      duration: "58m", 
      engagement: "High",
      location: "New York, NY"
    },
    { 
      name: "Michael Chen", 
      email: "m.chen@techcorp.com", 
      joinTime: "2:03 PM", 
      duration: "55m", 
      engagement: "High",
      location: "San Francisco, CA"
    },
    { 
      name: "Emily Rodriguez", 
      email: "emily.r@startup.io", 
      joinTime: "2:15 PM", 
      duration: "42m", 
      engagement: "Medium",
      location: "Austin, TX"
    },
    { 
      name: "David Kim", 
      email: "david@agency.com", 
      joinTime: "2:01 PM", 
      duration: "35m", 
      engagement: "Medium",
      location: "Seattle, WA"
    },
    { 
      name: "Lisa Thompson", 
      email: "lisa.t@consulting.biz", 
      joinTime: "2:25 PM", 
      duration: "28m", 
      engagement: "Low",
      location: "Chicago, IL"
    }
  ];

  const getEngagementBadge = (engagement: string) => {
    switch (engagement) {
      case 'High':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">High</Badge>;
      case 'Medium':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Medium</Badge>;
      case 'Low':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Low</Badge>;
      default:
        return <Badge variant="secondary">{engagement}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Attendee Details
          </CardTitle>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input 
                placeholder="Search attendees..." 
                className="pl-10 w-64"
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Join Time</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Duration</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Engagement</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Location</th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((attendee, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 font-medium text-gray-900">{attendee.name}</td>
                  <td className="py-3 px-4 text-gray-600">{attendee.email}</td>
                  <td className="py-3 px-4 text-gray-600">{attendee.joinTime}</td>
                  <td className="py-3 px-4 text-gray-600">{attendee.duration}</td>
                  <td className="py-3 px-4">{getEngagementBadge(attendee.engagement)}</td>
                  <td className="py-3 px-4 text-gray-600">{attendee.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendeeTable;
