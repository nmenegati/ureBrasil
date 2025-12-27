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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          student_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          student_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          student_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "pending_documents_queue"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "activity_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_full_status"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "activity_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_url: string
          id: string
          mime_type: string
          rejection_notes: string | null
          rejection_reason: string | null
          rejection_reason_id: string | null
          status: Database["public"]["Enums"]["document_status"]
          student_id: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_url: string
          id?: string
          mime_type: string
          rejection_notes?: string | null
          rejection_reason?: string | null
          rejection_reason_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          student_id: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_url?: string
          id?: string
          mime_type?: string
          rejection_notes?: string | null
          rejection_reason?: string | null
          rejection_reason_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          student_id?: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_rejection_reason_id_fkey"
            columns: ["rejection_reason_id"]
            isOneToOne: false
            referencedRelation: "rejection_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "pending_documents_queue"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_full_status"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          card_brand: string | null
          card_last_digits: string | null
          confirmed_at: string | null
          created_at: string
          gateway_charge_id: string | null
          gateway_name: string | null
          gateway_reference_id: string | null
          id: string
          installments: number | null
          metadata: Json | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          pix_code: string | null
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          pix_receipt_url: string | null
          plan_id: string
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          card_brand?: string | null
          card_last_digits?: string | null
          confirmed_at?: string | null
          created_at?: string
          gateway_charge_id?: string | null
          gateway_name?: string | null
          gateway_reference_id?: string | null
          id?: string
          installments?: number | null
          metadata?: Json | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          pix_code?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          pix_receipt_url?: string | null
          plan_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          card_brand?: string | null
          card_last_digits?: string | null
          confirmed_at?: string | null
          created_at?: string
          gateway_charge_id?: string | null
          gateway_name?: string | null
          gateway_reference_id?: string | null
          id?: string
          installments?: number | null
          metadata?: Json | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pix_code?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          pix_receipt_url?: string | null
          plan_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "pending_documents_queue"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_full_status"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_direito: boolean
          is_physical: boolean
          name: string
          price: number
          type: Database["public"]["Enums"]["card_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_direito?: boolean
          is_physical?: boolean
          name: string
          price: number
          type: Database["public"]["Enums"]["card_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_direito?: boolean
          is_physical?: boolean
          name?: string
          price?: number
          type?: Database["public"]["Enums"]["card_type"]
          updated_at?: string
        }
        Relationships: []
      }
      rejection_reasons: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          document_type: Database["public"]["Enums"]["document_type"]
          id: string
          is_active: boolean
          reason: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          document_type: Database["public"]["Enums"]["document_type"]
          id?: string
          is_active?: boolean
          reason: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          document_type?: Database["public"]["Enums"]["document_type"]
          id?: string
          is_active?: boolean
          reason?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_cards: {
        Row: {
          card_number: string
          card_type: Database["public"]["Enums"]["card_type"]
          created_at: string
          delivered_at: string | null
          digital_card_url: string | null
          id: string
          is_physical: boolean
          issued_at: string
          payment_id: string
          qr_code: string
          shipped_at: string | null
          shipping_code: string | null
          shipping_status: Database["public"]["Enums"]["shipping_status"] | null
          status: Database["public"]["Enums"]["card_status"]
          student_id: string
          updated_at: string
          valid_until: string
        }
        Insert: {
          card_number: string
          card_type: Database["public"]["Enums"]["card_type"]
          created_at?: string
          delivered_at?: string | null
          digital_card_url?: string | null
          id?: string
          is_physical?: boolean
          issued_at?: string
          payment_id: string
          qr_code: string
          shipped_at?: string | null
          shipping_code?: string | null
          shipping_status?:
            | Database["public"]["Enums"]["shipping_status"]
            | null
          status?: Database["public"]["Enums"]["card_status"]
          student_id: string
          updated_at?: string
          valid_until: string
        }
        Update: {
          card_number?: string
          card_type?: Database["public"]["Enums"]["card_type"]
          created_at?: string
          delivered_at?: string | null
          digital_card_url?: string | null
          id?: string
          is_physical?: boolean
          issued_at?: string
          payment_id?: string
          qr_code?: string
          shipped_at?: string | null
          shipping_code?: string | null
          shipping_status?:
            | Database["public"]["Enums"]["shipping_status"]
            | null
          status?: Database["public"]["Enums"]["card_status"]
          student_id?: string
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_cards_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "pending_documents_queue"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_full_status"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string
          cep: string | null
          city: string | null
          complement: string | null
          course: string | null
          cpf: string
          created_at: string
          enrollment_number: string | null
          full_name: string
          id: string
          institution: string | null
          neighborhood: string | null
          number: string | null
          period: string | null
          phone: string
          plan_id: string | null
          profile_completed: boolean
          rg: string | null
          state: string | null
          street: string | null
          terms_accepted: boolean
          terms_accepted_at: string | null
          terms_ip_address: unknown
          terms_version: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date: string
          cep?: string | null
          city?: string | null
          complement?: string | null
          course?: string | null
          cpf: string
          created_at?: string
          enrollment_number?: string | null
          full_name: string
          id?: string
          institution?: string | null
          neighborhood?: string | null
          number?: string | null
          period?: string | null
          phone: string
          plan_id?: string | null
          profile_completed?: boolean
          rg?: string | null
          state?: string | null
          street?: string | null
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          terms_ip_address?: unknown
          terms_version?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string
          cep?: string | null
          city?: string | null
          complement?: string | null
          course?: string | null
          cpf?: string
          created_at?: string
          enrollment_number?: string | null
          full_name?: string
          id?: string
          institution?: string | null
          neighborhood?: string | null
          number?: string | null
          period?: string | null
          phone?: string
          plan_id?: string | null
          profile_completed?: boolean
          rg?: string | null
          state?: string | null
          street?: string | null
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          terms_ip_address?: unknown
          terms_version?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          attachments: Json | null
          created_at: string
          id: string
          is_internal: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          id?: string
          is_internal?: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          id?: string
          is_internal?: boolean
          message?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "admin_tickets_summary"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          created_at: string
          id: string
          message: string
          priority: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          student_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          message: string
          priority?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          student_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          message?: string
          priority?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          student_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "pending_documents_queue"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "support_tickets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_full_status"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "support_tickets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          event_type: string
          id: string
          payload: Json
          record_id: string
          response: Json | null
          sent_at: string | null
          table_name: string
        }
        Insert: {
          event_type: string
          id?: string
          payload: Json
          record_id: string
          response?: Json | null
          sent_at?: string | null
          table_name: string
        }
        Update: {
          event_type?: string
          id?: string
          payload?: Json
          record_id?: string
          response?: Json | null
          sent_at?: string | null
          table_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_dashboard: {
        Row: {
          active_cards: number | null
          completed_profiles: number | null
          open_tickets: number | null
          pending_documents: number | null
          pending_payments: number | null
          total_students: number | null
        }
        Relationships: []
      }
      admin_tickets_summary: {
        Row: {
          assigned_to: string | null
          course: string | null
          created_at: string | null
          institution: string | null
          last_message: string | null
          last_message_at: string | null
          message_count: number | null
          priority: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          student_cpf: string | null
          student_email: string | null
          student_name: string | null
          student_phone: string | null
          subject: string | null
          ticket_id: string | null
        }
        Relationships: []
      }
      pending_documents_queue: {
        Row: {
          course: string | null
          cpf: string | null
          document_id: string | null
          document_type: Database["public"]["Enums"]["document_type"] | null
          file_url: string | null
          hours_waiting: number | null
          institution: string | null
          student_email: string | null
          student_id: string | null
          student_name: string | null
          submitted_at: string | null
        }
        Relationships: []
      }
      physical_cards_to_print: {
        Row: {
          card_id: string | null
          card_number: string | null
          cep: string | null
          city: string | null
          complement: string | null
          course: string | null
          cpf: string | null
          full_name: string | null
          institution: string | null
          issued_at: string | null
          neighborhood: string | null
          number: string | null
          period: string | null
          phone: string | null
          plan_name: string | null
          plan_type: Database["public"]["Enums"]["card_type"] | null
          rg: string | null
          shipping_status: Database["public"]["Enums"]["shipping_status"] | null
          state: string | null
          street: string | null
          valid_until: string | null
        }
        Relationships: []
      }
      student_full_status: {
        Row: {
          card_is_physical: boolean | null
          card_number: string | null
          card_status: Database["public"]["Enums"]["card_status"] | null
          card_valid_until: string | null
          course: string | null
          cpf: string | null
          docs_approved: number | null
          docs_pending: number | null
          docs_rejected: number | null
          full_name: string | null
          institution: string | null
          open_tickets: number | null
          payment_amount: number | null
          payment_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          phone: string | null
          profile_completed: boolean | null
          shipping_status: Database["public"]["Enums"]["shipping_status"] | null
          student_id: string | null
          terms_accepted: boolean | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_card_validity: { Args: { issue_date: string }; Returns: string }
      check_cpf_exists: { Args: { p_cpf: string }; Returns: boolean }
      check_phone_exists: { Args: { p_phone: string }; Returns: boolean }
      generate_card_number: { Args: never; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["user_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      card_status:
        | "pending_docs"
        | "pending_payment"
        | "processing"
        | "active"
        | "expired"
        | "cancelled"
      card_type:
        | "geral_digital"
        | "geral_fisica"
        | "direito_digital"
        | "direito_fisica"
      document_status: "pending" | "approved" | "rejected"
      document_type: "rg" | "endereco" | "matricula" | "foto" | "selfie"
      payment_method: "pix" | "credit_card" | "debit_card"
      payment_status:
        | "pending"
        | "processing"
        | "approved"
        | "rejected"
        | "refunded"
      shipping_status:
        | "pending"
        | "processing"
        | "shipped"
        | "delivered"
        | "failed"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_user"
        | "resolved"
        | "closed"
      user_role: "user" | "admin" | "manager"
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
      card_status: [
        "pending_docs",
        "pending_payment",
        "processing",
        "active",
        "expired",
        "cancelled",
      ],
      card_type: [
        "geral_digital",
        "geral_fisica",
        "direito_digital",
        "direito_fisica",
      ],
      document_status: ["pending", "approved", "rejected"],
      document_type: ["rg", "endereco", "matricula", "foto", "selfie"],
      payment_method: ["pix", "credit_card", "debit_card"],
      payment_status: [
        "pending",
        "processing",
        "approved",
        "rejected",
        "refunded",
      ],
      shipping_status: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "failed",
      ],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_user",
        "resolved",
        "closed",
      ],
      user_role: ["user", "admin", "manager"],
    },
  },
} as const
