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
   - **PIN de 6 dígitos**, não complexo para facilitar o uso, mas protegido adequadamente.
   - Derivação e proteção usando **PBKDF2-SHA256**, com salt individual aleatório e 100.000 iterações (usando `Web Crypto API`).

3. **Gerenciamento de Sessões e Tokens:**
   - **Nunca persistir o token puro**. Somente o hash `SHA-256` é guardado no banco. O token puro é gerado aleatoriamente (32 bytes) e devolvido uma única vez ao cliente.
   - **Validade da Sessão**: **30 dias**.

4. **Bloqueios e Segurança:**
   - O PIN incorreto após **5 tentativas** gera um bloqueio temporário de **15 minutos**.
   - IP não será coletado, mitigando risco relacionado à LGPD desnecessariamente.

5. **Recuperação Administrativa:**
   - Somente um administrador pode emitir um link de recuperação, que invalidará as sessões ativas e o PIN existente, forçando nova ativação.

## Consequências

- Alta segurança e dependência zero de sistemas externos ou bibliotecas Node que quebram no Workers (criptografia nativa Web).
- Em caso de vazamento do D1, nenhum PIN ou Token de Sessão pode ser revertido rapidamente.
