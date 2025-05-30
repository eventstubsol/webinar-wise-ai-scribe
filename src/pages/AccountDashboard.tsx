
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ZoomIntegration from "@/components/ZoomIntegration";
import UserProfileCard from "@/components/UserProfileCard";
import RecentActivityCard from "@/components/RecentActivityCard";
import BulkRegistrationRecovery from "@/components/BulkRegistrationRecovery";
import { useSyncLogs } from "@/hooks/useSyncLogs";
import { Settings, Database, User, Activity } from "lucide-react";

const AccountDashboard = () => {
  const { user } = useAuth();
  const { syncLogs } = useSyncLogs();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <span className="text-gray-600">Please log in to access your account dashboard</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Account Dashboard</h1>
        <p className="text-gray-600">Manage your account settings and integrations</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="data-recovery" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Data Recovery
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <UserProfileCard user={user} />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <ZoomIntegration />
        </TabsContent>

        <TabsContent value="data-recovery" className="space-y-6">
          <BulkRegistrationRecovery />
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <RecentActivityCard syncLogs={syncLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AccountDashboard;
