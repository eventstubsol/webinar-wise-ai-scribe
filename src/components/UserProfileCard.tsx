
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Building, Calendar, Edit } from "lucide-react";
import { User as SupabaseUser } from '@supabase/supabase-js';

interface UserProfileCardProps {
  user: SupabaseUser | null;
}

const UserProfileCard = ({ user }: UserProfileCardProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center space-x-2">
          <User className="w-5 h-5" />
          <span>Profile Information</span>
        </CardTitle>
        <Button variant="outline" size="sm">
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'User'}
            </h3>
            <p className="text-gray-600 text-sm">Account Holder</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-sm">{user?.email || 'No email'}</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <Building className="w-4 h-4 text-gray-400" />
            <span className="text-sm">Default Organization</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm">
              Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
            </span>
          </div>
        </div>

        <div className="pt-2">
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Active Account
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserProfileCard;
