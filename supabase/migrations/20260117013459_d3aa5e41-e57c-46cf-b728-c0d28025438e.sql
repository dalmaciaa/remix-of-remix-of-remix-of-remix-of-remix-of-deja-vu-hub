-- Agregar nuevo rol 'cajero' al enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cajero';

-- Crear tabla de sesiones de caja
CREATE TABLE public.cash_register_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  opened_by UUID REFERENCES public.staff(id),
  closed_by UUID REFERENCES public.staff(id),
  initial_cash NUMERIC NOT NULL DEFAULT 0,
  is_event BOOLEAN NOT NULL DEFAULT false,
  ticket_price NUMERIC DEFAULT 0,
  ticket_quantity INTEGER DEFAULT 0,
  tickets_sold INTEGER DEFAULT 0,
  final_cash NUMERIC,
  expected_cash NUMERIC,
  expected_transfer NUMERIC,
  expected_qr NUMERIC,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
);

-- Habilitar RLS en cash_register_sessions
ALTER TABLE public.cash_register_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to cash_register_sessions" 
ON public.cash_register_sessions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Crear tabla para gastos pequeños de caja (durante la jornada)
CREATE TABLE public.cash_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.cash_register_sessions(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.staff(id)
);

-- Habilitar RLS en cash_expenses
ALTER TABLE public.cash_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to cash_expenses" 
ON public.cash_expenses 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Agregar realtime para las tablas de caja
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_register_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_expenses;