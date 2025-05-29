
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Webhook, 
  Play, 
  Users, 
  UserCheck, 
  RadioIcon, 
  StopCircle,
  TestTube,
  Settings,
  AlertCircle
} from "lucide-react";
import { useWebhookManagement } from "@/hooks/useWebhookManagement";
import { useAuth } from "@/hooks/useAuth";
import { useWebinarData } from "@/hooks/useWebinarData";
import { useState } from "react";

const WebhookTestingPanel = () => {
  const { user } = useAuth();
  const { webinars } = useWebinarData();
  const {
    registerWebhook,
    testWebinarStarted,
    testWebinarEnded,
    testParticipantJoined,
    testParticipantLeft,
    testRegistrationCreated,
    isRegistering,
    isTesting
  } = useWebhookManagement();

  const [selectedWebinar, setSelectedWebinar] = useState<string>('');
  const [participantName, setParticipantName] = useState('Test Participant');
  const [organizationId, setOrganizationId] = useState('');

  const handleRegisterWebhook = async () => {
    if (!organizationId) {
      alert('Please enter organization ID');
      return;
    }
    await registerWebhook(organizationId);
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'started':
        return <RadioIcon className="w-4 h-4 text-green-500" />;
      case 'ended':
        return <StopCircle className="w-4 h-4 text-red-500" />;
      case 'joined':
        return <Users className="w-4 h-4 text-blue-500" />;
      case 'left':
        return <Users className="w-4 h-4 text-gray-500" />;
      case 'registration':
        return <UserCheck className="w-4 h-4 text-purple-500" />;
      default:
        return <TestTube className="w-4 h-4 text-gray-400" />;
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <span className="text-gray-600">Please log in to access webhook testing</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Webhook className="w-5 h-5" />
            <span>Webhook Management & Testing</span>
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              Phase 2 Testing
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Webhook Registration */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <h3 className="font-medium">Webhook Registration</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="orgId">Organization ID</Label>
                <Input
                  id="orgId"
                  placeholder="Enter organization ID"
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={handleRegisterWebhook}
                  disabled={isRegistering || !organizationId}
                  className="w-full"
                >
                  {isRegistering ? 'Registering...' : 'Register Webhook'}
                </Button>
              </div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">Webhook Registration</p>
                  <p>This will register your webhook endpoint with Zoom to receive real-time events for webinars, participants, and registrations.</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Test Configuration */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <TestTube className="w-4 h-4" />
              <h3 className="font-medium">Test Configuration</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="webinar">Test Webinar (Optional)</Label>
                <Select value={selectedWebinar} onValueChange={setSelectedWebinar}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a webinar or use mock data" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Use Mock Data</SelectItem>
                    {webinars.slice(0, 10).map((webinar) => (
                      <SelectItem key={webinar.id} value={webinar.id}>
                        {webinar.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="participant">Participant Name</Label>
                <Input
                  id="participant"
                  placeholder="Test Participant"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Test Events */}
          <div className="space-y-4">
            <h3 className="font-medium">Test Webhook Events</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button
                variant="outline"
                onClick={() => testWebinarStarted(selectedWebinar || undefined)}
                disabled={isTesting}
                className="flex items-center space-x-2 h-auto p-4"
              >
                {getEventIcon('started')}
                <div className="text-left">
                  <div className="font-medium">Webinar Started</div>
                  <div className="text-xs text-gray-500">Test live webinar start</div>
                </div>
              </Button>

              <Button
                variant="outline"
                onClick={() => testWebinarEnded(selectedWebinar || undefined)}
                disabled={isTesting}
                className="flex items-center space-x-2 h-auto p-4"
              >
                {getEventIcon('ended')}
                <div className="text-left">
                  <div className="font-medium">Webinar Ended</div>
                  <div className="text-xs text-gray-500">Test webinar completion</div>
                </div>
              </Button>

              <Button
                variant="outline"
                onClick={() => testParticipantJoined(selectedWebinar || undefined, participantName)}
                disabled={isTesting}
                className="flex items-center space-x-2 h-auto p-4"
              >
                {getEventIcon('joined')}
                <div className="text-left">
                  <div className="font-medium">Participant Joined</div>
                  <div className="text-xs text-gray-500">Test participant entry</div>
                </div>
              </Button>

              <Button
                variant="outline"
                onClick={() => testParticipantLeft(selectedWebinar || undefined, participantName)}
                disabled={isTesting}
                className="flex items-center space-x-2 h-auto p-4"
              >
                {getEventIcon('left')}
                <div className="text-left">
                  <div className="font-medium">Participant Left</div>
                  <div className="text-xs text-gray-500">Test participant exit</div>
                </div>
              </Button>

              <Button
                variant="outline"
                onClick={() => testRegistrationCreated(selectedWebinar || undefined)}
                disabled={isTesting}
                className="flex items-center space-x-2 h-auto p-4"
              >
                {getEventIcon('registration')}
                <div className="text-left">
                  <div className="font-medium">Registration Created</div>
                  <div className="text-xs text-gray-500">Test new registration</div>
                </div>
              </Button>

              <Button
                variant="outline"
                disabled={true}
                className="flex items-center space-x-2 h-auto p-4 opacity-50"
              >
                <Play className="w-4 h-4" />
                <div className="text-left">
                  <div className="font-medium">More Events</div>
                  <div className="text-xs text-gray-500">Coming soon...</div>
                </div>
              </Button>
            </div>
          </div>

          {/* Status Information */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Testing Status</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p>• Test events will trigger the real-time dashboard updates</p>
              <p>• Monitor the Real-time Dashboard section to see live updates</p>
              <p>• Check browser console for detailed webhook processing logs</p>
              <p>• Test events are logged with 'test_' prefix in the database</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WebhookTestingPanel;
