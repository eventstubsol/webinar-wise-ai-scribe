
export async function validateUserAndOrganization(supabase: any, user: any) {
  // Get user's profile to fetch organization_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !profile.organization_id) {
    console.error('[userValidation] Profile/organization error:', profileError);
    throw new Error('User profile not found or no organization assigned');
  }

  const organizationId = profile.organization_id;
  console.log(`[userValidation] Using organization_id: ${organizationId}`);
  
  return organizationId;
}

export async function getWebinarsForResync(supabase: any, userId: string, organizationId: string) {
  const { data: webinars, error: webinarsError } = await supabase
    .from('webinars')
    .select('zoom_webinar_id, title')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .not('zoom_webinar_id', 'is', null)
    .limit(100); // Limit to prevent massive jobs
  
  if (webinarsError) {
    console.error('[userValidation] Webinars fetch error:', webinarsError);
    throw new Error(`Failed to fetch webinars: ${webinarsError.message}`);
  }

  if (!webinars || webinars.length === 0) {
    throw new Error('No webinars found to sync');
  }

  return webinars;
}
