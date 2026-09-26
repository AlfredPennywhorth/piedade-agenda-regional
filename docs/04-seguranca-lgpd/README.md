# Segurança e LGPD

Este diretório contém a documentação de segurança e conformidade LGPD do projeto **Agenda Regional São Paulo**.

## Diretrizes gerais de segurança

### O que NUNCA deve ser commitado no Git

- Senhas ou hashes de senhas reais
- Tokens de API (Cloudflare, GitHub, etc.)
- Secrets de sessão
- Chaves privadas (RSA, EC, etc.)
- Dados reais de membros
- CPF real
- Telefone real
- Qualquer dado pessoal de pessoa real

### Gestão de secrets

- Secrets de produção: `wrangler secret put <NOME>`
- Secrets de CI/CD: GitHub Actions Secrets
- Variáveis não-secretas: `wrangler.toml` (seção `[vars]`)

## LGPD — princípios aplicáveis

| Princípio | Aplicação no projeto |
|---|---|
| Finalidade | Dados somente para gestão institucional, agenda, acesso, presença, Portaria e segurança |
| Necessidade | Coletar e retornar somente o mínimo necessário |
| Livre acesso | Processo institucional deve permitir solicitação de informações pelo titular |
| Qualidade | Dados devem ser atualizáveis e vinculados à estrutura institucional correta |
| Transparência | Finalidades, retenção e canal do titular devem ser informados |
| Segurança | Autenticação própria, tokens armazenados por hash, segregação de escopo e trilha de auditoria |
| Prevenção | Não coletar documentos civis nem dados sem finalidade homologada |
| Não discriminação | Dados não podem ser utilizados para fins discriminatórios |
| Responsabilização | Operações administrativas relevantes possuem auditoria |

## Dados pessoais atualmente tratados

O cadastro-base utiliza:

- nome completo;
- número de celular;
- código institucional da carteirinha;
- data de ordenação;
- Casa de Oração e vínculos institucionais;
- dados necessários à conta e aos perfis de acesso.

Fluxos específicos também tratam dados de convocação, RSVP, presença, convidados, Portaria e notificações.

**Não são coletados no cadastro-base: CPF, documento civil ou data de nascimento.**

### Atenção ao contexto institucional

Mesmo quando um campo isolado parece comum, o conjunto de dados desta aplicação pode revelar vínculo com organização religiosa. Por isso, a definição das hipóteses legais aplicáveis não deve ser feita automaticamente pelo software. Deve ser validada formalmente pelo controlador considerando as regras da LGPD para dados pessoais e, quando aplicável, dados pessoais sensíveis.

## Finalidade e retenção

A LGPD não é tratada no projeto como uma autorização para retenção indefinida.

Cada categoria de dado deve possuir:

1. finalidade específica;
2. acesso compatível com a função;
3. hipótese legal validada pelo controlador;
4. evento de término do tratamento;
5. prazo ou critério de retenção;
6. regra de eliminação ou anonimização quando cabível.

A matriz técnica vigente está em:

- [Matriz técnica de tratamento e retenção](./matriz-tratamento-retencao.md)

Prazos ainda não homologados são registrados como **pendentes**, e não como retenção permanente.

## Ciência de responsabilidade

A ciência exigida do responsável Regional/PMO registra que a pessoa recebeu e compreendeu responsabilidades de governança. **Ela não é consentimento para tratamento de dados pessoais.**

## Regra para evolução do schema

Nenhuma nova categoria de dado pessoal deve ser incluída sem registrar finalidade, necessidade, acesso, hipótese legal validada, retenção e descarte.

## Referências oficiais

- Lei nº 13.709/2018 (LGPD):
  https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm
- ANPD — Perguntas frequentes:
  https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes
- ANPD — materiais educativos e publicações:
  https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes

> **Status S13.06:** inventário técnico e critérios de retenção documentados. Bases legais e prazos institucionais indicados como pendentes quando dependem de validação formal do controlador/jurídico.
