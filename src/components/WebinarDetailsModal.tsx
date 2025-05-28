
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, Users, Settings, Shield, Bell, MessageSquare, Link, Mail, Phone } from 'lucide-react';
import { format } from 'date-fns';

interface WebinarDetailsModalProps {
  webinar: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WebinarDetailsModal = ({ webinar, open, onOpenChange }: WebinarDetailsModalProps) => {
  if (!webinar) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not specified';
    try {
      return format(new Date(dateString), 'PPP p');
    } catch {
      return 'Invalid date';
    }
  };

  const getRecurrenceText = (recurrence: any) => {
    if (!recurrence) return 'One-time webinar';
    
    const typeMap = {
      1: 'Daily',
      2: 'Weekly', 
      3: 'Monthly'
    };
    
    return `${typeMap[recurrence.recurrence_type] || 'Unknown'} (every ${recurrence.repeat_interval || 1} interval)`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {webinar.title}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-6">
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Host</label>
                    <p className="text-sm">{webinar.host_name || 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Host Email</label>
                    <p className="text-sm">{webinar.host_email || 'Not specified'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Webinar ID</label>
                    <p className="text-sm font-mono">{webinar.zoom_webinar_id || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Registration URL</label>
                    {webinar.registration_url ? (
                      <a href={webinar.registration_url} target="_blank" rel="noopener noreferrer" 
                         className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                        <Link className="h-3 w-3" />
                        Open Registration
                      </a>
                    ) : (
                      <p className="text-sm text-gray-500">Not available</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Start Time</label>
                    <p className="text-sm">{formatDate(webinar.start_time)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Duration</label>
                    <p className="text-sm">{webinar.duration_minutes ? `${webinar.duration_minutes} minutes` : 'Not specified'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Timezone</label>
                    <p className="text-sm">{webinar.timezone || 'Not specified'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Type</label>
                    <p className="text-sm">
                      <Badge variant={webinar.is_simulive ? 'secondary' : 'outline'}>
                        {webinar.is_simulive ? 'Simulive' : webinar.webinar_type || 'Regular'}
                      </Badge>
                    </p>
                  </div>
                  {webinar.pstn_password && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">PSTN Password</label>
                      <p className="text-sm font-mono flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {webinar.pstn_password}
                      </p>
                    </div>
                  )}
                </div>
                
                {webinar.agenda && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Agenda</label>
                    <p className="text-sm mt-1 p-3 bg-gray-50 rounded-md">{webinar.agenda}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Attendance Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Attendance Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{webinar.registrants_count || 0}</div>
                    <div className="text-sm text-gray-500">Registrants</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{webinar.attendees_count || 0}</div>
                    <div className="text-sm text-gray-500">Attendees</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {webinar.registrants_count && webinar.attendees_count 
                        ? Math.round((webinar.attendees_count / webinar.registrants_count) * 100) + '%'
                        : 'N/A'
                      }
                    </div>
                    <div className="text-sm text-gray-500">Attendance Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recurrence Information */}
            {webinar.recurrence && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Recurrence Pattern
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{getRecurrenceText(webinar.recurrence)}</p>
                  {webinar.recurrence.weekly_days && (
                    <p className="text-sm text-gray-500 mt-2">
                      Weekly on: {webinar.recurrence.weekly_days}
                    </p>
                  )}
                  {webinar.recurrence.end_date_time && (
                    <p className="text-sm text-gray-500 mt-2">
                      Ends: {formatDate(webinar.recurrence.end_date_time)}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Settings */}
            {webinar.settings && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Webinar Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Registration Type</label>
                      <p className="text-sm">
                        {webinar.settings.registration_type === 1 ? 'Registration required' : 
                         webinar.settings.registration_type === 2 ? 'Register once, attend any occurrence' :
                         webinar.settings.registration_type === 3 ? 'Register for each occurrence' : 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Approval Type</label>
                      <p className="text-sm">
                        {webinar.settings.approval_type === 0 ? 'Automatically approve' : 
                         webinar.settings.approval_type === 1 ? 'Manually approve' :
                         webinar.settings.approval_type === 2 ? 'No registration required' : 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Recording</label>
                      <p className="text-sm">
                        {webinar.settings.auto_recording === 'local' ? 'Local recording' :
                         webinar.settings.auto_recording === 'cloud' ? 'Cloud recording' :
                         webinar.settings.auto_recording === 'none' ? 'No recording' : 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Practice Session</label>
                      <p className="text-sm">{webinar.settings.practice_session ? 'Enabled' : 'Disabled'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Language</label>
                      <p className="text-sm">{webinar.settings.language || 'en-US'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Registration Status</label>
                      <p className="text-sm">
                        {webinar.settings.close_registration ? 
                          <Badge variant="destructive">Closed</Badge> : 
                          <Badge variant="default">Open</Badge>
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex flex-wrap gap-2">
                    {webinar.settings.host_video && <Badge variant="outline">Host Video On</Badge>}
                    {webinar.settings.panelists_video && <Badge variant="outline">Panelist Video On</Badge>}
                    {webinar.settings.hd_video && <Badge variant="outline">HD Video</Badge>}
                    {webinar.settings.on_demand && <Badge variant="outline">On Demand</Badge>}
                    {webinar.settings.post_webinar_survey && <Badge variant="outline">Post-Survey</Badge>}
                    {webinar.settings.allow_multiple_devices && <Badge variant="outline">Multiple Devices</Badge>}
                    {webinar.settings.request_permission_to_unmute && <Badge variant="outline">Permission to Unmute</Badge>}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Authentication & Security */}
            {webinar.authentication && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Authentication & Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {webinar.authentication.meeting_authentication && (
                      <div>
                        <Badge variant="secondary">Meeting Authentication Required</Badge>
                        {webinar.authentication.authentication_name && (
                          <p className="text-sm text-gray-500 mt-1">
                            Method: {webinar.authentication.authentication_name}
                          </p>
                        )}
                      </div>
                    )}
                    {webinar.authentication.panelist_authentication && (
                      <Badge variant="secondary">Panelist Authentication Required</Badge>
                    )}
                    {webinar.authentication.enforce_login && (
                      <div>
                        <Badge variant="secondary">Login Required</Badge>
                        {webinar.authentication.enforce_login_domains && (
                          <p className="text-sm text-gray-500 mt-1">
                            Allowed domains: {webinar.authentication.enforce_login_domains}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Q&A Settings */}
            {webinar.qa_settings && webinar.qa_settings.enable && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Q&A Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {webinar.qa_settings.allow_submit_questions && <Badge variant="outline">Questions Allowed</Badge>}
                    {webinar.qa_settings.allow_anonymous_questions && <Badge variant="outline">Anonymous Questions</Badge>}
                    {webinar.qa_settings.attendees_can_comment && <Badge variant="outline">Comments Allowed</Badge>}
                    {webinar.qa_settings.attendees_can_upvote && <Badge variant="outline">Upvoting Enabled</Badge>}
                    {webinar.qa_settings.allow_auto_reply && <Badge variant="outline">Auto Reply</Badge>}
                  </div>
                  {webinar.qa_settings.auto_reply_text && (
                    <div className="mt-3">
                      <label className="text-sm font-medium text-gray-500">Auto Reply Text</label>
                      <p className="text-sm mt-1 p-2 bg-gray-50 rounded">{webinar.qa_settings.auto_reply_text}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Notifications */}
            {webinar.notifications && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Notification Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {webinar.notifications.attendees_reminder_enable && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Attendee Reminders</span>
                        <Badge variant="outline">Enabled</Badge>
                      </div>
                    )}
                    {webinar.notifications.follow_up_attendees_enable && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Follow-up for Attendees</span>
                        <Badge variant="outline">Enabled</Badge>
                      </div>
                    )}
                    {webinar.notifications.follow_up_absentees_enable && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Follow-up for Absentees</span>
                        <Badge variant="outline">Enabled</Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tracking Fields */}
            {webinar.tracking_fields && webinar.tracking_fields.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tracking Fields</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {webinar.tracking_fields.map((field: any, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm font-medium">{field.field_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">{field.field_value}</span>
                          {field.visible !== undefined && (
                            <Badge variant={field.visible ? "default" : "secondary"} className="text-xs">
                              {field.visible ? "Visible" : "Hidden"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Interpreters */}
            {webinar.interpreters && webinar.interpreters.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Interpreters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {webinar.interpreters.map((interpreter: any, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">{interpreter.email}</span>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs">
                            {interpreter.interpreter_type}
                          </Badge>
                          {interpreter.languages && (
                            <Badge variant="secondary" className="text-xs">
                              {interpreter.languages}
                            </Badge>
                          )}
                          {interpreter.sign_language && (
                            <Badge variant="secondary" className="text-xs">
                              {interpreter.sign_language}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
