
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Database, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useMassResync } from "@/hooks/useMassResync";

const MassResyncPanel = () => {
  const { syncing, results, startMassResync } = useMassResync();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Database className="w-5 h-5" />
          <span>Mass Re-sync</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            Perform a complete historical data recovery for all your webinars. This will re-sync all instances and participants.
          </p>
          <div className="flex items-center space-x-2 text-xs text-amber-600">
            <AlertTriangle className="w-3 h-3" />
            <span>This operation may take several minutes depending on the number of webinars</span>
          </div>
        </div>

        <Button
          onClick={startMassResync}
          disabled={syncing}
          className="w-full flex items-center space-x-2"
          variant={syncing ? "outline" : "default"}
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Re-syncing All Webinars...' : 'Start Mass Re-sync'}</span>
        </Button>

        {syncing && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm text-blue-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Processing all webinars with historical data recovery...</span>
            </div>
            <Progress value={undefined} className="w-full" />
          </div>
        )}

        {results && (
          <div className="space-y-4 mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Mass Re-sync Results</span>
            </h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Webinars:</span>
                  <Badge variant="outline">{results.total_webinars}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Successful:</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {results.successful_webinars}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Failed:</span>
                  <Badge variant="secondary" className="bg-red-100 text-red-800">
                    {results.failed_webinars}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Participants:</span>
                  <Badge variant="outline">{results.total_participants_synced}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Instances:</span>
                  <Badge variant="outline">{results.total_instances_processed}</Badge>
                </div>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="mt-4">
                <h5 className="font-medium text-red-600 flex items-center space-x-2 mb-2">
                  <XCircle className="w-4 h-4" />
                  <span>Errors ({results.errors.length})</span>
                </h5>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {results.errors.map((error, index) => (
                    <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      <div className="font-medium">{error.topic}</div>
                      <div>{error.error}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MassResyncPanel;
