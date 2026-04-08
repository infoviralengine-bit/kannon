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
          monthly_spend_cap: number | null
          name: string
          notes: string | null
          planned_creators: number
          start_date: string
          status: string
          video_views_cap: number | null
        }
        Insert: {
          client_cpm?: number | null
          client_fixed_per_creator?: number | null
          client_name: string
          client_profile_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_spend_cap?: number | null
          name: string
          notes?: string | null
          planned_creators?: number
          start_date: string
          status?: string
          video_views_cap?: number | null
        }
        Update: {
          client_cpm?: number | null
          client_fixed_per_creator?: number | null
          client_name?: string
          client_profile_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_spend_cap?: number | null
          name?: string
          notes?: string | null
          planned_creators?: number
          start_date?: string
          status?: string
          video_views_cap?: number | null
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
      closer_leads: {
        Row: {
          call_channel: string
          call_datetime: string
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          meet_link: string | null
          notes: string | null
          phone: string | null
          source: string
          status: string
          tiktok_username: string | null
        }
        Insert: {
          call_channel?: string
          call_datetime: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          meet_link?: string | null
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          tiktok_username?: string | null
        }
        Update: {
          call_channel?: string
          call_datetime?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          meet_link?: string | null
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          tiktok_username?: string | null
        }
        Relationships: []
      }
      contract_campaigns: {
        Row: {
          campaign_id: string
          contract_id: string
          id: string
        }
        Insert: {
          campaign_id: string
          contract_id: string
          id?: string
        }
        Update: {
          campaign_id?: string
          contract_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_campaigns_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_campaigns_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_creators: {
        Row: {
          contract_id: string
          creator_id: string
          id: string
          joined_at: string
        }
        Insert: {
          contract_id: string
          creator_id: string
          id?: string
          joined_at?: string
        }
        Update: {
          contract_id?: string
          creator_id?: string
          id?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_creators_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_creators_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          contract_id: string
          created_at: string
          creator_id: string
          id: string
          ip_address: string | null
          onboarding_link_id: string | null
          signed_at: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          creator_id: string
          id?: string
          ip_address?: string | null
          onboarding_link_id?: string | null
          signed_at?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          creator_id?: string
          id?: string
          ip_address?: string | null
          onboarding_link_id?: string | null
          signed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_onboarding_link_id_fkey"
            columns: ["onboarding_link_id"]
            isOneToOne: false
            referencedRelation: "onboarding_links"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          contract_text: string
          created_at: string
          creator_cpm: number
          creator_fixed: number
          first_period_start: string | null
          id: string
          is_active: boolean
          min_videos_per_day: number
          name: string
          start_date: string
          type: string
        }
        Insert: {
          contract_text?: string
          created_at?: string
          creator_cpm?: number
          creator_fixed?: number
          first_period_start?: string | null
          id?: string
          is_active?: boolean
          min_videos_per_day?: number
          name: string
          start_date?: string
          type?: string
        }
        Update: {
          contract_text?: string
          created_at?: string
          creator_cpm?: number
          creator_fixed?: number
          first_period_start?: string | null
          id?: string
          is_active?: boolean
          min_videos_per_day?: number
          name?: string
          start_date?: string
          type?: string
        }
        Relationships: []
      }
      creator_calendar: {
        Row: {
          content_id: string | null
          created_at: string
          creator_id: string
          id: string
          scheduled_for: string
          status: string
          tiktok_account_id: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string
          creator_id: string
          id?: string
          scheduled_for: string
          status?: string
          tiktok_account_id?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string
          creator_id?: string
          id?: string
          scheduled_for?: string
          status?: string
          tiktok_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_calendar_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "creator_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_calendar_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_calendar_tiktok_account_id_fkey"
            columns: ["tiktok_account_id"]
            isOneToOne: false
            referencedRelation: "tiktok_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_content: {
        Row: {
          body: string | null
          campaign_id: string | null
          created_at: string
          creator_id: string
          due_date: string | null
          file_url: string | null
          id: string
          status: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          campaign_id?: string | null
          created_at?: string
          creator_id: string
          due_date?: string | null
          file_url?: string | null
          id?: string
          status?: string
          title: string
          type?: string
        }
        Update: {
          body?: string | null
          campaign_id?: string | null
          created_at?: string
          creator_id?: string
          due_date?: string | null
          file_url?: string | null
          id?: string
          status?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_content_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_content_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
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
          period_end: string | null
          period_month: number
          period_start: string | null
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
          period_end?: string | null
          period_month: number
          period_start?: string | null
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
          period_end?: string | null
          period_month?: number
          period_start?: string | null
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
          address_city: string | null
          address_province: string | null
          address_street: string | null
          address_zip: string | null
          created_at: string
          creator_cpm: number | null
          creator_fixed: number | null
          date_of_birth: string | null
          email: string | null
          fiscal_code: string | null
          iban: string | null
          iban_holder_name: string | null
          id: string
          min_videos_per_day: number | null
          name: string
          onboarding_phase: string | null
          phone: string | null
          profile_id: string | null
          status: string
        }
        Insert: {
          address_city?: string | null
          address_province?: string | null
          address_street?: string | null
          address_zip?: string | null
          created_at?: string
          creator_cpm?: number | null
          creator_fixed?: number | null
          date_of_birth?: string | null
          email?: string | null
          fiscal_code?: string | null
          iban?: string | null
          iban_holder_name?: string | null
          id?: string
          min_videos_per_day?: number | null
          name: string
          onboarding_phase?: string | null
          phone?: string | null
          profile_id?: string | null
          status?: string
        }
        Update: {
          address_city?: string | null
          address_province?: string | null
          address_street?: string | null
          address_zip?: string | null
          created_at?: string
          creator_cpm?: number | null
          creator_fixed?: number | null
          date_of_birth?: string | null
          email?: string | null
          fiscal_code?: string | null
          iban?: string | null
          iban_holder_name?: string | null
          id?: string
          min_videos_per_day?: number | null
          name?: string
          onboarding_phase?: string | null
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
      notifications: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          type: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          type: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_links: {
        Row: {
          completed_at: string | null
          contract_ids: string[]
          created_at: string
          creator_id: string | null
          id: string
          lead_id: string
          status: string
          token: string
        }
        Insert: {
          completed_at?: string | null
          contract_ids?: string[]
          created_at?: string
          creator_id?: string | null
          id?: string
          lead_id: string
          status?: string
          token?: string
        }
        Update: {
          completed_at?: string | null
          contract_ids?: string[]
          created_at?: string
          creator_id?: string | null
          id?: string
          lead_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_links_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_links_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "closer_leads"
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
          template_id: string | null
          tiktok_account_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          dm_sent?: number | null
          id?: string
          replies_received?: number | null
          template_id?: string | null
          tiktok_account_id: string
        }
        Update: {
          created_at?: string
          date?: string
          dm_sent?: number | null
          id?: string
          replies_received?: number | null
          template_id?: string | null
          tiktok_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_stats_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "outreach_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_stats_tiktok_account_id_fkey"
            columns: ["tiktok_account_id"]
            isOneToOne: false
            referencedRelation: "tiktok_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
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
      scraping_logs: {
        Row: {
          accounts_processed: number
          created_at: string
          error_message: string | null
          id: string
          run_at: string
          status: string
          videos_created: number
          videos_updated: number
        }
        Insert: {
          accounts_processed?: number
          created_at?: string
          error_message?: string | null
          id?: string
          run_at?: string
          status: string
          videos_created?: number
          videos_updated?: number
        }
        Update: {
          accounts_processed?: number
          created_at?: string
          error_message?: string | null
          id?: string
          run_at?: string
          status?: string
          videos_created?: number
          videos_updated?: number
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
          following_count: number
          id: string
          is_active: boolean | null
          last_scraped_at: string | null
          owner_profile_id: string | null
          username: string
          warmup_day: number
          warmup_started_at: string | null
        }
        Insert: {
          account_type: string
          campaign_id?: string | null
          created_at?: string
          creator_id?: string | null
          following_count?: number
          id?: string
          is_active?: boolean | null
          last_scraped_at?: string | null
          owner_profile_id?: string | null
          username: string
          warmup_day?: number
          warmup_started_at?: string | null
        }
        Update: {
          account_type?: string
          campaign_id?: string | null
          created_at?: string
          creator_id?: string | null
          following_count?: number
          id?: string
          is_active?: boolean | null
          last_scraped_at?: string | null
          owner_profile_id?: string | null
          username?: string
          warmup_day?: number
          warmup_started_at?: string | null
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
          {
            foreignKeyName: "tiktok_accounts_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      get_campaign_total_views: {
        Args: { p_campaign_ids: string[] }
        Returns: {
          campaign_id: string
          total_views: number
        }[]
      }
      get_client_campaign_data: { Args: { p_user_id: string }; Returns: Json }
      get_client_daily_views: {
        Args: { p_days?: number; p_user_id: string }
        Returns: Json
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
      owns_tiktok_account: {
        Args: { _account_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "team"
        | "creator"
        | "client"
        | "outreach"
        | "closer"
        | "campaign_manager"
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
      app_role: [
        "admin",
        "team",
        "creator",
        "client",
        "outreach",
        "closer",
        "campaign_manager",
      ],
    },
  },
} as const
