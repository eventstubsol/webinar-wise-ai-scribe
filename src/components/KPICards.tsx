
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, TrendingUp, MessageSquare } from "lucide-react";

const KPICards = () => {
  const kpis = [
    {
      title: "Total Registrants",
      value: "1,247",
      change: "+12.5%",
      changeType: "positive",
      icon: Users,
      color: "from-blue-500 to-blue-600"
    },
    {
      title: "Attendees",
      value: "892",
      change: "+8.3%",
      changeType: "positive", 
      icon: UserCheck,
      color: "from-green-500 to-green-600"
    },
    {
      title: "Attendance Rate",
      value: "71.5%",
      change: "-2.1%",
      changeType: "negative",
      icon: TrendingUp,
      color: "from-purple-500 to-purple-600"
    },
    {
      title: "Engagement Score",
      value: "8.4/10",
      change: "+15.2%",
      changeType: "positive",
      icon: MessageSquare,
      color: "from-orange-500 to-orange-600"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {kpis.map((kpi, index) => (
        <Card key={index} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {kpi.title}
            </CardTitle>
            <div className={`p-2 rounded-lg bg-gradient-to-r ${kpi.color}`}>
              <kpi.icon className="w-4 h-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {kpi.value}
            </div>
            <div className={`text-sm flex items-center space-x-1 ${
              kpi.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
            }`}>
              <span>{kpi.change}</span>
              <span className="text-gray-500">vs last webinar</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default KPICards;
