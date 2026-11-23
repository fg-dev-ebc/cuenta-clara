CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  alias text NOT NULL CHECK (char_length(alias) BETWEEN 2 AND 50),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE administrators (
  user_id uuid PRIMARY KEY REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES establishments(id),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  zone text NOT NULL,
  address text NOT NULL,
  place_id text UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  search_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, name, zone, address)
);

CREATE INDEX branches_establishment_idx ON branches (establishment_id);
CREATE INDEX branches_search_idx ON branches USING gin (search_text gin_trgm_ops) WHERE status = 'active';
CREATE INDEX branches_zone_idx ON branches (zone) WHERE status = 'active';

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  form_kind text NOT NULL DEFAULT 'general' CHECK (form_kind IN ('general', 'price', 'buffet', 'tip', 'parking', 'charge')),
  position integer NOT NULL DEFAULT 100 CHECK (position >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO categories (slug, name, form_kind, position) VALUES
  ('precios', 'Precios', 'price', 10),
  ('buffet', 'Buffet', 'buffet', 20),
  ('promociones', 'Promociones', 'price', 30),
  ('consumo-minimo', 'Consumo mínimo', 'charge', 40),
  ('cover', 'Cover', 'charge', 50),
  ('propinas', 'Propinas', 'tip', 60),
  ('cargos-adicionales', 'Cargos adicionales', 'charge', 70),
  ('servicio', 'Servicio', 'general', 80),
  ('estacionamiento', 'Estacionamiento', 'parking', 90),
  ('entorno', 'Entorno', 'general', 100),
  ('otros', 'Otros', 'general', 110);

CREATE TABLE establishment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES profiles(id),
  establishment_id uuid REFERENCES establishments(id),
  proposed_name text NOT NULL,
  branch_name text NOT NULL,
  zone text NOT NULL,
  address text NOT NULL,
  place_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'linked')),
  resolved_branch_id uuid REFERENCES branches(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK ((status IN ('approved', 'linked')) = (resolved_branch_id IS NOT NULL)),
  CHECK ((status = 'pending') = (resolved_at IS NULL))
);

CREATE INDEX requests_status_idx ON establishment_requests (status, created_at DESC);
CREATE INDEX requests_author_idx ON establishment_requests (author_id, created_at DESC);

CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id),
  request_id uuid UNIQUE REFERENCES establishment_requests(id),
  author_id uuid NOT NULL REFERENCES profiles(id),
  category_id uuid NOT NULL REFERENCES categories(id),
  title text NOT NULL CHECK (char_length(title) BETWEEN 4 AND 100),
  description text NOT NULL CHECK (char_length(description) BETWEEN 15 AND 3000),
  visited_on date NOT NULL,
  amount numeric(12, 2) CHECK (amount >= 0),
  currency char(3),
  details jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object'),
  status text NOT NULL CHECK (status IN ('pending', 'published', 'hidden', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CHECK ((amount IS NULL) = (currency IS NULL)),
  CHECK (branch_id IS NOT NULL OR request_id IS NOT NULL),
  CHECK (status <> 'published' OR (branch_id IS NOT NULL AND published_at IS NOT NULL))
);

CREATE INDEX reviews_public_idx ON reviews (branch_id, published_at DESC, id) WHERE status = 'published';
CREATE INDEX reviews_category_idx ON reviews (branch_id, category_id, visited_on DESC) WHERE status = 'published';
CREATE INDEX reviews_author_idx ON reviews (author_id, created_at DESC);

CREATE TABLE uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);
CREATE INDEX uploads_pending_idx ON uploads (created_at) WHERE consumed_at IS NULL;

CREATE TABLE review_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id),
  object_key text NOT NULL UNIQUE,
  media_type text NOT NULL CHECK (media_type = 'image/webp'),
  byte_size integer NOT NULL CHECK (byte_size > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_images_review_idx ON review_images (review_id);

CREATE TABLE correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id),
  author_id uuid NOT NULL REFERENCES profiles(id),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE UNIQUE INDEX one_pending_correction ON correction_requests (review_id, author_id) WHERE status = 'pending';
CREATE INDEX corrections_status_idx ON correction_requests (status, created_at DESC);

CREATE TABLE review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id),
  author_id uuid NOT NULL REFERENCES profiles(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE UNIQUE INDEX one_pending_report ON review_reports (review_id, author_id) WHERE status = 'pending';
CREATE INDEX reports_status_idx ON review_reports (status, created_at DESC);

CREATE TABLE establishment_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id),
  visitor_id uuid NOT NULL,
  view_day date NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (branch_id, visitor_id, view_day)
);
CREATE INDEX views_day_idx ON establishment_views (view_day, branch_id);

CREATE TABLE moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES administrators(user_id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX moderation_recent_idx ON moderation_logs (created_at DESC);

CREATE TABLE places_rate_limits (
  user_id uuid NOT NULL REFERENCES profiles(id),
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, window_start)
);

CREATE TABLE live_revisions (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1
);
INSERT INTO live_revisions (id) VALUES ('directory'), ('admin');
