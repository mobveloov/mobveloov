INSERT INTO public.subscription_plans (
  name, billing_period, totem_limit, price, is_active, sort_order,
  base_monthly_price, quarterly_price, annual_price,
  quarterly_discount_percent, annual_discount_percent, semiannual_discount_percent
) VALUES (
  'Plano Diamante', 'monthly', 999999, 990.00, true, 5,
  990.00, 0, 0,
  0, 0, 0
)
ON CONFLICT DO NOTHING;
