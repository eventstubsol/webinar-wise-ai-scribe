
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  BarChart3, 
  Users, 
  MessageSquare, 
  Settings, 
  Download,
  TrendingUp,
  PieChart
} from "lucide-react";

const Sidebar = () => {
  const menuItems = [
    { icon: BarChart3, label: "Dashboard", active: true },
    { icon: Calendar, label: "Webinars", active: false },
    { icon: Users, label: "Attendees", active: false },
    { icon: MessageSquare, label: "Engagement", active: false },
    { icon: TrendingUp, label: "Analytics", active: false },
    { icon: PieChart, label: "Reports", active: false },
    { icon: Download, label: "Exports", active: false },
    { icon: Settings, label: "Settings", active: false }
  ];

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 h-full p-4">
      <div className="space-y-2">
        {menuItems.map((item, index) => (
          <Button
            key={index}
            variant={item.active ? "default" : "ghost"}
            className={`w-full justify-start ${
              item.active 
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white" 
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <item.icon className="w-4 h-4 mr-3" />
            {item.label}
          </Button>
        ))}
      </div>
      
      <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
        <h3 className="font-medium text-gray-900 mb-2">AI Insights</h3>
        <p className="text-sm text-gray-600 mb-3">
          Get AI-powered insights about your webinar performance
        </p>
        <Button size="sm" className="w-full bg-gradient-to-r from-blue-600 to-purple-600">
          Generate Report
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
