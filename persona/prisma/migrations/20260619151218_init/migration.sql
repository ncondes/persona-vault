CREATE TYPE "name_variant_kind" AS ENUM ('legal', 'preferred', 'professional', 'public');

CREATE TYPE "profile_field_key" AS ENUM ('email', 'phone', 'address', 'dob');

CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "name_variant" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "name_variant_kind" NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "name_variant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_field" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" "profile_field_key" NOT NULL,
    "value" TEXT NOT NULL,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_field_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "allowed_scopes" TEXT[],
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
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_entry" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "scopes_released" TEXT[],
    "fields_released" TEXT[],

    CONSTRAINT "audit_entry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

CREATE UNIQUE INDEX "name_variant_user_id_kind_key" ON "name_variant"("user_id", "kind");

CREATE UNIQUE INDEX "profile_field_user_id_key_key" ON "profile_field"("user_id", "key");

CREATE UNIQUE INDEX "consent_user_id_client_id_key" ON "consent"("user_id", "client_id");

ALTER TABLE "name_variant" ADD CONSTRAINT "name_variant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "profile_field" ADD CONSTRAINT "profile_field_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "consent" ADD CONSTRAINT "consent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "consent" ADD CONSTRAINT "consent_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_entry" ADD CONSTRAINT "audit_entry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_entry" ADD CONSTRAINT "audit_entry_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
