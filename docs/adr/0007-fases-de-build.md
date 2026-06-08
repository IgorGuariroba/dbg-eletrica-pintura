# Fases de build reorganizadas após grill de 40 decisões

5 fases mantidas, conteúdo reorganizado. Critério: cada fase entrega valor utilizável sozinha. Fase anterior precisa estar sólida antes de avançar. Diferenciais reais (transparência, fotos, perfil técnico) entram na Fase 2 — são o que separa DBG de informal.

## Fase 1 — Fundação (funciona e gera valor imediato)

Contextos: Catálogo, Equipe, Portal (parcial), Operação (parcial), Notificação (parcial)

**Infra:**
- Neon Postgres + schema inicial (serviços, membros, solicitações, OS)
- Cloudflare R2 (bucket privado + público)
- Vercel deploy + domínio
- Auth.js v5 + Google OAuth + role detection
- Admin raiz via .env

**Catálogo:**
- CRUD serviços (nome, categoria, preço base, unidade, foto, ativo/inativo)
- Garantia por serviço (campo prazo_garantia_meses)

**Equipe:**
- Cadastro técnicos (foto, bio, especialidades, disponibilidade)
- Cadastro membros internos + módulos binários
- Roles compostas (técnico + módulos)

**Portal (público):**
- Landing page institucional (serviços, portfólio, avaliações, CTA)
- Formulário de solicitação (taps, múltiplas categorias, endereço obrigatório, LGPD)
- Confirmação + redirect wa.me

**Operação (básica):**
- Fila de solicitações
- Montagem de orçamento (itens do catálogo, breakdown)
- Envio de orçamento via wa.me (link com token)
- Aprovação/rejeição pelo cliente (link token, sem login)
- Máquina de estados: NOVA → ORÇADA → APROVADA/REJEITADA

**Notificação (wa.me só):**
- Links wa.me pra todas interações (formulário → empresa, técnico → cliente)
- Sem Cloud API ainda (número precisa migrar pra Business)

**Resultado Fase 1:** Diego recebe solicitações pelo site, monta orçamento digital, cliente aprova por link. Sai do caderno pro digital.

---

## Fase 2 — Diferencial competitivo (concorrente informal nunca faz)

Contextos: Portal (PWA técnico), Operação (campo), Notificação (e-mail)

**PWA Técnico (offline-first):**
- Service Worker + IndexedDB (Dexie.js)
- Foto antes (obrigatória, mín. 1) + foto depois (obrigatória)
- Timestamp + geolocalização nas fotos
- Compressão client-side antes de armazenar
- Notas de serviço + materiais consumidos
- Background Sync pra fila offline
- Solicitação express (técnico cria no local)
- Aprovação presencial (assinatura na tela + checkbox LGPD)

**Operação (campo):**
- Estados de campo: A_CAMINHO → NO_LOCAL → EM_EXECUÇÃO → CONCLUÍDA
- Rastreamento manual (botões no PWA)
- Confirmação de presença do cliente
- Orçamento complementar (presencial ou remoto)
- Fluxo express comprimido (pula agendamento)
- Conversão express → remoto (técnico cancela/despromove)

**Portal (perfil técnico):**
- Perfil público do técnico (foto, nome, bio, especialidades)
- Transparência de preço no site (breakdown visível)

**Notificação (e-mail):**
- Resend + React Email (templates)
- React PDF (orçamento, fatura)
- E-mail pra documentação (fatura, fotos, garantia)

**Resultado Fase 2:** Fotos antes/depois em toda OS, perfil do técnico visível, preço transparente. Diferencial real — prova do trabalho, não promessa.

---

## Fase 3 — Experiência premium

Contextos: Operação (agendamento), Portal (cliente logado), Financeiro (pagamento)

**Instant Booking:**
- Agenda de técnicos em tempo real
- Atribuição automática por especialidade + disponibilidade
- Cliente escolhe slot (não técnico), admin pode override
- Horário comercial configurável + disponibilidade individual do técnico
- Prioridade pra assinantes nos slots
- Raio de cobertura (ponto central + km, aviso suave)

**Reagendamento/Cancelamento multi-ator:**
- Cliente: até 24h antes, sem taxa
- Técnico: reagenda OS atribuída, cancela com motivo obrigatório
- Admin (Operação): qualquer OS, inclusive em lote

**Portal do cliente (logado Google):**
- Histórico de solicitações + OS filhas
- Status individual por OS
- Fotos antes/depois, faturas, certificados
- Garantias ativas + botão acionar

**Pagamento (Mercado Pago):**
- Pix QR + link de pagamento
- Pagamento flexível (na hora ou depois)
- Pagamento manual (dinheiro/transferência, técnico confirma)
- Checkout consolidado opcional (pagar junto ou separado)
- Upsell de assinatura no checkout (economia visível)
- Webhook MP → atualiza status PAGA

**Resultado Fase 3:** Cliente agenda sozinho, paga digital, vê tudo no portal. Experiência de app moderno.

---

## Fase 4 — Automação e confiança

Contextos: Notificação (Cloud API), Financeiro (garantias + faturamento), Marketing (parcial)

**WhatsApp Cloud API:**
- Migrar número pra Business verificado (pré-requisito)
- Templates aprovados pela Meta
- Notificações proativas (orçamento pronto, técnico a caminho, lembrete pagamento)
- Horário restrito 8h-20h + fila de envio
- Separação: WhatsApp pra urgente, e-mail pra documento

**Garantia completa:**
- Certificado PDF automático ao concluir OS
- Botão "Acionar Garantia" (descrição + foto obrigatória)
- Validação: prazo + verificação de complementar rejeitado
- OS Garantia gerada automaticamente se válida

**Faturamento digital:**
- PDF profissional (orçamento, fatura, garantia, fotos)
- Envio automático por e-mail em cada transição
- Documentos acessíveis no portal

**Avaliações:**
- Nota + comentário após conclusão
- Lembrete único 48h
- Nota ≥ 4★ → link Google Review (g.page)
- Nota ≤ 3★ → alerta módulo Marketing + tratativa
- Reavaliação após tratativa resolvida
- Perfil técnico com nota média + portfólio

**Portfólio curado:**
- Técnico marca "boa pra portfólio" no PWA
- Admin (Marketing) aprova antes de publicar
- Fotos internas ≠ fotos públicas

**Resultado Fase 4:** Notificações automáticas, garantia formal, avaliações com filtro pra Google. Confiança sistematizada.

---

## Fase 5 — Escala e fidelização

Contextos: Financeiro (assinaturas), Marketing (completo), Operação (preventiva)

**Planos de assinatura:**
- CRUD planos (Básico/Conforto/Premium)
- Mercado Pago Subscriptions API
- Desconto automático no checkout
- Prioridade no agendamento
- Assinatura multicanal (checkout, presencial na tela, QR)
- E-mail boas-vindas com detalhes do plano
- Inadimplência delegada ao MP (retry 4x, Card Updater, cancela após 3 falhas)
- Cancelamento pelo cliente (portal/WhatsApp), admin (motivo obrigatório)

**Visitas preventivas:**
- OS Preventiva gerada automaticamente por calendário do plano
- Checklist preventivo por categoria (configurável no Catálogo)
- Técnico segue checklist + observações
- Relatório enviado ao cliente
- Problema encontrado → OS Complementar (paga)

**Marketing completo:**
- Landing pages auto + override (título, descrição, preço promocional, upsell, depoimentos)
- Remarketing configurável (prazos + toggles on/off)
- Reativação inativos 6+ meses
- Indicação dupla (referral loop, valor fixo R$, link único)
- Google Business API (camada 2: lê avaliações, responde pelo painel, dashboard reputação) — quando Diego verificar negócio no Google
- Dashboard filtrado por módulo (métricas por contexto)

**Resultado Fase 5:** Receita recorrente, manutenção preventiva, marketing automatizado. Escala sem perder qualidade.
