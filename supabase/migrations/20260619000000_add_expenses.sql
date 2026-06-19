-- Enum for expense categories
CREATE TYPE public.expense_category AS ENUM (
  'salaires',
  'achat_robes',
  'charges',
  'autre'
);

-- Expenses table
CREATE TABLE public.expenses (
  id             UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE              NOT NULL,
  amount         NUMERIC(10, 2)    NOT NULL CHECK (amount > 0),
  category       expense_category  NOT NULL,
  dress_category TEXT              NULL,       -- populated only when category = 'achat_robes'
  description    TEXT,
  created_by     UUID              REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX expenses_date_idx     ON public.expenses (date);
CREATE INDEX expenses_category_idx ON public.expenses (category);

-- RLS: full access for authenticated users (internal tool)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_authenticated_all" ON public.expenses
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at (reuses existing trigger function)
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
