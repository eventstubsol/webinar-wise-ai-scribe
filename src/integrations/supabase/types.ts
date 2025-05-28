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
          duration_minutes: number | null
          email: string
          engagement_score: number | null
          id: string
          join_time: string | null
          leave_time: string | null
          name: string
          organization_id: string
          updated_at: string
          webinar_id: string
          zoom_user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          email: string
          engagement_score?: number | null
          id?: string
          join_time?: string | null
          leave_time?: string | null
          name: string
          organization_id: string
          updated_at?: string
          webinar_id: string
          zoom_user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          email?: string
          engagement_score?: number | null
          id?: string
          join_time?: string | null
          leave_time?: string | null
          name?: string
          organization_id?: string
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
      webinars: {
        Row: {
          attendees_count: number | null
          created_at: string
          duration_minutes: number | null
          end_time: string | null
          host_name: string | null
          id: string
          organization_id: string
          registrants_count: number | null
          start_time: string | null
          title: string
          updated_at: string
          zoom_webinar_id: string | null
        }
        Insert: {
          attendees_count?: number | null
          created_at?: string
          duration_minutes?: number | null
          end_time?: string | null
          host_name?: string | null
          id?: string
          organization_id: string
          registrants_count?: number | null
          start_time?: string | null
          title: string
          updated_at?: string
          zoom_webinar_id?: string | null
        }
        Update: {
          attendees_count?: number | null
          created_at?: string
          duration_minutes?: number | null
          end_time?: string | null
          host_name?: string | null
          id?: string
          organization_id?: string
          registrants_count?: number | null
          start_time?: string | null
          title?: string
          updated_at?: string
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
          id: string
          organization_id: string
          permissions: Json | null
          updated_at: string
          zoom_email: string
          zoom_user_id: string
        }
        Insert: {
          connection_status?: string
          created_at?: string
          id?: string
          organization_id: string
          permissions?: Json | null
          updated_at?: string
          zoom_email: string
          zoom_user_id: string
        }
        Update: {
          connection_status?: string
          created_at?: string
          id?: string
          organization_id?: string
          permissions?: Json | null
          updated_at?: string
          zoom_email?: string
          zoom_user_id?: string
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
    }
    Enums: {
      user_role: "admin" | "analyst" | "host" | "viewer"
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
    },
  },
} as const
