-- Clients are now registered at runtime through the developer console and owned
-- by a developer, so the seeded rows are cleared to allow the new NOT NULL
-- columns. This cascades their consents and audit entries; the seed recreates
-- the demo clients.
DELETE FROM "client";

CREATE TYPE "client_status" AS ENUM ('active', 'disabled');

ALTER TABLE "client"
  DROP COLUMN "secret_hash",
  ADD COLUMN "owner_id" TEXT NOT NULL,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "accent" TEXT NOT NULL DEFAULT 'teal',
  ADD COLUMN "secret_encrypted" TEXT NOT NULL,
  ADD COLUMN "secret_last_four" TEXT NOT NULL,
  ADD COLUMN "status" "client_status" NOT NULL DEFAULT 'active';

CREATE INDEX "client_owner_id_idx" ON "client"("owner_id");

ALTER TABLE "client" ADD CONSTRAINT "client_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "audit_entry_client_id_at_idx" ON "audit_entry"("client_id", "at");

CREATE TABLE "oidc_payload" (
    "model" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "grant_id" TEXT,
    "user_code" TEXT,
    "uid" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oidc_payload_pkey" PRIMARY KEY ("model", "id")
);

-- NULLs are distinct in Postgres, so these only constrain rows that carry the
-- value. Session.save destroys the old row before writing the new one.
CREATE UNIQUE INDEX "oidc_payload_uid_key" ON "oidc_payload"("uid");
CREATE UNIQUE INDEX "oidc_payload_user_code_key" ON "oidc_payload"("user_code");
CREATE INDEX "oidc_payload_grant_id_idx" ON "oidc_payload"("grant_id");
CREATE INDEX "oidc_payload_expires_at_idx" ON "oidc_payload"("expires_at");
