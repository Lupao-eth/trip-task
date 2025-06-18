export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          avatar_url: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          username?: string | null
          avatar_url?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          username?: string | null
          avatar_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      rider_profiles: {
        Row: {
          id: string
          user_id: string
          full_name: string | null
          avatar_url: string | null
          phone_number: string | null
          vehicle_type: string
          vehicle_plate: string
          is_available: boolean
          current_location: string | null
          rating: number
          total_trips: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          full_name?: string | null
          avatar_url?: string | null
          phone_number?: string | null
          vehicle_type: string
          vehicle_plate: string
          is_available?: boolean
          current_location?: string | null
          rating?: number
          total_trips?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string | null
          avatar_url?: string | null
          phone_number?: string | null
          vehicle_type?: string
          vehicle_plate?: string
          is_available?: boolean
          current_location?: string | null
          rating?: number
          total_trips?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_profiles_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      bookings: {
        Row: {
          id: string
          user_id: string
          rider_id: string | null
          pickup_location: string
          dropoff_location: string
          schedule_time: string | null
          status: string
          created_at: string
          updated_at: string
          notes: string | null
        }
        Insert: {
          id?: string
          user_id: string
          rider_id?: string | null
          pickup_location: string
          dropoff_location: string
          schedule_time?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          notes?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          rider_id?: string | null
          pickup_location?: string
          dropoff_location?: string
          schedule_time?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_rider_id_fkey"
            columns: ["rider_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      booking_with_user: {
        Row: {
          id: string
          user_id: string
          rider_id: string | null
          pickup_location: string
          dropoff_location: string
          schedule_time: string | null
          status: string
          created_at: string
          updated_at: string
          notes: string | null
          user: {
            id: string
            full_name: string | null
            avatar_url: string | null
          }
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 