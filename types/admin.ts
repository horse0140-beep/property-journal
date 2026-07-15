export type UserRole = "user" | "super_admin" | "support" | "moderator";

export type PlanKey = "free" | "premium" | "landlord" | "realtor";

export type EntitlementKey = "owner_access" | "premium" | "landlord" | "realtor";

export type DiscountType =
  | "percent"
  | "fixed"
  | "free_trial"
  | "lifetime_access"
  | "owner_grant";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type TicketPriority = "low" | "normal" | "high" | "urgent";

export type SubscriptionStatus = "active" | "cancelled" | "past_due" | "trialing" | "expired";

export type BillingCycle = "monthly" | "yearly";

export type UserRoleRecord = {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type UserEntitlement = {
  id: string;
  user_id: string;
  entitlement: EntitlementKey;
  granted_by: string | null;
  created_at: string;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  plan: PlanKey;
  created_at: string;
  role: UserRole | null;
  role_id: string | null;
  entitlements: EntitlementKey[];
  has_owner_access: boolean;
  is_founder?: boolean;
};

export type PromoCode = {
  id: string;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  plan_scope: PlanKey | "all";
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PricingPlan = {
  id: string;
  plan_key: PlanKey;
  name: string;
  monthly_price: number;
  yearly_price: number;
  description: string | null;
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PricingOverview = {
  plan_key: PlanKey;
  name: string;
  monthly_price: number;
  yearly_price: number;
  is_active: boolean;
};

export type SupportTicket = {
  id: string;
  user_id: string | null;
  user_email: string;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Subscription = {
  id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  plan_key: PlanKey;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  amount: number;
  promo_code_id: string | null;
  started_at: string;
  expires_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminStats = {
  totalUsers: number;
  activeSubscriptions: number;
  openTickets: number;
  activePromoCodes: number;
  totalRevenue: number;
  usersByPlan: Record<PlanKey, number>;
};

export type AdminDashboardStats = {
  totalUsers: number;
  freeUsers: number;
  premiumUsers: number;
  landlordUsers: number;
  realtorUsers: number;
  ownerAccessUsers: number;
  activePromoCodes: number;
  totalPromoCodes: number;
  activeSubscriptions: number;
  openTickets: number;
  totalRevenue: number;
  usersByPlan: Record<PlanKey, number>;
  pricingOverview: PricingOverview[];
};

export type PricingPlanInput = {
  plan_key: PlanKey;
  name: string;
  monthly_price: number;
  yearly_price: number;
  description?: string;
  features: string[];
  is_active: boolean;
  sort_order: number;
};

export type PromoCodeInput = {
  code: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  plan_scope: PlanKey | "all";
  max_uses?: number | null;
  is_active: boolean;
  expires_at?: string | null;
};
