CREATE TABLE "landing_override" (
	"servico_id" uuid PRIMARY KEY NOT NULL,
	"titulo" varchar(200),
	"descricao" text,
	"preco_promo" numeric(10, 2),
	"upsell_servico_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_override_depoimento" (
	"servico_id" uuid NOT NULL,
	"avaliacao_id" uuid NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "landing_override_depoimento_servico_id_avaliacao_id_pk" PRIMARY KEY("servico_id","avaliacao_id")
);
--> statement-breakpoint
CREATE TABLE "landing_override_foto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"servico_id" uuid NOT NULL,
	"chave" text NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "landing_override" ADD CONSTRAINT "landing_override_servico_id_servico_id_fk" FOREIGN KEY ("servico_id") REFERENCES "public"."servico"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_override" ADD CONSTRAINT "landing_override_upsell_servico_id_servico_id_fk" FOREIGN KEY ("upsell_servico_id") REFERENCES "public"."servico"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_override_depoimento" ADD CONSTRAINT "landing_override_depoimento_servico_id_landing_override_servico_id_fk" FOREIGN KEY ("servico_id") REFERENCES "public"."landing_override"("servico_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_override_depoimento" ADD CONSTRAINT "landing_override_depoimento_avaliacao_id_avaliacao_id_fk" FOREIGN KEY ("avaliacao_id") REFERENCES "public"."avaliacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_override_foto" ADD CONSTRAINT "landing_override_foto_servico_id_landing_override_servico_id_fk" FOREIGN KEY ("servico_id") REFERENCES "public"."landing_override"("servico_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "landing_override_foto_servico_ordem_idx" ON "landing_override_foto" USING btree ("servico_id","ordem");