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
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      call_history: {
        Row: {
          call_type: string
          created_at: string
          direction: string
          duration_seconds: number
          ended_at: string | null
          id: string
          peer_user_id: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          call_type: string
          created_at?: string
          direction: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          peer_user_id: string
          started_at?: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          call_type?: string
          created_at?: string
          direction?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          peer_user_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_group_messages: {
        Row: {
          content: string
          created_at: string | null
          edited_at: string | null
          group_id: string
          id: string
          is_deleted: boolean | null
          media_type: string | null
          media_url: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          edited_at?: string | null
          group_id: string
          id?: string
          is_deleted?: boolean | null
          media_type?: string | null
          media_url?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          edited_at?: string | null
          group_id?: string
          id?: string
          is_deleted?: boolean | null
          media_type?: string | null
          media_url?: string | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_group_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_groups: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          invite_code: string
          max_members: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          invite_code?: string
          max_members?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          invite_code?: string
          max_members?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_deleted: boolean | null
          is_read: boolean | null
          receiver_id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_read?: boolean | null
          receiver_id: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_read?: boolean | null
          receiver_id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_memories: {
        Row: {
          collaboration_id: string
          content: string | null
          created_at: string
          creator_user_id: string
          id: string
          media_url: string | null
          memory_type: Database["public"]["Enums"]["memory_type"]
        }
        Insert: {
          collaboration_id: string
          content?: string | null
          created_at?: string
          creator_user_id: string
          id?: string
          media_url?: string | null
          memory_type: Database["public"]["Enums"]["memory_type"]
        }
        Update: {
          collaboration_id?: string
          content?: string | null
          created_at?: string
          creator_user_id?: string
          id?: string
          media_url?: string | null
          memory_type?: Database["public"]["Enums"]["memory_type"]
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_memories_collaboration_id_fkey"
            columns: ["collaboration_id"]
            isOneToOne: false
            referencedRelation: "collaboration_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_otp: {
        Row: {
          collaboration_id: string
          created_at: string
          id: string
          otp_code: string
        }
        Insert: {
          collaboration_id: string
          created_at?: string
          id?: string
          otp_code: string
        }
        Update: {
          collaboration_id?: string
          created_at?: string
          id?: string
          otp_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_otp_collaboration_id_fkey"
            columns: ["collaboration_id"]
            isOneToOne: true
            referencedRelation: "collaboration_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_participants: {
        Row: {
          collaboration_id: string
          id: string
          joined_at: string
          left_at: string | null
          user_id: string
        }
        Insert: {
          collaboration_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          user_id: string
        }
        Update: {
          collaboration_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_participants_collaboration_id_fkey"
            columns: ["collaboration_id"]
            isOneToOne: false
            referencedRelation: "collaboration_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          host_user_id: string
          id: string
          is_active: boolean | null
          otp_expires_at: string
          session_date: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          host_user_id: string
          id?: string
          is_active?: boolean | null
          otp_expires_at: string
          session_date?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          host_user_id?: string
          id?: string
          is_active?: boolean | null
          otp_expires_at?: string
          session_date?: string | null
          title?: string | null
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          discount_percentage: number
          discounted_price: number
          id: string
          original_price: number
          payment_method: string | null
          plan_id: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          discount_percentage: number
          discounted_price: number
          id?: string
          original_price: number
          payment_method?: string | null
          plan_id?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          discount_percentage?: number
          discounted_price?: number
          id?: string
          original_price?: number
          payment_method?: string | null
          plan_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_percentage: number
          end_date: string
          id: string
          is_active: boolean
          max_uses: number | null
          start_date: string
          times_used: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          discount_percentage: number
          end_date: string
          id?: string
          is_active?: boolean
          max_uses?: number | null
          start_date: string
          times_used?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          discount_percentage?: number
          end_date?: string
          id?: string
          is_active?: boolean
          max_uses?: number | null
          start_date?: string
          times_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          sender_email: string
          sender_name: string
          smtp_host: string
          smtp_password: string
          smtp_port: number
          smtp_username: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          sender_email: string
          sender_name?: string
          smtp_host: string
          smtp_password: string
          smtp_port?: number
          smtp_username: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          sender_email?: string
          sender_name?: string
          smtp_host?: string
          smtp_password?: string
          smtp_port?: number
          smtp_username?: string
          updated_at?: string
        }
        Relationships: []
      }
      future_messages: {
        Row: {
          content: string
          created_at: string
          deliver_at: string
          id: string
          is_delivered: boolean | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deliver_at: string
          id?: string
          is_delivered?: boolean | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deliver_at?: string
          id?: string
          is_delivered?: boolean | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      group_call_participants: {
        Row: {
          call_id: string
          id: string
          joined_at: string
          left_at: string | null
          user_id: string
          was_kicked: boolean | null
        }
        Insert: {
          call_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          user_id: string
          was_kicked?: boolean | null
        }
        Update: {
          call_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          user_id?: string
          was_kicked?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "group_call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "group_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      group_calls: {
        Row: {
          call_type: string
          created_at: string
          ended_at: string | null
          group_id: string
          id: string
          started_at: string
          started_by: string
          status: string
        }
        Insert: {
          call_type?: string
          created_at?: string
          ended_at?: string | null
          group_id: string
          id?: string
          started_at?: string
          started_by: string
          status?: string
        }
        Update: {
          call_type?: string
          created_at?: string
          ended_at?: string | null
          group_id?: string
          id?: string
          started_at?: string
          started_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_calls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
          whatsapp_number: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          ai_analysis: Json | null
          collaboration_id: string | null
          content: string | null
          created_at: string
          emotion_category: string | null
          event_category: string | null
          id: string
          is_from_collaboration: boolean | null
          is_public: boolean | null
          language: string | null
          location_data: Json | null
          locked_until: string | null
          media_url: string | null
          memory_date: string
          memory_type: Database["public"]["Enums"]["memory_type"]
          mood: string | null
          people_tags: string[] | null
          privacy_level: string | null
          sentiment_score: number | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          collaboration_id?: string | null
          content?: string | null
          created_at?: string
          emotion_category?: string | null
          event_category?: string | null
          id?: string
          is_from_collaboration?: boolean | null
          is_public?: boolean | null
          language?: string | null
          location_data?: Json | null
          locked_until?: string | null
          media_url?: string | null
          memory_date: string
          memory_type: Database["public"]["Enums"]["memory_type"]
          mood?: string | null
          people_tags?: string[] | null
          privacy_level?: string | null
          sentiment_score?: number | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          collaboration_id?: string | null
          content?: string | null
          created_at?: string
          emotion_category?: string | null
          event_category?: string | null
          id?: string
          is_from_collaboration?: boolean | null
          is_public?: boolean | null
          language?: string | null
          location_data?: Json | null
          locked_until?: string | null
          media_url?: string | null
          memory_date?: string
          memory_type?: Database["public"]["Enums"]["memory_type"]
          mood?: string | null
          people_tags?: string[] | null
          privacy_level?: string | null
          sentiment_score?: number | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      memory_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          memory_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          memory_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          memory_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_comments_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_likes: {
        Row: {
          created_at: string
          id: string
          memory_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          memory_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          memory_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_likes_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
        ]
      }
      mpesa_config: {
        Row: {
          consumer_key: string
          consumer_secret: string
          created_at: string
          environment: string
          id: string
          is_active: boolean | null
          passkey: string
          shortcode: string
          updated_at: string
        }
        Insert: {
          consumer_key: string
          consumer_secret: string
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean | null
          passkey: string
          shortcode: string
          updated_at?: string
        }
        Update: {
          consumer_key?: string
          consumer_secret?: string
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean | null
          passkey?: string
          shortcode?: string
          updated_at?: string
        }
        Relationships: []
      }
      mpesa_transactions: {
        Row: {
          amount: number
          checkout_request_id: string | null
          created_at: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt_number: string | null
          phone_number: string
          plan_id: string
          result_code: string | null
          result_desc: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          phone_number: string
          plan_id: string
          result_code?: string | null
          result_desc?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          phone_number?: string
          plan_id?: string
          result_code?: string | null
          result_desc?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mpesa_transactions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          comments: boolean
          created_at: string
          friend_requests: boolean
          id: string
          likes: boolean
          mentions: boolean
          messages: boolean
          trending: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          comments?: boolean
          created_at?: string
          friend_requests?: boolean
          id?: string
          likes?: boolean
          mentions?: boolean
          messages?: boolean
          trending?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          comments?: boolean
          created_at?: string
          friend_requests?: boolean
          id?: string
          likes?: boolean
          mentions?: boolean
          messages?: boolean
          trending?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          content: string
          created_at: string
          from_user_id: string | null
          id: string
          is_read: boolean
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          is_read?: boolean
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          is_read?: boolean
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_social_platforms: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean | null
          plan_id: string
          platform: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          plan_id: string
          platform: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          plan_id?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_social_platforms_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          full_name: string | null
          gender: string | null
          id: string
          is_discoverable: boolean
          preferred_language: string | null
          updated_at: string
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          is_discoverable?: boolean
          preferred_language?: string | null
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          is_discoverable?: boolean
          preferred_language?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      reported_content: {
        Row: {
          created_at: string
          id: string
          memory_id: string
          reason: string | null
          reporter_id: string
          reviewed_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          memory_id: string
          reason?: string | null
          reporter_id: string
          reviewed_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          memory_id?: string
          reason?: string | null
          reporter_id?: string
          reviewed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reported_content_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
        ]
      }
      social_import_config: {
        Row: {
          config: Json | null
          contact_identifier: string | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean | null
          platform: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          contact_identifier?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean | null
          platform: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          contact_identifier?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean | null
          platform?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_import_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          memory_id: string | null
          platform: string
          source_message_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          memory_id?: string | null
          platform: string
          source_message_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          memory_id?: string | null
          platform?: string
          source_message_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_import_logs_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
        ]
      }
      social_link_tokens: {
        Row: {
          created_at: string
          expires_at: string
          platform: string
          token: string
          used: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          platform: string
          token: string
          used?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          platform?: string
          token?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          daily_memory_limit: number
          features: Json | null
          id: string
          is_active: boolean | null
          languages_limited: boolean | null
          name: string
          price_monthly: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_memory_limit: number
          features?: Json | null
          id?: string
          is_active?: boolean | null
          languages_limited?: boolean | null
          name: string
          price_monthly: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_memory_limit?: number
          features?: Json | null
          id?: string
          is_active?: boolean | null
          languages_limited?: boolean | null
          name?: string
          price_monthly?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
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
      user_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          last_memory_date: string | null
          memories_used_today: number | null
          plan_id: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_memory_date?: string | null
          memories_used_today?: number | null
          plan_id: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_memory_date?: string | null
          memories_used_today?: number | null
          plan_id?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      whatup_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          reply_to_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          reply_to_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          reply_to_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatup_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "whatup_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatup_comments_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "whatup_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      whatup_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatup_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "whatup_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatup_posts: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
          video_url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          video_url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          video_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_social_link_token: { Args: { _platform: string }; Returns: string }
      create_system_notification: {
        Args: {
          _content: string
          _from_user_id?: string
          _reference_id?: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      find_collaboration_by_otp: {
        Args: { _otp_code: string }
        Returns: {
          created_at: string
          host_user_id: string
          id: string
          is_active: boolean
          otp_expires_at: string
          session_date: string
          title: string
        }[]
      }
      get_active_social_platforms: {
        Args: never
        Returns: {
          contact_identifier: string
          display_name: string
          is_active: boolean
          platform: string
        }[]
      }
      get_collaboration_details: {
        Args: { _collaboration_id: string }
        Returns: {
          created_at: string
          ended_at: string
          host_user_id: string
          id: string
          is_active: boolean
          otp_code: string
          otp_expires_at: string
          session_date: string
          title: string
        }[]
      }
      get_group_by_invite_code: {
        Args: { code: string }
        Returns: {
          avatar_url: string
          description: string
          id: string
          member_count: number
          name: string
        }[]
      }
      get_mpesa_public_status: {
        Args: never
        Returns: {
          environment: string
          is_active: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_memory_usage: {
        Args: { _subscription_id: string }
        Returns: undefined
      }
      is_collaboration_host: {
        Args: { _collaboration_id: string; _user_id: string }
        Returns: boolean
      }
      is_collaboration_participant: {
        Args: { _collaboration_id: string; _user_id: string }
        Returns: boolean
      }
      is_friend: {
        Args: { _friend_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      join_collaboration_with_otp: {
        Args: { _collaboration_id: string; _otp_code: string }
        Returns: boolean
      }
      join_group_by_invite_code: {
        Args: { _invite_code: string }
        Returns: Json
      }
      redeem_coupon: {
        Args: {
          _coupon_id: string
          _original_price: number
          _payment_method?: string
          _plan_id: string
        }
        Returns: Json
      }
      redeem_social_link_token: {
        Args: { _platform: string; _token: string }
        Returns: string
      }
      reset_daily_memory_count: {
        Args: { _subscription_id: string }
        Returns: undefined
      }
      search_users_for_discovery: {
        Args: { page_num?: number; page_size?: number; search_term?: string }
        Returns: {
          avatar_url: string
          full_name: string
          user_id: string
        }[]
      }
      upsert_user_subscription: {
        Args: {
          _period_end?: string
          _plan_id: string
          _status?: string
          _user_id: string
        }
        Returns: undefined
      }
      use_coupon: { Args: { _coupon_id: string }; Returns: undefined }
      validate_coupon: { Args: { _code: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
      memory_type: "text" | "audio" | "video" | "photo"
      subscription_tier: "basic" | "standard" | "premium"
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
      app_role: ["admin", "user"],
      memory_type: ["text", "audio", "video", "photo"],
      subscription_tier: ["basic", "standard", "premium"],
    },
  },
} as const
