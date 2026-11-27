BEGIN;

ALTER TABLE public.menus
  DROP CONSTRAINT IF EXISTS menus_category_check,
  ALTER COLUMN category TYPE varchar(40),
  ADD CONSTRAINT menus_category_check CHECK (
    char_length(category) BETWEEN 1 AND 40
    AND category = btrim(category)
    AND category !~ '[[:cntrl:]]'
  );

COMMIT;
