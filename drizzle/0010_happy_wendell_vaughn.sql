ALTER TABLE "orcamento" ADD COLUMN "aprovacao_tipo" varchar(20);--> statement-breakpoint
ALTER TABLE "orcamento" ADD COLUMN "assinatura_url" text;--> statement-breakpoint
ALTER TABLE "orcamento" ADD COLUMN "aprovacao_por" varchar(255);--> statement-breakpoint
ALTER TABLE "orcamento" ADD COLUMN "aprovacao_lgpd" boolean;