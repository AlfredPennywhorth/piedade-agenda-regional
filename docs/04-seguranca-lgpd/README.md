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
- Data de nascimento real
- Telefone real
- Qualquer dado pessoal de pessoa real

### Gestão de secrets

- Secrets de produção: `wrangler secret put <NOME>`
- Secrets de CI/CD: GitHub Actions Secrets
- Variáveis não-secretas: `wrangler.toml` (seção `[vars]`)

## LGPD — Princípios aplicáveis

| Princípio | Aplicação prevista |
|---|---|
| Finalidade | Dados coletados somente para gestão de reuniões regionais |
| Necessidade | Coletar apenas dados estritamente necessários |
| Livre acesso | Membro pode solicitar seus dados |
| Qualidade | Dados atualizados e corretos |
| Transparência | Informar o membro sobre uso dos dados |
| Segurança | Autenticação própria + sessões seguras (ADR-001) |
| Prevenção | Não armazenar dados desnecessários |
| Não discriminação | Sem uso de dados para fins discriminatórios |
| Responsabilização | Registro de acessos e alterações |

## Dados sensíveis previstos

- Data de nascimento (apenas para validação de identidade na ativação — ver ADR-001)
- Número de celular (opcional, sem SMS obrigatório)

> **Status:** Política de LGPD a ser detalhada pelo PMO. Framework de segurança estabelecido na S00.
