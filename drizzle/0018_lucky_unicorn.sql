CREATE TABLE "pagamento" (
	"payment_id" varchar(64) NOT NULL,
	"os_id" uuid NOT NULL,
	"valor" numeric(10, 2) NOT NULL,
	"metodo" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pagamento_payment_id_os_id_pk" PRIMARY KEY("payment_id","os_id")
);
--> statement-breakpoint
ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_os_id_ordem_servico_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."ordem_servico"("id") ON DELETE restrict ON UPDATE no action;