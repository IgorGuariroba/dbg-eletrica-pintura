ALTER TABLE "membro" ADD COLUMN "slug" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "membro_slug_uq" ON "membro" USING btree ("slug");