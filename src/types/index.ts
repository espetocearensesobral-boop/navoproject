export type AppRole = 'client' | 'barber' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AppRole;
  avatar_url: string;
  loyalty_points: number;
  loyalty_tier: 'Bronze' | 'Prata' | 'Ouro Metálico';
  saved_cards: SavedCard[];
}

export interface SavedCard {
  id: string;
  card_holder: string;
  last_four: string;
  brand: 'visa' | 'mastercard' | 'elo';
  expiry: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
}

export interface ServiceItem {
  id: string;
  category_id: string;
  title: string;
  description: string;
  price: number;
  duration_minutes: number;
  is_combo?: boolean;
  original_price?: number;
  discount_percentage?: number;
  popular?: boolean;
  image_url?: string;
  gallery_urls?: string[];
}

export interface Professional {
  id: string;
  name: string;
  nickname?: string;
  role: string;
  rating: number;
  reviews_count: number;
  photo_url: string;
  specialties: string[];
  commission_rate: number; // e.g. 0.40 = 40%
  working_hours: {
    days: string[]; // ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    start: string; // '08:00'
    end: string; // '19:00'
    lunch_break?: { start: string; end: string };
  };
  is_active?: boolean;
  bio?: string;
  phone?: string;
  pix_key?: string;
}

export interface Appointment {
  id: string;
  client_id: string;
  client_name: string;
  client_phone: string;
  professional_id: string;
  professional_name: string;
  services: ServiceItem[];
  total_duration_minutes: number;
  original_amount: number;
  discount_amount: number;
  final_amount: number;
  loyalty_points_used: number;
  date: string; // YYYY-MM-DD
  time_slot: string; // HH:mm
  status: 'pending' | 'confirmed' | 'in_queue' | 'in_service' | 'completed' | 'cancelled' | 'no_show';
  payment_method: 'credit_card' | 'pix' | 'loyalty_balance' | 'pay_at_venue' | 'in_store';
  cancellation_reason?: string;
  is_reviewed?: boolean;
  booking_code?: string;
  voucher_code?: string;
  created_at: string;
}

export interface SubscriptionPlan {
  id: string;
  title: string;
  monthly_price: number;
  description: string;
  features: string[];
  is_popular?: boolean;
  badge?: string;
}

export interface UserSubscription {
  id: string;
  plan_id: string;
  plan_title: string;
  monthly_price: number;
  status: 'active' | 'paused' | 'cancelled';
  next_billing_date: string;
  cuts_used_this_month: number;
  cuts_limit: number | 'ilimitado';
}

export interface LoyaltyReward {
  id: string;
  title: string;
  points_required: number;
  reward_type: 'discount' | 'free_product' | 'free_service';
  value_description: string;
  icon: string;
}

export interface WaitingQueueItem {
  id: string;
  client_name: string;
  client_phone?: string;
  service_title: string;
  service_price?: number;
  professional_id?: string;
  professional_name: string;
  scheduled_time: string;
  estimated_wait_minutes: number;
  status: 'waiting' | 'in_chair' | 'completed';
  arrived_at: string;
  notes?: string;
  started_at?: string;
  completed_at?: string;
}

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  cost_price: number;
  stock_quantity: number;
  min_stock_alert: number;
  commission_percentage: number;
  image_url?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'client' | 'bot';
  text: string;
  timestamp: string;
  options?: { label: string; action: string }[];
}
