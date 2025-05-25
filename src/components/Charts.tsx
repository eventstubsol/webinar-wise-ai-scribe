
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

const Charts = () => {
  const engagementData = [
    { time: '0min', attendees: 892, engagement: 85 },
    { time: '10min', attendees: 876, engagement: 82 },
    { time: '20min', attendees: 851, engagement: 79 },
    { time: '30min', attendees: 823, engagement: 76 },
    { time: '40min', attendees: 798, engagement: 73 },
    { time: '50min', attendees: 776, engagement: 71 },
    { time: '60min', attendees: 754, engagement: 68 }
  ];

  const deviceData = [
    { name: 'Desktop', value: 487, color: '#3b82f6' },
    { name: 'Mobile', value: 267, color: '#10b981' },
    { name: 'Tablet', value: 138, color: '#f59e0b' }
  ];

  const pollData = [
    { question: 'Q1: Product Interest', yes: 78, no: 22 },
    { question: 'Q2: Budget Ready', yes: 64, no: 36 },
    { question: 'Q3: Timeline', yes: 82, no: 18 }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Engagement Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={engagementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="attendees" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7, stroke: '#3b82f6', strokeWidth: 2 }}
              />
              <Line 
                type="monotone" 
                dataKey="engagement" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7, stroke: '#10b981', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Device Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={deviceData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {deviceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Poll Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={pollData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" stroke="#64748b" />
              <YAxis dataKey="question" type="category" stroke="#64748b" width={80} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="yes" fill="#10b981" radius={[0, 4, 4, 0]} />
              <Bar dataKey="no" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default Charts;
