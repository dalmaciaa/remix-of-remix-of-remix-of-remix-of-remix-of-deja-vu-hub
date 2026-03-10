
-- Table for ticket events (noches/eventos de entradas)
CREATE TABLE public.ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  event_date timestamp with time zone NOT NULL,
  valid_from timestamp with time zone NOT NULL,
  valid_until timestamp with time zone NOT NULL,
  venue text,
  default_price numeric NOT NULL DEFAULT 0,
  max_capacity integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to ticket_events" ON public.ticket_events
  FOR ALL USING (true) WITH CHECK (true);

-- Table for individual tickets
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_event_id uuid NOT NULL REFERENCES public.ticket_events(id) ON DELETE CASCADE,
  ticket_code text NOT NULL UNIQUE,
  holder_name text NOT NULL,
  holder_dni text,
  holder_email text,
  holder_phone text,
  price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'used', 'expired', 'cancelled')),
  used_at timestamp with time zone,
  used_by uuid REFERENCES public.staff(id),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to tickets" ON public.tickets
  FOR ALL USING (true) WITH CHECK (true);
