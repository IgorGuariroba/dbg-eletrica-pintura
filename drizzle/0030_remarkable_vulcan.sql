ALTER TABLE "assinatura" ADD COLUMN "plano_pendente_id" uuid;--> statement-breakpoint
ALTER TABLE "assinatura" ADD COLUMN "cancelamento_pendente" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assinatura" ADD COLUMN "data_efetivacao" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ordem_servico" ADD COLUMN "assinatura_id" uuid;--> statement-breakpoint
ALTER TABLE "assinatura" ADD CONSTRAINT "assinatura_plano_pendente_id_plano_id_fk" FOREIGN KEY ("plano_pendente_id") REFERENCES "public"."plano"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordem_servico" ADD CONSTRAINT "ordem_servico_assinatura_id_assinatura_id_fk" FOREIGN KEY ("assinatura_id") REFERENCES "public"."assinatura"("id") ON DELETE set null ON UPDATE no action;