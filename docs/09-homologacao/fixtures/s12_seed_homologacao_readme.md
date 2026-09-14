# README - Seed de Homologação S12

Este conjunto de dados foi preparado estaticamente para viabilizar os Cenários 3 a 10 da homologação manual S12.

**ATENÇÃO:** Não execute este script em produção. É destinado apenas ao banco de dados SQLite/D1 local.

## 1. Ordem de Execução
1. Garanta que todas as migrations já foram aplicadas, para que a estrutura de tabelas mais recente exista.
2. Execute o script consolidado no banco local de dev.
   - *Comando sugerido (via wrangler se permitido posteriormente):* `npx wrangler d1 execute piedade-agenda-regional-dev --local --file=./scratch/s12_seed_homologacao_completo.sql`
3. Inicie a aplicação (frontend e backend).

## 2. Dependências
Este seed não exige outros scripts prévios, pois realiza `INSERT OR IGNORE` nas entidades fundamentais.

## 3. IDs Sintéticos Criados
* **Regionais:** `reg-1`, `reg-2`
* **Administração:** `adm-2`
* **Membros:** `m-1`, `m-2`, `m-3`, `m-4`, `m-5`, `m-6`, `m-7`, `m-9`
* **Eventos:**
  * `evento-sintetico-gestor-s12` (Escopo `reg-1`)
  * `evento-sintetico-fora-s12` (Escopo `adm-2`)

## 4. Tabela de Tokens a Gerar

A autenticação recebe um Bearer token bruto e valida seu SHA-256 contra `sessoes.token_hash`. Como os hashes reais ainda precisam ser computados localmente pelo PO, o script de seed tem `PENDENTE_GERAR_HASH_<perfil>`.
**IMPORTANTE:**
- As sessões válidas devem ser preparadas LOCALMENTE.
- Os tokens reais são gerados exclusivamente no computador de homologação.
- O token bruto e o hash correspondente **nunca são commitados**.
- Os valores TOKEN_* citados na tabela abaixo são identificadores lógicos de homologação e NÃO são credenciais reais. O PO deve gerar seus próprios tokens, calcular os hashes, injetá-los no DB e usar os correspondentes reais no localStorage, ou simplesmente fazer login na UI.

| Cenário | Personagem | Função / Vínculo | Token Bruto (Injetar no LocalStorage) |
| :--- | :--- | :--- | :--- |
| **C3** | `m-3` | GESTOR_RELATORIOS (reg-1) | `TOKEN_GESTOR_RELATORIOS` |
| **C4** | `m-4` | GESTOR_RELATORIOS (adm-2) | `TOKEN_GESTOR_FORA` |
| **C5** | `m-5` | Nenhum (apenas organizador no evento) | `TOKEN_ORGANIZADOR` |
| **C6** | `m-6` | AUDITOR_SISTEMA (reg-1) | `TOKEN_AUDITOR_REGIONAL` |
| **C7, C8** | `m-7` | AUDITOR_SISTEMA (adm-2) | `TOKEN_AUDITOR_ADM` |
| **C9** | `m-9` | Múltiplas funções | `TOKEN_MULTIFUNCAO` |
| **C10-A** | N/A | Ações inseridas estaticamente | N/A (Usa auditor regional) |
| **C10-B** | Vários | Ações via uso real | O teste exigirá login e navegação real |

## 5. Eventos Criados
1. **evento-sintetico-gestor-s12:** Simula um culto na "Regional 1".
2. **evento-sintetico-fora-s12:** Simula um evento na "Administração 2" (isolado).
