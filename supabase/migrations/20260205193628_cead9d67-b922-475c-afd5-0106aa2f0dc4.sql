-- Add columns for split payment amounts
ALTER TABLE public.sales 
ADD COLUMN cash_amount numeric DEFAULT 0,
ADD COLUMN transfer_amount numeric DEFAULT 0,
ADD COLUMN qr_amount numeric DEFAULT 0;