-- Users and roles.
--
-- Four roles. `student` and `staff` register themselves; `legal_expert` is only ever created
-- through an admin invite; `admin` is seeded. The CHECK keeps a typo from
-- inventing a fifth role.
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student','staff','legal_expert','admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
