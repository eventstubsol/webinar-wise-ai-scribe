
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalyticsRequest {
  webinar_id?: string
  organization_id: string
  analytics_type: 'summary' | 'timeline' | 'comparative' | 'segments' | 'business'
  period_start?: string
  period_end?: string
  period_type?: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
}

async function calculateWebinarAnalyticsSummary(supabaseClient: any, webinar_id: string, organization_id: string) {
  console.log(`Calculating analytics summary for webinar: ${webinar_id}`)

  // Get webinar basic data
  const { data: webinar } = await supabaseClient
    .from('webinars')
    .select('*')
    .eq('id', webinar_id)
    .single()

  if (!webinar) {
    throw new Error('Webinar not found')
  }

  // Get attendees data
  const { data: attendees } = await supabaseClient
    .from('attendees')
    .select('*')
    .eq('webinar_id', webinar_id)

  // Get registrations data
  const { data: registrations } = await supabaseClient
    .from('zoom_registrations')
    .select('*')
    .eq('webinar_id', webinar_id)

  // Get chat messages
  const { data: chatMessages } = await supabaseClient
    .from('zoom_chat_messages')
    .select('*')
    .eq('webinar_id', webinar_id)

  // Get poll responses
  const { data: pollResponses } = await supabaseClient
    .from('zoom_poll_responses')
    .select('*')
    .eq('organization_id', organization_id)

  // Get Q&A sessions
  const { data: qaSessions } = await supabaseClient
    .from('zoom_qa_sessions')
    .select('*')
    .eq('webinar_id', webinar_id)

  // Calculate metrics
  const totalRegistrants = registrations?.length || 0
  const totalAttendees = attendees?.length || 0
  const attendanceRate = totalRegistrants > 0 ? (totalAttendees / totalRegistrants) * 100 : 0

  // Calculate engagement score
  const totalChatMessages = chatMessages?.length || 0
  const totalPollResponses = pollResponses?.length || 0
  const totalQaQuestions = qaSessions?.length || 0

  const engagementScore = totalAttendees > 0 
    ? ((totalChatMessages + totalPollResponses + totalQaQuestions) / totalAttendees) * 10
    : 0

  // Calculate average watch time and completion rate
  const averageWatchTime = attendees?.reduce((sum, a) => sum + (a.duration_minutes || 0), 0) / (totalAttendees || 1)
  const completionRate = webinar.duration_minutes > 0 
    ? (averageWatchTime / webinar.duration_minutes) * 100
    : 0

  // Device and geographic breakdown
  const deviceBreakdown = attendees?.reduce((acc, attendee) => {
    const device = attendee.device_type || 'unknown'
    acc[device] = (acc[device] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  const geographicBreakdown = attendees?.reduce((acc, attendee) => {
    const location = attendee.location || 'unknown'
    acc[location] = (acc[location] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  // Calculate performance scores
  const engagementPerformanceScore = Math.min(engagementScore * 10, 100)
  const retentionPerformanceScore = Math.min(completionRate, 100)
  const overallPerformanceScore = (attendanceRate + engagementPerformanceScore + retentionPerformanceScore) / 3

  const analyticsData = {
    webinar_id,
    organization_id,
    analytics_date: new Date().toISOString().split('T')[0],
    total_registrants: totalRegistrants,
    total_attendees: totalAttendees,
    attendance_rate: Math.round(attendanceRate * 100) / 100,
    peak_attendance: totalAttendees, // Simplified for now
    average_attendance: totalAttendees,
    average_engagement_score: Math.round(engagementScore * 100) / 100,
    total_chat_messages: totalChatMessages,
    total_poll_responses: totalPollResponses,
    total_qa_questions: totalQaQuestions,
    actual_duration_minutes: webinar.duration_minutes || 0,
    average_watch_time_minutes: Math.round(averageWatchTime * 100) / 100,
    completion_rate: Math.round(completionRate * 100) / 100,
    device_breakdown: deviceBreakdown,
    geographic_breakdown: geographicBreakdown,
    overall_performance_score: Math.round(overallPerformanceScore * 100) / 100,
    engagement_performance_score: Math.round(engagementPerformanceScore * 100) / 100,
    retention_performance_score: Math.round(retentionPerformanceScore * 100) / 100
  }

  // Insert or update analytics summary
  const { data: existingSummary } = await supabaseClient
    .from('webinar_analytics_summary')
    .select('id')
    .eq('webinar_id', webinar_id)
    .eq('analytics_date', analyticsData.analytics_date)
    .single()

  if (existingSummary) {
    await supabaseClient
      .from('webinar_analytics_summary')
      .update(analyticsData)
      .eq('id', existingSummary.id)
  } else {
    await supabaseClient
      .from('webinar_analytics_summary')
      .insert(analyticsData)
  }

  return analyticsData
}

async function calculateEngagementTimeline(supabaseClient: any, webinar_id: string, organization_id: string) {
  console.log(`Calculating engagement timeline for webinar: ${webinar_id}`)

  // Get webinar duration
  const { data: webinar } = await supabaseClient
    .from('webinars')
    .select('duration_minutes, start_time')
    .eq('id', webinar_id)
    .single()

  if (!webinar || !webinar.duration_minutes) {
    throw new Error('Webinar data incomplete')
  }

  // Create timeline data for each 5-minute interval
  const timelineData = []
  const intervalMinutes = 5
  const totalIntervals = Math.ceil(webinar.duration_minutes / intervalMinutes)

  for (let i = 0; i < totalIntervals; i++) {
    const timeInterval = i * intervalMinutes

    // For now, simulate engagement data
    // In a real implementation, you'd aggregate actual timestamp-based data
    const baseEngagement = 75 + Math.random() * 25 // 75-100%
    const engagementLevel = Math.max(0, baseEngagement - (i * 2)) // Slight decline over time

    timelineData.push({
      webinar_id,
      organization_id,
      time_interval: timeInterval,
      active_attendees: Math.floor(50 * (engagementLevel / 100)), // Simulated
      engagement_level: Math.round(engagementLevel * 100) / 100,
      chat_activity: Math.floor(Math.random() * 10),
      poll_activity: Math.floor(Math.random() * 5),
      qa_activity: Math.floor(Math.random() * 3),
      significant_events: []
    })
  }

  // Clear existing timeline data and insert new
  await supabaseClient
    .from('webinar_engagement_timeline')
    .delete()
    .eq('webinar_id', webinar_id)

  if (timelineData.length > 0) {
    await supabaseClient
      .from('webinar_engagement_timeline')
      .insert(timelineData)
  }

  return timelineData
}

async function calculateComparativeAnalytics(supabaseClient: any, organization_id: string, period_type: string, period_start: string, period_end: string) {
  console.log(`Calculating comparative analytics for org: ${organization_id}, period: ${period_type}`)

  // Get webinars in the period
  const { data: webinars } = await supabaseClient
    .from('webinars')
    .select(`
      id,
      title,
      start_time,
      attendees_count,
      registrants_count
    `)
    .eq('organization_id', organization_id)
    .gte('start_time', period_start)
    .lte('start_time', period_end)

  if (!webinars || webinars.length === 0) {
    throw new Error('No webinars found in period')
  }

  // Get analytics summaries for these webinars
  const webinarIds = webinars.map(w => w.id)
  const { data: analyticsSummaries } = await supabaseClient
    .from('webinar_analytics_summary')
    .select('*')
    .in('webinar_id', webinarIds)

  // Calculate aggregated metrics
  const totalWebinars = webinars.length
  const totalRegistrants = webinars.reduce((sum, w) => sum + (w.registrants_count || 0), 0)
  const totalAttendees = webinars.reduce((sum, w) => sum + (w.attendees_count || 0), 0)
  const averageAttendanceRate = totalRegistrants > 0 ? (totalAttendees / totalRegistrants) * 100 : 0

  const averageEngagementScore = analyticsSummaries?.length > 0
    ? analyticsSummaries.reduce((sum, a) => sum + (a.average_engagement_score || 0), 0) / analyticsSummaries.length
    : 0

  // Find top performing webinars
  const topPerformingWebinars = analyticsSummaries
    ?.sort((a, b) => (b.overall_performance_score || 0) - (a.overall_performance_score || 0))
    .slice(0, 5)
    .map(a => ({
      webinar_id: a.webinar_id,
      performance_score: a.overall_performance_score,
      attendance_rate: a.attendance_rate,
      engagement_score: a.average_engagement_score
    })) || []

  const comparativeData = {
    organization_id,
    period_type,
    period_start,
    period_end,
    total_webinars: totalWebinars,
    total_registrants: totalRegistrants,
    total_attendees: totalAttendees,
    average_attendance_rate: Math.round(averageAttendanceRate * 100) / 100,
    average_engagement_score: Math.round(averageEngagementScore * 100) / 100,
    attendance_trend: 0, // Would calculate based on previous period
    engagement_trend: 0,
    registration_trend: 0,
    top_performing_webinars: topPerformingWebinars,
    engagement_hotspots: []
  }

  // Insert or update comparative analytics
  const { data: existing } = await supabaseClient
    .from('webinar_comparative_analytics')
    .select('id')
    .eq('organization_id', organization_id)
    .eq('period_type', period_type)
    .eq('period_start', period_start)
    .eq('period_end', period_end)
    .single()

  if (existing) {
    await supabaseClient
      .from('webinar_comparative_analytics')
      .update(comparativeData)
      .eq('id', existing.id)
  } else {
    await supabaseClient
      .from('webinar_comparative_analytics')
      .insert(comparativeData)
  }

  return comparativeData
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { webinar_id, organization_id, analytics_type, period_start, period_end, period_type }: AnalyticsRequest = await req.json()

    if (!organization_id) {
      throw new Error('Organization ID is required')
    }

    let result

    switch (analytics_type) {
      case 'summary':
        if (!webinar_id) throw new Error('Webinar ID required for summary analytics')
        result = await calculateWebinarAnalyticsSummary(supabaseClient, webinar_id, organization_id)
        break

      case 'timeline':
        if (!webinar_id) throw new Error('Webinar ID required for timeline analytics')
        result = await calculateEngagementTimeline(supabaseClient, webinar_id, organization_id)
        break

      case 'comparative':
        if (!period_start || !period_end || !period_type) {
          throw new Error('Period parameters required for comparative analytics')
        }
        result = await calculateComparativeAnalytics(supabaseClient, organization_id, period_type, period_start, period_end)
        break

      default:
        throw new Error(`Unsupported analytics type: ${analytics_type}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        analytics_type,
        data: result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Analytics processor error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
