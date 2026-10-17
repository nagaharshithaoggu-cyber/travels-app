-- CreateTable
CREATE TABLE "Airport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India'
);

-- CreateTable
CREATE TABLE "TrainSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offerId" TEXT NOT NULL,
    "trainName" TEXT NOT NULL,
    "trainNumber" TEXT NOT NULL,
    "originStationCode" TEXT NOT NULL,
    "destinationStationCode" TEXT NOT NULL,
    "runningDays" TEXT NOT NULL,
    CONSTRAINT "TrainSchedule_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "TransportOffer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainStop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainId" TEXT NOT NULL,
    "stationCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "arriveAt" DATETIME,
    "departAt" DATETIME,
    CONSTRAINT "TrainStop_trainId_fkey" FOREIGN KEY ("trainId") REFERENCES "TrainSchedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainStop_stationCode_fkey" FOREIGN KEY ("stationCode") REFERENCES "Station" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offerId" TEXT NOT NULL,
    "busName" TEXT NOT NULL,
    "busType" TEXT NOT NULL,
    "airConditioned" BOOLEAN NOT NULL DEFAULT true,
    "boardingPoint" TEXT NOT NULL,
    "droppingPoint" TEXT NOT NULL,
    "cancellationPolicy" TEXT NOT NULL,
    "seatLayout" TEXT NOT NULL,
    CONSTRAINT "BusSchedule_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "TransportOffer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusSeat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "busId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "seatType" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "BusSeat_busId_fkey" FOREIGN KEY ("busId") REFERENCES "BusSchedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FlightSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offerId" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "originAirportCode" TEXT NOT NULL,
    "destinationAirportCode" TEXT NOT NULL,
    "baggageAllowance" TEXT NOT NULL,
    "baseFareMinor" INTEGER NOT NULL,
    "taxesMinor" INTEGER NOT NULL,
    "refundInfo" TEXT NOT NULL,
    CONSTRAINT "FlightSchedule_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "TransportOffer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FlightSchedule_originAirportCode_fkey" FOREIGN KEY ("originAirportCode") REFERENCES "Airport" ("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FlightSchedule_destinationAirportCode_fkey" FOREIGN KEY ("destinationAirportCode") REFERENCES "Airport" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "passwordHash", "phone", "role", "updatedAt") SELECT "createdAt", "email", "id", "name", "passwordHash", "phone", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Airport_code_key" ON "Airport"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TrainSchedule_offerId_key" ON "TrainSchedule"("offerId");

-- CreateIndex
CREATE INDEX "TrainSchedule_trainNumber_originStationCode_destinationStationCode_idx" ON "TrainSchedule"("trainNumber", "originStationCode", "destinationStationCode");

-- CreateIndex
CREATE UNIQUE INDEX "TrainStop_trainId_sequence_key" ON "TrainStop"("trainId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "BusSchedule_offerId_key" ON "BusSchedule"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "BusSeat_busId_code_key" ON "BusSeat"("busId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "FlightSchedule_offerId_key" ON "FlightSchedule"("offerId");

-- CreateIndex
CREATE INDEX "FlightSchedule_flightNumber_originAirportCode_destinationAirportCode_idx" ON "FlightSchedule"("flightNumber", "originAirportCode", "destinationAirportCode");
