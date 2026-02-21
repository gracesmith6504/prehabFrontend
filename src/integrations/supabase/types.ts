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
      risk_reports: {
        Row: {
          acute_chronic_ratio: number | null
          athlete_id: string
          created_at: string
          escalation_status: string | null
          explanation: string | null
          id: string
          load_risk_multiplier: number | null
          phase: string | null
          phase_multiplier: number | null
          risk_level: string
          risk_score: number
          soreness_contribution: number | null
        }
        Insert: {
          acute_chronic_ratio?: number | null
          athlete_id: string
          created_at?: string
          escalation_status?: string | null
          explanation?: string | null
          id?: string
          load_risk_multiplier?: number | null
          phase?: string | null
          phase_multiplier?: number | null
          risk_level?: string
          risk_score?: number
          soreness_contribution?: number | null
        }
        Update: {
          acute_chronic_ratio?: number | null
          athlete_id?: string
          created_at?: string
          escalation_status?: string | null
          explanation?: string | null
          id?: string
          load_risk_multiplier?: number | null
          phase?: string | null
          phase_multiplier?: number | null
          risk_level?: string
          risk_score?: number
          soreness_contribution?: number | null
        }
        Relationships: []
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
          athlete_id?: string
          created_at?: string
          explanation?: string | null
          id?: string
          last_updated?: string
          original_plan?: Json
          risk_level?: string | null
          risk_score?: number | null
        }
        Relationships: []
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
