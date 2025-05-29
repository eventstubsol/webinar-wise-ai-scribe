
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from "lucide-react";

const PollsDebugger = () => {
  const { user } = useAuth();
  const [webinarId, setWebinarId] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);

  const testPollsAPI = async () => {
    if (!webinarId || !user?.id) return;
    
    setTesting(true);
    setTestResult(null);
    
    try {
      console.log('Testing polls API for webinar:', webinarId);
      
      const { data, error } = await supabase.functions.invoke('zoom-test-polls', {
        body: { 
          user_id: user.id,
          zoom_webinar_id: webinarId 
        }
      });

      if (error) {
        console.error('Test polls API error:', error);
        setTestResult({ success: false, error: error.message });
      } else {
        console.log('Test polls API result:', data);
        setTestResult(data);
      }
    } catch (error: any) {
      console.error('Exception testing polls API:', error);
      setTestResult({ success: false, error: error.message });
    } finally {
      setTesting(false);
    }
  };

  const syncPollsForWebinar = async () => {
    if (!webinarId || !user?.id) return;
    
    setTesting(true);
    setSyncResult(null);
    
    try {
      // First get the webinar record to get organization_id
      const { data: webinars, error: webinarError } = await supabase
        .from('webinars')
        .select('id, organization_id')
        .eq('zoom_webinar_id', webinarId)
        .single();

      if (webinarError || !webinars) {
        throw new Error('Webinar not found in database');
      }

      console.log('Syncing polls for webinar:', webinarId, 'DB ID:', webinars.id);
      
      const { data, error } = await supabase.functions.invoke('zoom-sync-polls', {
        body: { 
          organization_id: webinars.organization_id,
          user_id: user.id,
          webinar_id: webinars.id,
          zoom_webinar_id: webinarId 
        }
      });

      if (error) {
        console.error('Sync polls error:', error);
        setSyncResult({ success: false, error: error.message });
      } else {
        console.log('Sync polls result:', data);
        setSyncResult(data);
      }
    } catch (error: any) {
      console.error('Exception syncing polls:', error);
      setSyncResult({ success: false, error: error.message });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <AlertCircle className="w-5 h-5" />
          <span>Polls Sync Debugger</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex space-x-2">
          <Input
            placeholder="Enter Zoom Webinar ID"
            value={webinarId}
            onChange={(e) => setWebinarId(e.target.value)}
          />
          <Button 
            onClick={testPollsAPI} 
            disabled={testing || !webinarId}
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
            Test API
          </Button>
          <Button 
            onClick={syncPollsForWebinar} 
            disabled={testing || !webinarId}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
            Sync Polls
          </Button>
        </div>

        {testResult && (
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              {getStatusIcon(testResult.success)}
              <span className="font-medium">API Test Results</span>
            </div>
            
            {testResult.polls_endpoint && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(testResult.polls_endpoint.status === 'success')}
                  <span>Polls Endpoint</span>
                  <Badge variant="outline">
                    {testResult.polls_found} polls found
                  </Badge>
                </div>
                {testResult.polls_endpoint.status === 'error' && (
                  <pre className="text-xs bg-red-50 p-2 rounded">
                    {JSON.stringify(testResult.polls_endpoint.error, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {testResult.results_endpoint && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(testResult.results_endpoint.status === 'success')}
                  <span>Results Endpoint</span>
                  <Badge variant="outline">
                    {testResult.results_found} results found
                  </Badge>
                </div>
                {testResult.results_endpoint.status === 'error' && (
                  <pre className="text-xs bg-red-50 p-2 rounded">
                    {JSON.stringify(testResult.results_endpoint.error, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {testResult.api_errors && testResult.api_errors.length > 0 && (
              <div className="space-y-2">
                <span className="font-medium text-red-600">API Errors:</span>
                <ul className="text-sm text-red-600">
                  {testResult.api_errors.map((error: string, index: number) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {syncResult && (
          <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2">
              {getStatusIcon(syncResult.success)}
              <span className="font-medium">Sync Results</span>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">Found:</span> {syncResult.total_found || 0}
              </div>
              <div>
                <span className="font-medium">Synced:</span> {syncResult.polls_synced || 0}
              </div>
              <div>
                <span className="font-medium">Errors:</span> {syncResult.errors || 0}
              </div>
            </div>

            {syncResult.has_results && (
              <Badge variant="secondary">Poll results available</Badge>
            )}

            {syncResult.api_error && (
              <div className="text-sm text-red-600">
                API Error: {syncResult.api_error}
              </div>
            )}

            {!syncResult.success && syncResult.error && (
              <pre className="text-xs bg-red-50 p-2 rounded">
                {syncResult.error}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PollsDebugger;
