
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { syncCompleteWebinarWithAllInstances } from './handlers/syncCompleteWebinar.ts'
import { handleMassResyncAllWebinars } from './handlers/massResync.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Decryption function (same as in auth.ts)
async function decryptCredential(encryptedText: string, key: string): Promise<string> {
  try {
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)
    
    const encoder = new TextEncoder()
    const keyData = encoder.encode(key.slice(0, 32).padEnd(32, '0'))
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encrypted
    )
    
    return new TextDecoder().decode(decrypted)
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt credential')
  }
}

serve(async (req) => {
  // Handle preflight requests
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

    // Parse body once here to avoid "Body already consumed" error
    const body = await req.json();
    const { action } = body;

    console.log(`[zoom-api] Processing action: ${action}`);

    // Create decryption key (same as used in zoom-store-credentials)
    const encryptionKey = `${user.id}-${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 32)}`
    
    // Decrypt credentials
    const credentials = {
      account_id: await decryptCredential(connection.encrypted_account_id, encryptionKey),
      client_id: await decryptCredential(connection.encrypted_client_id, encryptionKey),
      client_secret: await decryptCredential(connection.encrypted_client_secret, encryptionKey)
    };

    console.log('Successfully decrypted credentials for user:', user.id);

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

      case 'chunked_mass_resync':
        // Import dynamically to avoid issues
        const { handleChunkedMassResync } = await import('./handlers/chunkedMassResync.ts');
        return await handleChunkedMassResync(body, supabase, user, credentials);

      case 'get_resync_status':
        const { getChunkedResyncStatus } = await import('./handlers/chunkedMassResync.ts');
        return await getChunkedResyncStatus(body, supabase, user);

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
