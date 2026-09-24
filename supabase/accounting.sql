-- Clever Toys: accounting (cost prices and expenses) for Admin → Accounting.
-- Run once in Supabase SQL Editor. Safe to re-run. Only adds columns and a table; nothing is changed or removed.

-- What each product (or variant) costs you, used to calculate cost of goods sold and profit.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price numeric(10,2) CHECK (cost_price IS NULL OR cost_price >= 0);
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS cost_price numeric(10,2) CHECK (cost_price IS NULL OR cost_price >= 0);

-- Business expenses (stock purchases, delivery, marketing, rent…).
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spent_on date NOT NULL DEFAULT current_date,
  category text NOT NULL DEFAULT 'Other',
  description text NOT NULL DEFAULT '',
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  payment_method text NOT NULL DEFAULT 'Cash',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_spent_on_idx ON public.expenses(spent_on DESC);

-- Only administrators can see or change expenses.
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage expenses" ON public.expenses;
CREATE POLICY "Admins can manage expenses" ON public.expenses FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE ALL ON public.expenses FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;

NOTIFY pgrst, 'reload schema';
