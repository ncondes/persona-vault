-- Sign-up and sign-in now wait on a code emailed to the address being claimed.
-- A sign-up parks here in full until that code comes back, so the `user` table
-- only ever gains rows for addresses somebody actually reached. Nothing is
-- backfilled: existing accounts were created before this gate and keep working.

CREATE TYPE "otp_purpose" AS ENUM ('signup', 'login');

CREATE TABLE "otp_challenge" (
    "id" TEXT NOT NULL,
    "purpose" "otp_purpose" NOT NULL,
    "email" TEXT NOT NULL,
    -- login only: the account this code opens
    "user_id" TEXT,
    -- signup only: the account that does not exist yet
    "first_name" TEXT,
    "last_name" TEXT,
    "password_hash" TEXT,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sends" INTEGER NOT NULL DEFAULT 1,
    "last_sent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenge_pkey" PRIMARY KEY ("id")
);

-- The first index backs the live-challenge lookup that turns a repeat request
-- into a resend; the second backs the expiry sweep.
CREATE INDEX "otp_challenge_email_purpose_idx" ON "otp_challenge"("email", "purpose");
CREATE INDEX "otp_challenge_expires_at_idx" ON "otp_challenge"("expires_at");

ALTER TABLE "otp_challenge" ADD CONSTRAINT "otp_challenge_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
