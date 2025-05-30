export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      attendees: {
        Row: {
          created_at: string
          device_type: string | null
          duration_minutes: number | null
          email: string
          engagement_score: number | null
          id: string
          ip_address: string | null
          join_count: number | null
          join_time: string | null
          leave_time: string | null
          location: string | null
          name: string
          network_type: string | null
          organization_id: string
          registration_id: string | null
          total_attention_time: number | null
          updated_at: string
          webinar_id: string
          zoom_user_id: string | null
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          duration_minutes?: number | null
          email: string
          engagement_score?: number | null
          id?: string
          ip_address?: string | null
          join_count?: number | null
          join_time?: string | null
          leave_time?: string | null
          location?: string | null
          name: string
          network_type?: string | null
          organization_id: string
          registration_id?: string | null
          total_attention_time?: number | null
          updated_at?: string
          webinar_id: string
          zoom_user_id?: string | null
        }
        Update: {
          created_at?: string
          device_type?: string | null
          duration_minutes?: number | null
          email?: string
          engagement_score?: number | null
          id?: string
          ip_address?: string | null
          join_count?: number | null
          join_time?: string | null
          leave_time?: string | null
          location?: string | null
          name?: string
          network_type?: string | null
          organization_id?: string
          registration_id?: string | null
          total_attention_time?: number | null
          updated_at?: string
          webinar_id?: string
          zoom_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendees_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_events: {
        Row: {
          attendee_id: string
          event_data: Json | null
          event_type: string
          id: string
          organization_id: string
          timestamp: string
          webinar_id: string
        }
        Insert: {
          attendee_id: string
          event_data?: Json | null
          event_type: string
          id?: string
          organization_id: string
          timestamp?: string
          webinar_id: string
        }
        Update: {
          attendee_id?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          organization_id?: string
          timestamp?: string
          webinar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_events_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_events_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      live_participant_sessions: {
        Row: {
          attendee_id: string | null
          attention_score: number | null
          connection_quality: Json | null
          created_at: string
          device_info: Json | null
          id: string
          interaction_count: number | null
          is_active: boolean | null
          joined_at: string
          last_seen: string | null
          organization_id: string
          participant_email: string | null
          participant_name: string | null
          session_duration: number | null
          updated_at: string
          webinar_id: string
          zoom_participant_id: string | null
        }
        Insert: {
          attendee_id?: string | null
          attention_score?: number | null
          connection_quality?: Json | null
          created_at?: string
          device_info?: Json | null
          id?: string
          interaction_count?: number | null
          is_active?: boolean | null
          joined_at?: string
          last_seen?: string | null
          organization_id: string
          participant_email?: string | null
          participant_name?: string | null
          session_duration?: number | null
          updated_at?: string
          webinar_id: string
          zoom_participant_id?: string | null
        }
        Update: {
          attendee_id?: string | null
          attention_score?: number | null
          connection_quality?: Json | null
          created_at?: string
          device_info?: Json | null
          id?: string
          interaction_count?: number | null
          is_active?: boolean | null
          joined_at?: string
          last_seen?: string | null
          organization_id?: string
          participant_email?: string | null
          participant_name?: string | null
          session_duration?: number | null
          updated_at?: string
          webinar_id?: string
          zoom_participant_id?: string | null
        }
        Relationships: []
      }
      mass_resync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          current_chunk: number
          errors: Json | null
          failed_webinars: number
          id: string
          organization_id: string
          processed_webinars: number
          started_at: string | null
          status: string
          successful_webinars: number
          total_chunks: number
          total_webinars: number
          updated_at: string | null
          user_id: string
          webinar_list: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_chunk?: number
          errors?: Json | null
          failed_webinars?: number
          id?: string
          organization_id: string
          processed_webinars?: number
          started_at?: string | null
          status?: string
          successful_webinars?: number
          total_chunks?: number
          total_webinars?: number
          updated_at?: string | null
          user_id: string
          webinar_list?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_chunk?: number
          errors?: Json | null
          failed_webinars?: number
          id?: string
          organization_id?: string
          processed_webinars?: number
          started_at?: string | null
          status?: string
          successful_webinars?: number
          total_chunks?: number
          total_webinars?: number
          updated_at?: string | null
          user_id?: string
          webinar_list?: Json | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
          zoom_access_token: string | null
          zoom_connected_at: string | null
          zoom_refresh_token: string | null
          zoom_token_expires_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
          zoom_access_token?: string | null
          zoom_connected_at?: string | null
          zoom_refresh_token?: string | null
          zoom_token_expires_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
          zoom_access_token?: string | null
          zoom_connected_at?: string | null
          zoom_refresh_token?: string | null
          zoom_token_expires_at?: string | null
        }
        Relationships: []
      }
      participant_analytics: {
        Row: {
          attendee_id: string
          attention_score: number | null
          chat_messages_sent: number | null
          connection_quality: Json | null
          created_at: string
          device_info: Json | null
          engagement_timeline: Json | null
          geographic_info: Json | null
          id: string
          interaction_count: number | null
          organization_id: string
          polls_participated: number | null
          questions_asked: number | null
          updated_at: string
          webinar_id: string
        }
        Insert: {
          attendee_id: string
          attention_score?: number | null
          chat_messages_sent?: number | null
          connection_quality?: Json | null
          created_at?: string
          device_info?: Json | null
          engagement_timeline?: Json | null
          geographic_info?: Json | null
          id?: string
          interaction_count?: number | null
          organization_id: string
          polls_participated?: number | null
          questions_asked?: number | null
          updated_at?: string
          webinar_id: string
        }
        Update: {
          attendee_id?: string
          attention_score?: number | null
          chat_messages_sent?: number | null
          connection_quality?: Json | null
          created_at?: string
          device_info?: Json | null
          engagement_timeline?: Json | null
          geographic_info?: Json | null
          id?: string
          interaction_count?: number | null
          organization_id?: string
          polls_participated?: number | null
          questions_asked?: number | null
          updated_at?: string
          webinar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_analytics_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_analytics_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_behavior_segments: {
        Row: {
          average_attendance_rate: number | null
          average_engagement_score: number | null
          content_preferences: Json | null
          created_at: string
          id: string
          interaction_patterns: Json | null
          organization_id: string
          participant_count: number | null
          preferred_webinar_times: Json | null
          retention_rate: number | null
          segment_criteria: Json
          segment_description: string | null
          segment_name: string
          updated_at: string
        }
        Insert: {
          average_attendance_rate?: number | null
          average_engagement_score?: number | null
          content_preferences?: Json | null
          created_at?: string
          id?: string
          interaction_patterns?: Json | null
          organization_id: string
          participant_count?: number | null
          preferred_webinar_times?: Json | null
          retention_rate?: number | null
          segment_criteria: Json
          segment_description?: string | null
          segment_name: string
          updated_at?: string
        }
        Update: {
          average_attendance_rate?: number | null
          average_engagement_score?: number | null
          content_preferences?: Json | null
          created_at?: string
          id?: string
          interaction_patterns?: Json | null
          organization_id?: string
          participant_count?: number | null
          preferred_webinar_times?: Json | null
          retention_rate?: number | null
          segment_criteria?: Json
          segment_description?: string | null
          segment_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_behavior_segments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          zoom_access_token: string | null
          zoom_refresh_token: string | null
          zoom_token_expires_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          zoom_access_token?: string | null
          zoom_refresh_token?: string | null
          zoom_token_expires_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          zoom_access_token?: string | null
          zoom_refresh_token?: string | null
          zoom_token_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_count: number | null
          id: string
          last_error: string | null
          metadata: Json | null
          organization_id: string
          started_at: string | null
          status: string
          total_expected: number | null
          total_fetched: number | null
          total_stored: number | null
          webinar_id: string
          zoom_webinar_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_count?: number | null
          id?: string
          last_error?: string | null
          metadata?: Json | null
          organization_id: string
          started_at?: string | null
          status?: string
          total_expected?: number | null
          total_fetched?: number | null
          total_stored?: number | null
          webinar_id: string
          zoom_webinar_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_count?: number | null
          id?: string
          last_error?: string | null
          metadata?: Json | null
          organization_id?: string
          started_at?: string | null
          status?: string
          total_expected?: number | null
          total_fetched?: number | null
          total_stored?: number | null
          webinar_id?: string
          zoom_webinar_id?: string
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          current_item: number | null
          error_message: string | null
          id: string
          job_type: string
          metadata: Json | null
          organization_id: string
          progress: number | null
          started_at: string | null
          status: string
          total_items: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_item?: number | null
          error_message?: string | null
          id?: string
          job_type: string
          metadata?: Json | null
          organization_id: string
          progress?: number | null
          started_at?: string | null
          status?: string
          total_items?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_item?: number | null
          error_message?: string | null
          id?: string
          job_type?: string
          metadata?: Json | null
          organization_id?: string
          progress?: number | null
          started_at?: string | null
          status?: string
          total_items?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sync_jobs_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          organization_id: string
          records_processed: number | null
          started_at: string
          status: string
          sync_type: string
          user_id: string | null
          webinar_id: string | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          organization_id: string
          records_processed?: number | null
          started_at?: string
          status: string
          sync_type: string
          user_id?: string | null
          webinar_id?: string | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string
          records_processed?: number | null
          started_at?: string
          status?: string
          sync_type?: string
          user_id?: string | null
          webinar_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_logs_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_analytics_summary: {
        Row: {
          actual_duration_minutes: number | null
          analytics_date: string
          attendance_rate: number | null
          average_attendance: number | null
          average_engagement_score: number | null
          average_watch_time_minutes: number | null
          completion_rate: number | null
          created_at: string
          device_breakdown: Json | null
          engagement_performance_score: number | null
          geographic_breakdown: Json | null
          id: string
          organization_id: string
          overall_performance_score: number | null
          peak_attendance: number | null
          retention_performance_score: number | null
          total_attendees: number | null
          total_chat_messages: number | null
          total_poll_responses: number | null
          total_qa_questions: number | null
          total_registrants: number | null
          updated_at: string
          webinar_id: string
        }
        Insert: {
          actual_duration_minutes?: number | null
          analytics_date?: string
          attendance_rate?: number | null
          average_attendance?: number | null
          average_engagement_score?: number | null
          average_watch_time_minutes?: number | null
          completion_rate?: number | null
          created_at?: string
          device_breakdown?: Json | null
          engagement_performance_score?: number | null
          geographic_breakdown?: Json | null
          id?: string
          organization_id: string
          overall_performance_score?: number | null
          peak_attendance?: number | null
          retention_performance_score?: number | null
          total_attendees?: number | null
          total_chat_messages?: number | null
          total_poll_responses?: number | null
          total_qa_questions?: number | null
          total_registrants?: number | null
          updated_at?: string
          webinar_id: string
        }
        Update: {
          actual_duration_minutes?: number | null
          analytics_date?: string
          attendance_rate?: number | null
          average_attendance?: number | null
          average_engagement_score?: number | null
          average_watch_time_minutes?: number | null
          completion_rate?: number | null
          created_at?: string
          device_breakdown?: Json | null
          engagement_performance_score?: number | null
          geographic_breakdown?: Json | null
          id?: string
          organization_id?: string
          overall_performance_score?: number | null
          peak_attendance?: number | null
          retention_performance_score?: number | null
          total_attendees?: number | null
          total_chat_messages?: number | null
          total_poll_responses?: number | null
          total_qa_questions?: number | null
          total_registrants?: number | null
          updated_at?: string
          webinar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webinar_analytics_summary_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webinar_analytics_summary_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_authentication: {
        Row: {
          authentication_domains: string | null
          authentication_name: string | null
          authentication_option: string | null
          created_at: string | null
          enforce_login: boolean | null
          enforce_login_domains: string | null
          id: string
          meeting_authentication: boolean | null
          organization_id: string
          panelist_authentication: boolean | null
          updated_at: string | null
          webinar_id: string
        }
        Insert: {
          authentication_domains?: string | null
          authentication_name?: string | null
          authentication_option?: string | null
          created_at?: string | null
          enforce_login?: boolean | null
          enforce_login_domains?: string | null
          id?: string
          meeting_authentication?: boolean | null
          organization_id: string
          panelist_authentication?: boolean | null
          updated_at?: string | null
          webinar_id: string
        }
        Update: {
          authentication_domains?: string | null
          authentication_name?: string | null
          authentication_option?: string | null
          created_at?: string | null
          enforce_login?: boolean | null
          enforce_login_domains?: string | null
          id?: string
          meeting_authentication?: boolean | null
          organization_id?: string
          panelist_authentication?: boolean | null
          updated_at?: string | null
          webinar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webinar_authentication_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: true
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_business_metrics: {
        Row: {
          attributed_revenue: number | null
          attribution_model: string | null
          attribution_window_days: number | null
          conversion_rate: number | null
          cost_per_attendee: number | null
          cost_per_lead: number | null
          created_at: string
          direct_revenue: number | null
          id: string
          leads_generated: number | null
          marketing_cost: number | null
          organization_id: string
          pipeline_value: number | null
          platform_cost: number | null
          production_cost: number | null
          qualified_leads: number | null
          roi_percentage: number | null
          total_cost: number | null
          updated_at: string
          webinar_id: string
        }
        Insert: {
          attributed_revenue?: number | null
          attribution_model?: string | null
          attribution_window_days?: number | null
          conversion_rate?: number | null
          cost_per_attendee?: number | null
          cost_per_lead?: number | null
          created_at?: string
          direct_revenue?: number | null
          id?: string
          leads_generated?: number | null
          marketing_cost?: number | null
          organization_id: string
          pipeline_value?: number | null
          platform_cost?: number | null
          production_cost?: number | null
          qualified_leads?: number | null
          roi_percentage?: number | null
          total_cost?: number | null
          updated_at?: string
          webinar_id: string
        }
        Update: {
          attributed_revenue?: number | null
          attribution_model?: string | null
          attribution_window_days?: number | null
          conversion_rate?: number | null
          cost_per_attendee?: number | null
          cost_per_lead?: number | null
          created_at?: string
          direct_revenue?: number | null
          id?: string
          leads_generated?: number | null
          marketing_cost?: number | null
          organization_id?: string
          pipeline_value?: number | null
          platform_cost?: number | null
          production_cost?: number | null
          qualified_leads?: number | null
          roi_percentage?: number | null
          total_cost?: number | null
          updated_at?: string
          webinar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webinar_business_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webinar_business_metrics_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_comparative_analytics: {
        Row: {
          attendance_trend: number | null
          average_attendance_rate: number | null
          average_engagement_score: number | null
          created_at: string
          engagement_hotspots: Json | null
          engagement_trend: number | null
          id: string
          organization_id: string
          period_end: string
          period_start: string
          period_type: string
          registration_trend: number | null
          top_performing_webinars: Json | null
          total_attendees: number | null
          total_registrants: number | null
          total_webinars: number | null
          updated_at: string
        }
        Insert: {
          attendance_trend?: number | null
          average_attendance_rate?: number | null
          average_engagement_score?: number | null
          created_at?: string
          engagement_hotspots?: Json | null
          engagement_trend?: number | null
          id?: string
          organization_id: string
          period_end: string
          period_start: string
          period_type: string
          registration_trend?: number | null
          top_performing_webinars?: Json | null
          total_attendees?: number | null
          total_registrants?: number | null
          total_webinars?: number | null
          updated_at?: string
        }
        Update: {
          attendance_trend?: number | null
          average_attendance_rate?: number | null
          average_engagement_score?: number | null
          created_at?: string
          engagement_hotspots?: Json | null
          engagement_trend?: number | null
          id?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          registration_trend?: number | null
          top_performing_webinars?: Json | null
          total_attendees?: number | null
          total_registrants?: number | null
          total_webinars?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webinar_comparative_analytics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_engagement_timeline: {
        Row: {
          active_attendees: number | null
          chat_activity: number | null
          created_at: string
          engagement_level: number | null
          id: string
          organization_id: string
          poll_activity: number | null
          qa_activity: number | null
          significant_events: Json | null
          time_interval: number
          webinar_id: string
        }
        Insert: {
          active_attendees?: number | null
          chat_activity?: number | null
          created_at?: string
          engagement_level?: number | null
          id?: string
          organization_id: string
          poll_activity?: number | null
          qa_activity?: number | null
          significant_events?: Json | null
          time_interval: number
          webinar_id: string
        }
        Update: {
          active_attendees?: number | null
          chat_activity?: number | null
          created_at?: string
          engagement_level?: number | null
          id?: string
          organization_id?: string
          poll_activity?: number | null
          qa_activity?: number | null
          significant_events?: Json | null
          time_interval?: number
          webinar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webinar_engagement_timeline_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webinar_engagement_timeline_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_instances: {
        Row: {
          created_at: string
          duration: number | null
          host_id: string | null
          id: string
          raw_data: Json | null
          start_time: string | null
          total_participants: number | null
          updated_at: string
          user_id: string
          webinar_id: string
          zoom_instance_id: string
        }
        Insert: {
          created_at?: string
          duration?: number | null
          host_id?: string | null
          id?: string
          raw_data?: Json | null
          start_time?: string | null
          total_participants?: number | null
          updated_at?: string
          user_id: string
          webinar_id: string
          zoom_instance_id: string
        }
        Update: {
          created_at?: string
          duration?: number | null
          host_id?: string | null
          id?: string
          raw_data?: Json | null
          start_time?: string | null
          total_participants?: number | null
          updated_at?: string
          user_id?: string
          webinar_id?: string
          zoom_instance_id?: string
        }
        Relationships: []
      }
      webinar_interpreters: {
        Row: {
          created_at: string | null
          email: string
          id: string
          interpreter_type: string
          languages: string | null
          organization_id: string
          sign_language: string | null
          updated_at: string | null
          webinar_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          interpreter_type: string
          languages?: string | null
          organization_id: string
          sign_language?: string | null
          updated_at?: string | null
          webinar_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          interpreter_type?: string
          languages?: string | null
          organization_id?: string
          sign_language?: string | null
          updated_at?: string | null
          webinar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webinar_interpreters_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_live_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          organization_id: string
          participant_id: string | null
          processed: boolean | null
          timestamp: string
          webinar_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          organization_id: string
          participant_id?: string | null
          processed?: boolean | null
          timestamp?: string
          webinar_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          organization_id?: string
          participant_id?: string | null
          processed?: boolean | null
          timestamp?: string
          webinar_id?: string
        }
        Relationships: []
      }
      webinar_live_status: {
        Row: {
          created_at: string
          current_participants: number | null
          id: string
          is_live: boolean | null
          last_activity: string | null
          live_metrics: Json | null
          organization_id: string
          peak_participants: number | null
          started_at: string | null
          status: string
          updated_at: string
          webinar_id: string
        }
        Insert: {
          created_at?: string
          current_participants?: number | null
          id?: string
          is_live?: boolean | null
          last_activity?: string | null
          live_metrics?: Json | null
          organization_id: string
          peak_participants?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          webinar_id: string
        }
        Update: {
          created_at?: string
          current_participants?: number | null
          id?: string
          is_live?: boolean | null
          last_activity?: string | null
          live_metrics?: Json | null
          organization_id?: string
          peak_participants?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          webinar_id?: string
        }
        Relationships: []
      }
      webinar_notifications: {
        Row: {
          attendees_reminder_enable: boolean | null
          attendees_reminder_type: number | null
          created_at: string | null
          follow_up_absentees_enable: boolean | null
          follow_up_absentees_type: number | null
          follow_up_attendees_enable: boolean | null
          follow_up_attendees_type: number | null
          id: string
          organization_id: string
          updated_at: string | null
          webinar_id: string
        }
        Insert: {
          attendees_reminder_enable?: boolean | null
          attendees_reminder_type?: number | null
          created_at?: string | null
          follow_up_absentees_enable?: boolean | null
          follow_up_absentees_type?: number | null
          follow_up_attendees_enable?: boolean | null
          follow_up_attendees_type?: number | null
          id?: string
          organization_id: string
          updated_at?: string | null
          webinar_id: string
        }
        Update: {
          attendees_reminder_enable?: boolean | null
          attendees_reminder_type?: number | null
          created_at?: string | null
          follow_up_absentees_enable?: boolean | null
          follow_up_absentees_type?: number | null
          follow_up_attendees_enable?: boolean | null
          follow_up_attendees_type?: number | null
          id?: string
          organization_id?: string
          updated_at?: string | null
          webinar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webinar_notifications_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: true
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_occurrences: {
        Row: {
          created_at: string | null
          duration: number | null
          id: string
          occurrence_id: string
          organization_id: string
          start_time: string | null
          status: string | null
          updated_at: string | null
          webinar_id: string
        }
        Insert: {
          created_at?: string | null
          duration?: number | null
          id?: string
          occurrence_id: string
          organization_id: string
          start_time?: string | null
          status?: string | null
          updated_at?: string | null
          webinar_id: string
        }
        Update: {
          created_at?: string | null
          duration?: number | null
          id?: string
          occurrence_id?: string
          organization_id?: string
          start_time?: string | null
          status?: string | null
          updated_at?: string | null
          webinar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webinar_occurrences_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_panelists: {
        Row: {
          created_at: string
          duration_minutes: number | null
          email: string
          id: string
          invited_at: string | null
          join_url: string | null
          joined_at: string | null
          left_at: string | null
          name: string | null
          organization_id: string
          status: string | null
          updated_at: string
          virtual_background_id: string | null
          webinar_id: string
          zoom_panelist_id: string | null
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          email: string
          id?: string
          invited_at?: string | null
          join_url?: string | null
          joined_at?: string | null
          left_at?: string | null
          name?: string | null
          organization_id: string
          status?: string | null
          updated_at?: string
          virtual_background_id?: string | null
          webinar_id: string
          zoom_panelist_id?: string | null
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          email?: string
          id?: string
          invited_at?: string | null
          join_url?: string | null
          joined_at?: string | null
          left_at?: string | null
          name?: string | null
          organization_id?: string
          status?: string | null
          updated_at?: string
          virtual_background_id?: string | null
          webinar_id?: string
          zoom_panelist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webinar_panelists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webinar_panelists_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_qa_settings: {
        Row: {
          allow_anonymous_questions: boolean | null
          allow_auto_reply: boolean | null
          allow_submit_questions: boolean | null
          answer_questions: string | null
          attendees_can_comment: boolean | null
          attendees_can_upvote: boolean | null
          auto_reply_text: string | null
          created_at: string | null
          enable: boolean | null
          id: string
          organization_id: string
          updated_at: string | null
          webinar_id: string
        }
        Insert: {
          allow_anonymous_questions?: boolean | null
          allow_auto_reply?: boolean | null
          allow_submit_questions?: boolean | null
          answer_questions?: string | null
          attendees_can_comment?: boolean | null
          attendees_can_upvote?: boolean | null
          auto_reply_text?: string | null
          created_at?: string | null
          enable?: boolean | null
          id?: string
          organization_id: string
          updated_at?: string | null
          webinar_id: string
        }
        Update: {
          allow_anonymous_questions?: boolean | null
          allow_auto_reply?: boolean | null
          allow_submit_questions?: boolean | null
          answer_questions?: string | null
          attendees_can_comment?: boolean | null
          attendees_can_upvote?: boolean | null
          auto_reply_text?: string | null
          created_at?: string | null
          enable?: boolean | null
          id?: string
          organization_id?: string
          updated_at?: string | null
          webinar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webinar_qa_settings_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: true
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_recording_analytics: {
        Row: {
          access_logs: Json | null
          average_view_duration: number | null
          created_at: string
          device_analytics: Json | null
          geographic_data: Json | null
          id: string
          organization_id: string
          peak_concurrent_viewers: number | null
          recording_id: string
          sharing_permissions: Json | null
          total_views: number | null
          transcript_available: boolean | null
          transcript_content: string | null
          unique_viewers: number | null
          updated_at: string
          webinar_id: string
        }
        Insert: {
          access_logs?: Json | null
          average_view_duration?: number | null
          created_at?: string
          device_analytics?: Json | null
          geographic_data?: Json | null
          id?: string
          organization_id: string
          peak_concurrent_viewers?: number | null
          recording_id: string
          sharing_permissions?: Json | null
          total_views?: number | null
          transcript_available?: boolean | null
          transcript_content?: string | null
          unique_viewers?: number | null
          updated_at?: string
          webinar_id: string
        }
        Update: {
          access_logs?: Json | null
          average_view_duration?: number | null
          created_at?: string
          device_analytics?: Json | null
          geographic_data?: Json | null
          id?: string
          organization_id?: string
          peak_concurrent_viewers?: number | null
          recording_id?: string
          sharing_permissions?: Json | null
          total_views?: number | null
          transcript_available?: boolean | null
          transcript_content?: string | null
          unique_viewers?: number | null
          updated_at?: string
          webinar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webinar_recording_analytics_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "zoom_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webinar_recording_analytics_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_recurrence: {
        Row: {
          created_at: string | null
          end_date_time: string | null
          end_times: number | null
          id: string
          monthly_day: number | null
          monthly_week: number | null
          monthly_week_day: number | null
          organization_id: string
          recurrence_type: number
          repeat_interval: number | null
          updated_at: string | null
          webinar_id: string
          weekly_days: string | null
        }
        Insert: {
          created_at?: string | null
          end_date_time?: string | null
          end_times?: number | null
          id?: string
          monthly_day?: number | null
          monthly_week?: number | null
          monthly_week_day?: number | null
          organization_id: string
          recurrence_type: number
          repeat_interval?: number | null
          updated_at?: string | null
          webinar_id: string
          weekly_days?: string | null
        }
        Update: {
          created_at?: string | null
          end_date_time?: string | null
          end_times?: number | null
          id?: string
          monthly_day?: number | null
          monthly_week?: number | null
          monthly_week_day?: number | null
          organization_id?: string
          recurrence_type?: number
          repeat_interval?: number | null
          updated_at?: string | null
          webinar_id?: string
          weekly_days?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webinar_recurrence_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: true
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_registration_questions: {
        Row: {
          answer_options: Json | null
          created_at: string
          display_order: number | null
          field_name: string | null
          id: string
          is_required: boolean | null
          organization_id: string
          question_text: string
          question_type: string
          updated_at: string
          webinar_id: string
        }
        Insert: {
          answer_options?: Json | null
          created_at?: string
          display_order?: number | null
          field_name?: string | null
          id?: string
          is_required?: boolean | null
          organization_id: string
          question_text: string
          question_type: string
          updated_at?: string
          webinar_id: string
        }
        Update: {
          answer_options?: Json | null
          created_at?: string
          display_order?: number | null
          field_name?: string | null
          id?: string
          is_required?: boolean | null
          organization_id?: string
          question_text?: string
          question_type?: string
          updated_at?: string
          webinar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webinar_registration_questions_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_registration_responses: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          question_id: string
          registration_id: string
          response_text: string | null
          response_values: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          question_id: string
          registration_id: string
          response_text?: string | null
          response_values?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          question_id?: string
          registration_id?: string
          response_text?: string | null
          response_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "webinar_registration_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "webinar_registration_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webinar_registration_responses_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "zoom_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_settings: {
        Row: {
          add_audio_watermark: boolean | null
          add_watermark: boolean | null
          allow_host_control_participant_mute_state: boolean | null
          allow_multiple_devices: boolean | null
          alternative_host_update_polls: boolean | null
          alternative_hosts: string | null
          approval_type: number | null
          audio: string | null
          audio_conference_info: string | null
          auto_recording: string | null
          close_registration: boolean | null
          contact_email: string | null
          contact_name: string | null
          created_at: string | null
          email_in_attendee_report: boolean | null
          email_language: string | null
          enable_session_branding: boolean | null
          global_dial_in_countries: Json | null
          hd_video: boolean | null
          hd_video_for_attendees: boolean | null
          host_video: boolean | null
          id: string
          language: string | null
          notify_registrants: boolean | null
          on_demand: boolean | null
          organization_id: string
          panelists_invitation_email_notification: boolean | null
          panelists_video: boolean | null
          post_webinar_survey: boolean | null
          practice_session: boolean | null
          registrants_confirmation_email: boolean | null
          registrants_email_notification: boolean | null
          registrants_restrict_number: number | null
          registration_type: number | null
          request_permission_to_unmute: boolean | null
          send_1080p_video_to_attendees: boolean | null
          show_share_button: boolean | null
          survey_url: string | null
          updated_at: string | null
          webinar_id: string
        }
        Insert: {
          add_audio_watermark?: boolean | null
          add_watermark?: boolean | null
          allow_host_control_participant_mute_state?: boolean | null
          allow_multiple_devices?: boolean | null
          alternative_host_update_polls?: boolean | null
          alternative_hosts?: string | null
          approval_type?: number | null
          audio?: string | null
          audio_conference_info?: string | null
          auto_recording?: string | null
          close_registration?: boolean | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          email_in_attendee_report?: boolean | null
          email_language?: string | null
          enable_session_branding?: boolean | null
          global_dial_in_countries?: Json | null
          hd_video?: boolean | null
          hd_video_for_attendees?: boolean | null
          host_video?: boolean | null
          id?: string
          language?: string | null
          notify_registrants?: boolean | null
          on_demand?: boolean | null
          organization_id: string
          panelists_invitation_email_notification?: boolean | null
          panelists_video?: boolean | null
          post_webinar_survey?: boolean | null
          practice_session?: boolean | null
          registrants_confirmation_email?: boolean | null
          registrants_email_notification?: boolean | null
          registrants_restrict_number?: number | null
          registration_type?: number | null
          request_permission_to_unmute?: boolean | null
          send_1080p_video_to_attendees?: boolean | null
          show_share_button?: boolean | null
          survey_url?: string | null
          updated_at?: string | null
          webinar_id: string
        }
        Update: {
          add_audio_watermark?: boolean | null
          add_watermark?: boolean | null
          allow_host_control_participant_mute_state?: boolean | null
          allow_multiple_devices?: boolean | null
          alternative_host_update_polls?: boolean | null
          alternative_hosts?: string | null
          approval_type?: number | null
          audio?: string | null
          audio_conference_info?: string | null
          auto_recording?: string | null
          close_registration?: boolean | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          email_in_attendee_report?: boolean | null
          email_language?: string | null
          enable_session_branding?: boolean | null
          global_dial_in_countries?: Json | null
          hd_video?: boolean | null
          hd_video_for_attendees?: boolean | null
          host_video?: boolean | null
          id?: string
          language?: string | null
          notify_registrants?: boolean | null
          on_demand?: boolean | null
          organization_id?: string
          panelists_invitation_email_notification?: boolean | null
          panelists_video?: boolean | null
          post_webinar_survey?: boolean | null
          practice_session?: boolean | null
          registrants_confirmation_email?: boolean | null
          registrants_email_notification?: boolean | null
          registrants_restrict_number?: number | null
          registration_type?: number | null
          request_permission_to_unmute?: boolean | null
          send_1080p_video_to_attendees?: boolean | null
          show_share_button?: boolean | null
          survey_url?: string | null
          updated_at?: string | null
          webinar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webinar_settings_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: true
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_source_tracking: {
        Row: {
          approval_history: Json | null
          created_at: string
          creation_workflow: Json | null
          id: string
          organization_id: string
          source_metadata: Json | null
          source_type: string
          template_id: string | null
          updated_at: string
          webinar_id: string
        }
        Insert: {
          approval_history?: Json | null
          created_at?: string
          creation_workflow?: Json | null
          id?: string
          organization_id: string
          source_metadata?: Json | null
          source_type: string
          template_id?: string | null
          updated_at?: string
          webinar_id: string
        }
        Update: {
          approval_history?: Json | null
          created_at?: string
          creation_workflow?: Json | null
          id?: string
          organization_id?: string
          source_metadata?: Json | null
          source_type?: string
          template_id?: string | null
          updated_at?: string
          webinar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webinar_source_tracking_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "webinar_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webinar_source_tracking_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_template_settings: {
        Row: {
          branding_data: Json | null
          created_at: string
          id: string
          organization_id: string
          settings_data: Json
          template_id: string
          updated_at: string
        }
        Insert: {
          branding_data?: Json | null
          created_at?: string
          id?: string
          organization_id: string
          settings_data?: Json
          template_id: string
          updated_at?: string
        }
        Update: {
          branding_data?: Json | null
          created_at?: string
          id?: string
          organization_id?: string
          settings_data?: Json
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webinar_template_settings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "webinar_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          organization_id: string
          template_type: string | null
          updated_at: string
          user_id: string | null
          zoom_template_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          organization_id: string
          template_type?: string | null
          updated_at?: string
          user_id?: string | null
          zoom_template_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string
          template_type?: string | null
          updated_at?: string
          user_id?: string | null
          zoom_template_id?: string
        }
        Relationships: []
      }
      webinar_tracking_fields: {
        Row: {
          created_at: string | null
          field_name: string
          field_value: string
          id: string
          organization_id: string
          updated_at: string | null
          visible: boolean | null
          webinar_id: string
        }
        Insert: {
          created_at?: string | null
          field_name: string
          field_value: string
          id?: string
          organization_id: string
          updated_at?: string | null
          visible?: boolean | null
          webinar_id: string
        }
        Update: {
          created_at?: string | null
          field_name?: string
          field_value?: string
          id?: string
          organization_id?: string
          updated_at?: string | null
          visible?: boolean | null
          webinar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webinar_tracking_fields_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      webinars: {
        Row: {
          agenda: string | null
          attendees_count: number | null
          created_at: string
          created_at_zoom: string | null
          creation_source: string | null
          duration_minutes: number | null
          encrypted_passcode: string | null
          encrypted_password: string | null
          end_time: string | null
          h323_passcode: string | null
          has_recording: boolean | null
          host_email: string | null
          host_id: string | null
          host_name: string | null
          id: string
          is_simulive: boolean | null
          join_url: string | null
          organization_id: string
          password: string | null
          pstn_password: string | null
          record_file_id: string | null
          recording_count: number | null
          registrants_count: number | null
          registration_url: string | null
          start_time: string | null
          start_url: string | null
          status: Database["public"]["Enums"]["webinar_status"] | null
          timezone: string | null
          title: string
          transition_to_live: boolean | null
          updated_at: string
          user_id: string | null
          uuid: string | null
          webinar_number: number | null
          webinar_type: string | null
          zoom_webinar_id: string | null
        }
        Insert: {
          agenda?: string | null
          attendees_count?: number | null
          created_at?: string
          created_at_zoom?: string | null
          creation_source?: string | null
          duration_minutes?: number | null
          encrypted_passcode?: string | null
          encrypted_password?: string | null
          end_time?: string | null
          h323_passcode?: string | null
          has_recording?: boolean | null
          host_email?: string | null
          host_id?: string | null
          host_name?: string | null
          id?: string
          is_simulive?: boolean | null
          join_url?: string | null
          organization_id: string
          password?: string | null
          pstn_password?: string | null
          record_file_id?: string | null
          recording_count?: number | null
          registrants_count?: number | null
          registration_url?: string | null
          start_time?: string | null
          start_url?: string | null
          status?: Database["public"]["Enums"]["webinar_status"] | null
          timezone?: string | null
          title: string
          transition_to_live?: boolean | null
          updated_at?: string
          user_id?: string | null
          uuid?: string | null
          webinar_number?: number | null
          webinar_type?: string | null
          zoom_webinar_id?: string | null
        }
        Update: {
          agenda?: string | null
          attendees_count?: number | null
          created_at?: string
          created_at_zoom?: string | null
          creation_source?: string | null
          duration_minutes?: number | null
          encrypted_passcode?: string | null
          encrypted_password?: string | null
          end_time?: string | null
          h323_passcode?: string | null
          has_recording?: boolean | null
          host_email?: string | null
          host_id?: string | null
          host_name?: string | null
          id?: string
          is_simulive?: boolean | null
          join_url?: string | null
          organization_id?: string
          password?: string | null
          pstn_password?: string | null
          record_file_id?: string | null
          recording_count?: number | null
          registrants_count?: number | null
          registration_url?: string | null
          start_time?: string | null
          start_url?: string | null
          status?: Database["public"]["Enums"]["webinar_status"] | null
          timezone?: string | null
          title?: string
          transition_to_live?: boolean | null
          updated_at?: string
          user_id?: string | null
          uuid?: string | null
          webinar_number?: number | null
          webinar_type?: string | null
          zoom_webinar_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webinars_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      zoom_chat_messages: {
        Row: {
          attendee_id: string | null
          id: string
          message: string
          message_type: string | null
          organization_id: string
          sender_email: string | null
          sender_name: string
          timestamp: string
          webinar_id: string
        }
        Insert: {
          attendee_id?: string | null
          id?: string
          message: string
          message_type?: string | null
          organization_id: string
          sender_email?: string | null
          sender_name: string
          timestamp?: string
          webinar_id: string
        }
        Update: {
          attendee_id?: string | null
          id?: string
          message?: string
          message_type?: string | null
          organization_id?: string
          sender_email?: string | null
          sender_name?: string
          timestamp?: string
          webinar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zoom_chat_messages_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zoom_chat_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zoom_chat_messages_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      zoom_connections: {
        Row: {
          connection_status: string
          created_at: string
          credentials_stored_at: string | null
          encrypted_account_id: string | null
          encrypted_client_id: string | null
          encrypted_client_secret: string | null
          id: string
          organization_id: string
          permissions: Json | null
          updated_at: string
          user_id: string | null
          zoom_email: string | null
          zoom_user_id: string | null
        }
        Insert: {
          connection_status?: string
          created_at?: string
          credentials_stored_at?: string | null
          encrypted_account_id?: string | null
          encrypted_client_id?: string | null
          encrypted_client_secret?: string | null
          id?: string
          organization_id: string
          permissions?: Json | null
          updated_at?: string
          user_id?: string | null
          zoom_email?: string | null
          zoom_user_id?: string | null
        }
        Update: {
          connection_status?: string
          created_at?: string
          credentials_stored_at?: string | null
          encrypted_account_id?: string | null
          encrypted_client_id?: string | null
          encrypted_client_secret?: string | null
          id?: string
          organization_id?: string
          permissions?: Json | null
          updated_at?: string
          user_id?: string | null
          zoom_email?: string | null
          zoom_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zoom_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      zoom_poll_responses: {
        Row: {
          attendee_id: string | null
          id: string
          organization_id: string
          participant_email: string | null
          participant_name: string | null
          poll_id: string
          response: string
          timestamp: string
        }
        Insert: {
          attendee_id?: string | null
          id?: string
          organization_id: string
          participant_email?: string | null
          participant_name?: string | null
          poll_id: string
          response: string
          timestamp?: string
        }
        Update: {
          attendee_id?: string | null
          id?: string
          organization_id?: string
          participant_email?: string | null
          participant_name?: string | null
          poll_id?: string
          response?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "zoom_poll_responses_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zoom_poll_responses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zoom_poll_responses_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "zoom_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      zoom_polls: {
        Row: {
          created_at: string
          id: string
          options: Json | null
          organization_id: string
          poll_type: string | null
          question: string
          results: Json | null
          title: string
          total_responses: number | null
          webinar_id: string
          zoom_poll_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          options?: Json | null
          organization_id: string
          poll_type?: string | null
          question: string
          results?: Json | null
          title: string
          total_responses?: number | null
          webinar_id: string
          zoom_poll_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          options?: Json | null
          organization_id?: string
          poll_type?: string | null
          question?: string
          results?: Json | null
          title?: string
          total_responses?: number | null
          webinar_id?: string
          zoom_poll_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zoom_polls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zoom_polls_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      zoom_qa_sessions: {
        Row: {
          answer: string | null
          answered_by: string | null
          asker_email: string | null
          asker_name: string | null
          created_at: string
          id: string
          organization_id: string
          question: string
          timestamp: string
          webinar_id: string
          zoom_qa_id: string | null
        }
        Insert: {
          answer?: string | null
          answered_by?: string | null
          asker_email?: string | null
          asker_name?: string | null
          created_at?: string
          id?: string
          organization_id: string
          question: string
          timestamp?: string
          webinar_id: string
          zoom_qa_id?: string | null
        }
        Update: {
          answer?: string | null
          answered_by?: string | null
          asker_email?: string | null
          asker_name?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          question?: string
          timestamp?: string
          webinar_id?: string
          zoom_qa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zoom_qa_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zoom_qa_sessions_webinar_id_fkey"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      zoom_recordings: {
        Row: {
          created_at: string
          download_url: string | null
          file_size: number | null
          file_type: string | null
          id: string
          organization_id: string
          password: string | null
          play_url: string | null
          recording_end: string | null
          recording_start: string | null
          recording_type: string
          status: string | null
          webinar_id: string
          zoom_recording_id: string | null
        }
        Insert: {
          created_at?: string
          download_url?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          organization_id: string
          password?: string | null
          play_url?: string | null
          recording_end?: string | null
          recording_start?: string | null
          recording_type: string
          status?: string | null
          webinar_id: string
          zoom_recording_id?: string | null
        }
        Update: {
          created_at?: string
          download_url?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          organization_id?: string
          password?: string | null
          play_url?: string | null
          recording_end?: string | null
          recording_start?: string | null
          recording_type?: string
          status?: string | null
          webinar_id?: string
          zoom_recording_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_recordings_webinar"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      zoom_registrations: {
        Row: {
          created_at: string
          custom_questions: Json | null
          email: string
          first_name: string | null
          id: string
          join_url: string | null
          last_name: string | null
          last_synced_at: string | null
          organization_id: string
          registration_time: string | null
          source_api_status: string | null
          status: string
          sync_batch_id: string | null
          updated_at: string
          webinar_id: string
          zoom_registrant_id: string | null
        }
        Insert: {
          created_at?: string
          custom_questions?: Json | null
          email: string
          first_name?: string | null
          id?: string
          join_url?: string | null
          last_name?: string | null
          last_synced_at?: string | null
          organization_id: string
          registration_time?: string | null
          source_api_status?: string | null
          status?: string
          sync_batch_id?: string | null
          updated_at?: string
          webinar_id: string
          zoom_registrant_id?: string | null
        }
        Update: {
          created_at?: string
          custom_questions?: Json | null
          email?: string
          first_name?: string | null
          id?: string
          join_url?: string | null
          last_name?: string | null
          last_synced_at?: string | null
          organization_id?: string
          registration_time?: string | null
          source_api_status?: string | null
          status?: string
          sync_batch_id?: string | null
          updated_at?: string
          webinar_id?: string
          zoom_registrant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_registrations_webinar"
            columns: ["webinar_id"]
            isOneToOne: false
            referencedRelation: "webinars"
            referencedColumns: ["id"]
          },
        ]
      }
      zoom_webhook_events: {
        Row: {
          created_at: string
          event_ts: string | null
          event_type: string
          id: string
          organization_id: string
          payload: Json
          processed: boolean | null
          processing_error: string | null
          webhook_id: string | null
          webinar_id: string | null
        }
        Insert: {
          created_at?: string
          event_ts?: string | null
          event_type: string
          id?: string
          organization_id: string
          payload: Json
          processed?: boolean | null
          processing_error?: string | null
          webhook_id?: string | null
          webinar_id?: string | null
        }
        Update: {
          created_at?: string
          event_ts?: string | null
          event_type?: string
          id?: string
          organization_id?: string
          payload?: Json
          processed?: boolean | null
          processing_error?: string | null
          webhook_id?: string | null
          webinar_id?: string | null
        }
        Relationships: []
      }
      zoom_webinar_instance_participants: {
        Row: {
          created_at: string
          duration: number | null
          email: string
          id: string
          instance_id: string
          join_time: string | null
          leave_time: string | null
          name: string | null
          participant_id: string
          participant_type: string
          raw_data: Json | null
          updated_at: string
          user_id: string
          webinar_id: string
        }
        Insert: {
          created_at?: string
          duration?: number | null
          email: string
          id?: string
          instance_id: string
          join_time?: string | null
          leave_time?: string | null
          name?: string | null
          participant_id: string
          participant_type: string
          raw_data?: Json | null
          updated_at?: string
          user_id: string
          webinar_id: string
        }
        Update: {
          created_at?: string
          duration?: number | null
          email?: string
          id?: string
          instance_id?: string
          join_time?: string | null
          leave_time?: string | null
          name?: string | null
          participant_id?: string
          participant_type?: string
          raw_data?: Json | null
          updated_at?: string
          user_id?: string
          webinar_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_inactive_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_user_organization_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      update_webinar_status: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      user_role: "admin" | "analyst" | "host" | "viewer"
      webinar_status:
        | "scheduled"
        | "upcoming"
        | "live"
        | "completed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["admin", "analyst", "host", "viewer"],
      webinar_status: [
        "scheduled",
        "upcoming",
        "live",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
