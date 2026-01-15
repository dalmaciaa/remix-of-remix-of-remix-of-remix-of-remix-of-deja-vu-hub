-- Add 'semi_elaborated' to product_category enum
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'semi_elaborated';