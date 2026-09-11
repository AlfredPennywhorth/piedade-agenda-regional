# Roteiro Operacional de Homologação Manual S12 (Cenários 3 a 10)

**Objetivo:** Instruções passo a passo para o PO executar a homologação manual restrita aos cenários S12.

**Autenticação:** O sistema recebe um Bearer token bruto e valida seu SHA-256 no banco. O PO precisará gerar e inserir o token bruto correspondente no localStorage.
*(Nota: Os valores TOKEN_* citados abaixo são identificadores lógicos de homologação e NÃO são tokens de sessão reais.)*

---

## Cenário 3 — GESTOR_RELATORIOS
1. **Nome:** Acesso autorizado ao relatório do próprio escopo.
2. **Objetivo:** Validar acesso de leitura do gestor de relatórios.
3. **Perfil Sintético:** Membro 3.
4. **Funções:** `GESTOR_RELATORIOS`.
5. **Escopo:** Regional 1.
6. **Token:** `TOKEN_GESTOR_RELATORIOS`
7. **Pré-condições:** O hash do token precisa estar cadastrado no banco.
8. **Dados Sintéticos:** Check-ins no evento-sintetico-gestor-s12.
9. **Comando localStorage:** `localStorage.setItem('session_token', 'TOKEN_GESTOR_RELATORIOS');`
10. **URL a abrir:** `http://localhost:5173/eventos/evento-sintetico-gestor-s12/relatorios`
11. **Critério PASS:** Menu visível e dados exibidos.

## Cenário 4 — GESTOR_RELATORIOS fora do escopo
1. **Nome:** Bloqueio lateral.
2. **Objetivo:** Impedir que Gestor de Adm 2 veja evento da Regional 1.
3. **Perfil Sintético:** Membro 4.
4. **Funções:** `GESTOR_RELATORIOS` na Adm 2.
5. **Token:** `TOKEN_GESTOR_FORA`
6. **Comando:** `localStorage.setItem('session_token', 'TOKEN_GESTOR_FORA');`
7. **URL a abrir:** `http://localhost:5173/eventos/evento-sintetico-gestor-s12/relatorios`
8. **Critério PASS:** 403 retornado.

## Cenário 5 — Organizador sem GESTOR_RELATORIOS
1. **Nome:** Permissão estrita por função canônica.
2. **Objetivo:** Garantir que organizador sem a função de Gestor não veja relatórios confidenciais.
3. **Perfil Sintético:** Membro 5.
4. **Funções:** Nenhuma função canônica sistêmica. Possui apenas seu `membro_id` no campo `organizador_membro_id` do evento.
5. **Token:** `TOKEN_ORGANIZADOR`
6. **Comando:** `localStorage.setItem('session_token', 'TOKEN_ORGANIZADOR');`
7. **Critério PASS:** 403 no relatório nominal.

## Cenário 6 — AUDITOR_SISTEMA Regional
1. **Perfil Sintético:** Membro 6 (`AUDITOR_SISTEMA` Reg 1).
2. **Token:** `TOKEN_AUDITOR_REGIONAL`
3. **URL:** `/auditoria`
4. **Critério PASS:** Vê os logs da Regional 1 e não da Adm 2.

## Cenário 7 e 8 — AUDITOR_SISTEMA Administração / Fora de Escopo
1. **Perfil Sintético:** Membro 7 (`AUDITOR_SISTEMA` Adm 2).
2. **Token:** `TOKEN_AUDITOR_ADM`
3. **Critério PASS:** Tentar filtrar logs da Regional 1 via API direta deve resultar em 403 (Fail-closed). Só deve ver logs da Adm 2.

## Cenário 9 — Usuário Multifunção
1. **Token:** `TOKEN_MULTIFUNCAO`
2. **Critério PASS:** Capacidades não colidem; exerce portaria, auditoria e relatório em seus devidos escopos.

## Cenário 10-A — Auditoria (Visualização e Filtros)
1. **Nome:** Auditoria - Exibição de logs sintéticos.
2. **Objetivo:** Comprovar exibição de UI, paginação, filtros e controle de acesso da página de Auditoria.
3. **Dados Sintéticos:** Logs do script de seed.
4. **Critério PASS:** A tabela renderiza as sete strings corretamente a partir dos mocks do DB, permitindo filtros por data.

## Cenário 10-B — Auditoria (Geração Real da Auditoria)
1. **Nome:** Auditoria Transacional Real.
2. **Objetivo:** Comprovar que o uso real da aplicação dispara as funções e as persistências atômicas em `auditoria_logs`.
3. **Pré-condições:** Tabela de logs limpa (ou ignorar logs prévios).
4. **Ação do PO:** Acessar o sistema, criar um evento real na UI, publicar convocação, cancelar convocação, atualizar evento, realizar check-in e check-in via QR, além de um RSVP real.
5. **Critério PASS:** Verificar na tabela de auditoria se novas linhas autênticas foram geradas em tempo real com as 7 ações canônicas. O PASS do C10 depende exclusivamente deste passo B.
