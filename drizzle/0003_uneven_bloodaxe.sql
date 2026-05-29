ALTER TABLE "solicitacao" ADD COLUMN "token" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "solicitacao" ADD COLUMN "data_desejada" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "solicitacao" ADD COLUMN "duracao_estimada" varchar(20);--> statement-breakpoint
CREATE UNIQUE INDEX "cliente_whatsapp_uq" ON "cliente" USING btree ("whatsapp");--> statement-breakpoint
CREATE UNIQUE INDEX "solicitacao_token_uq" ON "solicitacao" USING btree ("token");