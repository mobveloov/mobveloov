export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'en_route'
  | 'in_progress'
  | 'completed'
  | 'canceled';

export type CompanyStatus = 'active' | 'paused' | 'deleted' | 'suspended' | 'trial' | 'pending_pagamento' | 'pending';

export type WhatsAppStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type WhatsAppProvider = 'evolution' | 'zapi' | 'zpro' | 'meta_cloud' | 'custom_webhook' | 'veloov';

export type AppRole = 'passenger' | 'tenant_admin' | 'superadmin';

export type IntegrationMode = 'manual' | 'machine' | 'webhook';

export interface Company {
  id: string;
  slug: string;
  name: string;
  status: CompanyStatus;
  brand_color: string;
  plan_id: string | null;
  expires_at: string | null;
  custom_discount: number | null;
  cnpj: string | null;
  responsible_name: string | null;
  responsible_phone: string | null;
  responsible_email: string | null;
  asaas_customer_id: string | null;
  asaas_payment_id: string | null;
  asaas_checkout_url: string | null;
  suspend_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyAdmin {
  id: string;
  user_id: string;
  company_id: string;
  role: string;
  created_at: string;
}

export interface CompanySettings {
  id: string;
  company_id: string;
  base_fee: number;
  per_km_rate: number;
  per_min_rate: number;
  min_fee: number;
  surge_multiplier: number;
  category_label: string;
  category_description: string;
  eta_minutes: number;
  integration_mode: IntegrationMode;
  simulation_mode: boolean;
  require_price_before_dispatch: boolean;
  updated_at: string;
}

export interface CompanyLocation {
  id: string;
  company_id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  is_active: boolean;
  sort_order: number;
  device_fingerprint: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleCategory {
  id: string;
  company_id: string;
  location_id: string | null;
  label: string;
  description: string;
  base_fee: number;
  per_km_rate: number;
  per_min_rate: number;
  min_fee: number;
  eta_minutes: number;
  sort_order: number;
  is_active: boolean;
  machine_category_id: string | null;
  machine_category_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  company_id: string;
  name: string;
  phone: string;
  vehicle_plate: string | null;
  vehicle_model: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyCredentials {
  id: string;
  company_id: string;
  machine_api_url: string;
  machine_api_key: string | null;
  taximetro_username: string | null;
  taximetro_password: string | null;
  webhook_url: string | null;
  webhook_headers: Record<string, string> | null;
  webhook_payload_template: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  updated_at: string;
}

export interface Ride {
  id: string;
  company_id: string;
  location_id: string | null;
  passenger_name: string;
  passenger_phone: string;
  origin_label: string;
  origin_lat: number;
  origin_lng: number;
  destination_label: string;
  destination_lat: number;
  destination_lng: number;
  distance_km: number;
  duration_min: number;
  category_label: string;
  estimated_price: number;
  status: OrderStatus;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_plate: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  machine_order_id: string | null;
  final_price: number | null;
  webhook_events: WebhookEvent[];
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface WhatsAppInstance {
  id: string;
  company_id: string;
  evolution_api_url: string | null;
  evolution_global_token: string | null;
  instance_name: string | null;
  connection_status: WhatsAppStatus;
  qr_code: string | null;
  last_connected_at: string | null;
  whatsapp_provider: WhatsAppProvider;
  provider_token: string | null;
  provider_phone_id: string | null;
  provider_waba_id: string | null;
  provider_api_url: string | null;
  updated_at: string;
}

export interface AdminLog {
  id: string;
  company_id: string;
  source: string;
  level: string;
  message: string;
  payload: Record<string, unknown> | null;
  ride_id: string | null;
  created_at: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  billing_period: string;
  totem_limit: number;
  price: number;
  base_monthly_price: number;
  quarterly_price: number;
  semiannual_price: number;
  annual_price: number;
  quarterly_discount_percent: number;
  semiannual_discount_percent: number;
  annual_discount_percent: number;
  message_tier: string;
  is_active: boolean;
  sort_order: number;
  bot_incluso: boolean;
  limite_conexoes_bot: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryPricing {
  id: string;
  label: string;
  description: string;
  base_price: number;
  final_price: number;
  eta_minutes: number;
  sort_order: number;
  machine_category_id?: string;
}

export interface Invoice {
  id: string;
  company_id: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  due_date: string | null;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  payment_method: string | null;
  gateway_invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface InternalUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'admin' | 'support' | 'finance';
  is_active: boolean;
  phone: string | null;
  company_name: string | null;
  cnpj: string | null;
  avatar_url: string | null;
  two_factor_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  company_id: string;
  subject: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketReply {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_name: string;
  author_role: string;
  message: string;
  created_at: string;
}

export interface Passenger {
  id: string;
  company_id: string;
  name: string;
  phone: string;
  is_blocked: boolean;
  block_reason: string | null;
  total_rides: number;
  created_at: string;
  updated_at: string;
}

export type NotificationType = 'new_pending_company' | 'totem_offline' | 'invoice_overdue' | 'company_created' | 'general';

export interface SuperadminNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  related_id: string | null;
  created_at: string;
}

export interface WhatsAppChat {
  id: string;
  company_id: string;
  phone: string;
  contact_name: string | null;
  last_message_preview: string | null;
  last_message_at: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  chat_id: string;
  company_id: string;
  direction: 'incoming' | 'outgoing';
  phone: string;
  body: string | null;
  message_type: string;
  raw_payload: Record<string, unknown> | null;
  sent_at: string;
  created_at: string;
}

export interface BotWhatsappConexao {
  id: string;
  company_id: string;
  instance_name: string;
  phone_number: string | null;
  connection_status: string;
  qr_code: string | null;
  evolution_api_url: string | null;
  evolution_global_token: string | null;
  bot_custom_messages: Record<string, string> | null;
  bot_category_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface RideMessage {
  id: string;
  ride_id: string;
  company_id: string;
  sender: 'motorista' | 'passageiro';
  content: string;
  status: 'enviada' | 'entregue' | 'lida';
  whatsapp_delivered: boolean;
  created_at: string;
}
