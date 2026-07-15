export type PropertyShare = {
  id: string;
  user_id: string;
  property_id: string;
  property_label: string;
  share_token: string;
  label: string;
  expires_at: string | null;
  is_active: boolean;
  views_count: number;
  include_personal_info: boolean;
  snapshot_json?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ContractorPortalAccess = {
  id: string;
  user_id: string;
  property_id: string;
  property_label: string;
  contractor_name: string;
  contractor_email: string;
  contractor_phone: string | null;
  trade: string;
  access_code: string;
  permissions: string[];
  notes: string | null;
  is_active: boolean;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MaintenanceForecastItem = {
  title: string;
  category: string;
  dueWindow: string;
  priority: "low" | "medium" | "high";
  estimatedCost: string;
  reason: string;
};

export type MaintenanceForecast = {
  id: string;
  user_id: string;
  property_id: string;
  summary: string;
  items: MaintenanceForecastItem[];
  annual_budget: string;
  generated_at: string;
};

export type StripeCustomerRecord = {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_key: string;
  status: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};
