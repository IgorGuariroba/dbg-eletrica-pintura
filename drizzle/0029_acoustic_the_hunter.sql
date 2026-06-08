ALTER TABLE "plano" ADD COLUMN "slug" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "plano_slug_uq" ON "plano" USING btree ("slug");