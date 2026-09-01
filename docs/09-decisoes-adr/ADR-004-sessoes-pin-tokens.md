# ADR 004: Sessões, PIN e Tokens de Ativação

**Data:** 01 de setembro de 2026
**Status:** Aprovado (Sprint S03)

## Contexto

Precisamos de um sistema de autenticação nativo e resiliente rodando no Cloudflare Workers para os membros da Agenda Regional São Paulo. Não usaremos o Cloudflare Access para os usuários finais e não queremos depender de e-mail ou SMS (custo e logística).

## Decisão

Foi decidido implementar:

1. **Ativação Inicial por Link:**
   - Link tem validade de **7 dias**.
   - A ativação exige token, além da confirmação de celular e data de nascimento.

2. **Mecanismo de Autenticação (PIN):**
   - **PIN de 6 dígitos**, não complexo para facilitar o uso.
   - Proteção com **Pepper (HMAC-SHA256)** utilizando chave de configuração (injetada via variável de ambiente), impedindo ataques offline caso o D1 seja vazado isoladamente.
   - Derivação e proteção complementar usando **PBKDF2-SHA256**, com salt individual aleatório e 100.000 iterações (usando `Web Crypto API`). *Benchmark pendente para refinar o número de iterações no Cloudflare Workers.*
   - **Hash Versionado**: O resultado é persistido no banco no formato PHC (`$v1$pbkdf2-sha256$i=100000$salt$hash`), garantindo a evolução flexível do algoritmo no futuro. (O campo pin_salt do esquema é residual e o próprio hash é a fonte da verdade).

3. **Gerenciamento de Sessões e Tokens:**
   - **Nunca persistir o token puro**. Somente o hash `SHA-256` é guardado no banco. O token puro é gerado aleatoriamente (32 bytes) e devolvido uma única vez ao cliente.
   - **Validade da Sessão**: **30 dias**.

4. **Bloqueios e Segurança:**
   - O PIN incorreto após **5 tentativas** gera um bloqueio temporário de **15 minutos**.
   - IP não será coletado, mitigando risco relacionado à LGPD desnecessariamente.

5. **Recuperação Administrativa:**
   - Somente um administrador pode emitir um link de recuperação, que invalidará as sessões ativas e o PIN existente, forçando nova ativação.

## Consequências

- Alta segurança com criptografia nativa (Web Crypto API) e resistência a ataques offline usando Pepper no PIN.
- Flexibilidade na atualização do hash do PIN devido ao uso de string versionada (PHC format).
