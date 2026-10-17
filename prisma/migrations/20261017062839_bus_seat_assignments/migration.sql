-- CreateTable
CREATE TABLE "BookingSeat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "busSeatId" TEXT NOT NULL,
    CONSTRAINT "BookingSeat_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookingSeat_busSeatId_fkey" FOREIGN KEY ("busSeatId") REFERENCES "BusSeat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingSeat_busSeatId_key" ON "BookingSeat"("busSeatId");
