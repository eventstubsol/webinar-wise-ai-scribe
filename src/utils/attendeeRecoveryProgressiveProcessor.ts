
import { supabase } from '@/integrations/supabase/client';
import { ProgressiveRecoveryOptions } from '@/types/attendeeRecoveryDiagnostics';

export const performProgressiveRecovery = async (
  webinarIds: string[],
  options: ProgressiveRecoveryOptions,
  userId: string
): Promise<any[]> => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();

  if (!profile?.organization_id) {
    throw new Error('Organization not found');
  }

  const results = [];

  for (const webinarId of webinarIds) {
    const { data: webinar } = await supabase
      .from('webinars')
      .select('*')
      .eq('id', webinarId)
      .single();

    if (!webinar) continue;

    console.log(`🎯 Starting enhanced recovery for: ${webinar.title}`);

    // Use the enhanced recovery function with transaction-based processing
    const { data, error } = await supabase.functions.invoke('zoom-sync-participants', {
      body: {
        organization_id: profile.organization_id,
        user_id: userId,
        webinar_id: webinar.id,
        zoom_webinar_id: webinar.zoom_webinar_id,
        options: {
          lenient_bot_detection: options.enableLenientBotDetection,
          lenient_email_validation: options.enableLenientEmailValidation,
          max_retries: options.maxRetryAttempts,
          batch_size: options.batchSize,
          min_duration: options.customFilters?.minDuration,
          allow_partial_emails: options.customFilters?.allowPartialEmails,
        }
      }
    });

    results.push({
      webinar_id: webinarId,
      success: !error,
      data,
      error: error?.message,
      recovery_type: 'enhanced_transaction_processing'
    });
  }

  return results;
};
