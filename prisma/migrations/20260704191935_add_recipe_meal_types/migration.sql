-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "mealTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];
