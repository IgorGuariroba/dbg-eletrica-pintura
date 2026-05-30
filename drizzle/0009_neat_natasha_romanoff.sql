CREATE TABLE "confirmacao_presenca" (
	"os_id" uuid PRIMARY KEY NOT NULL,
	"ip" varchar(64) NOT NULL,
	"confirmado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transicao_os" ADD COLUMN "lat" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "transicao_os" ADD COLUMN "lon" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "confirmacao_presenca" ADD CONSTRAINT "confirmacao_presenca_os_id_ordem_servico_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."ordem_servico"("id") ON DELETE cascade ON UPDATE no action;