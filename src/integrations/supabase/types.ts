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
      agent_actions: {
        Row: {
          action_type: string
          agent_run_id: string
          athlete_id: string
          created_at: string
          details: Json | null
          id: string
        }
        Insert: {
          action_type: string
          agent_run_id: string
          athlete_id: string
          created_at?: string
          details?: Json | null
          id?: string
        }
        Update: {
          action_type?: string
          agent_run_id?: string
          athlete_id?: string
          created_at?: string
          details?: Json | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          athletes_processed: number | null
          completed_at: string | null
          created_at: string
          errors: Json | null
          id: string
          model_version: string | null
          started_at: string
          status: string
          trigger_type: string
        }
        Insert: {
          athletes_processed?: number | null
          completed_at?: string | null
          created_at?: string
          errors?: Json | null
          id?: string
          model_version?: string | null
          started_at?: string
          status?: string
          trigger_type?: string
        }
        Update: {
          athletes_processed?: number | null
          completed_at?: string | null
          created_at?: string
          errors?: Json | null
          id?: string
          model_version?: string | null
          started_at?: string
          status?: string
          trigger_type?: string
        }
        Relationships: []
      }
      athlete_profiles: {
        Row: {
          coach_id: string | null
          contraceptive_use: boolean | null
          created_at: string
          cycle_length: number | null
          cycle_start_date: string | null
          id: string
          menstruation_length: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coach_id?: string | null
          contraceptive_use?: boolean | null
          created_at?: string
          cycle_length?: number | null
          cycle_start_date?: string | null
          id?: string
          menstruation_length?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coach_id?: string | null
          contraceptive_use?: boolean | null
          created_at?: string
          cycle_length?: number | null
          cycle_start_date?: string | null
          id?: string
          menstruation_length?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      escalations: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          agent_run_id: string | null
          athlete_id: string
          created_at: string
          id: string
          notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          risk_prediction_id: string | null
          status: string
          trigger_reason: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agent_run_id?: string | null
          athlete_id: string
          created_at?: string
          id?: string
          notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_prediction_id?: string | null
          status?: string
          trigger_reason: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agent_run_id?: string | null
          athlete_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_prediction_id?: string | null
          status?: string
          trigger_reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalations_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_risk_prediction_id_fkey"
            columns: ["risk_prediction_id"]
            isOneToOne: false
            referencedRelation: "risk_predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_events: {
        Row: {
          agent_run_id: string | null
          athlete_id: string
          created_at: string
          feedback_type: string
          given_by: string
          id: string
          modified_plan: Json | null
          reason: string | null
          risk_prediction_id: string | null
          weekly_plan_id: string | null
        }
        Insert: {
          agent_run_id?: string | null
          athlete_id: string
          created_at?: string
          feedback_type: string
          given_by: string
          id?: string
          modified_plan?: Json | null
          reason?: string | null
          risk_prediction_id?: string | null
          weekly_plan_id?: string | null
        }
        Update: {
          agent_run_id?: string | null
          athlete_id?: string
          created_at?: string
          feedback_type?: string
          given_by?: string
          id?: string
          modified_plan?: Json | null
          reason?: string | null
          risk_prediction_id?: string | null
          weekly_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_events_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_events_risk_prediction_id_fkey"
            columns: ["risk_prediction_id"]
            isOneToOne: false
            referencedRelation: "risk_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_events_weekly_plan_id_fkey"
            columns: ["weekly_plan_id"]
            isOneToOne: false
            referencedRelation: "weekly_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      model_registry: {
        Row: {
          accuracy: number | null
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          predictor_type: string
          version: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          predictor_type?: string
          version: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          predictor_type?: string
          version?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      risk_predictions: {
        Row: {
          agent_run_id: string | null
          athlete_id: string
          confidence: number
          created_at: string
          id: string
          model_version: string | null
          predictor_type: string
          risk_level: string
          risk_prob: number
          risk_score: number
          top_drivers: Json | null
          trained_at: string | null
        }
        Insert: {
          agent_run_id?: string | null
          athlete_id: string
          confidence?: number
          created_at?: string
          id?: string
          model_version?: string | null
          predictor_type?: string
          risk_level?: string
          risk_prob?: number
          risk_score?: number
          top_drivers?: Json | null
          trained_at?: string | null
        }
        Update: {
          agent_run_id?: string | null
          athlete_id?: string
          confidence?: number
          created_at?: string
          id?: string
          model_version?: string | null
          predictor_type?: string
          risk_level?: string
          risk_prob?: number
          risk_score?: number
          top_drivers?: Json | null
          trained_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_predictions_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_reports: {
        Row: {
          acute_chronic_ratio: number | null
          agent_run_id: string | null
          athlete_id: string
          created_at: string
          escalation_status: string | null
          explanation: string | null
          id: string
          load_risk_multiplier: number | null
          phase: string | null
          phase_multiplier: number | null
          risk_level: string
          risk_prediction_id: string | null
          risk_score: number
          soreness_contribution: number | null
        }
        Insert: {
          acute_chronic_ratio?: number | null
          agent_run_id?: string | null
          athlete_id: string
          created_at?: string
          escalation_status?: string | null
          explanation?: string | null
          id?: string
          load_risk_multiplier?: number | null
          phase?: string | null
          phase_multiplier?: number | null
          risk_level?: string
          risk_prediction_id?: string | null
          risk_score?: number
          soreness_contribution?: number | null
        }
        Update: {
          acute_chronic_ratio?: number | null
          agent_run_id?: string | null
          athlete_id?: string
          created_at?: string
          escalation_status?: string | null
          explanation?: string | null
          id?: string
          load_risk_multiplier?: number | null
          phase?: string | null
          phase_multiplier?: number | null
          risk_level?: string
          risk_prediction_id?: string | null
          risk_score?: number
          soreness_contribution?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_reports_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_reports_risk_prediction_id_fkey"
            columns: ["risk_prediction_id"]
            isOneToOne: false
            referencedRelation: "risk_predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      soreness_logs: {
        Row: {
          athlete_id: string
          calf: number
          created_at: string
          date: string
          groin: number
          hamstring: number
          id: string
          knee: number
          other_label: string | null
          other_value: number | null
        }
        Insert: {
          athlete_id: string
          calf?: number
          created_at?: string
          date?: string
          groin?: number
          hamstring?: number
          id?: string
          knee?: number
          other_label?: string | null
          other_value?: number | null
        }
        Update: {
          athlete_id?: string
          calf?: number
          created_at?: string
          date?: string
          groin?: number
          hamstring?: number
          id?: string
          knee?: number
          other_label?: string | null
          other_value?: number | null
        }
        Relationships: []
      }
      training_sessions: {
        Row: {
          athlete_id: string
          created_at: string
          date: string
          duration: number
          id: string
          intensity: string
          rpe: number
          session_type: string
          sport: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          date?: string
          duration?: number
          id?: string
          intensity?: string
          rpe?: number
          session_type?: string
          sport?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          date?: string
          duration?: number
          id?: string
          intensity?: string
          rpe?: number
          session_type?: string
          sport?: string
        }
        Relationships: []
      }
      weekly_plans: {
        Row: {
          adjusted_plan: Json
          agent_run_id: string | null
          athlete_id: string
          created_at: string
          explanation: string | null
          id: string
          last_updated: string
          original_plan: Json
          risk_level: string | null
          risk_score: number | null
        }
        Insert: {
          adjusted_plan?: Json
          agent_run_id?: string | null
          athlete_id: string
          created_at?: string
          explanation?: string | null
          id?: string
          last_updated?: string
          original_plan?: Json
          risk_level?: string | null
          risk_score?: number | null
        }
        Update: {
          adjusted_plan?: Json
          agent_run_id?: string | null
          athlete_id?: string
          created_at?: string
          explanation?: string | null
          id?: string
          last_updated?: string
          original_plan?: Json
          risk_level?: string | null
          risk_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_plans_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "athlete" | "coach"
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
      app_role: ["athlete", "coach"],
    },
  },
} as const
