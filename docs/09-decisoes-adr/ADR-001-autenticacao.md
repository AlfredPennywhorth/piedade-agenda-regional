# ADR-001 — Mecanismo de Autenticação

| Campo | Valor |
|---|---|
| **ID** | ADR-001 |
| **Título** | Mecanismo de Autenticação |
| **Status** | **DECIDIDO** (PMO-001 — 2026-08-31) |
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
| Validação inicial | Celular + Data de nascimento |
| Mecanismo de sessão | Próprio e seguro (a definir na S01) |
| Contingência | PIN |
| Evolução futura | Arquitetura preparada para Passkeys / WebAuthn |
| Recuperação | Administrativa (sem auto-serviço de reset) |
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
  - `sessoes` — tokens de sessão, expiração, IP/User-Agent
  - `links_ativacao` — links individuais, status, expiração
  - `tentativas_acesso` — auditoria de tentativas (LGPD)
- **Dados sensíveis**: Data de nascimento usada apenas para validação de identidade na ativação.
  Verificar com PMO se deve ser armazenada após ativação (LGPD — princípio da necessidade).

---

## Ressalva técnica (Lead Dev)

> Conforme ressalva PMO: manter separação estrita entre código dependente de runtime Node
> (ex: testes com `better-sqlite3`) e código destinado ao Cloudflare Worker/D1.
> Toda lógica de autenticação deve ser implementada exclusivamente em `apps/worker/src/`.

---

## Próximos passos (Sprint S01+)

- [ ] Definir schema de `sessoes`, `links_ativacao` e `tentativas_acesso`
- [ ] Definir algoritmo de geração e validação de links individuais
- [ ] Definir tempo de expiração de sessão e política de renovação
- [ ] Definir estrutura do PIN (tamanho, hash, tentativas máximas)
- [ ] Avaliar biblioteca criptográfica compatível com Cloudflare Workers
- [ ] Documentar fluxo de ativação com o PMO
- [ ] Definir processo de recuperação administrativa

> **NÃO IMPLEMENTAR nesta Sprint S00.**
> Implementação aguarda autorização formal do PMO para Sprint S01.
