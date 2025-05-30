
export async function storeWebinarInstance(
  supabase: any,
  userId: string,
  webinarId: string,
  instanceData: any
) {
  try {
    const { data: dbInstance, error } = await supabase
      .from('webinar_instances')
      .upsert({
        user_id: userId,
        webinar_id: webinarId,
        zoom_instance_id: instanceData.uuid,
        start_time: instanceData.start_time,
        host_id: instanceData.host_id,
        duration: instanceData.duration,
        total_participants: instanceData.participants_count || 0,
        raw_data: instanceData
      }, {
        onConflict: 'user_id,webinar_id,zoom_instance_id'
      })
      .select()
      .single();
    
    if (error) {
      console.error(`[webinarInstanceStorage] Error storing webinar instance:`, error);
      throw error;
    }
    
    console.log(`[webinarInstanceStorage] Successfully stored webinar instance ${instanceData.uuid}`);
    return dbInstance;
  } catch (error) {
    console.error('[webinarInstanceStorage] Error in storeWebinarInstance:', error);
    throw error;
  }
}
