-- CreateTable
CREATE TABLE "ShopPartner" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopPartner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopPartner_shopId_idx" ON "ShopPartner"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopPartner_shopId_partnerId_key" ON "ShopPartner"("shopId", "partnerId");

-- AddForeignKey
ALTER TABLE "ShopPartner" ADD CONSTRAINT "ShopPartner_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPartner" ADD CONSTRAINT "ShopPartner_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
