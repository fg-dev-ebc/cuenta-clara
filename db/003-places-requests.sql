ALTER TABLE establishment_requests
  ALTER COLUMN proposed_name DROP NOT NULL,
  ALTER COLUMN branch_name DROP NOT NULL,
  ALTER COLUMN zone DROP NOT NULL,
  ALTER COLUMN address DROP NOT NULL,
  ADD CONSTRAINT establishment_request_has_source CHECK (
    place_id IS NOT NULL OR (
      proposed_name IS NOT NULL AND branch_name IS NOT NULL AND zone IS NOT NULL AND address IS NOT NULL
    )
  );
