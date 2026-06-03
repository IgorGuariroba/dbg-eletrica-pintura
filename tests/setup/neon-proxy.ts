import { configurarProxyLocalNeon } from "@/db/neon-local-proxy";

// Roda antes de cada arquivo de teste: se NEON_LOCAL_PROXY estiver setado
// (CI / integração contra docker), redireciona o driver Neon ao proxy local.
// Sem a env, é no-op e os testes de integração com `skipIf(!hasDb)` skipam.
configurarProxyLocalNeon();
