CREATE TYPE "vault_kind" AS ENUM ('name', 'username', 'avatar', 'birth_date', 'document', 'email', 'phone', 'address', 'blood_type', 'eps', 'allergy');

CREATE TYPE "name_context" AS ENUM ('legal', 'preferred', 'professional', 'public');

CREATE TYPE "audit_type" AS ENUM ('grant', 'release', 'revoke');

CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "confirm_sensitive" BOOLEAN NOT NULL DEFAULT true,
    "notify_access" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vault_item" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "vault_kind" NOT NULL,
    "label" TEXT,
    "value" TEXT NOT NULL,
    "detail" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "name_context" "name_context",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "allowed_scopes" TEXT[],
    "required_scopes" TEXT[],
    "redirect_uris" TEXT[],
    "secret_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consent" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "scopes" TEXT[],
    "selections" JSONB NOT NULL,
    "grant_id" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_entry" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" "audit_type" NOT NULL DEFAULT 'release',
    "context" TEXT NOT NULL,
    "scopes_released" TEXT[],
    "fields_released" TEXT[],

    CONSTRAINT "audit_entry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

CREATE INDEX "vault_item_user_id_kind_idx" ON "vault_item"("user_id", "kind");

CREATE UNIQUE INDEX "consent_user_id_client_id_key" ON "consent"("user_id", "client_id");

ALTER TABLE "vault_item" ADD CONSTRAINT "vault_item_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "consent" ADD CONSTRAINT "consent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "consent" ADD CONSTRAINT "consent_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_entry" ADD CONSTRAINT "audit_entry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_entry" ADD CONSTRAINT "audit_entry_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
