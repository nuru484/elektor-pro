-- DropIndex
DROP INDEX "Organization_slug_key";

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "accentColor",
DROP COLUMN "locale",
DROP COLUMN "primaryColor",
DROP COLUMN "settings",
DROP COLUMN "slug",
DROP COLUMN "timezone";

