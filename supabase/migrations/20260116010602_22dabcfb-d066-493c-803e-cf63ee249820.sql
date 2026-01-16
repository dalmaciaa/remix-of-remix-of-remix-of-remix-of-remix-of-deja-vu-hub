-- Add bartender orders table for drink orders
CREATE TABLE public.bartender_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff(id),
  staff_name TEXT NOT NULL,
  table_number TEXT,
  notes TEXT,
  status public.kitchen_order_status NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add bartender order items table
CREATE TABLE public.bartender_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bartender_order_id UUID NOT NULL REFERENCES public.bartender_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bartender_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bartender_order_items ENABLE ROW LEVEL SECURITY;

-- Create policies for bartender_orders
CREATE POLICY "Allow all access to bartender_orders" 
ON public.bartender_orders 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create policies for bartender_order_items
CREATE POLICY "Allow all access to bartender_order_items" 
ON public.bartender_order_items 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_bartender_orders_updated_at
BEFORE UPDATE ON public.bartender_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.bartender_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kitchen_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;