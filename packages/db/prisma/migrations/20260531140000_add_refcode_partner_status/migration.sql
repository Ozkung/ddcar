-- Add status to ShopPartner (existing rows default to ACCEPTED since they were created by admin)
ALTER TABLE "ShopPartner" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACCEPTED';

-- Add index on partnerId for incoming-request lookups
CREATE INDEX "ShopPartner_partnerId_idx" ON "ShopPartner"("partnerId");
