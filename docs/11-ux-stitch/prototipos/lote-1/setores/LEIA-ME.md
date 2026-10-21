# Setores — protótipos com alternância integrada (prévia derivada)

Arquivos **-unificado.html** são DERIVAÇÕES para revisão visual e técnica. Os oito arquivos em `originais/` preservam as versões do Stitch efetivamente recebidas no repositório. Alguns uploads sofreram normalização de bytes (por exemplo, finais de linha); portanto, os hashes abaixo atestam os bytes versionados no GitHub, sem afirmar identidade byte a byte com os downloads anteriores ao upload.

## Operação
- Abrir cada `unificados-em-avaliacao/*-unificado.html` num navegador; o botão flutuante “Tema claro/escuro” alterna os dois temas NO MESMO HTML.
- O tema persiste no navegador via localStorage; sem permissão de armazenamento, o controle continua funcional na página aberta.
- Os quatro arquivos partilham o mesmo mecanismo, incluído em cada HTML para prévia independente. Nenhuma instalação é necessária; o Tailwind CDN e fontes externas dos originais exigem internet.
- Alterações de cor e ajustes de contraste usam CSS de sobreposição. O layout, os campos e scripts originais de referência foram mantidos da versão clara.
- A tela desktop 007 possui botão original de tema com lógica insuficiente; ele foi ocultado na versão derivada e substituído por controle único funcional.

## Limites importantes
- O resultado é uma PRÉVIA, não a implementação final React/Tailwind nem uma aprovação visual automática.
- Diferenças estruturais entre Stitch claro e escuro não são transferidas mecanicamente: a estrutura base é clara; cores escuras são aplicadas sobre ela.
- Conteúdo ilustrativo como setor, nome de usuário, versão, ambiente e opções não deve gerar novas regras de produto.
- No app definitivo: tokens de temas globais, identidade institucional e logotipo aprovado; cabeçalho azul #102D55; versão/build/ambiente dinâmicos SOMENTE no rodapé; evitar rolagem horizontal; não duplicar tema por tela.
- Não incluir variante defeituosa de edição com filtros duplicados.
- Esta PR propõe atualização documental em `develop` após aprovação; não altera `main`, banco ou deploy.

## Publicação proposta
Manter oito fontes em `originais/` e os quatro derivados exclusivamente em `unificados-em-avaliacao/`, sem cópias na raiz. `MANIFESTO-SHA256.json` relaciona caminhos, tamanhos e hashes SHA-256 dos bytes versionados no GitHub. Submeter PR documental à `develop` e aguardar CI/Codex e aprovação explícita de merge; Gate A integral continua aberto. O Gate A integral continua aberto.

## Diretriz do Product Owner — textos orientativos (19/10/2026)
- **Por enquanto, não apresentar textos orientativos ou explicativos nas telas da aplicação.** Orientações de uso devem ser concentradas exclusivamente no **Manual de Uso**.
- Eliminar na futura implementação descrições auxiliares, blocos de dicas, avisos tutoriais e parágrafos de explicação que não sejam indispensáveis à operação.
- Permanecem admitidos rótulos de campos, títulos, botões, indicações de obrigatoriedade, mensagens objetivas de validação/erro, confirmação de ação e informações operacionais estritamente necessárias; essas não constituem texto orientativo.
- Esta diretriz também se aplica às telas de Setores. Alguns HTMLs Stitch originais e derivados ainda contêm textos orientativos; **isso é dívida visual documentada, não autorização para reproduzi-los na aplicação**.
- **Preservação de evidências:** não alterar os oito originais nem os quatro derivados neste arquivamento documental. Remover esses textos somente de versões de implementação/revisão visual derivadas, após autorização específica do PO e nova validação.
