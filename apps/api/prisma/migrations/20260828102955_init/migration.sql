-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('FREE', 'PREMIUM', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SkinType" AS ENUM ('DRY', 'OILY', 'COMBINATION', 'NORMAL', 'SENSITIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SensitivityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FragrancePreference" AS ENUM ('NO_PREFERENCE', 'PREFER_FRAGRANCE_FREE', 'REQUIRE_FRAGRANCE_FREE');

-- CreateEnum
CREATE TYPE "BudgetTier" AS ENUM ('UNDER_30', 'UNDER_50', 'UNDER_100', 'UNDER_200', 'NO_LIMIT');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "RoutineStep" AS ENUM ('CLEANSER', 'TONER', 'EXFOLIANT', 'SERUM', 'EYE', 'MOISTURIZER', 'SPF', 'MASK', 'TREATMENT', 'BODY', 'HAIR', 'MAKEUP', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beauty_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skinType" "SkinType" NOT NULL DEFAULT 'UNKNOWN',
    "sensitivity" "SensitivityLevel" NOT NULL DEFAULT 'UNKNOWN',
    "budget" "BudgetTier" NOT NULL DEFAULT 'NO_LIMIT',
    "fragrancePreference" "FragrancePreference" NOT NULL DEFAULT 'NO_PREFERENCE',
    "veganPreference" BOOLEAN NOT NULL DEFAULT false,
    "crueltyFreePreference" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beauty_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beauty_concerns" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "beauty_concerns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beauty_goals" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "beauty_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "description" TEXT,
    "isVegan" BOOLEAN NOT NULL DEFAULT false,
    "isCrueltyFree" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "routineStep" "RoutineStep" NOT NULL DEFAULT 'OTHER',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "ean" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT,
    "usage" TEXT,
    "imageUrl" TEXT,
    "volume" DOUBLE PRECISION,
    "volumeUnit" TEXT DEFAULT 'ml',
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isFragranceFree" BOOLEAN NOT NULL DEFAULT false,
    "isVegan" BOOLEAN NOT NULL DEFAULT false,
    "isCrueltyFree" BOOLEAN NOT NULL DEFAULT false,
    "targetSkinTypes" "SkinType"[] DEFAULT ARRAY[]::"SkinType"[],
    "ingredientScore" INTEGER NOT NULL DEFAULT 50,
    "lowestPrice" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "inciName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "commonName" TEXT,
    "description" TEXT,
    "functions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "concerns" TEXT,
    "comedogenicRating" INTEGER,
    "sensitivityImpact" INTEGER NOT NULL DEFAULT 0,
    "goodForSkinTypes" "SkinType"[] DEFAULT ARRAY[]::"SkinType"[],
    "isActiveIngredient" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_ingredients" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "concentrationRange" TEXT,

    CONSTRAINT "product_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "websiteUrl" TEXT,
    "affiliateUrlTemplate" TEXT,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_offers" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "url" TEXT,
    "availability" "Availability" NOT NULL DEFAULT 'IN_STOCK',
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_shelf_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "user_shelf_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "targetPrice" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_comparisons" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "productIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "suggestions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProfilePreferredBrands" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProfilePreferredBrands_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ProfileExcludedBrands" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProfileExcludedBrands_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ProfileExcludedIngredients" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProfileExcludedIngredients_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ProfileConcerns" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProfileConcerns_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_IngredientTargetsConcerns" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_IngredientTargetsConcerns_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ProfileGoals" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProfileGoals_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_IngredientSupportsGoals" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_IngredientSupportsGoals_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "beauty_profiles_userId_key" ON "beauty_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "beauty_concerns_slug_key" ON "beauty_concerns"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "beauty_goals_slug_key" ON "beauty_goals"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "brands_name_idx" ON "brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE INDEX "categories_routineStep_idx" ON "categories"("routineStep");

-- CreateIndex
CREATE UNIQUE INDEX "products_ean_key" ON "products"("ean");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_brandId_idx" ON "products"("brandId");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "products_lowestPrice_idx" ON "products"("lowestPrice");

-- CreateIndex
CREATE INDEX "products_ingredientScore_idx" ON "products"("ingredientScore");

-- CreateIndex
CREATE INDEX "products_isActive_categoryId_idx" ON "products"("isActive", "categoryId");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_inciName_key" ON "ingredients"("inciName");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_slug_key" ON "ingredients"("slug");

-- CreateIndex
CREATE INDEX "ingredients_inciName_idx" ON "ingredients"("inciName");

-- CreateIndex
CREATE INDEX "product_ingredients_ingredientId_idx" ON "product_ingredients"("ingredientId");

-- CreateIndex
CREATE INDEX "product_ingredients_productId_position_idx" ON "product_ingredients"("productId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "product_ingredients_productId_ingredientId_key" ON "product_ingredients"("productId", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

-- CreateIndex
CREATE INDEX "product_offers_productId_price_idx" ON "product_offers"("productId", "price");

-- CreateIndex
CREATE INDEX "product_offers_storeId_idx" ON "product_offers"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "product_offers_productId_storeId_key" ON "product_offers"("productId", "storeId");

-- CreateIndex
CREATE INDEX "price_history_productId_recordedAt_idx" ON "price_history"("productId", "recordedAt");

-- CreateIndex
CREATE INDEX "user_shelf_items_userId_addedAt_idx" ON "user_shelf_items"("userId", "addedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_shelf_items_userId_productId_key" ON "user_shelf_items"("userId", "productId");

-- CreateIndex
CREATE INDEX "price_alerts_userId_active_idx" ON "price_alerts"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "price_alerts_userId_productId_key" ON "price_alerts"("userId", "productId");

-- CreateIndex
CREATE INDEX "product_comparisons_userId_createdAt_idx" ON "product_comparisons"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_updatedAt_idx" ON "ai_conversations"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "_ProfilePreferredBrands_B_index" ON "_ProfilePreferredBrands"("B");

-- CreateIndex
CREATE INDEX "_ProfileExcludedBrands_B_index" ON "_ProfileExcludedBrands"("B");

-- CreateIndex
CREATE INDEX "_ProfileExcludedIngredients_B_index" ON "_ProfileExcludedIngredients"("B");

-- CreateIndex
CREATE INDEX "_ProfileConcerns_B_index" ON "_ProfileConcerns"("B");

-- CreateIndex
CREATE INDEX "_IngredientTargetsConcerns_B_index" ON "_IngredientTargetsConcerns"("B");

-- CreateIndex
CREATE INDEX "_ProfileGoals_B_index" ON "_ProfileGoals"("B");

-- CreateIndex
CREATE INDEX "_IngredientSupportsGoals_B_index" ON "_IngredientSupportsGoals"("B");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beauty_profiles" ADD CONSTRAINT "beauty_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_shelf_items" ADD CONSTRAINT "user_shelf_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_shelf_items" ADD CONSTRAINT "user_shelf_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_comparisons" ADD CONSTRAINT "product_comparisons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfilePreferredBrands" ADD CONSTRAINT "_ProfilePreferredBrands_A_fkey" FOREIGN KEY ("A") REFERENCES "beauty_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfilePreferredBrands" ADD CONSTRAINT "_ProfilePreferredBrands_B_fkey" FOREIGN KEY ("B") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfileExcludedBrands" ADD CONSTRAINT "_ProfileExcludedBrands_A_fkey" FOREIGN KEY ("A") REFERENCES "beauty_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfileExcludedBrands" ADD CONSTRAINT "_ProfileExcludedBrands_B_fkey" FOREIGN KEY ("B") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfileExcludedIngredients" ADD CONSTRAINT "_ProfileExcludedIngredients_A_fkey" FOREIGN KEY ("A") REFERENCES "beauty_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfileExcludedIngredients" ADD CONSTRAINT "_ProfileExcludedIngredients_B_fkey" FOREIGN KEY ("B") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfileConcerns" ADD CONSTRAINT "_ProfileConcerns_A_fkey" FOREIGN KEY ("A") REFERENCES "beauty_concerns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfileConcerns" ADD CONSTRAINT "_ProfileConcerns_B_fkey" FOREIGN KEY ("B") REFERENCES "beauty_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IngredientTargetsConcerns" ADD CONSTRAINT "_IngredientTargetsConcerns_A_fkey" FOREIGN KEY ("A") REFERENCES "beauty_concerns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IngredientTargetsConcerns" ADD CONSTRAINT "_IngredientTargetsConcerns_B_fkey" FOREIGN KEY ("B") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfileGoals" ADD CONSTRAINT "_ProfileGoals_A_fkey" FOREIGN KEY ("A") REFERENCES "beauty_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfileGoals" ADD CONSTRAINT "_ProfileGoals_B_fkey" FOREIGN KEY ("B") REFERENCES "beauty_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IngredientSupportsGoals" ADD CONSTRAINT "_IngredientSupportsGoals_A_fkey" FOREIGN KEY ("A") REFERENCES "beauty_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IngredientSupportsGoals" ADD CONSTRAINT "_IngredientSupportsGoals_B_fkey" FOREIGN KEY ("B") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
