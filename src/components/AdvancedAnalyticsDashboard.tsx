import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Users, MessageSquare, BarChart3, HelpCircle, Clock, Target, DollarSign, Award } from 'lucide-react';
import { useAdvancedAnalytics } from '@/hooks/useAdvancedAnalytics';
import { useWebinarData } from '@/hooks/useWebinarData';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'];

const AdvancedAnalyticsDashboard = () => {
  const {
    selectedWebinarId,
    setSelectedWebinarId,
    selectedPeriod,
    setSelectedPeriod,
    analyticsSummary,
    engagementTimeline,
    comparativeAnalytics,
    summaryLoading,
    timelineLoading,
    comparativeLoading,
    generating,
    generateWebinarAnalytics,
    generateComparativeAnalytics
  } = useAdvancedAnalytics();

  const { webinars, loading: webinarsLoading } = useWebinarData();

  const handleWebinarSelect = async (webinarId: string) => {
    setSelectedWebinarId(webinarId);
    await generateWebinarAnalytics(webinarId);
  };

  const handlePeriodChange = (period: any) => {
    setSelectedPeriod(period);
    generateComparativeAnalytics();
  };

  // Transform timeline data for charts
  const timelineChartData = engagementTimeline?.map(point => ({
    time: `${point.time_interval}min`,
    engagement: point.engagement_level,
    attendees: point.active_attendees,
    chat: point.chat_activity,
    polls: point.poll_activity,
    qa: point.qa_activity
  })) || [];

  // Transform device breakdown for pie chart
  const deviceChartData = analyticsSummary?.device_breakdown 
    ? Object.entries(analyticsSummary.device_breakdown).map(([device, count]) => ({
        name: device,
        value: count
      }))
    : [];

  // Transform geographic data
  const geoChartData = analyticsSummary?.geographic_breakdown
    ? Object.entries(analyticsSummary.geographic_breakdown).map(([location, count]) => ({
        location,
        attendees: count
      }))
    : [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Advanced Analytics & Insights</h1>
          <p className="text-gray-600 mt-2">Deep dive into webinar performance and audience engagement</p>
        </div>
        
        <div className="flex gap-4">
          <Select value={selectedWebinarId || ""} onValueChange={handleWebinarSelect}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a webinar" />
            </SelectTrigger>
            <SelectContent>
              {webinars?.map((webinar) => (
                <SelectItem key={webinar.id} value={webinar.id}>
                  {webinar.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {generating && (
            <Button disabled>
              Generating Analytics...
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="comparative">Comparative</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {analyticsSummary && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyticsSummary.attendance_rate}%</div>
                    <p className="text-xs text-muted-foreground">
                      {analyticsSummary.total_attendees} of {analyticsSummary.total_registrants} registered
                    </p>
                    <Progress value={analyticsSummary.attendance_rate} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Engagement Score</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyticsSummary.average_engagement_score}</div>
                    <p className="text-xs text-muted-foreground">
                      Average interactions per attendee
                    </p>
                    <Badge variant={analyticsSummary.average_engagement_score > 5 ? "default" : "secondary"} className="mt-2">
                      {analyticsSummary.average_engagement_score > 5 ? "High" : "Moderate"} Engagement
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyticsSummary.completion_rate}%</div>
                    <p className="text-xs text-muted-foreground">
                      Average: {Math.round(analyticsSummary.average_watch_time_minutes)}min watch time
                    </p>
                    <Progress value={analyticsSummary.completion_rate} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
                    <Award className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyticsSummary.overall_performance_score}</div>
                    <p className="text-xs text-muted-foreground">
                      Overall webinar performance
                    </p>
                    <Badge variant={analyticsSummary.overall_performance_score > 75 ? "default" : "secondary"} className="mt-2">
                      {analyticsSummary.overall_performance_score > 75 ? "Excellent" : "Good"}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Interaction Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Chat Messages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">{analyticsSummary.total_chat_messages}</div>
                    <p className="text-sm text-muted-foreground">Total messages sent</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Poll Responses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">{analyticsSummary.total_poll_responses}</div>
                    <p className="text-sm text-muted-foreground">Poll interactions</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5" />
                      Q&A Questions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-600">{analyticsSummary.total_qa_questions}</div>
                    <p className="text-sm text-muted-foreground">Questions asked</p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {!analyticsSummary && !summaryLoading && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-muted-foreground">Select a webinar to view detailed analytics</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6">
          {engagementTimeline && engagementTimeline.length > 0 && (
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Engagement Timeline</CardTitle>
                  <CardDescription>Track audience engagement throughout the webinar</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={timelineChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="engagement" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="attendees" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Interaction Activity</CardTitle>
                  <CardDescription>Chat, polls, and Q&A activity over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={timelineChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="chat" fill="#8884d8" name="Chat" />
                      <Bar dataKey="polls" fill="#82ca9d" name="Polls" />
                      <Bar dataKey="qa" fill="#ffc658" name="Q&A" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="audience" className="space-y-6">
          {analyticsSummary && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Device Breakdown</CardTitle>
                  <CardDescription>How attendees joined the webinar</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={deviceChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {deviceChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Geographic Distribution</CardTitle>
                  <CardDescription>Where your attendees are located</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={geoChartData.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="location" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="attendees" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="comparative" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Period Comparison</CardTitle>
              <CardDescription>Compare performance across different time periods</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <Select 
                  value={selectedPeriod.type} 
                  onValueChange={(type: any) => handlePeriodChange({ ...selectedPeriod, type })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button onClick={generateComparativeAnalytics} disabled={generating}>
                  Generate Report
                </Button>
              </div>

              {comparativeAnalytics && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{comparativeAnalytics.total_webinars}</div>
                      <p className="text-sm text-muted-foreground">Total Webinars</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{comparativeAnalytics.average_attendance_rate}%</div>
                      <p className="text-sm text-muted-foreground">Avg Attendance Rate</p>
                      <div className="flex items-center mt-2">
                        {comparativeAnalytics.attendance_trend >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`text-sm ml-1 ${comparativeAnalytics.attendance_trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {Math.abs(comparativeAnalytics.attendance_trend)}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{comparativeAnalytics.average_engagement_score}</div>
                      <p className="text-sm text-muted-foreground">Avg Engagement</p>
                      <div className="flex items-center mt-2">
                        {comparativeAnalytics.engagement_trend >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`text-sm ml-1 ${comparativeAnalytics.engagement_trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {Math.abs(comparativeAnalytics.engagement_trend)}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI-Powered Insights</CardTitle>
              <CardDescription>Automated recommendations and predictions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsSummary && (
                  <>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold text-blue-900">Performance Summary</h4>
                      <p className="text-blue-700 mt-2">
                        Your webinar achieved a {analyticsSummary.overall_performance_score}% performance score. 
                        {analyticsSummary.attendance_rate > 70 
                          ? " Excellent attendance rate! " 
                          : " Consider improving promotional strategies. "
                        }
                        {analyticsSummary.average_engagement_score > 5 
                          ? "High audience engagement suggests compelling content."
                          : "Consider adding more interactive elements to boost engagement."
                        }
                      </p>
                    </div>

                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-semibold text-green-900">Recommendations</h4>
                      <ul className="text-green-700 mt-2 space-y-1">
                        {analyticsSummary.completion_rate < 80 && (
                          <li>• Consider shorter content or more breaks to improve completion rate</li>
                        )}
                        {analyticsSummary.total_chat_messages < 10 && (
                          <li>• Encourage more chat interaction with prompts and questions</li>
                        )}
                        {analyticsSummary.total_poll_responses < 5 && (
                          <li>• Add more polls throughout the webinar to maintain engagement</li>
                        )}
                        <li>• Schedule follow-up communications within 24 hours for best results</li>
                      </ul>
                    </div>

                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <h4 className="font-semibold text-yellow-900">Optimization Opportunities</h4>
                      <p className="text-yellow-700 mt-2">
                        Based on your device breakdown, consider optimizing for mobile users. 
                        Peak engagement occurs in the first 20 minutes - front-load your most important content.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedAnalyticsDashboard;
