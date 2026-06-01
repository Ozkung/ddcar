-- Align SQL column default with Prisma schema @default("PENDING")
ALTER TABLE "ShopPartner" ALTER COLUMN "status" SET DEFAULT 'PENDING';
