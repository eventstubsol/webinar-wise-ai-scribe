import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Link2, Unlink, Clock, CheckCircle, XCircle, AlertCircle, Database, Users, Settings, MessageSquare, BarChart3, HelpCircle, UserCheck } from "lucide-react";
import { useZoomIntegration } from "@/hooks/useZoomIntegration";
import { useAuth } from "@/hooks/useAuth";
import ZoomConnectionWizard from "./ZoomConnectionWizard";
import PollsDebugger from "./PollsDebugger";
import { useState } from "react";

const ZoomIntegration = () => {
  const { user } = useAuth();
  const {
    zoomConnection,
    syncLogs,
    syncing,
    isConnected,
    syncWebinarData,
    disconnectZoom,
    syncProgress,
    syncJobs,
  } = useZoomIntegration();

  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const handleWizardSuccess = () => {
    setIsWizardOpen(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'started':
      case 'running':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'started':
      case 'running':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSyncStageIcon = (stage: string) => {
    switch (stage) {
      case 'webinars':
      case 'webinar_details':
        return <Database className="w-4 h-4" />;
      case 'participants':
        return <Users className="w-4 h-4" />;
      case 'chat':
        return <MessageSquare className="w-4 h-4" />;
      case 'polls':
        return <BarChart3 className="w-4 h-4" />;
      case 'qa':
        return <HelpCircle className="w-4 h-4" />;
      case 'registrations':
        return <UserCheck className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <RefreshCw className="w-4 h-4" />;
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <span className="text-gray-600">Please log in to access Zoom integration</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Link2 className="w-5 h-5" />
              <span>Zoom Integration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Connected
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {zoomConnection?.zoom_email || 'Account connected'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Connected on {new Date(zoomConnection?.created_at || '').toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disconnectZoom}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Unlink className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Smart Rate-Limited Sync</h4>
                      <p className="text-sm text-gray-600">
                        Intelligent sync that respects Zoom's API limits and includes comprehensive dashboard permissions
                      </p>
                      {/* Permissions info */}
                      <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                        <div className="font-medium mb-1">Required permissions:</div>
                        <div>• Basic webinar access</div>
                        <div>• Dashboard analytics</div>
                        <div>• Participant data access</div>
                      </div>
                    </div>
                    <Button
                      onClick={syncWebinarData}
                      disabled={syncing}
                      className="flex items-center space-x-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                      <span>{syncing ? 'Syncing...' : 'Start Smart Sync'}</span>
                    </Button>
                  </div>

                  {/* Enhanced Sync Progress */}
                  {syncing && syncProgress.stage !== 'idle' && (
                    <div className="space-y-3 p-4 bg-blue-50 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getSyncStageIcon(syncProgress.stage)}
                          <span className="font-medium text-sm">
                            {syncProgress.message}
                          </span>
                        </div>
                        {syncProgress.estimatedTimeRemaining && (
                          <span className="text-xs text-gray-500">
                            {syncProgress.estimatedTimeRemaining}
                          </span>
                        )}
                      </div>
                      <Progress value={syncProgress.progress} className="w-full" />
                      <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                        <div>
                          <span className="font-medium">{syncProgress.progress}% complete</span>
                        </div>
                        {syncProgress.apiRequestsUsed && (
                          <div className="text-right">
                            <span>API calls: {syncProgress.apiRequestsUsed}</span>
                          </div>
                        )}
                      </div>
                      {syncProgress.details && (
                        <div className="grid grid-cols-3 gap-2 text-xs bg-white p-2 rounded border">
                          {syncProgress.details.webinars_found && (
                            <div className="text-center">
                              <div className="font-medium">{String(syncProgress.details.webinars_found)}</div>
                              <div className="text-gray-500">Found</div>
                            </div>
                          )}
                          {syncProgress.details.webinars_synced && (
                            <div className="text-center">
                              <div className="font-medium">{String(syncProgress.details.webinars_synced)}</div>
                              <div className="text-gray-500">Synced</div>
                            </div>
                          )}
                          {syncProgress.details.detailed_sync_count && (
                            <div className="text-center">
                              <div className="font-medium">{String(syncProgress.details.detailed_sync_count)}</div>
                              <div className="text-gray-500">Detailed</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div>
                  <Badge variant="outline" className="bg-gray-100 text-gray-800">
                    Not Connected
                  </Badge>
                  <p className="text-sm text-gray-600 mt-2">
                    Connect your Zoom account to sync comprehensive webinar data automatically
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Updated integration includes dashboard access for complete analytics
                  </p>
                </div>
                <Button 
                  onClick={() => setIsWizardOpen(true)} 
                  className="flex items-center space-x-2"
                >
                  <Settings className="w-4 h-4" />
                  <span>Setup Zoom Integration</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Polls Debugger for enhanced debugging */}
        {isConnected && (
          <PollsDebugger />
        )}

        {/* Enhanced Sync Jobs Display */}
        {syncJobs && syncJobs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="w-5 h-5" />
                <span>Sync Jobs</span>
                <Badge variant="outline" className="ml-auto">
                  {syncJobs.filter(job => job.status === 'running').length} active
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {syncJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(job.status)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">
                            {job.job_type === 'comprehensive_rate_limited_sync' ? 'Smart Rate-Limited Sync' : job.job_type.replace('_', ' ')}
                          </span>
                          <Badge variant="outline" className={getStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          {new Date(job.started_at).toLocaleString()}
                          {job.metadata?.webinars_synced && (
                            <span className="ml-2">• {String(job.metadata.webinars_synced)} webinars</span>
                          )}
                          {job.metadata?.api_requests_made && (
                            <span className="ml-2">• {String(job.metadata.api_requests_made)} API calls</span>
                          )}
                        </p>
                        {job.error_message && (
                          <p className="text-sm text-red-600 mt-1">{job.error_message}</p>
                        )}
                        {job.metadata?.stage_message && job.status === 'running' && (
                          <p className="text-sm text-blue-600 mt-1">{job.metadata.stage_message}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      {job.status === 'running' && (
                        <div className="space-y-1">
                          <div className="text-gray-500">{job.progress}%</div>
                          <Progress value={job.progress} className="w-20" />
                        </div>
                      )}
                      {job.completed_at && (
                        <div className="text-gray-500">
                          {Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)}s
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sync History */}
        {syncLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Recent Sync Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {syncLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="flex items-center justify-between py-3 border-b last:border-b-0">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(log.status)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium capitalize">{log.sync_type}</span>
                          <Badge variant="outline" className={getStatusColor(log.status)}>
                            {log.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          {new Date(log.started_at).toLocaleString()}
                          {log.records_processed !== null && log.records_processed > 0 && (
                            <span className="ml-2">• {log.records_processed} records processed</span>
                          )}
                        </p>
                        {log.error_message && (
                          <p className="text-sm text-red-600 mt-1">{log.error_message}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {log.completed_at ? (
                        `${Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s`
                      ) : (
                        'In progress...'
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <ZoomConnectionWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={handleWizardSuccess}
      />
    </>
  );
};

export default ZoomIntegration;
