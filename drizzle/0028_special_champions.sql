ALTER TABLE "orcamento" ADD COLUMN "desconto_plano" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orcamento" ADD COLUMN "percentual_desconto_plano" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "plano" ADD COLUMN "beneficios" text;--> statement-breakpoint
ALTER TABLE "plano" ADD COLUMN "percentual_desconto" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "plano" ADD COLUMN "preventivas_por_ano" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plano" ADD COLUMN "prioridade_agendamento" boolean DEFAULT false NOT NULL;