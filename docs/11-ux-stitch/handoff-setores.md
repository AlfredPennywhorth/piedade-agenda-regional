# Stitch — sublote Gestão Territorial / Setores

**Referência:** proposta Stitch revisada em 15/10/2026; aprovação **da direção visual** pelo PO, condicionada a cabeçalho com azul consistente e versão/ambiente/build no rodapé. Nenhum deploy ou código aprovado.

| Código oficial | Superfície | Dados e ações existentes nas capturas | Estado |
|---|---|---|---|
| `AGD-ADM-007` | Listagem | Título Gestão Territorial — Setores; filtros Regional/Administração; contagem; Nome, Administração, Código, Status, Detalhes e Editar; Novo Setor | Claro desktop/mobile e escuro desktop/mobile conceitualmente aprovados; QA pendente |
| `AGD-ADM-041` | Cadastro | Regional*, Administração*, Nome do Setor*, Código opcional, Setor Ativo, Cancelar/Salvar Setor | Direção visual clara/escura aprovada; mobile específico ainda deve ser validado |
| `AGD-ADM-042` | Edição | Mesmos campos de cadastro; Cancelar/Atualizar Setor | Direção visual clara/escura aprovada; descartar variante escura defeituosa que duplica filtros |

**Não transportar do HTML Stitch:** opções de Regionais/Administrações fictícias, códigos preenchidos artificialmente, regras de homologação/escalas, busca ou paginação não comprovadas, gráficos/mapas, alegações de sincronização, toasts de salvamento simulados. Usar APIs, dados reais e autorização existentes; apresentação condicional por perfil deve vir do código do produto.

**Mobile:** cards exibem Nome, Administração, Código, Status e ações Detalhes/Editar. Navegação inferior não deve encobrir último registro; não impedir zoom. O indicador verde de sincronização foi removido na última rodada.

**Pendências para Gate A final do sublote:** referência rastreável dos arquivos finais do Stitch, validação de layouts de cadastro/edição mobile, revisão de acessibilidade/contraste e confirmação do PO da versão final por código. Aceite desta direção visual não equivale ao Gate A do **lote 1 inteiro** (que inclui outras superfícies).

**Implementação futura (PR independente):** tema com tokens compartilhados; versão/build reais no rodapé; nenhum código funcional nesta etapa. Smoke Beta com perfis autorizados/não autorizados, filtros em cascata, CRUD, estados, acessibilidade, larguras 360/390/430/768/1280/1440 e modo claro/escuro/automático.
