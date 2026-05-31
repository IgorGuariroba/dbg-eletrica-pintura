CREATE TABLE "bairro_cobertura" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(120) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bairro_cobertura_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
ALTER TABLE "operacao_config" ADD COLUMN "horario_comercial" jsonb;