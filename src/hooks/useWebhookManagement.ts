
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface TestEventParams {
  eventType: string;
  webinarId?: string;
  participantData?: {
    id?: string;
    name?: string;
    email?: string;
    user_id?: string;
    first_name?: string;
    last_name?: string;
  };
  customData?: any;
}

export const useWebhookManagement = () => {
  const { user } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const registerWebhook = async (organizationId: string) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return null;
    }

    setIsRegistering(true);

    try {
      console.log('Registering webhook for organization:', organizationId);

      const response = await supabase.functions.invoke('zoom-webhook-register', {
        body: {
          organization_id: organizationId,
          user_id: user.id
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to register webhook');
      }

      const result = response.data;
      console.log('Webhook registration result:', result);

      if (result?.success) {
        toast({
          title: "Success",
          description: "Zoom webhook registered successfully",
        });

        return result;
      } else {
        throw new Error(result?.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      console.error('Webhook registration error:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register Zoom webhook",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsRegistering(false);
    }
  };

  const testWebhookEvent = async (params: TestEventParams) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return null;
    }

    setIsTesting(true);

    try {
      console.log('Testing webhook event:', params);

      // Get user's organization
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('Failed to get user organization');
      }

      const response = await supabase.functions.invoke('zoom-webhook-test', {
        body: {
          event_type: params.eventType,
          webinar_id: params.webinarId,
          organization_id: profile.organization_id,
          participant_data: params.participantData,
          custom_data: params.customData
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to test webhook');
      }

      const result = response.data;
      console.log('Webhook test result:', result);

      if (result?.success) {
        toast({
          title: "Test Event Sent",
          description: `Successfully triggered '${params.eventType}' webhook event`,
        });

        return result;
      } else {
        throw new Error(result?.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      console.error('Webhook test error:', error);
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test webhook event",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsTesting(false);
    }
  };

  const testWebinarStarted = (webinarId?: string) => {
    return testWebhookEvent({
      eventType: 'webinar.started',
      webinarId,
      customData: {
        topic: 'Test Webinar - Started',
        start_time: new Date().toISOString()
      }
    });
  };

  const testWebinarEnded = (webinarId?: string) => {
    return testWebhookEvent({
      eventType: 'webinar.ended',
      webinarId,
      customData: {
        topic: 'Test Webinar - Ended',
        end_time: new Date().toISOString()
      }
    });
  };

  const testParticipantJoined = (webinarId?: string, participantName = 'Test Participant') => {
    return testWebhookEvent({
      eventType: 'webinar.participant_joined',
      webinarId,
      participantData: {
        name: participantName,
        email: `${participantName.toLowerCase().replace(' ', '.')}@example.com`,
        user_id: `test_user_${Date.now()}`
      }
    });
  };

  const testParticipantLeft = (webinarId?: string, participantName = 'Test Participant') => {
    return testWebhookEvent({
      eventType: 'webinar.participant_left',
      webinarId,
      participantData: {
        name: participantName,
        email: `${participantName.toLowerCase().replace(' ', '.')}@example.com`,
        user_id: `test_user_${Date.now()}`
      }
    });
  };

  const testRegistrationCreated = (webinarId?: string) => {
    return testWebhookEvent({
      eventType: 'webinar.registration_created',
      webinarId,
      participantData: {
        email: 'new.registrant@example.com',
        first_name: 'New',
        last_name: 'Registrant'
      }
    });
  };

  return {
    registerWebhook,
    testWebhookEvent,
    testWebinarStarted,
    testWebinarEnded,
    testParticipantJoined,
    testParticipantLeft,
    testRegistrationCreated,
    isRegistering,
    isTesting
  };
};
