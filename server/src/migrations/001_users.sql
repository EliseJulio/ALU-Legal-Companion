-- Accounts for everyone who signs in.
CREATE TABLE users (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  role              TEXT NOT NULL CHECK (role IN ('student', 'staff', 'legal_expert', 'admin')),
  -- Login is refused until the person proves they own the address.
  email_verified_at TIMESTAMPTZ,
  -- An account is switched off and never deleted. Guides, directory entries and bookings
  -- point at users. A delete would break them, and a published guide must keep naming who checked it.
  deactivated_at    TIMESTAMPTZ,
  -- Adding 1 ends every login the account has. A signed token cannot be taken back,
  -- so each token carries this number and works only while it still matches.
  session_version   INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
