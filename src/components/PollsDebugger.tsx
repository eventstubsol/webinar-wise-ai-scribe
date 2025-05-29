
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle, Play, RefreshCw } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const PollsDebugger = () => {
  const { user } = useAuth();
  const [testing, setTesting] = useState(false);
  const [webinarId, setWebinarId] = useState('');
  const [testResults, setTestResults] = useState<any>(null);

  const testPollsAPI = async () => {
    if (!webinarId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a webinar ID to test",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setTestResults(null);

    try {
      console.log('Testing polls API for webinar:', webinarId);
      
      const { data, error } = await supabase.functions.invoke('zoom-test-polls', {
        body: { 
          user_id: user?.id,
          zoom_webinar_id: webinarId.trim()
        }
      });

      if (error) {
        console.error('Test function error:', error);
        throw new Error(error.message || 'Test function failed');
      }

      console.log('Test results:', data);
      setTestResults(data);

      if (data.success) {
        toast({
          title: "Test Complete",
          description: `Found ${data.polls_found} polls for webinar ${webinarId}`,
        });
      } else {
        toast({
          title: "Test Failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('Polls test error:', error);
      toast({
        title: "Test Error",
        description: error.message || "Failed to test polls API",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const syncSpecificWebinar = async () => {
    if (!webinarId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a webinar ID to sync",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);

    try {
      console.log('Syncing polls for specific webinar:', webinarId);
      
      const { data, error } = await supabase.functions.invoke('zoom-sync-polls', {
        body: { 
          user_id: user?.id,
          zoom_webinar_id: webinarId.trim(),
          organization_id: user?.user_metadata?.organization_id
        }
      });

      if (error) {
        console.error('Sync function error:', error);
        throw new Error(error.message || 'Sync function failed');
      }

      console.log('Sync results:', data);

      if (data.success) {
        toast({
          title: "Sync Complete",
          description: `Synced ${data.polls_synced} polls and ${data.responses_synced} responses`,
        });
      } else {
        toast({
          title: "Sync Failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('Polls sync error:', error);
      toast({
        title: "Sync Error",
        description: error.message || "Failed to sync polls",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5" />
            <span>Polls API Debugger</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="webinar-id" className="text-sm font-medium">
              Webinar ID to Test
            </label>
            <Input
              id="webinar-id"
              placeholder="Enter Zoom webinar ID (e.g., 87894302885)"
              value={webinarId}
              onChange={(e) => setWebinarId(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Enter a specific webinar ID that should have polls configured
            </p>
          </div>

          <div className="flex space-x-2">
            <Button 
              onClick={testPollsAPI}
              disabled={testing || !webinarId.trim()}
              className="flex items-center space-x-2"
            >
              <Play className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing...' : 'Test Polls API'}</span>
            </Button>

            <Button 
              onClick={syncSpecificWebinar}
              disabled={testing || !webinarId.trim()}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Syncing...' : 'Sync This Webinar'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {testResults.success ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span>Test Results</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Webinar ID</p>
                <p className="text-sm text-gray-600">{testResults.webinar_id}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Polls Found</p>
                <Badge variant={testResults.polls_found > 0 ? "default" : "secondary"}>
                  {testResults.polls_found} polls
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Results Found</p>
                <Badge variant={testResults.results_found > 0 ? "default" : "secondary"}>
                  {testResults.results_found} with results
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium">API Errors</p>
                <Badge variant={testResults.api_errors?.length > 0 ? "destructive" : "default"}>
                  {testResults.api_errors?.length || 0} errors
                </Badge>
              </div>
            </div>

            {testResults.past_webinars_endpoint && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Past Webinars Endpoint</p>
                <div className="bg-gray-50 p-3 rounded text-xs">
                  <p><strong>Status:</strong> {testResults.past_webinars_endpoint.status}</p>
                  {testResults.past_webinars_endpoint.polls_count !== undefined && (
                    <p><strong>Polls Count:</strong> {testResults.past_webinars_endpoint.polls_count}</p>
                  )}
                  {testResults.past_webinars_endpoint.has_embedded_results !== undefined && (
                    <p><strong>Has Results:</strong> {testResults.past_webinars_endpoint.has_embedded_results ? 'Yes' : 'No'}</p>
                  )}
                </div>
              </div>
            )}

            {testResults.webinars_endpoint && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Webinars Endpoint (Legacy)</p>
                <div className="bg-gray-50 p-3 rounded text-xs">
                  <p><strong>Status:</strong> {testResults.webinars_endpoint.status}</p>
                  {testResults.webinars_endpoint.polls_count !== undefined && (
                    <p><strong>Polls Count:</strong> {testResults.webinars_endpoint.polls_count}</p>
                  )}
                </div>
              </div>
            )}

            {testResults.api_errors && testResults.api_errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-600">API Errors</p>
                <div className="bg-red-50 p-3 rounded text-xs space-y-1">
                  {testResults.api_errors.map((error: string, index: number) => (
                    <p key={index} className="text-red-700">{error}</p>
                  ))}
                </div>
              </div>
            )}

            {testResults.recommendation && (
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm font-medium text-blue-800">Recommendation</p>
                <p className="text-sm text-blue-700">{testResults.recommendation}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Debugging Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>• Use webinar IDs from your Zoom dashboard that have polls configured</p>
          <p>• Check that your Zoom account has the necessary scopes for polls API</p>
          <p>• Past webinars endpoint is the correct one for retrieving poll data</p>
          <p>• If no polls are found, the webinar might not have had any polls</p>
          <p>• Check the function logs for detailed API responses</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PollsDebugger;
