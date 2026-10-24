# Stitch — Grupos de Trabalho: aceite visual condicionado

**Decisão expressa do PO — 16/10/2026.** O PO aprovou a aparência do último lote de **cinco propostas** com ressalvas. Os quatro prints anteriores enviados na conversa são **telas nativas da aplicação**, usadas como referência funcional — não são entregáveis produzidos pelo Stitch.

| Código canônico | Entrega | Decisão |
|---|---|---|
| `AGD-ADM-009` | Gestão de Grupos de Trabalho — desktop | Aceite visual condicionado |
| `AGD-ADM-009` | Gestão de Grupos de Trabalho — mobile | Aceite visual condicionado |
| `AGD-ADM-045` | Cadastrar Grupo | Aceite visual condicionado |
| `AGD-ADM-046` | Editar Grupo | Aceite visual condicionado |
| `AGD-ADM-047` | Detalhes do Grupo | Aceite visual condicionado |

## Critério do PO: separar conteúdo demonstrativo de interface nativa

> «Desconsidere as informações geradas que são de competência dos usuários cadastrarem. Só se as alucinações alterarem rótulos, títulos ou legendas nativas.»

- **Dados ilustrativos**, incluindo nomes inventados, códigos de registros, datas, contagens ou quantidades em exemplos do Stitch, **não bloqueiam o aceite estético** e jamais devem virar dados persistidos, seeds ou exigências funcionais.
- **Estrutura e semântica** não são dados ilustrativos: conferir rótulos, títulos, legendas, escolhas do filtro/Regional, formulários, status, permissões, opções de operação, mensagens institucionais e subfluxos contra os componentes reais. Eliminar opções inventadas «Regional: Interior», «Regional: Litoral», «Administrações Locais» e «Comissões Transitórias» quando alteram seleção/escopo.
- GTs são cadastrados vinculados à **Regional** (não a Administração ou Setor); preservar nome, Regional obrigatória e status ativo/inativo. Seletores de Regionais obtêm dados reais, nunca listas estáticas dos mockups; não introduzir fluxos de homologação.
- O produto continha como referência 11 GTs reais: Almoxarifado, Calamidades, Compras, Cozinhas/Reuniões, Doações Massivas, Fundo Musical, Orientações Sociais, Salas de Costura, Secretaria, Tesouraria e Voluntários. A aplicação deve carregar cadastros reais, não uma lista estática desses nomes; o número 11 refere-se à fotografia de referência, não limite ou regra de negócio.
- Manter ações Detalhes/Editar/Cadastrar apenas para capabilities autorizadas e validar a exibição dos códigos `009`, `045`, `046` e `047` sem criar códigos novos.
- Não copiar HTML/JS/CDN do Stitch. Exemplo de «salvar com sucesso» simulado não representa gravação real. Rever navegação, fechamento de modal, foco, feedback, estado vazio/erro/carregamento, responsividade sem rolagem horizontal, sem `user-scalable=no` e com textos completos.
- Cabeçalho institucional e navegação partilhados; versão/build/ambiente dinâmicos **só no rodapé**. Tema escuro reaproveita `DESIGN.md` e os primeiros protótipos dark mode do Stitch **sem duplicar protótipos individuais**.
- Proibir cruzes, crucifixos e ícones de templo/igreja com cruz.

## Fontes e rastreabilidade

Prints de origem (4 imagens) e **5 HTML posteriores** enviados na conversa do projeto em 16/10/2026. Arquivos recebidos, identificados como propostas:
- `Texto colado(20261016-123715).txt` — `AGD-ADM-009` desktop
- `Texto colado (4)(10).txt` — `AGD-ADM-009` mobile
- `Texto colado (5)(9).txt` — `AGD-ADM-045` cadastro
- `Texto colado (2)(20261016-123748).txt` — `AGD-ADM-046` edição
- `Texto colado (3)(20261016-123808).txt` — `AGD-ADM-047` detalhes

**Hashes SHA-256 conferidos:** as cinco propostas finais de GTs estão identificadas com SHA-256 dos bytes dos anexos no manifesto [`gate-a-lote-1-rastreabilidade.md`](./gate-a-lote-1-rastreabilidade.md), seção **Grupos de Trabalho: inventário da remessa final do Stitch**. Essa conferência identifica as cópias recebidas, mas **não** equivale ao arquivamento dos HTMLs originais no repositório.

**Pendente:** arquivar os cinco HTMLs originais e as capturas de referência em local versionado/imutável, e registrar as ligações de cada anexo com o respectivo commit/blob recuperável e seu hash. Os nomes acima **não significam** que os arquivos estejam presentes no repositório. Não afirmar Gate A concluído por este aceite.

**Limites:** nenhuma implementação, alteração funcional, mudança de banco, CI de aplicação, deploy ou merge autorizados por este documento. O lote 1 continua com Gate A integral aberto.

## Atualização do PO — 24/10/2026

O PO **aprovou os layouts das cinco telas de Grupos de Trabalho** (`AGD-ADM-009` desktop e mobile, `AGD-ADM-045`, `AGD-ADM-046` e `AGD-ADM-047`), preservadas as restrições de usar dados reais, funcionalidades existentes e logotipo institucional aprovado.

**Pendência visual expressa:** o catálogo apresenta somente uma versão dos cinco HTMLs de GT; **não estão disponíveis prévias escuras separadas**. O PO observou a mesma ausência nas telas de **Administrações** (`AGD-ADM-006`, `039`, `040`). Disponibilizar a visualização dos temas escuros para comparação, preferindo tokens compartilhados do design system em vez de duplicar implementação funcional; não inventar campos ou informações. Issue de acompanhamento específica criada no GitHub.

O aceite de layout **não constitui aceite final de tema escuro**, responsividade/QA, operações reais, implementação React nem deploy. Os protótipos originais devem permanecer preservados; qualquer derivação para teste deve ficar identificada como prévia.
