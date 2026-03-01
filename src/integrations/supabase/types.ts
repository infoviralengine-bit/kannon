export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      campaign_creators: {
        Row: {
          campaign_id: string
          creator_id: string
          id: string
          joined_at: string | null
        }
        Insert: {
          campaign_id: string
          creator_id: string
          id?: string
          joined_at?: string | null
        }
        Update: {
          campaign_id?: string
          creator_id?: string
          id?: string
          joined_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_creators_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_creators_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          client_cpm: number | null
          client_fixed_per_creator: number | null
          client_name: string
          client_profile_id: string | null
          created_at: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          planned_creators: number
          start_date: string
          status: string
        }
        Insert: {
          client_cpm?: number | null
          client_fixed_per_creator?: number | null
          client_name: string
          client_profile_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          planned_creators?: number
          start_date: string
          status?: string
        }
        Update: {
          client_cpm?: number | null
          client_fixed_per_creator?: number | null
          client_name?: string
          client_profile_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          planned_creators?: number
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payments: {
        Row: {
          campaign_id: string
          cpm_amount: number
          cpm_views: number
          created_at: string
          cycle_id: string
          cycle_number: number
          due_date: string
          fixed_amount: number
          id: string
          is_paid: boolean
          notes: string | null
          paid_at: string | null
          total_amount: number
          views_paid_cumulative: number
          views_snapshot_at: string | null
        }
        Insert: {
          campaign_id: string
          cpm_amount?: number
          cpm_views?: number
          created_at?: string
          cycle_id: string
          cycle_number: number
          due_date: string
          fixed_amount?: number
          id?: string
          is_paid?: boolean
          notes?: string | null
          paid_at?: string | null
          total_amount?: number
          views_paid_cumulative?: number
          views_snapshot_at?: string | null
        }
        Update: {
          campaign_id?: string
          cpm_amount?: number
          cpm_views?: number
          created_at?: string
          cycle_id?: string
          cycle_number?: number
          due_date?: string
          fixed_amount?: number
          id?: string
          is_paid?: boolean
          notes?: string | null
          paid_at?: string | null
          total_amount?: number
          views_paid_cumulative?: number
          views_snapshot_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_payments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "payment_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_payments: {
        Row: {
          cpm_amount: number
          created_at: string
          creator_id: string
          fixed_amount: number
          fixed_earned: boolean
          id: string
          is_paid: boolean
          notes: string | null
          paid_at: string | null
          period_month: number
          period_year: number
          total_amount: number
        }
        Insert: {
          cpm_amount?: number
          created_at?: string
          creator_id: string
          fixed_amount?: number
          fixed_earned?: boolean
          id?: string
          is_paid?: boolean
          notes?: string | null
          paid_at?: string | null
          period_month: number
          period_year: number
          total_amount?: number
        }
        Update: {
          cpm_amount?: number
          created_at?: string
          creator_id?: string
          fixed_amount?: number
          fixed_earned?: boolean
          id?: string
          is_paid?: boolean
          notes?: string | null
          paid_at?: string | null
          period_month?: number
          period_year?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_payments_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          created_at: string
          creator_cpm: number | null
          creator_fixed: number | null
          email: string | null
          id: string
          min_videos_per_day: number | null
          name: string
          phone: string | null
          profile_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          creator_cpm?: number | null
          creator_fixed?: number | null
          email?: string | null
          id?: string
          min_videos_per_day?: number | null
          name: string
          phone?: string | null
          profile_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          creator_cpm?: number | null
          creator_fixed?: number | null
          email?: string | null
          id?: string
          min_videos_per_day?: number | null
          name?: string
          phone?: string | null
          profile_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "creators_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_stats: {
        Row: {
          created_at: string
          date: string
          dm_sent: number | null
          id: string
          replies_received: number | null
          tiktok_account_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          dm_sent?: number | null
          id?: string
          replies_received?: number | null
          tiktok_account_id: string
        }
        Update: {
          created_at?: string
          date?: string
          dm_sent?: number | null
          id?: string
          replies_received?: number | null
          tiktok_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_stats_tiktok_account_id_fkey"
            columns: ["tiktok_account_id"]
            isOneToOne: false
            referencedRelation: "tiktok_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_cycles: {
        Row: {
          campaign_id: string
          created_at: string
          cycle_end_date: string
          cycle_number: number
          cycle_start_date: string
          id: string
          is_last_cycle: boolean
        }
        Insert: {
          campaign_id: string
          created_at?: string
          cycle_end_date: string
          cycle_number: number
          cycle_start_date: string
          id?: string
          is_last_cycle?: boolean
        }
        Update: {
          campaign_id?: string
          created_at?: string
          cycle_end_date?: string
          cycle_number?: number
          cycle_start_date?: string
          id?: string
          is_last_cycle?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payment_cycles_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          cpm_amount: number | null
          created_at: string
          creator_id: string
          fixed_amount: number | null
          fixed_earned: boolean | null
          id: string
          is_paid: boolean | null
          notes: string | null
          paid_at: string | null
          period_month: number
          period_year: number
          total_amount: number | null
        }
        Insert: {
          cpm_amount?: number | null
          created_at?: string
          creator_id: string
          fixed_amount?: number | null
          fixed_earned?: boolean | null
          id?: string
          is_paid?: boolean | null
          notes?: string | null
          paid_at?: string | null
          period_month: number
          period_year: number
          total_amount?: number | null
        }
        Update: {
          cpm_amount?: number | null
          created_at?: string
          creator_id?: string
          fixed_amount?: number | null
          fixed_earned?: boolean | null
          id?: string
          is_paid?: boolean | null
          notes?: string | null
          paid_at?: string | null
          period_month?: number
          period_year?: number
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      tiktok_accounts: {
        Row: {
          account_type: string
          campaign_id: string | null
          created_at: string
          creator_id: string | null
          id: string
          is_active: boolean | null
          username: string
        }
        Insert: {
          account_type: string
          campaign_id?: string | null
          created_at?: string
          creator_id?: string | null
          id?: string
          is_active?: boolean | null
          username: string
        }
        Update: {
          account_type?: string
          campaign_id?: string | null
          created_at?: string
          creator_id?: string | null
          id?: string
          is_active?: boolean | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_accounts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_accounts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          comments: number | null
          created_at: string
          id: string
          last_scraped_at: string | null
          likes: number | null
          published_at: string
          tiktok_account_id: string
          tiktok_video_id: string
          views: number | null
          views_at_last_payment: number
          views_final: number | null
          window_closed: boolean
          window_expires_at: string | null
        }
        Insert: {
          comments?: number | null
          created_at?: string
          id?: string
          last_scraped_at?: string | null
          likes?: number | null
          published_at: string
          tiktok_account_id: string
          tiktok_video_id: string
          views?: number | null
          views_at_last_payment?: number
          views_final?: number | null
          window_closed?: boolean
          window_expires_at?: string | null
        }
        Update: {
          comments?: number | null
          created_at?: string
          id?: string
          last_scraped_at?: string | null
          likes?: number | null
          published_at?: string
          tiktok_account_id?: string
          tiktok_video_id?: string
          views?: number | null
          views_at_last_payment?: number
          views_final?: number | null
          window_closed?: boolean
          window_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_tiktok_account_id_fkey"
            columns: ["tiktok_account_id"]
            isOneToOne: false
            referencedRelation: "tiktok_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bulk_update_video_views: {
        Args: { p_ids: string[]; p_views: number[] }
        Returns: undefined
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "team" | "creator" | "client"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "team", "creator", "client"],
    },
  },
} as const
