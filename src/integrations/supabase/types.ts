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
      attendant_assignments: {
        Row: {
          attendant_id: string
          created_at: string
          date: string
          id: string
          pump_id: string | null
          shift_id: string
        }
        Insert: {
          attendant_id: string
          created_at?: string
          date?: string
          id?: string
          pump_id?: string | null
          shift_id: string
        }
        Update: {
          attendant_id?: string
          created_at?: string
          date?: string
          id?: string
          pump_id?: string | null
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendant_assignments_attendant_id_fkey"
            columns: ["attendant_id"]
            isOneToOne: false
            referencedRelation: "attendants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendant_assignments_pump_id_fkey"
            columns: ["pump_id"]
            isOneToOne: false
            referencedRelation: "pumps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendant_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      attendants: {
        Row: {
          branch_id: string
          created_at: string
          employee_id: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          employee_id?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          employee_id?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendants_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          county: string
          created_at: string
          franchise_type: Database["public"]["Enums"]["franchise_type"]
          id: string
          is_active: boolean
          location: string | null
          name: string
          updated_at: string
        }
        Insert: {
          county: string
          created_at?: string
          franchise_type: Database["public"]["Enums"]["franchise_type"]
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          county?: string
          created_at?: string
          franchise_type?: Database["public"]["Enums"]["franchise_type"]
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_deposits: {
        Row: {
          amount: number
          amount_usd: number | null
          attendant_id: string | null
          branch_id: string
          created_at: string
          created_by: string | null
          date: string
          deposit_type: string
          exchange_rate: number | null
          id: string
          notes: string | null
          shift_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          amount_usd?: number | null
          attendant_id?: string | null
          branch_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          deposit_type: string
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          shift_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_usd?: number | null
          attendant_id?: string | null
          branch_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          deposit_type?: string
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          shift_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_deposits_attendant_id_fkey"
            columns: ["attendant_id"]
            isOneToOne: false
            referencedRelation: "attendants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_deposits_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_deposits_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_deliveries: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          delivery_date: string
          driver_name: string | null
          id: string
          notes: string | null
          quantity_usg: number
          receipt_number: string | null
          supplier: string | null
          tank_id: string
          updated_at: string
          vehicle_plate: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          delivery_date?: string
          driver_name?: string | null
          id?: string
          notes?: string | null
          quantity_usg?: number
          receipt_number?: string | null
          supplier?: string | null
          tank_id: string
          updated_at?: string
          vehicle_plate?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          delivery_date?: string
          driver_name?: string | null
          id?: string
          notes?: string | null
          quantity_usg?: number
          receipt_number?: string | null
          supplier?: string | null
          tank_id?: string
          updated_at?: string
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_deliveries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_deliveries_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      islands: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          island_number: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          island_number: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          island_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "islands_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pumps: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          island_id: string | null
          name: string
          product_type: Database["public"]["Enums"]["product_type"]
          totalizers_count: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          island_id?: string | null
          name: string
          product_type: Database["public"]["Enums"]["product_type"]
          totalizers_count?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          island_id?: string | null
          name?: string
          product_type?: Database["public"]["Enums"]["product_type"]
          totalizers_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pumps_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pumps_island_id_fkey"
            columns: ["island_id"]
            isOneToOne: false
            referencedRelation: "islands"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_sales_reports: {
        Row: {
          attendant_id: string
          branch_id: string
          closing_meter: number
          created_at: string
          created_by: string | null
          date: string
          id: string
          island_id: string | null
          opening_meter: number
          pump_id: string
          rtt_usg: number
          sales_liters: number | null
          sales_usg: number | null
          shift_id: string
          total_sales_usd: number | null
          unit_price_usd: number
          updated_at: string
        }
        Insert: {
          attendant_id: string
          branch_id: string
          closing_meter?: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          island_id?: string | null
          opening_meter?: number
          pump_id: string
          rtt_usg?: number
          sales_liters?: number | null
          sales_usg?: number | null
          shift_id: string
          total_sales_usd?: number | null
          unit_price_usd?: number
          updated_at?: string
        }
        Update: {
          attendant_id?: string
          branch_id?: string
          closing_meter?: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          island_id?: string | null
          opening_meter?: number
          pump_id?: string
          rtt_usg?: number
          sales_liters?: number | null
          sales_usg?: number | null
          shift_id?: string
          total_sales_usd?: number | null
          unit_price_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_sales_reports_attendant_id_fkey"
            columns: ["attendant_id"]
            isOneToOne: false
            referencedRelation: "attendants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_sales_reports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_sales_reports_island_id_fkey"
            columns: ["island_id"]
            isOneToOne: false
            referencedRelation: "islands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_sales_reports_pump_id_fkey"
            columns: ["pump_id"]
            isOneToOne: false
            referencedRelation: "pumps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_sales_reports_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string
          end_time: string
          id: string
          name: Database["public"]["Enums"]["shift_name"]
          start_time: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          name: Database["public"]["Enums"]["shift_name"]
          start_time: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          name?: Database["public"]["Enums"]["shift_name"]
          start_time?: string
        }
        Relationships: []
      }
      stock_readings: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          date: string
          id: string
          notes: string | null
          physical_level_usg: number
          shift_id: string | null
          tank_id: string
          theoretical_level_usg: number
          variance_usg: number | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          physical_level_usg?: number
          shift_id?: string | null
          tank_id: string
          theoretical_level_usg?: number
          variance_usg?: number | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          physical_level_usg?: number
          shift_id?: string | null
          tank_id?: string
          theoretical_level_usg?: number
          variance_usg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_readings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_readings_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_readings_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      tank_pump_assignments: {
        Row: {
          created_at: string
          id: string
          pump_id: string
          tank_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pump_id: string
          tank_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pump_id?: string
          tank_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tank_pump_assignments_pump_id_fkey"
            columns: ["pump_id"]
            isOneToOne: false
            referencedRelation: "pumps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tank_pump_assignments_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      tanks: {
        Row: {
          branch_id: string
          capacity_usg: number
          created_at: string
          current_level_usg: number
          id: string
          is_active: boolean
          name: string
          product_type: Database["public"]["Enums"]["product_type"]
          status: Database["public"]["Enums"]["tank_status"]
          threshold_usg: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          capacity_usg: number
          created_at?: string
          current_level_usg?: number
          id?: string
          is_active?: boolean
          name: string
          product_type: Database["public"]["Enums"]["product_type"]
          status?: Database["public"]["Enums"]["tank_status"]
          threshold_usg?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          capacity_usg?: number
          created_at?: string
          current_level_usg?: number
          id?: string
          is_active?: boolean
          name?: string
          product_type?: Database["public"]["Enums"]["product_type"]
          status?: Database["public"]["Enums"]["tank_status"]
          threshold_usg?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tanks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_admin: { Args: { _user_id: string }; Returns: boolean }
      get_user_branch: { Args: { _user_id: string }; Returns: string }
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
      is_admin_or_supervisor: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "cashier" | "attendant"
      franchise_type: "Financial Dealer" | "Young Dealer" | "COCO Dealer"
      product_type: "PMS" | "AGO"
      shift_name: "Morning" | "Afternoon" | "Night"
      tank_status: "Full" | "Medium" | "Low" | "Critical"
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
      app_role: ["admin", "supervisor", "cashier", "attendant"],
      franchise_type: ["Financial Dealer", "Young Dealer", "COCO Dealer"],
      product_type: ["PMS", "AGO"],
      shift_name: ["Morning", "Afternoon", "Night"],
      tank_status: ["Full", "Medium", "Low", "Critical"],
    },
  },
} as const
