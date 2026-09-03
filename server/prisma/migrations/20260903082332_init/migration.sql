/*
  Warnings:

  - You are about to drop the column `baseValuation` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `contractSeasonsRemaining` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `listedForSale` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the `TokenBalance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TransferWindow` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TokenBalance" DROP CONSTRAINT "TokenBalance_clubId_fkey";

-- DropForeignKey
ALTER TABLE "TransferWindow" DROP CONSTRAINT "TransferWindow_seasonId_fkey";

-- AlterTable
ALTER TABLE "Player" DROP COLUMN "baseValuation",
DROP COLUMN "contractSeasonsRemaining",
DROP COLUMN "listedForSale";

-- DropTable
DROP TABLE "TokenBalance";

-- DropTable
DROP TABLE "TransferWindow";
