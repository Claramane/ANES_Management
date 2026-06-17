export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      merge_requests: {
        Row: {
          branch_id: string
          conflict_resolution: Json | null
          created_at: string
          description: string | null
          id: string
          merge_strategy: string | null
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          conflict_resolution?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          merge_strategy?: string | null
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          conflict_resolution?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          merge_strategy?: string | null
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      monthly_schedules: {
        Row: {
          area_code: string | null
          created_at: string
          date: string
          id: string
          shift_type: string
          special_type: string | null
          updated_at: string
          user_id: string
          work_time: string | null
        }
        Insert: {
          area_code?: string | null
          created_at?: string
          date: string
          id?: string
          shift_type: string
          special_type?: string | null
          updated_at?: string
          user_id: string
          work_time?: string | null
        }
        Update: {
          area_code?: string | null
          created_at?: string
          date?: string
          id?: string
          shift_type?: string
          special_type?: string | null
          updated_at?: string
          user_id?: string
          work_time?: string | null
        }
        Relationships: []
      }
      schedule_branches: {
        Row: {
          base_commit_id: string | null
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          head_commit_id: string | null
          id: string
          kind: string
          merged_at: string | null
          merged_into_commit_id: string | null
          month: string
          name: string
          owner_user_id: string
          related_entity_id: string | null
          related_entity_table: string | null
          status: string
          updated_at: string
        }
        Insert: {
          base_commit_id?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          head_commit_id?: string | null
          id?: string
          kind: string
          merged_at?: string | null
          merged_into_commit_id?: string | null
          month: string
          name: string
          owner_user_id: string
          related_entity_id?: string | null
          related_entity_table?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          base_commit_id?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          head_commit_id?: string | null
          id?: string
          kind?: string
          merged_at?: string | null
          merged_into_commit_id?: string | null
          month?: string
          name?: string
          owner_user_id?: string
          related_entity_id?: string | null
          related_entity_table?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedule_changes: {
        Row: {
          actor_id: string | null
          branch_id: string | null
          change_source: string | null
          created_at: string
          date: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          op: string
          related_entity_id: string | null
          related_entity_table: string | null
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          branch_id?: string | null
          change_source?: string | null
          created_at?: string
          date: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          op?: string
          related_entity_id?: string | null
          related_entity_table?: string | null
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          branch_id?: string | null
          change_source?: string | null
          created_at?: string
          date?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          op?: string
          related_entity_id?: string | null
          related_entity_table?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      schedule_commits: {
        Row: {
          author_id: string | null
          author_name: string | null
          branch_id: string | null
          committed_at: string
          id: string
          kind: string
          merged_from_branch_id: string | null
          message: string | null
          month: string
          parent_id: string | null
          snapshot: Json
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          branch_id?: string | null
          committed_at?: string
          id?: string
          kind?: string
          merged_from_branch_id?: string | null
          message?: string | null
          month: string
          parent_id?: string | null
          snapshot?: Json
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          branch_id?: string | null
          committed_at?: string
          id?: string
          kind?: string
          merged_from_branch_id?: string | null
          message?: string | null
          month?: string
          parent_id?: string | null
          snapshot?: Json
        }
        Relationships: []
      }
      schedule_heads: {
        Row: { commit_id: string; month: string; updated_at: string }
        Insert: { commit_id: string; month: string; updated_at?: string }
        Update: { commit_id?: string; month?: string; updated_at?: string }
        Relationships: []
      }
      shift_rules: {
        Row: {
          created_at: string
          id: string
          identity: string
          max_consecutive_work_days: number
          max_eve_per_month: number | null
          max_night_per_month: number | null
          min_rest_hours_after_eve: number
          min_rest_hours_after_night: number
          notes: string | null
          swap_allowed_shift_types: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          identity: string
          max_consecutive_work_days?: number
          max_eve_per_month?: number | null
          max_night_per_month?: number | null
          min_rest_hours_after_eve?: number
          min_rest_hours_after_night?: number
          notes?: string | null
          swap_allowed_shift_types?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          identity?: string
          max_consecutive_work_days?: number
          max_eve_per_month?: number | null
          max_night_per_month?: number | null
          min_rest_hours_after_eve?: number
          min_rest_hours_after_night?: number
          notes?: string | null
          swap_allowed_shift_types?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      shift_swap_requests: {
        Row: {
          admin_review_note: string | null
          admin_reviewed_at: string | null
          branch_ids: string[]
          created_at: string
          id: string
          invalidated_reason: string | null
          memo: string | null
          merge_request_ids: string[]
          requester_area_code: string | null
          requester_date: string
          requester_full_name: string
          requester_shift_type: string
          requester_user_id: string
          reviewed_by_admin: string | null
          reviewed_by_target: string | null
          status: string
          swap_plan: Json | null
          target_area_code: string | null
          target_date: string
          target_full_name: string
          target_reviewed_at: string | null
          target_shift_type: string
          target_user_id: string
          updated_at: string
        }
        Insert: {
          admin_review_note?: string | null
          admin_reviewed_at?: string | null
          branch_ids?: string[]
          created_at?: string
          id?: string
          invalidated_reason?: string | null
          memo?: string | null
          merge_request_ids?: string[]
          requester_area_code?: string | null
          requester_date: string
          requester_full_name: string
          requester_shift_type: string
          requester_user_id: string
          reviewed_by_admin?: string | null
          reviewed_by_target?: string | null
          status?: string
          swap_plan?: Json | null
          target_area_code?: string | null
          target_date: string
          target_full_name: string
          target_reviewed_at?: string | null
          target_shift_type: string
          target_user_id: string
          updated_at?: string
        }
        Update: {
          admin_review_note?: string | null
          admin_reviewed_at?: string | null
          branch_ids?: string[]
          created_at?: string
          id?: string
          invalidated_reason?: string | null
          memo?: string | null
          merge_request_ids?: string[]
          requester_area_code?: string | null
          requester_date?: string
          requester_full_name?: string
          requester_shift_type?: string
          requester_user_id?: string
          reviewed_by_admin?: string | null
          reviewed_by_target?: string | null
          status?: string
          swap_plan?: Json | null
          target_area_code?: string | null
          target_date?: string
          target_full_name?: string
          target_reviewed_at?: string | null
          target_shift_type?: string
          target_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          group_data: Json | null
          hire_date: string | null
          id: string | null
          identity: string | null
          is_active: boolean
          permissions: string[]
          role: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          group_data?: Json | null
          hire_date?: string | null
          id?: string | null
          identity?: string | null
          is_active?: boolean
          permissions?: string[]
          role?: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          group_data?: Json | null
          hire_date?: string | null
          id?: string | null
          identity?: string | null
          is_active?: boolean
          permissions?: string[]
          role?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_swap_request: { Args: { p_id: string }; Returns: undefined }
      commit_checkpoint: {
        Args: { p_kind?: string; p_message?: string; p_month: string }
        Returns: unknown
      }
      compute_branch_merge_conflicts: {
        Args: { p_branch_id: string }
        Returns: Json
      }
      decide_swap_request_as_target: {
        Args: { p_decision: string; p_id: string }
        Returns: undefined
      }
      get_branch_state: { Args: { p_branch_id: string }; Returns: Json }
      get_my_role: { Args: Record<PropertyKey, never>; Returns: string }
      has_permission: { Args: { cap: string }; Returns: boolean }
      merge_branch: {
        Args: { p_branch_id: string; p_conflict_resolution?: Json; p_message?: string }
        Returns: unknown
      }
      open_branch: {
        Args: {
          p_kind?: string
          p_month: string
          p_name?: string
          p_related_entity_id?: string
          p_related_entity_table?: string
        }
        Returns: unknown
      }
      restore_to_commit: {
        Args: { p_commit_id: string; p_message?: string }
        Returns: unknown
      }
      review_swap_request: {
        Args: { p_conflict_resolution?: Json; p_decision: string; p_id: string }
        Returns: undefined
      }
      submit_swap_request: {
        Args: {
          p_memo?: string
          p_requester_date: string
          p_target_date: string
          p_target_user_id: string
        }
        Returns: string
      }
      write_to_branch: {
        Args: {
          p_branch_id: string
          p_date: string
          p_field: string
          p_new_value?: string
          p_old_value?: string
          p_op: string
          p_user_id: string
        }
        Returns: string
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Row']

export type TablesInsert<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Update']
