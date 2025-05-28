
export async function createSyncLog(supabaseClient: any, organizationId: string, userId: string) {
  const { data: syncLog } = await supabaseClient
    .from('sync_logs')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      sync_type: 'webinars_comprehensive',
      status: 'started',
    })
    .select()
    .single()

  console.log('Created sync log:', syncLog?.id)
  return syncLog
}

export async function updateSyncLog(supabaseClient: any, syncLogId: string, processedCount: number, errorCount: number) {
  const syncStatus = errorCount > 0 && processedCount === 0 ? 'failed' : 'completed'
  const errorMessage = errorCount > 0 ? `${errorCount} webinars failed to process` : null
  
  await supabaseClient
    .from('sync_logs')
    .update({
      status: syncStatus,
      records_processed: processedCount,
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq('id', syncLogId)
}

export async function logSyncError(supabaseClient: any, userId: string, errorMessage: string) {
  try {
    await supabaseClient
      .from('sync_logs')
      .insert({
        organization_id: 'unknown',
        user_id: userId,
        sync_type: 'webinars',
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
  } catch (logError) {
    console.error('Failed to log error:', logError)
  }
}
