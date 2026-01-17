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
      bartender_order_items: {
        Row: {
          bartender_order_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string | null
          product_name: string
          quantity: number
        }
        Insert: {
          bartender_order_id: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name: string
          quantity: number
        }
        Update: {
          bartender_order_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "bartender_order_items_bartender_order_id_fkey"
            columns: ["bartender_order_id"]
            isOneToOne: false
            referencedRelation: "bartender_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bartender_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bartender_orders: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          sale_id: string | null
          staff_id: string | null
          staff_name: string
          status: Database["public"]["Enums"]["kitchen_order_status"]
          table_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          sale_id?: string | null
          staff_id?: string | null
          staff_name: string
          status?: Database["public"]["Enums"]["kitchen_order_status"]
          table_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          sale_id?: string | null
          staff_id?: string | null
          staff_name?: string
          status?: Database["public"]["Enums"]["kitchen_order_status"]
          table_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bartender_orders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bartender_orders_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_expenses: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          session_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          session_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_expenses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_register_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          expected_cash: number | null
          expected_qr: number | null
          expected_transfer: number | null
          final_cash: number | null
          id: string
          initial_cash: number
          is_event: boolean
          notes: string | null
          opened_at: string
          opened_by: string | null
          status: string
          ticket_price: number | null
          ticket_quantity: number | null
          tickets_sold: number | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          expected_cash?: number | null
          expected_qr?: number | null
          expected_transfer?: number | null
          final_cash?: number | null
          id?: string
          initial_cash?: number
          is_event?: boolean
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          status?: string
          ticket_price?: number | null
          ticket_quantity?: number | null
          tickets_sold?: number | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          expected_cash?: number | null
          expected_qr?: number | null
          expected_transfer?: number | null
          final_cash?: number | null
          id?: string
          initial_cash?: number
          is_event?: boolean
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          status?: string
          ticket_price?: number | null
          ticket_quantity?: number | null
          tickets_sold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      event_complements: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          price: number
          quantity: number
          total: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          price?: number
          quantity?: number
          total?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          price?: number
          quantity?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_complements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          base_price: number
          client_name: string
          client_phone: string | null
          created_at: string
          event_date: string
          event_type: string
          id: string
          notes: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          base_price?: number
          client_name: string
          client_phone?: string | null
          created_at?: string
          event_date: string
          event_type: string
          id?: string
          notes?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          client_name?: string
          client_phone?: string | null
          created_at?: string
          event_date?: string
          event_type?: string
          id?: string
          notes?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          description: string | null
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          description?: string | null
          id?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          description?: string | null
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
        }
        Relationships: []
      }
      kitchen_order_items: {
        Row: {
          created_at: string
          id: string
          kitchen_order_id: string
          notes: string | null
          product_id: string | null
          product_name: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          kitchen_order_id: string
          notes?: string | null
          product_id?: string | null
          product_name: string
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          kitchen_order_id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_order_items_kitchen_order_id_fkey"
            columns: ["kitchen_order_id"]
            isOneToOne: false
            referencedRelation: "kitchen_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_orders: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          sale_id: string | null
          staff_id: string | null
          staff_name: string
          status: Database["public"]["Enums"]["kitchen_order_status"]
          table_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          sale_id?: string | null
          staff_id?: string | null
          staff_name: string
          status?: Database["public"]["Enums"]["kitchen_order_status"]
          table_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          sale_id?: string | null
          staff_id?: string | null
          staff_name?: string
          status?: Database["public"]["Enums"]["kitchen_order_status"]
          table_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_orders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_orders_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      login_verification_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          used: boolean
          user_agent: string | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          used?: boolean
          user_agent?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          used?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          cost_per_unit: number | null
          created_at: string
          id: string
          is_compound: boolean
          is_for_sale: boolean
          min_stock: number
          name: string
          package_count: number | null
          purchase_price: number
          quantity: number
          requires_kitchen: boolean
          sale_price: number
          status: Database["public"]["Enums"]["stock_status"]
          unit_base: string | null
          units_per_package: number | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["product_category"]
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          is_compound?: boolean
          is_for_sale?: boolean
          min_stock?: number
          name: string
          package_count?: number | null
          purchase_price?: number
          quantity?: number
          requires_kitchen?: boolean
          sale_price?: number
          status?: Database["public"]["Enums"]["stock_status"]
          unit_base?: string | null
          units_per_package?: number | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          is_compound?: boolean
          is_for_sale?: boolean
          min_stock?: number
          name?: string
          package_count?: number | null
          purchase_price?: number
          quantity?: number
          requires_kitchen?: boolean
          sale_price?: number
          status?: Database["public"]["Enums"]["stock_status"]
          unit_base?: string | null
          units_per_package?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      recipes: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          product_id: string
          quantity: number
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          product_id: string
          quantity: number
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          product_id?: string
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Insert: {
          id?: string
          product_id?: string | null
          product_name: string
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Update: {
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          concept: string | null
          created_at: string
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          staff_id: string | null
          staff_name: string | null
          table_number: string | null
          total_amount: number
        }
        Insert: {
          concept?: string | null
          created_at?: string
          id?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          staff_id?: string | null
          staff_name?: string | null
          table_number?: string | null
          total_amount?: number
        }
        Update: {
          concept?: string | null
          created_at?: string
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          staff_id?: string | null
          staff_name?: string | null
          table_number?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          password_hash: string
          phone: string | null
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          password_hash: string
          phone?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          password_hash?: string
          phone?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      staff_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_id: string | null
          role_target: Database["public"]["Enums"]["app_role"] | null
          staff_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          related_id?: string | null
          role_target?: Database["public"]["Enums"]["app_role"] | null
          staff_id?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_id?: string | null
          role_target?: Database["public"]["Enums"]["app_role"] | null
          staff_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_notifications_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          created_at: string
          id: string
          new_quantity: number
          notes: string | null
          previous_quantity: number
          product_id: string | null
          product_name: string
          reason: Database["public"]["Enums"]["adjustment_reason"]
        }
        Insert: {
          created_at?: string
          id?: string
          new_quantity: number
          notes?: string | null
          previous_quantity: number
          product_id?: string | null
          product_name: string
          reason: Database["public"]["Enums"]["adjustment_reason"]
        }
        Update: {
          created_at?: string
          id?: string
          new_quantity?: number
          notes?: string | null
          previous_quantity?: number
          product_id?: string | null
          product_name?: string
          reason?: Database["public"]["Enums"]["adjustment_reason"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_staff_roles: {
        Args: { _staff_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      staff_has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _staff_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      adjustment_reason:
        | "loss"
        | "internal_consumption"
        | "breakage"
        | "correction"
      app_role: "admin" | "mozo" | "cocina" | "bartender" | "cajero"
      expense_category:
        | "drinks"
        | "suppliers"
        | "staff"
        | "events"
        | "maintenance"
        | "others"
      kitchen_order_status:
        | "pendiente"
        | "en_preparacion"
        | "listo"
        | "entregado"
      payment_method: "cash" | "transfer" | "qr"
      payment_status: "no_cobrado" | "cobrado"
      product_category:
        | "drinks"
        | "cocktails"
        | "food"
        | "supplies"
        | "others"
        | "semi_elaborated"
      stock_status: "normal" | "low" | "critical"
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
      adjustment_reason: [
        "loss",
        "internal_consumption",
        "breakage",
        "correction",
      ],
      app_role: ["admin", "mozo", "cocina", "bartender", "cajero"],
      expense_category: [
        "drinks",
        "suppliers",
        "staff",
        "events",
        "maintenance",
        "others",
      ],
      kitchen_order_status: [
        "pendiente",
        "en_preparacion",
        "listo",
        "entregado",
      ],
      payment_method: ["cash", "transfer", "qr"],
      payment_status: ["no_cobrado", "cobrado"],
      product_category: [
        "drinks",
        "cocktails",
        "food",
        "supplies",
        "others",
        "semi_elaborated",
      ],
      stock_status: ["normal", "low", "critical"],
    },
  },
} as const
