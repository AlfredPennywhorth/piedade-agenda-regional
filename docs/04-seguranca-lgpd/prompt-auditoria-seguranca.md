# Prompt para auditoria de segurança

Copie e cole o texto abaixo em uma nova conversa do ChatGPT:

```text
Faça uma auditoria de segurança completa do projeto, analisando o código-fonte, dependências, configurações, workflows de CI/CD, autenticação, autorização, proteção de dados pessoais, exposição de segredos, validação de entradas, endpoints públicos, armazenamento de tokens, headers HTTP e riscos de implantação.

Para cada ponto encontrado:

1. Classifique a severidade: crítica, alta, média ou baixa.
2. Informe o arquivo e as linhas relacionadas.
3. Explique o impacto prático e o cenário de exploração.
4. Indique uma sugestão objetiva de correção ou melhoria.
5. Informe se o problema é confirmado, provável ou apenas uma recomendação preventiva.

Dê atenção especial aos seguintes itens:

- Tokens de sessão armazenados no localStorage e possíveis riscos de XSS.
- Endpoint de bootstrap ou criação do primeiro usuário administrador.
- Credenciais e tokens transmitidos em URLs.
- Rate limiting, brute force, enumeração de usuários e recuperação de PIN/senha.
- Validação de JSON, tamanho de payloads e sanitização de entradas.
- SQL injection, XSS, CSRF, SSRF, IDOR e falhas de autorização por escopo.
- Separação entre rotas autenticadas e rotas públicas.
- Exposição de dados pessoais e conformidade com LGPD.
- Headers de segurança, CSP, CORS, HSTS, cookies e política de referências.
- Service worker, notificações push e URLs externas.
- Dependências vulneráveis e segurança da cadeia de suprimentos.
- Permissões de GitHub Actions, uso de Actions não fixadas por SHA e exposição de secrets.
- Configurações de produção, Cloudflare Workers, banco D1 e logs.

Não altere nenhum arquivo. Produza um relatório em português, organizado por severidade, começando por um resumo executivo. Ao final, inclua:

- Os controles de segurança já existentes e considerados positivos.
- Uma lista priorizada de ações corretivas.
- Os riscos residuais que precisam de acompanhamento.
- Uma conclusão indicando se o projeto está pronto para produção do ponto de vista de segurança.

Não invente vulnerabilidades. Diferencie claramente vulnerabilidades confirmadas, hipóteses que precisam de validação e recomendações de hardening.
```
