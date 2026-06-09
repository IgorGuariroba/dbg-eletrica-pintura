CREATE TABLE "credito_movimentacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"valor" numeric(10, 2) NOT NULL,
	"tipo" varchar(20) NOT NULL,
	"payment_id" varchar(64),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credito_movimentacao" ADD CONSTRAINT "credito_movimentacao_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credito_movimentacao_payment_uq" ON "credito_movimentacao" USING btree ("payment_id");