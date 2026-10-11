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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      fin_advisor_categories: {
        Row: {
          advisor_id: string
          assigned_at: string
          category_code: string
          role: string
        }
        Insert: {
          advisor_id: string
          assigned_at?: string
          category_code: string
          role: string
        }
        Update: {
          advisor_id?: string
          assigned_at?: string
          category_code?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_advisor_categories_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "fin_advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_advisor_categories_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "fin_financial_categories"
            referencedColumns: ["code"]
          },
        ]
      }
      fin_advisors: {
        Row: {
          advisory_style: string
          best_suited_for: string[]
          biography: string
          certifications: string[]
          created_at: string
          education: string | null
          experience: string
          full_name: string
          id: string
          is_active: boolean
          is_fictional: boolean
          meeting_format: string | null
          nessie_customer_id: string | null
          strengths: string[]
          title: string
          updated_at: string
        }
        Insert: {
          advisory_style: string
          best_suited_for?: string[]
          biography: string
          certifications?: string[]
          created_at?: string
          education?: string | null
          experience: string
          full_name: string
          id: string
          is_active?: boolean
          is_fictional?: boolean
          meeting_format?: string | null
          nessie_customer_id?: string | null
          strengths?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          advisory_style?: string
          best_suited_for?: string[]
          biography?: string
          certifications?: string[]
          created_at?: string
          education?: string | null
          experience?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_fictional?: boolean
          meeting_format?: string | null
          nessie_customer_id?: string | null
          strengths?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      fin_company_fundamentals: {
        Row: {
          cik: string | null
          company_name: string | null
          fetched_at: string
          metrics: Json | null
          source: string
          status: string
          symbol: string
        }
        Insert: {
          cik?: string | null
          company_name?: string | null
          fetched_at?: string
          metrics?: Json | null
          source?: string
          status?: string
          symbol: string
        }
        Update: {
          cik?: string | null
          company_name?: string | null
          fetched_at?: string
          metrics?: Json | null
          source?: string
          status?: string
          symbol?: string
        }
        Relationships: []
      }
      fin_comparison_profiles: {
        Row: {
          age_band: string | null
          annual_income_cents: number | null
          assessment_version: string | null
          categories_updated_at: string | null
          comparison_subset: string | null
          created_at: string
          data_source: Json
          debt_breakdown: Json
          debt_cents: number | null
          financial_background: string
          financial_goals: string[]
          full_name: string
          household: string | null
          id: string
          income_stability: string | null
          investment_experience: string | null
          investments_cents: number | null
          is_fictional: boolean
          last_assessed_at: string | null
          monthly_savings_cents: number | null
          monthly_spending_cents: number | null
          nessie_customer_id: string | null
          occupation: string | null
          overview_score: number | null
          recent_activity: Json
          risk_assessment_status: string
          savings_cents: number | null
          spending_pattern: string | null
          updated_at: string
        }
        Insert: {
          age_band?: string | null
          annual_income_cents?: number | null
          assessment_version?: string | null
          categories_updated_at?: string | null
          comparison_subset?: string | null
          created_at?: string
          data_source?: Json
          debt_breakdown?: Json
          debt_cents?: number | null
          financial_background: string
          financial_goals?: string[]
          full_name: string
          household?: string | null
          id: string
          income_stability?: string | null
          investment_experience?: string | null
          investments_cents?: number | null
          is_fictional?: boolean
          last_assessed_at?: string | null
          monthly_savings_cents?: number | null
          monthly_spending_cents?: number | null
          nessie_customer_id?: string | null
          occupation?: string | null
          overview_score?: number | null
          recent_activity?: Json
          risk_assessment_status?: string
          savings_cents?: number | null
          spending_pattern?: string | null
          updated_at?: string
        }
        Update: {
          age_band?: string | null
          annual_income_cents?: number | null
          assessment_version?: string | null
          categories_updated_at?: string | null
          comparison_subset?: string | null
          created_at?: string
          data_source?: Json
          debt_breakdown?: Json
          debt_cents?: number | null
          financial_background?: string
          financial_goals?: string[]
          full_name?: string
          household?: string | null
          id?: string
          income_stability?: string | null
          investment_experience?: string | null
          investments_cents?: number | null
          is_fictional?: boolean
          last_assessed_at?: string | null
          monthly_savings_cents?: number | null
          monthly_spending_cents?: number | null
          nessie_customer_id?: string | null
          occupation?: string | null
          overview_score?: number | null
          recent_activity?: Json
          risk_assessment_status?: string
          savings_cents?: number | null
          spending_pattern?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fin_financial_accounts: {
        Row: {
          account_type: string
          cash_cents: number
          created_at: string
          currency: string
          id: string
          institution: string | null
          name: string
          source: string
          updated_at: string
          user_id: string
          valuation_timestamp: string
        }
        Insert: {
          account_type: string
          cash_cents?: number
          created_at?: string
          currency?: string
          id: string
          institution?: string | null
          name: string
          source: string
          updated_at?: string
          user_id: string
          valuation_timestamp: string
        }
        Update: {
          account_type?: string
          cash_cents?: number
          created_at?: string
          currency?: string
          id?: string
          institution?: string | null
          name?: string
          source?: string
          updated_at?: string
          user_id?: string
          valuation_timestamp?: string
        }
        Relationships: []
      }
      fin_financial_categories: {
        Row: {
          code: string
          description: string
          label: string
        }
        Insert: {
          code: string
          description: string
          label: string
        }
        Update: {
          code?: string
          description?: string
          label?: string
        }
        Relationships: []
      }
      fin_investment_holdings: {
        Row: {
          account_id: string
          asset_class: string
          cost_basis_cents: number | null
          external_security_id: string | null
          id: string
          latest_price: number | null
          name: string
          price_timestamp: string | null
          quantity: number
          sector: string | null
          source: string
          supplied_value_cents: number | null
          supplied_value_date: string | null
          symbol: string | null
          underlying_exposure: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          asset_class: string
          cost_basis_cents?: number | null
          external_security_id?: string | null
          id: string
          latest_price?: number | null
          name: string
          price_timestamp?: string | null
          quantity: number
          sector?: string | null
          source: string
          supplied_value_cents?: number | null
          supplied_value_date?: string | null
          symbol?: string | null
          underlying_exposure?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          asset_class?: string
          cost_basis_cents?: number | null
          external_security_id?: string | null
          id?: string
          latest_price?: number | null
          name?: string
          price_timestamp?: string | null
          quantity?: number
          sector?: string | null
          source?: string
          supplied_value_cents?: number | null
          supplied_value_date?: string | null
          symbol?: string | null
          underlying_exposure?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_investment_holdings_user_id_account_id_fkey"
            columns: ["user_id", "account_id"]
            isOneToOne: false
            referencedRelation: "fin_financial_accounts"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      fin_market_bars: {
        Row: {
          close: number
          feed: string
          fetched_at: string
          high: number
          low: number
          open: number
          source: string
          symbol: string
          timeframe: string
          ts: string
          volume: number
        }
        Insert: {
          close: number
          feed: string
          fetched_at?: string
          high: number
          low: number
          open: number
          source?: string
          symbol: string
          timeframe: string
          ts: string
          volume: number
        }
        Update: {
          close?: number
          feed?: string
          fetched_at?: string
          high?: number
          low?: number
          open?: number
          source?: string
          symbol?: string
          timeframe?: string
          ts?: string
          volume?: number
        }
        Relationships: []
      }
      fin_market_latest: {
        Row: {
          feed: string
          fetched_at: string
          price: number | null
          source: string
          status: string
          symbol: string
          trade_ts: string | null
        }
        Insert: {
          feed: string
          fetched_at?: string
          price?: number | null
          source?: string
          status: string
          symbol: string
          trade_ts?: string | null
        }
        Update: {
          feed?: string
          fetched_at?: string
          price?: number | null
          source?: string
          status?: string
          symbol?: string
          trade_ts?: string | null
        }
        Relationships: []
      }
      fin_monte_carlo_runs: {
        Row: {
          config: Json
          id: number
          ran_at: string
          results: Json
          user_id: string
        }
        Insert: {
          config: Json
          id?: number
          ran_at?: string
          results: Json
          user_id: string
        }
        Update: {
          config?: Json
          id?: number
          ran_at?: string
          results?: Json
          user_id?: string
        }
        Relationships: []
      }
      fin_onboarding_quiz: {
        Row: {
          answers: Json
          completed_at: string | null
          quiz_version: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          quiz_version: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          quiz_version?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_profile_categories: {
        Row: {
          assessment_version: string | null
          assigned_at: string
          category_code: string
          profile_id: string
          source: string
          status: string
        }
        Insert: {
          assessment_version?: string | null
          assigned_at?: string
          category_code: string
          profile_id: string
          source: string
          status?: string
        }
        Update: {
          assessment_version?: string | null
          assigned_at?: string
          category_code?: string
          profile_id?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_profile_categories_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "fin_financial_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fin_profile_categories_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "fin_comparison_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_profile_category_history: {
        Row: {
          assessment_version: string | null
          changed_at: string
          id: number
          new_categories: string[]
          previous_categories: string[]
          profile_id: string
          source: string
        }
        Insert: {
          assessment_version?: string | null
          changed_at?: string
          id?: number
          new_categories: string[]
          previous_categories: string[]
          profile_id: string
          source: string
        }
        Update: {
          assessment_version?: string | null
          changed_at?: string
          id?: number
          new_categories?: string[]
          previous_categories?: string[]
          profile_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_profile_category_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "fin_comparison_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_recurring_overrides: {
        Row: {
          detection: string | null
          review: string | null
          series_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          detection?: string | null
          review?: string | null
          series_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          detection?: string | null
          review?: string | null
          series_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_risk_survey: {
        Row: {
          answers: Json
          created_at: string
          survey_version: string
          target_profile: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          survey_version: string
          target_profile?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          survey_version?: string
          target_profile?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_transaction_category_overrides: {
        Row: {
          category: string
          txn_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          txn_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          txn_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_transaction_category_overrides_user_id_txn_id_fkey"
            columns: ["user_id", "txn_id"]
            isOneToOne: true
            referencedRelation: "fin_transactions"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      fin_transactions: {
        Row: {
          account_id: string
          amount_cents: number
          category: string
          category_source: string
          created_at: string
          currency: string
          description: string
          external_id: string | null
          id: string
          is_sample: boolean
          linked_account_id: string | null
          merchant: string
          source: string
          txn_date: string
          txn_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          category: string
          category_source: string
          created_at?: string
          currency?: string
          description?: string
          external_id?: string | null
          id: string
          is_sample?: boolean
          linked_account_id?: string | null
          merchant: string
          source?: string
          txn_date: string
          txn_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          category?: string
          category_source?: string
          created_at?: string
          currency?: string
          description?: string
          external_id?: string | null
          id?: string
          is_sample?: boolean
          linked_account_id?: string | null
          merchant?: string
          source?: string
          txn_date?: string
          txn_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_user_profiles: {
        Row: {
          auth_user_id: string
          created_at: string
          display_name: string | null
          email: string | null
          last_login_at: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          last_login_at?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          last_login_at?: string | null
        }
        Relationships: []
      }
      fin_user_settings: {
        Row: {
          date_range: Json | null
          risk_inputs: Json
          savings_settings: Json
          transaction_source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          date_range?: Json | null
          risk_inputs: Json
          savings_settings: Json
          transaction_source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          date_range?: Json | null
          risk_inputs?: Json
          savings_settings?: Json
          transaction_source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_watchlist: {
        Row: {
          added_at: string
          symbol: string
          user_id: string
        }
        Insert: {
          added_at?: string
          symbol: string
          user_id: string
        }
        Update: {
          added_at?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_wellness_score_history: {
        Row: {
          calculated_at: string
          factors: Json
          id: number
          input_fingerprint: string
          last_confirmed_at: string
          methodology_version: string
          metrics: Json
          period_end: string
          period_start: string
          reconstructed: boolean
          score: number | null
          score_type: string
          status: string
          user_id: string
        }
        Insert: {
          calculated_at?: string
          factors?: Json
          id?: number
          input_fingerprint: string
          last_confirmed_at?: string
          methodology_version: string
          metrics?: Json
          period_end: string
          period_start: string
          reconstructed: boolean
          score?: number | null
          score_type: string
          status: string
          user_id: string
        }
        Update: {
          calculated_at?: string
          factors?: Json
          id?: number
          input_fingerprint?: string
          last_confirmed_at?: string
          methodology_version?: string
          metrics?: Json
          period_end?: string
          period_start?: string
          reconstructed?: boolean
          score?: number | null
          score_type?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_state: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      fin_profile_advisor_matches: {
        Row: {
          advisor_id: string | null
          profile_id: string | null
          shared_categories: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_advisor_categories_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "fin_advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_profile_categories_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "fin_comparison_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      fin_analytics: { Args: { p_score_type: string }; Returns: Json }
      fin_delete_my_data: { Args: never; Returns: undefined }
      fin_mfa_ok: { Args: never; Returns: boolean }
      fin_owner_daily_activity: {
        Args: { p_end: string; p_start: string }
        Returns: {
          amount_cents: number
          category: string
          currency: string
          day: string
          is_sample: boolean
          txn_count: number
          txn_type: string
        }[]
      }
      fin_read_session: { Args: never; Returns: Json }
      fin_record_scores: { Args: { p: Json }; Returns: number }
      fin_save_state: { Args: { p: Json }; Returns: Json }
      fin_score_inputs: { Args: never; Returns: Json }
      fin_set_profile_categories: {
        Args: {
          p_codes: string[]
          p_profile: string
          p_source: string
          p_version: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
