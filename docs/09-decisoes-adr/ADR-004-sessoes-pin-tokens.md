# ADR 004: Sessões, PIN e Tokens de Ativação

**Data:** 01 de setembro de 2026  
**Revisão:** 25 de setembro de 2026 — S13.01  
**Status:** Aprovado, revisado para a baseline vigente

## Contexto

Precisamos de um sistema de autenticação nativo e resiliente em Cloudflare Workers, sem depender de e-mail ou SMS para o acesso ordinário. A baseline atual também determina minimização de dados pessoais: data de nascimento não integra mais o cadastro nem os fluxos de autenticação ou recuperação.

## Decisão

### 1. Ativação inicial por link

- O link de ativação possui validade limitada e é armazenado apenas por hash.
- A ativação exige o token e a confirmação do celular cadastrado.
- A ativação **não coleta nem valida data de nascimento**.
- Clientes antigos que ainda enviarem o campo de nascimento têm esse campo descartado pelo contrato de entrada.
- Após a ativação bem-sucedida, o usuário define um PIN pessoal de seis dígitos e recebe uma sessão.

### 2. PIN

- PIN de 6 dígitos.
- O PIN nunca é persistido ou registrado em claro.
- Derivação por PBKDF2-SHA256 com salt individual e Pepper de ambiente.
- Hash versionado no formato PHC, permitindo evolução futura do algoritmo.
- O campo residual de salt separado não é a fonte de verdade quando o hash PHC já contém os parâmetros necessários.

### 3. Sessões

- O token puro nunca é persistido; apenas seu hash SHA-256 é armazenado.
- Expiração por **12 horas de inatividade**.
- Validade absoluta máxima de **30 dias**, mesmo com atividade recente.
- Logout explícito revoga a sessão atual no backend.
- Redefinição/troca de PIN deve revogar as sessões anteriores conforme o fluxo autorizado.
- Sessões revogadas ou expiradas retornam resposta neutra de não autorização.

### 4. Proteção contra força bruta

- O controle principal usa uma chave derivada da identidade alvo, armazenada somente por hash.
- A partir da 5ª falha consecutiva, aplica-se contenção progressiva:
  - 5ª: 30 segundos;
  - 6ª: 60 segundos;
  - 7ª: 2 minutos;
  - 8ª: 5 minutos;
  - 9ª: 10 minutos;
  - 10ª ou superior: 15 minutos.
- Durante o bloqueio, a API retorna HTTP 429 com `Retry-After`.
- Não há `sleep` ativo no Worker.
- IP/origem não é usado como identidade principal. No endpoint anônimo de recuperação, a origem pode ser usada apenas como sinal auxiliar de throttle e é transformada em hash antes da persistência; o valor bruto não deve ser armazenado.

### 5. Anti-enumeração e recuperação

- Login e recuperação usam mensagens externas neutras.
- A recuperação é solicitada pelo celular e sempre responde de forma genérica, independentemente da existência da conta.
- A redefinição efetiva do PIN permanece em fluxo administrativo autorizado.
- Data de nascimento não participa da recuperação.
- Qualquer novo fator adicional — SMS, e-mail, documento civil ou outro dado — depende de decisão expressa do PMO.

### 6. Armazenamento do token no cliente

Para a Beta controlada, permanece o armazenamento atual em `localStorage`.

Motivos:
- a aplicação Pages e a API Worker já operam com Bearer token e estão estabilizadas nesse contrato;
- uma migração imediata para Cookie HttpOnly altera CORS, credenciais, SameSite e introduz análise de CSRF;
- essa mudança ampliaria o risco de regressão no ciclo crítico de entrega de 30/09.

Essa permanência é uma decisão temporária de arquitetura, não uma declaração de que `localStorage` seja a opção ideal para produção. A exposição a XSS deve ser mitigada por CSP e hardening da aplicação na S13.02. Antes da produção definitiva, a alternativa Cookie HttpOnly deve ser reavaliada em conjunto com a arquitetura Pages/Worker, CSRF, PWA e domínios efetivos.

## Consequências

- A autenticação deixa de depender de dado pessoal desnecessário.
- Sessões possuem limites de inatividade e idade absoluta verificáveis.
- Ataques de força bruta recebem contenção progressiva sem bloquear redes compartilhadas como identidade primária.
- A recuperação não revela existência de usuário.
- O risco residual do token em `localStorage` fica explícito e rastreável até a revisão pré-produção.
