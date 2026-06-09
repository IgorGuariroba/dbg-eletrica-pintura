CREATE TABLE "config_referral" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"valor_premio" numeric(10, 2) DEFAULT '30.00' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indicacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"indicador_id" uuid NOT NULL,
	"indicado_id" uuid NOT NULL,
	"desconto_aplicado" boolean DEFAULT false NOT NULL,
	"credito_gerado" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cliente" ADD COLUMN "saldo_credito" numeric(10, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "orcamento" ADD COLUMN "desconto_indicacao" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "indicacao" ADD CONSTRAINT "indicacao_indicador_id_cliente_id_fk" FOREIGN KEY ("indicador_id") REFERENCES "public"."cliente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicacao" ADD CONSTRAINT "indicacao_indicado_id_cliente_id_fk" FOREIGN KEY ("indicado_id") REFERENCES "public"."cliente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "indicacao_indicado_uq" ON "indicacao" USING btree ("indicado_id");