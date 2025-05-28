
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { Users, Clock, UserCheck, UserX } from 'lucide-react';

interface Panelist {
  id: string;
  email: string;
  name?: string;
  status: string;
  joined_at?: string;
  left_at?: string;
  duration_minutes: number;
  invited_at?: string;
}

interface PanelistTableProps {
  panelists: Panelist[];
  loading?: boolean;
}

const PanelistTable: React.FC<PanelistTableProps> = ({ panelists, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Panelists
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading panelist data...</div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'joined':
        return <Badge variant="default" className="bg-green-100 text-green-800"><UserCheck className="h-3 w-3 mr-1" />Joined</Badge>;
      case 'invited':
        return <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />Invited</Badge>;
      case 'declined':
        return <Badge variant="destructive"><UserX className="h-3 w-3 mr-1" />Declined</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const totalPanelists = panelists.length;
  const joinedPanelists = panelists.filter(p => p.status === 'joined').length;
  const totalDuration = panelists.reduce((sum, p) => sum + p.duration_minutes, 0);
  const avgDuration = totalPanelists > 0 ? Math.round(totalDuration / totalPanelists) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Panelists ({totalPanelists})
        </CardTitle>
        
        {totalPanelists > 0 && (
          <div className="flex gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <UserCheck className="h-4 w-4" />
              {joinedPanelists} joined
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Avg: {formatDuration(avgDuration)}
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {totalPanelists === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No panelist data available for this webinar
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Join Time</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {panelists.map((panelist) => (
                <TableRow key={panelist.id}>
                  <TableCell className="font-medium">
                    {panelist.name || 'N/A'}
                  </TableCell>
                  <TableCell>{panelist.email}</TableCell>
                  <TableCell>{getStatusBadge(panelist.status)}</TableCell>
                  <TableCell>
                    {panelist.joined_at ? (
                      format(new Date(panelist.joined_at), 'MMM d, HH:mm')
                    ) : (
                      'N/A'
                    )}
                  </TableCell>
                  <TableCell>{formatDuration(panelist.duration_minutes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default PanelistTable;
