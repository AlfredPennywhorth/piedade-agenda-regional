# Portal independente de homologação Stitch

Página de índice com 27 referências HTML versionadas para avaliação do Gate A (Setores, Regionais, Administrações, GTs, Locais/Espaços e Casas de Oração).

## Build

A partir da raiz do repositório, com Node.js 20+:

```bash
node tools/homologacao-stitch/build.mjs
```

Publicar **somente** a pasta `dist-homologacao`. O comando copia arquivos HTML versionados, sem alteração, e cria a página `index.html` com links locais clicáveis. O portal não faz chamadas à API da Agenda e não acessa D1.

## Publicação segura — Cloudflare Pages

Criar **outro projeto Pages**, por exemplo `piedade-homologacao-stitch`, separado de `piedade-agenda-regional`.

- Git: repositório `AlfredPennywhorth/piedade-agenda-regional`; branch de publicação **develop** depois do merge autorizado desta PR, ou branch específica da PR para pré-visualização.
- Root directory: raiz do repositório.
- Framework preset: None.
- Build command: `node tools/homologacao-stitch/build.mjs`.
- Build output directory: `dist-homologacao`.
- Node: 20+.

**Nunca reutilizar os nomes do projeto Pages de produção/Beta nem seus workflows.** O URL público só poderá ser informado após a Cloudflare criar o novo projeto e efetuar o primeiro deploy. Não é necessário Worker/D1, token de usuário ou qualquer segredo da Agenda.

## Critérios de QA

1. Abrir o índice no Chrome desktop e mobile.
2. Abrir HTML 007 mobile, 005 desktop, 006 mobile, 009 desktop, 013 mobile e 008 mobile.
3. Conferir que cada link abre o HTML **renderizado** em nova aba, sem depender de HTMLPreview.
4. Verificar tema/zoom e links em grupo.
5. Tratar imagens, textos, estados e comportamentos dos protótipos como **fictícios**; os originais não são código de produção.

**Segurança:** os arquivos são HTML de referência com scripts/CDNs de demonstração; não introduzir credenciais, cookies, autenticação ou dados pessoais no portal. Se necessário, proteger acesso na borda separadamente. A homologação só significa aceite de aparência sob ressalvas, não de código nem funcionalidade.
