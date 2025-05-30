
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { syncCompleteWebinarWithAllInstances } from './handlers/syncCompleteWebinar.ts'
import { handleMassResyncAllWebinars } from './handlers/massResync.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user from auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get zoom credentials
    const { data: connection, error: connectionError } = await supabase
      .from('zoom_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('connection_status', 'active')
      .single();

    if (connectionError || !connection) {
      return new Response(JSON.stringify({ error: 'No active Zoom connection found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action } = body;

    // Decrypt credentials (using simplified approach for this example)
    const credentials = {
      account_id: connection.encrypted_account_id,
      client_id: connection.encrypted_client_id,
      client_secret: connection.encrypted_client_secret
    };

    switch (action) {
      case 'sync_webinar':
        const { webinar_id } = body;
        if (!webinar_id) {
          return new Response(JSON.stringify({ error: 'webinar_id is required for sync_webinar action' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const syncResult = await syncCompleteWebinarWithAllInstances(webinar_id, credentials, supabase, user);
        
        return new Response(JSON.stringify({
          success: true,
          result: syncResult
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'mass_resync':
        return await handleMassResyncAllWebinars(req, supabase, user, credentials);

      case 'mass-resync-all-webinars':
        return await handleMassResyncAllWebinars(req, supabase, user, credentials);

      case 'sync-complete-webinar':
        const { webinar_id: completeWebinarId } = body;
        if (!completeWebinarId) {
          return new Response(JSON.stringify({ error: 'webinar_id is required for sync-complete-webinar action' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const completeResult = await syncCompleteWebinarWithAllInstances(completeWebinarId, credentials, supabase, user);
        
        return new Response(JSON.stringify({
          success: true,
          result: completeResult
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Zoom API error:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
