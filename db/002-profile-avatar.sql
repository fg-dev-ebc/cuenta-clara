ALTER TABLE profiles
  ADD COLUMN avatar_id uuid UNIQUE,
  ADD COLUMN avatar_key text,
  ADD CONSTRAINT profiles_avatar_pair CHECK ((avatar_id IS NULL) = (avatar_key IS NULL));
