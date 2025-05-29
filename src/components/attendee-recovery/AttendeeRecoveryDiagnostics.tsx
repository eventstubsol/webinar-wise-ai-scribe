
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  BarChart3, 
  Users, 
  Zap,
  TrendingUp,
  Filter,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { 
  analyzeMissingAttendees, 
  performProgressiveRecovery, 
  generateRecoverySummary,
  type AttendeeRecoveryDiagnostics,
  type ProgressiveRecoveryOptions 
} from '@/services/attendeeRecoveryDiagnosticsService';

const AttendeeRecoveryDiagnosticsComponent = () => {
  const { user } = useAuth();
  const [diagnostics, setDiagnostics] = useState<AttendeeRecoveryDiagnostics[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWebinars, setSelectedWebinars] = useState<Set<string>>(new Set());
  const [recoveryInProgress, setRecoveryInProgress] = useState(false);
  const [progressiveOptions, setProgressiveOptions] = useState<ProgressiveRecoveryOptions>({
    enableLenientBotDetection: true,
    enableLenientEmailValidation: true,
    maxRetryAttempts: 3,
    batchSize: 300,
    customFilters: {
      minDuration: 0,
      allowPartialEmails: false
    }
  });

  const runDiagnostics = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const results = await analyzeMissingAttendees(user.id);
      setDiagnostics(results);
      toast({
        title: "Diagnostics Complete",
        description: `Analyzed ${results.length} webinars for missing attendee data`,
      });
    } catch (error: any) {
      toast({
        title: "Diagnostics Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runProgressiveRecovery = async () => {
    if (selectedWebinars.size === 0 || !user?.id) return;
    
    setRecoveryInProgress(true);
    try {
      const webinarIds = Array.from(selectedWebinars);
      const results = await performProgressiveRecovery(webinarIds, progressiveOptions, user.id);
      
      const successCount = results.filter(r => r.success).length;
      toast({
        title: "Progressive Recovery Complete",
        description: `Successfully processed ${successCount}/${results.length} webinars`,
      });
      
      // Refresh diagnostics
      await runDiagnostics();
      setSelectedWebinars(new Set());
    } catch (error: any) {
      toast({
        title: "Recovery Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRecoveryInProgress(false);
    }
  };

  const toggleWebinarSelection = (webinarId: string) => {
    const newSelection = new Set(selectedWebinars);
    if (newSelection.has(webinarId)) {
      newSelection.delete(webinarId);
    } else {
      newSelection.add(webinarId);
    }
    setSelectedWebinars(newSelection);
  };

  const selectHighGapWebinars = () => {
    const highGapIds = diagnostics
      .filter(d => d.gap_percentage > 30)
      .map(d => d.webinar_id);
    setSelectedWebinars(new Set(highGapIds));
  };

  const summary = diagnostics.length > 0 ? generateRecoverySummary(diagnostics) : null;

  const getGapSeverity = (percentage: number) => {
    if (percentage > 50) return { label: 'Critical', color: 'bg-red-500', textColor: 'text-red-700' };
    if (percentage > 30) return { label: 'High', color: 'bg-orange-500', textColor: 'text-orange-700' };
    if (percentage > 10) return { label: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-700' };
    return { label: 'Low', color: 'bg-green-500', textColor: 'text-green-700' };
  };

  useEffect(() => {
    if (user?.id) {
      runDiagnostics();
    }
  }, [user?.id]);

  return (
    <div className="space-y-6">
      {/* Summary Dashboard */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Gap</p>
                  <p className="text-2xl font-bold text-red-600">{summary.totalGap.toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Gap %</p>
                  <p className="text-2xl font-bold text-orange-600">{summary.averageGapPercentage}%</p>
                </div>
                <BarChart3 className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">High Gap Webinars</p>
                  <p className="text-2xl font-bold text-yellow-600">{summary.highGapWebinars}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recovery Potential</p>
                  <p className="text-2xl font-bold text-blue-600">{summary.recoveryPotential.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Progressive Recovery Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Progressive Recovery Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  checked={progressiveOptions.enableLenientBotDetection}
                  onChange={(e) => setProgressiveOptions(prev => ({
                    ...prev,
                    enableLenientBotDetection: e.target.checked
                  }))}
                />
                <span className="text-sm">Lenient Bot Detection</span>
              </label>
              <p className="text-xs text-muted-foreground">Reduce false positives in bot filtering</p>
            </div>
            
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  checked={progressiveOptions.enableLenientEmailValidation}
                  onChange={(e) => setProgressiveOptions(prev => ({
                    ...prev,
                    enableLenientEmailValidation: e.target.checked
                  }))}
                />
                <span className="text-sm">Lenient Email Validation</span>
              </label>
              <p className="text-xs text-muted-foreground">Accept more email formats during recovery</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <Button 
              onClick={runDiagnostics} 
              disabled={loading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Diagnostics
            </Button>
            
            <Button 
              onClick={selectHighGapWebinars}
              variant="outline"
            >
              <Filter className="h-4 w-4 mr-2" />
              Select High-Gap Webinars
            </Button>
            
            <Button 
              onClick={runProgressiveRecovery}
              disabled={selectedWebinars.size === 0 || recoveryInProgress}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Zap className={`h-4 w-4 mr-2 ${recoveryInProgress ? 'animate-pulse' : ''}`} />
              Run Progressive Recovery ({selectedWebinars.size})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Diagnostics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Webinar Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 w-full">
            <div className="space-y-3">
              {diagnostics.map((diagnostic) => {
                const severity = getGapSeverity(diagnostic.gap_percentage);
                const isSelected = selectedWebinars.has(diagnostic.webinar_id);
                
                return (
                  <div
                    key={diagnostic.webinar_id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleWebinarSelection(diagnostic.webinar_id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm truncate flex-1">{diagnostic.title}</h4>
                      <Badge variant="outline" className={severity.textColor}>
                        {severity.label}: {diagnostic.gap_percentage}%
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Expected:</span>
                        <div className="font-medium">{diagnostic.expected_attendees}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Actual:</span>
                        <div className="font-medium">{diagnostic.actual_attendees}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Gap:</span>
                        <div className="font-medium text-red-600">{diagnostic.gap_count}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Bots Filtered:</span>
                        <div className="font-medium">{diagnostic.filtering_stats.bots_filtered}</div>
                      </div>
                    </div>
                    
                    {diagnostic.recommendations.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="text-xs text-muted-foreground mb-1">Recommendations:</div>
                        <div className="space-y-1">
                          {diagnostic.recommendations.map((rec, idx) => (
                            <div key={idx} className="text-xs bg-yellow-50 p-1 rounded">
                              {rec}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendeeRecoveryDiagnosticsComponent;
