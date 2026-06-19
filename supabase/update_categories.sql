-- Migration script to update CrowdCity categories from 6 to 12.
-- This script:
-- 1. Drops the existing check constraint on the issues table category.
-- 2. Maps the existing categories to the new professional categories.
-- 3. Adds the updated check constraint with the 12 categories.

-- 1. Drop existing category check constraint
ALTER TABLE public.issues DROP CONSTRAINT IF EXISTS issues_category_check;

-- 2. Map existing category data to the new category values
UPDATE public.issues
SET category = CASE 
  WHEN category IN ('pothole', 'road', 'road damage', 'road_damage') THEN 'roads'
  WHEN category IN ('streetlight', 'light out', 'light_out') THEN 'streetlights'
  WHEN category IN ('leakage', 'water leak', 'water_leak') THEN 'water_supply'
  WHEN category = 'garbage' THEN 'garbage'
  WHEN category = 'drainage' THEN 'drainage'
  ELSE category
END;

-- In case there are any categories that aren't matched, verify/convert them to 'other' or preserve if valid
UPDATE public.issues
SET category = 'other'
WHERE category NOT IN ('roads', 'streetlights', 'water_supply', 'drainage', 'garbage', 'traffic', 'public_property', 'parks', 'sanitation', 'safety_hazard', 'environment', 'other');

-- 3. Add the updated check constraint
ALTER TABLE public.issues
ADD CONSTRAINT issues_category_check CHECK (category IN (
  'roads',
  'streetlights',
  'water_supply',
  'drainage',
  'garbage',
  'traffic',
  'public_property',
  'parks',
  'sanitation',
  'safety_hazard',
  'environment',
  'other'
));
