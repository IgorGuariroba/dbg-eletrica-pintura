import type { GatilhoRemarketingId } from "./gatilhos";

export interface RemarketingEnviadoRepo {
  claim(gatilho: GatilhoRemarketingId, clienteId: string, contexto: string): Promise<boolean>;
}
