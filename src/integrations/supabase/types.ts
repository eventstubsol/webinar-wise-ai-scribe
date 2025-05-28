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
          organization_id: string
          registration_time: string | null
          status: string
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
          organization_id: string
          registration_time?: string | null
          status?: string
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
          organization_id?: string
          registration_time?: string | null
          status?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
