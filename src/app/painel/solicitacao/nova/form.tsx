"use client";

import { SolicitarForm } from "@/app/solicitar/form";
import { criarSolicitacaoManualAction } from "./actions";

const CONSENT_LABEL_MANUAL =
  "Confirmo que coletei o consentimento LGPD do cliente verbalmente durante o atendimento. Meu usuário e o horário ficarão registrados na solicitação.";

export function SolicitacaoManualForm() {
  return (
    <SolicitarForm
      onSubmitAction={criarSolicitacaoManualAction}
      consentLabel={CONSENT_LABEL_MANUAL}
      submitLabel="Criar solicitação"
    />
  );
}
