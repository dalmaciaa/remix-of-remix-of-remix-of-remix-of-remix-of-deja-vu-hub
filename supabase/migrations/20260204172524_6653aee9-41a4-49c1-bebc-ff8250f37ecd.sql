-- Crear tabla para registrar historial de compras de inventario
CREATE TABLE public.inventory_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'unidad',
  purchase_price NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  notes TEXT,
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.inventory_purchases ENABLE ROW LEVEL SECURITY;

-- Política de acceso
CREATE POLICY "Allow all access to inventory_purchases" 
ON public.inventory_purchases 
FOR ALL 
USING (true) 
WITH CHECK (true);