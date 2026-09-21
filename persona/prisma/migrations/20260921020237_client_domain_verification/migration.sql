-- AlterTable
ALTER TABLE "client" ADD COLUMN     "verification_issued_at" TIMESTAMP(3),
ADD COLUMN     "verification_token" TEXT,
ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_domain" TEXT;
