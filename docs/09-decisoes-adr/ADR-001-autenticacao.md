# ADR-001 — Mecanismo de Autenticação

| Campo | Valor |
|---|---|
| **ID** | ADR-001 |
| **Título** | Mecanismo de Autenticação |
| **Status** | **DECIDIDO** (PMO-001 — 2026-08-31; revisado em 2026-09-25) |
| **Proposto por** | Lead Dev (Sprint S00) |
| **Decidido por** | PMO |
| **Data da decisão** | 2026-08-31 |
| **Sprint** | S00 (registro) / S01+ (implementação) |

---

## Contexto

O projeto Agenda Regional São Paulo requer autenticação de usuários finais para acesso à agenda de reuniões e registro de convocações. A escolha do mecanismo afeta:

- Modelo de dados de usuários/sessões
- Conformidade com LGPD
- Custo operacional
- Experiência do usuário final
- Escalabilidade para mais de 500 usuários

## Opções avaliadas

### Opção A — Cloudflare Access (Zero Trust)
**Status: REJEITADA pelo PMO**

Autenticação gerenciada pelo Cloudflare Zero Trust. Os usuários se autenticariam via provedor externo (Google, GitHub, e-mail).

**Motivos da rejeição (PMO):**
1. O plano gratuito do Cloudflare Zero Trust / Access não atende o volume previsto (>500 usuários) sem custo.
2. O público final não deve depender de conta de e-mail ou conta Cloudflare para utilizar a aplicação.
3. Incompatível com o modelo de ativação por link individual previsto.

### Opção B — OAuth2 externo (Google, GitHub)
**Status: NÃO AVALIADA FORMALMENTE — não alinhada ao perfil do público-alvo**

### Opção C — Autenticação própria no backend Worker
**Status: APROVADA pelo PMO**

---

## Decisão PMO-001

**Fica aprovada a seguinte arquitetura de autenticação:**

| Elemento | Decisão |
|---|---|
| Localização | Backend Cloudflare Worker |
| Persistência | Cloudflare D1 |
| Ativação | Link individual por membro |
| Validação inicial | Celular cadastrado + link individual |
| Mecanismo de sessão | Token aleatório; somente hash persistido no backend |
| Sessão | 12 h de inatividade máxima e 30 dias de validade absoluta |
| Contingência | PIN de 6 dígitos, armazenado somente por hash |
| Evolução futura | Arquitetura preparada para Passkeys / WebAuthn |
| Recuperação | Solicitação pelo usuário + redefinição administrativa por link individual |
| SMS | Não obrigatório |
| E-mail | Não obrigatório |

### Cloudflare Access — uso restrito

O Cloudflare Access **poderá ser avaliado posteriormente** somente para:
- Ambientes técnicos internos (ex: painel administrativo restrito a devs)
- Acesso administrativo da equipe técnica

**Nunca** para usuários finais do sistema.

---

## Consequências

### Positivas
- Controle total sobre o fluxo de autenticação
- Sem dependência de provedores externos para usuários finais
- Custo zero (D1 + Worker no plano free)
- Alinhado com o modelo de ativação individual
- Base para implementação futura de Passkeys/WebAuthn

### Negativas / Riscos
- Maior responsabilidade de implementação e segurança
- Necessidade de design cuidadoso do fluxo de sessão
- Necessidade de política de expiração e renovação de sessões

### Impacto no modelo de dados
- Tabelas a criar (Sprint S01+):
  - `sessoes` — hash do token, expiração, último acesso e User-Agent
  - `links_ativacao` — hash do token, status e expiração
  - `tentativas_acesso` — eventos mínimos necessários para segurança e recuperação
- **Minimização de dados**: a revisão de 25/09/2026 removeu a data de nascimento do modelo e dos fluxos de autenticação. A ativação utiliza link individual e confirmação do celular cadastrado.

---

## Ressalva técnica (Lead Dev)

> Conforme ressalva PMO: manter separação estrita entre código dependente de runtime Node
> (ex: testes com `better-sqlite3`) e código destinado ao Cloudflare Worker/D1.
> Toda lógica de autenticação deve ser implementada exclusivamente em `apps/worker/src/`.

---

## Estado implementado

- [x] Schema de `sessoes`, `links_ativacao` e `tentativas_acesso`
- [x] Tokens aleatórios com persistência apenas do hash
- [x] Sessão com máximo de 12 h de inatividade e 30 dias absolutos
- [x] PIN de 6 dígitos com hash e proteção contra tentativas sucessivas
- [x] Link individual de ativação/reset com validade de 7 dias
- [x] Revogação de sessões em logout, bloqueio e redefinição de PIN
- [x] Recuperação iniciada pelo usuário com resposta anti-enumeração e tratamento administrativo
- [x] Fluxos compatíveis com Cloudflare Worker/D1

## Retenção

Os prazos acima são limites de validade funcional das credenciais, não autorização para conservar indefinidamente seus registros históricos.

A política de descarte dos registros expirados/revogados e dos eventos de tentativa deve seguir a matriz de tratamento e retenção em `docs/04-seguranca-lgpd/matriz-tratamento-retencao.md`. Prazos institucionais ainda não homologados permanecem explicitamente pendentes.
