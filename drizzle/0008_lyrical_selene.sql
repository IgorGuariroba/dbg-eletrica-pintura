CREATE TABLE "transicao_os" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"os_id" uuid NOT NULL,
	"estado_anterior" "estado_os" NOT NULL,
	"estado_novo" "estado_os" NOT NULL,
	"ator_email" varchar(255) NOT NULL,
	"motivo" text,
	"em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transicao_os" ADD CONSTRAINT "transicao_os_os_id_ordem_servico_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."ordem_servico"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transicao_os_os_em_idx" ON "transicao_os" USING btree ("os_id","em");