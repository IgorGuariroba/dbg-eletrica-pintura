ALTER TABLE "servico" ADD COLUMN "slug" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "servico_slug_uq" ON "servico" USING btree ("slug");