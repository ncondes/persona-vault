-- CreateEnum
CREATE TYPE "key_state" AS ENUM ('incoming', 'active', 'retiring');

-- CreateTable
CREATE TABLE "signing_key" (
    "kid" TEXT NOT NULL,
    "alg" TEXT NOT NULL DEFAULT 'RS256',
    "public_jwk" JSONB NOT NULL,
    "private_encrypted" TEXT NOT NULL,
    "state" "key_state" NOT NULL DEFAULT 'incoming',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMP(3),
    "retires_at" TIMESTAMP(3),

    CONSTRAINT "signing_key_pkey" PRIMARY KEY ("kid")
);

-- CreateIndex
CREATE INDEX "signing_key_state_idx" ON "signing_key"("state");
