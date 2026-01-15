-- Add fields for package/unit separation in products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS units_per_package numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS package_count numeric DEFAULT 0;