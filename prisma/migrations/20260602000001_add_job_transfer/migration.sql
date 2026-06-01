CREATE TYPE "JobTransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

CREATE TABLE "JobTransfer" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromShopId" TEXT NOT NULL,
    "toShopId" TEXT NOT NULL,
    "status" "JobTransferStatus" NOT NULL DEFAULT 'PENDING',
    "previousJobStatus" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobTransfer_jobId_key" ON "JobTransfer"("jobId");
CREATE INDEX "JobTransfer_fromShopId_idx" ON "JobTransfer"("fromShopId");
CREATE INDEX "JobTransfer_toShopId_idx" ON "JobTransfer"("toShopId");

ALTER TABLE "JobTransfer"
    ADD CONSTRAINT "JobTransfer_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobTransfer"
    ADD CONSTRAINT "JobTransfer_fromShopId_fkey"
    FOREIGN KEY ("fromShopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JobTransfer"
    ADD CONSTRAINT "JobTransfer_toShopId_fkey"
    FOREIGN KEY ("toShopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
