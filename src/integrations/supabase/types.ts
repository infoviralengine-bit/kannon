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
      brief_change_requests: {
        Row: {
          author_id: string
          brief_id: string
          created_at: string
          id: string
          proposed_caption: string | null
          proposed_copy_text: string | null
          proposed_hashtags: string[] | null
          proposed_visual_note: string | null
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          author_id: string
          brief_id: string
          created_at?: string
          id?: string
          proposed_caption?: string | null
          proposed_copy_text?: string | null
          proposed_hashtags?: string[] | null
          proposed_visual_note?: string | null
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          author_id?: string
          brief_id?: string
          created_at?: string
          id?: string
          proposed_caption?: string | null
          proposed_copy_text?: string | null
          proposed_hashtags?: string[] | null
          proposed_visual_note?: string | null
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "brief_change_requests_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "v_brief_stats"
            referencedColumns: ["brief_id"]
          },
          {
            foreignKeyName: "brief_change_requests_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "video_briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      brief_comments: {
        Row: {
          author_id: string
          author_role: string
          body: string
          brief_id: string
          created_at: string
          id: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          author_id: string
          author_role: string
          body: string
          brief_id: string
          created_at?: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          brief_id?: string
          created_at?: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brief_comments_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "v_brief_stats"
            referencedColumns: ["brief_id"]
          },
          {
            foreignKeyName: "brief_comments_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "video_briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      brief_topics: {
        Row: {
          brief_id: string
          topic_id: string
        }
        Insert: {
          brief_id: string
          topic_id: string
        }
        Update: {
          brief_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brief_topics_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "v_brief_stats"
            referencedColumns: ["brief_id"]
          },
          {
            foreignKeyName: "brief_topics_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "video_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brief_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
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
          brief_threshold_engagement: number | null
          brief_threshold_views: number | null
          client_cpm: number | null
          client_fixed: number | null
          client_name: string
          client_profile_id: string | null
          created_at: string
          end_date: string | null
          id: string
          min_monthly_videos: number | null
          monthly_spend_cap: number | null
          name: string
          notes: string | null
          payment_terms: Json | null
          start_date: string
          status: string
          video_views_cap: number | null
        }
        Insert: {
          brief_threshold_engagement?: number | null
          brief_threshold_views?: number | null
          client_cpm?: number | null
          client_fixed?: number | null
          client_name: string
          client_profile_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          min_monthly_videos?: number | null
          monthly_spend_cap?: number | null
          name: string
          notes?: string | null
          payment_terms?: Json | null
          start_date: string
          status?: string
          video_views_cap?: number | null
        }
        Update: {
          brief_threshold_engagement?: number | null
          brief_threshold_views?: number | null
          client_cpm?: number | null
          client_fixed?: number | null
          client_name?: string
          client_profile_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          min_monthly_videos?: number | null
          monthly_spend_cap?: number | null
          name?: string
          notes?: string | null
          payment_terms?: Json | null
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
          amount_overridden: boolean
          amount_override: number | null
          campaign_id: string
          cpm_amount: number
          cpm_views: number
          created_at: string
          cycle_id: string | null
          cycle_number: number
          due_date: string
          fixed_amount: number
          id: string
          invoice_number: string | null
          invoice_sent: boolean
          invoice_sent_at: string | null
          is_paid: boolean
          notes: string | null
          notes_override: string | null
          paid_at: string | null
          payment_kind: string
          received_at: string | null
          total_amount: number
          views_paid_cumulative: number
          views_snapshot_at: string | null
        }
        Insert: {
          amount_overridden?: boolean
          amount_override?: number | null
          campaign_id: string
          cpm_amount?: number
          cpm_views?: number
          created_at?: string
          cycle_id?: string | null
          cycle_number: number
          due_date: string
          fixed_amount?: number
          id?: string
          invoice_number?: string | null
          invoice_sent?: boolean
          invoice_sent_at?: string | null
          is_paid?: boolean
          notes?: string | null
          notes_override?: string | null
          paid_at?: string | null
          payment_kind?: string
          received_at?: string | null
          total_amount?: number
          views_paid_cumulative?: number
          views_snapshot_at?: string | null
        }
        Update: {
          amount_overridden?: boolean
          amount_override?: number | null
          campaign_id?: string
          cpm_amount?: number
          cpm_views?: number
          created_at?: string
          cycle_id?: string | null
          cycle_number?: number
          due_date?: string
          fixed_amount?: number
          id?: string
          invoice_number?: string | null
          invoice_sent?: boolean
          invoice_sent_at?: string | null
          is_paid?: boolean
          notes?: string | null
          notes_override?: string | null
          paid_at?: string | null
          payment_kind?: string
          received_at?: string | null
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
      content_topics: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
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
          period_overrides: Json
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
          period_overrides?: Json
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
          period_overrides?: Json
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
          amount_override: number | null
          cpm_amount: number
          created_at: string
          creator_id: string
          fixed_amount: number
          fixed_earned: boolean
          id: string
          is_paid: boolean
          notes: string | null
          notes_override: string | null
          paid_at: string | null
          paid_via: string | null
          period_end: string | null
          period_month: number
          period_start: string | null
          period_year: number
          total_amount: number
        }
        Insert: {
          amount_override?: number | null
          cpm_amount?: number
          created_at?: string
          creator_id: string
          fixed_amount?: number
          fixed_earned?: boolean
          id?: string
          is_paid?: boolean
          notes?: string | null
          notes_override?: string | null
          paid_at?: string | null
          paid_via?: string | null
          period_end?: string | null
          period_month: number
          period_start?: string | null
          period_year: number
          total_amount?: number
        }
        Update: {
          amount_override?: number | null
          cpm_amount?: number
          created_at?: string
          creator_id?: string
          fixed_amount?: number
          fixed_earned?: boolean
          id?: string
          is_paid?: boolean
          notes?: string | null
          notes_override?: string | null
          paid_at?: string | null
          paid_via?: string | null
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
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
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
      financial_entries: {
        Row: {
          amount: number
          brand_name: string | null
          campaign_id: string | null
          category: string | null
          created_at: string
          creator_id: string | null
          currency: string
          date: string
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          recurring_expense_id: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          brand_name?: string | null
          campaign_id?: string | null
          category?: string | null
          created_at?: string
          creator_id?: string | null
          currency?: string
          date?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          recurring_expense_id?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          brand_name?: string | null
          campaign_id?: string | null
          category?: string | null
          created_at?: string
          creator_id?: string | null
          currency?: string
          date?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          recurring_expense_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_recurring_expense_id_fkey"
            columns: ["recurring_expense_id"]
            isOneToOne: false
            referencedRelation: "recurring_expenses"
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
          link: string | null
          message: string
          meta: Json
          severity: string
          type: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          meta?: Json
          severity?: string
          type: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          meta?: Json
          severity?: string
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
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          status: string
          token: string
        }
        Insert: {
          completed_at?: string | null
          contract_ids?: string[]
          created_at?: string
          creator_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          status?: string
          token?: string
        }
        Update: {
          completed_at?: string | null
          contract_ids?: string[]
          created_at?: string
          creator_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
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
      recurring_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          due_day: number
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          start_date: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          due_day: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          start_date?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          due_day?: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          start_date?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      scraping_logs: {
        Row: {
          accounts_processed: number
          completed_at: string | null
          created_at: string
          dataset_id: string | null
          error_message: string | null
          id: string
          progress_note: string | null
          run_at: string
          run_id: string | null
          started_at: string | null
          status: string
          triggered_by: string | null
          videos_created: number
          videos_updated: number
        }
        Insert: {
          accounts_processed?: number
          completed_at?: string | null
          created_at?: string
          dataset_id?: string | null
          error_message?: string | null
          id?: string
          progress_note?: string | null
          run_at?: string
          run_id?: string | null
          started_at?: string | null
          status: string
          triggered_by?: string | null
          videos_created?: number
          videos_updated?: number
        }
        Update: {
          accounts_processed?: number
          completed_at?: string | null
          created_at?: string
          dataset_id?: string | null
          error_message?: string | null
          id?: string
          progress_note?: string | null
          run_at?: string
          run_id?: string | null
          started_at?: string | null
          status?: string
          triggered_by?: string | null
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
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
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
      video_brief_matches: {
        Row: {
          brief_id: string
          confidence: number
          created_at: string
          id: string
          match_method: string
          matched_by: string | null
          video_id: string
        }
        Insert: {
          brief_id: string
          confidence?: number
          created_at?: string
          id?: string
          match_method: string
          matched_by?: string | null
          video_id: string
        }
        Update: {
          brief_id?: string
          confidence?: number
          created_at?: string
          id?: string
          match_method?: string
          matched_by?: string | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_brief_matches_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "v_brief_stats"
            referencedColumns: ["brief_id"]
          },
          {
            foreignKeyName: "video_brief_matches_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "video_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_brief_matches_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_performance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_brief_matches_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_briefs: {
        Row: {
          audio_id: string | null
          campaign_id: string
          caption: string | null
          copy_text: string
          created_at: string
          created_by: string | null
          expected_caption_keywords: string[] | null
          format_id: string | null
          hashtags: string[] | null
          id: string
          planned_publish_date: string
          reference_links: Json
          reference_type: string
          status: string
          threshold_engagement_override: number | null
          threshold_views_override: number | null
          title: string | null
          updated_at: string
          visual_note: string | null
          week_label: string | null
        }
        Insert: {
          audio_id?: string | null
          campaign_id: string
          caption?: string | null
          copy_text: string
          created_at?: string
          created_by?: string | null
          expected_caption_keywords?: string[] | null
          format_id?: string | null
          hashtags?: string[] | null
          id?: string
          planned_publish_date: string
          reference_links?: Json
          reference_type?: string
          status?: string
          threshold_engagement_override?: number | null
          threshold_views_override?: number | null
          title?: string | null
          updated_at?: string
          visual_note?: string | null
          week_label?: string | null
        }
        Update: {
          audio_id?: string | null
          campaign_id?: string
          caption?: string | null
          copy_text?: string
          created_at?: string
          created_by?: string | null
          expected_caption_keywords?: string[] | null
          format_id?: string | null
          hashtags?: string[] | null
          id?: string
          planned_publish_date?: string
          reference_links?: Json
          reference_type?: string
          status?: string
          threshold_engagement_override?: number | null
          threshold_views_override?: number | null
          title?: string | null
          updated_at?: string
          visual_note?: string | null
          week_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_briefs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_briefs_format_id_fkey"
            columns: ["format_id"]
            isOneToOne: false
            referencedRelation: "video_formats"
            referencedColumns: ["id"]
          },
        ]
      }
      video_formats: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          audio_id: string | null
          audio_name: string | null
          caption: string | null
          comments: number | null
          content_tag: string | null
          created_at: string
          duration_sec: number | null
          hashtags: string[] | null
          id: string
          last_scraped_at: string | null
          likes: number | null
          published_at: string
          saves: number | null
          shares: number | null
          tiktok_account_id: string
          tiktok_video_id: string
          views: number | null
          views_at_last_payment: number
          views_final: number | null
          window_closed: boolean
          window_expires_at: string | null
        }
        Insert: {
          audio_id?: string | null
          audio_name?: string | null
          caption?: string | null
          comments?: number | null
          content_tag?: string | null
          created_at?: string
          duration_sec?: number | null
          hashtags?: string[] | null
          id?: string
          last_scraped_at?: string | null
          likes?: number | null
          published_at: string
          saves?: number | null
          shares?: number | null
          tiktok_account_id: string
          tiktok_video_id: string
          views?: number | null
          views_at_last_payment?: number
          views_final?: number | null
          window_closed?: boolean
          window_expires_at?: string | null
        }
        Update: {
          audio_id?: string | null
          audio_name?: string | null
          caption?: string | null
          comments?: number | null
          content_tag?: string | null
          created_at?: string
          duration_sec?: number | null
          hashtags?: string[] | null
          id?: string
          last_scraped_at?: string | null
          likes?: number | null
          published_at?: string
          saves?: number | null
          shares?: number | null
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
      v_brief_stats: {
        Row: {
          avg_engagement_pct: number | null
          brief_id: string | null
          campaign_id: string | null
          format_id: string | null
          matched_videos_count: number | null
          threshold_engagement: number | null
          threshold_views: number | null
          total_effective_views: number | null
          total_engagements: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_briefs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_briefs_format_id_fkey"
            columns: ["format_id"]
            isOneToOne: false
            referencedRelation: "video_formats"
            referencedColumns: ["id"]
          },
        ]
      }
      v_financial_movements: {
        Row: {
          amount: number | null
          brand_name: string | null
          campaign_id: string | null
          category: string | null
          created_at: string | null
          creator_id: string | null
          date: string | null
          description: string | null
          due_date: string | null
          has_override: boolean | null
          id: string | null
          invoice_number: string | null
          notes: string | null
          recurring_expense_id: string | null
          source: string | null
          status: string | null
          type: string | null
        }
        Relationships: []
      }
      v_video_performance: {
        Row: {
          account_active: boolean | null
          account_type: string | null
          account_username: string | null
          age_days: number | null
          campaign_id: string | null
          campaign_name: string | null
          campaign_start_date: string | null
          client_cpm: number | null
          client_name: string | null
          comments: number | null
          creator_cpm: number | null
          creator_fixed: number | null
          creator_id: string | null
          creator_name: string | null
          creator_status: string | null
          effective_views: number | null
          engagement_pct: number | null
          id: string | null
          last_scraped_at: string | null
          likes: number | null
          published_at: string | null
          raw_effective_views: number | null
          tiktok_account_id: string | null
          tiktok_url: string | null
          tiktok_video_id: string | null
          total_engagements: number | null
          video_views_cap: number | null
          views: number | null
          views_final: number | null
          window_closed: boolean | null
          window_expires_at: string | null
          window_status: string | null
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
            foreignKeyName: "videos_tiktok_account_id_fkey"
            columns: ["tiktok_account_id"]
            isOneToOne: false
            referencedRelation: "tiktok_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      bulk_update_video_views: {
        Args: { p_ids: string[]; p_views: number[] }
        Returns: undefined
      }
      generate_recurring_expense_entries: {
        Args: { p_months_ahead?: number }
        Returns: number
      }
      get_campaign_manager_data: { Args: { p_period?: string }; Returns: Json }
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
      get_client_top_videos: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: Json
      }
      get_content_analytics: {
        Args: {
          p_campaign_id?: string
          p_format_id?: string
          p_period?: string
          p_topic_id?: string
        }
        Returns: Json
      }
      get_content_calendar: {
        Args: { p_campaign_id: string; p_from: string; p_to: string }
        Returns: Json
      }
      get_content_insights: {
        Args: { p_campaign_id?: string; p_period?: string }
        Returns: Json
      }
      get_creator_contract_campaigns: {
        Args: { _user_id: string }
        Returns: {
          campaign_id: string
          contract_id: string
        }[]
      }
      get_finance_dashboard: { Args: { p_period?: string }; Returns: Json }
      get_last_scrape_at: { Args: never; Returns: string }
      get_onboarding_data: { Args: { p_token: string }; Returns: Json }
      get_top_videos: {
        Args: {
          p_campaign_ids?: string[]
          p_creator_ids?: string[]
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_sort_by?: string
          p_sort_dir?: string
          p_to?: string
        }
        Returns: {
          account_username: string
          campaign_id: string
          campaign_name: string
          client_name: string
          comments: number
          creator_id: string
          creator_name: string
          effective_views: number
          engagement_pct: number
          id: string
          likes: number
          published_at: string
          raw_views: number
          tiktok_url: string
          tiktok_video_id: string
          total_count: number
          window_status: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_video_analytics: {
        Args: {
          p_campaign_ids?: string[]
          p_creator_ids?: string[]
          p_from?: string
          p_to?: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_video_to_briefs: { Args: { p_video_id: string }; Returns: number }
      notify_brief_event: {
        Args: {
          p_brief_id: string
          p_link?: string
          p_message: string
          p_targets?: string[]
          p_type: string
        }
        Returns: number
      }
      owns_tiktok_account: {
        Args: { _account_id: string; _user_id: string }
        Returns: boolean
      }
      rematch_all_unmatched_videos: {
        Args: { p_days_back?: number }
        Returns: number
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_finance_cash: { Args: { p_amount: number }; Returns: undefined }
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
        | "operator"
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
        "operator",
      ],
    },
  },
} as const
