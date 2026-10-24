import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const source = join(root, 'docs/11-ux-stitch/prototipos/lote-1');
const destination = join(root, 'apps/web/dist/homologacao-stitch');
const groups = [
  { title: 'Setores — referências originais (Gate A aberto)', folder: 'setores/originais/claro', files: [
    ['AGD-ADM-007-desktop.html','007 · Original claro · Desktop'],
    ['AGD-ADM-007-mobile.html','007 · Original claro · Mobile'],
    ['AGD-ADM-041-cadastro.html','041 · Original claro · Cadastro'],
    ['AGD-ADM-042-edicao.html','042 · Original claro · Edição']] },
  { title: 'Setores — originais escuros (comparação)', folder: 'setores/originais/escuro', files: [
    ['AGD-ADM-007-desktop.html','007 · Original escuro · Desktop'],
    ['AGD-ADM-007-mobile.html','007 · Original escuro · Mobile'],
    ['AGD-ADM-041-cadastro.html','041 · Original escuro · Cadastro'],
    ['AGD-ADM-042-edicao.html','042 · Original escuro · Edição (variante com ressalvas)']] },
  { title: 'Setores — derivações REPROVADAS (comparação apenas)', folder: 'setores/unificados-em-avaliacao', files: [
    ['AGD-ADM-007-desktop-unificado.html','007 · Derivado · Desktop · Não aprovado'],
    ['AGD-ADM-007-mobile-unificado.html','007 · Derivado · Mobile · Não aprovado'],
    ['AGD-ADM-041-cadastro-unificado.html','041 · Derivado · Cadastro · Não aprovado'],
    ['AGD-ADM-042-edicao-unificado.html','042 · Derivado · Edição · Não aprovado']] },
  { title: 'Regionais', folder: 'regionais-administracoes', files: [
    ['AGD-ADM-005-desktop.html','005 · Listagem desktop'],
    ['AGD-ADM-005-mobile.html','005 · Listagem mobile'],
    ['AGD-ADM-037-cadastro.html','037 · Cadastro'],
    ['AGD-ADM-038-edicao.html','038 · Edição']] },
  { title: 'Administrações', folder: 'regionais-administracoes', files: [
    ['AGD-ADM-006-desktop.html','006 · Listagem desktop'],
    ['AGD-ADM-006-mobile.html','006 · Listagem mobile'],
    ['AGD-ADM-039-cadastro.html','039 · Cadastro'],
    ['AGD-ADM-040-edicao.html','040 · Edição']] },
  { title: 'Grupos de Trabalho', folder: 'grupos-trabalho', files: [
    ['AGD-ADM-009-desktop.html','009 · Listagem desktop'],
    ['AGD-ADM-009-mobile.html','009 · Listagem mobile'],
    ['AGD-ADM-045-cadastro.html','045 · Cadastro'],
    ['AGD-ADM-046-edicao.html','046 · Edição'],
    ['AGD-ADM-047-detalhes.html','047 · Detalhes']] },
  { title: 'Locais e Espaços', folder: 'locais-espacos/originais', files: [
    ['AGD-ADM-013-listagem-desktop.html','013 · Listagem desktop'],
    ['AGD-ADM-013-listagem-mobile.html','013 · Listagem mobile'],
    ['AGD-ADM-055-novo-local.html','055 · Cadastro de Local'],
    ['AGD-ADM-056-editar-local.html','056 · Edição de Local'],
    ['AGD-ADM-057-detalhes-local.html','057 · Detalhes de Local'],
    ['AGD-ADM-058-espacos-do-local.html','058 · Espaços do Local']] },
  { title: 'Casas de Oração', folder: 'casas-de-oracao', files: [
    ['AGD-ADM-008-desktop.html','008 · Listagem desktop'],
    ['AGD-ADM-008-mobile.html','008 · Listagem mobile'],
    ['AGD-ADM-043-cadastro.html','043 · Cadastro'],
    ['AGD-ADM-044-edicao.html','044 · Edição']] },
];

if (!existsSync(source)) throw new Error('Referências Stitch não encontradas no repositório');
mkdirSync(destination, { recursive: true });
const esc = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
// Previa de contraste, nunca substitui a referencia original nem aprova o Gate A.
// Nao modifica HTMLs fonte, marcas/logotipos ou estrutura; aplica somente cores por CSS.
const darkPreviewCSS = `<style id="gate-a-dark-preview">
html,html body{color-scheme:dark}
body,[class~="bg-background"],[class~="bg-surface"]{background-color:#101827!important;color:#e9eef8!important}
[class~="bg-white"],[class~="bg-surface-container-lowest"],[class~="bg-surface-container-low"]{background-color:#1c283a!important}
[class~="bg-slate-50"],[class~="bg-gray-50"],[class~="bg-surface-container"],[class~="bg-surface-container-high"]{background-color:#263449!important}
[class~="bg-slate-100"],[class~="bg-gray-100"],[class~="bg-surface-container-highest"]{background-color:#31435a!important}
[class~="text-slate-900"],[class~="text-gray-900"],[class~="text-on-surface"],[class~="text-on-background"]{color:#eef3fc!important}
[class~="text-slate-800"],[class~="text-gray-800"],[class~="text-slate-700"],[class~="text-on-surface-variant"]{color:#dae3f0!important}
[class~="text-slate-600"],[class~="text-slate-500"],[class~="text-gray-600"],[class~="text-gray-500"]{color:#b3c4d9!important}
[class~="border-slate-200"],[class~="border-gray-200"],[class~="border-outline-variant"]{border-color:#506077!important}
input,select,textarea{background-color:#1c283a!important;color:#eef3fc!important;border-color:#62728b!important}
input::placeholder,textarea::placeholder{color:#aebed2!important}
</style>`;
// Ajustes EXCLUSIVOS das prévias ainda reprovadas. Grupos aprovados nao recebem estas regras.
const pendingDarkCSS = `<style id="gate-a-contrast-pending">
html,body{color-scheme:dark!important}
body{background:#101827!important;color:#f1f5ff!important}
main,section,article,aside,dialog,table,tbody,tr,form{color:inherit}
[class~="bg-white"],[class~="bg-surface-container-lowest"],[class~="bg-surface-container-low"],[class~="bg-gray-50"],[class~="bg-slate-50"]{background-color:#1b293b!important;color:#f1f5ff!important}
[class~="bg-surface-container"],[class~="bg-gray-100"],[class~="bg-slate-100"]{background-color:#26364a!important;color:#f1f5ff!important}
[class~="text-on-surface"],[class~="text-on-background"],[class~="text-slate-900"],[class~="text-gray-900"],[class~="text-slate-800"],[class~="text-gray-800"]{color:#f3f7ff!important}
[class~="text-on-surface-variant"],[class~="text-slate-600"],[class~="text-gray-600"],[class~="text-slate-500"],[class~="text-gray-500"]{color:#d3deed!important}
[class~="border-outline"],[class~="border-slate-200"],[class~="border-gray-200"]{border-color:#71839c!important}
input:not([type="checkbox"]):not([type="radio"]),select,textarea{background:#172538!important;color:#fff!important;border:1px solid #8193ac!important}
input::placeholder,textarea::placeholder{color:#c1cede!important}
button:disabled{opacity:.65}
a:not([class*="text-white"]){text-decoration-thickness:1px}
table th{color:#f3f7ff!important}
table td{color:#e4ebf8!important}
</style>`;
function needsContrastReview(group, filename) {
  return group.folder.startsWith('locais-espacos/') ||
    group.folder === 'casas-de-oracao' ||
    (group.folder === 'grupos-trabalho' && filename === 'AGD-ADM-047-detalhes.html');
}
// Correspondencia visual com a referencia Setores escura (somente GT, so na previa).
// Acoes primarias e Editar: azul; Detalhes: neutro. Estados hover preservados.
const gtButtonsCSS = `<style id="gate-a-gt-button-pattern">
button.bg-primary-container,button.bg-primary,button.bg-blue-600{background-color:#2563eb!important;color:#fff!important}
button.bg-primary-container:hover,button.bg-primary:hover,button.bg-blue-600:hover{background-color:#1d4ed8!important}
button.bg-surface-container-low{background-color:#1e293b!important;color:#e2e8f0!important}
button.bg-surface-container-low:hover{background-color:#334155!important;color:#fff!important}
button.bg-surface-container-high{background-color:#1e293b!important;color:#e2e8f0!important;border-color:#334155!important}
button.bg-surface-container-high:hover{background-color:#334155!important}
button:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}
button:disabled{opacity:.65}
</style>`;
function darkPreview(html, needsReview = false, groupFolder = '') {
  // O marcador e proposital: evita transmitir a impressao de que o tema ja foi homologado.
  const notice = '<div role="note" style="position:fixed;bottom:12px;left:12px;z-index:2147483647;background:#111827;color:white;padding:8px 12px;border:1px solid #64748b;border-radius:8px;font:12px system-ui;max-width:75vw">PRÉVIA ESCURA PARA AVALIAÇÃO · NÃO HOMOLOGADA</div>';
  return html.replace(/<\/head>/i, darkPreviewCSS+(needsReview ? pendingDarkCSS : '')+(groupFolder === 'grupos-trabalho' ? gtButtonsCSS : '')+'</head>').replace(/<\/body>/i,notice+'</body>');
}
let total = 0;
const panels = groups.map((group, index) => {
  const cards = group.files.map(([filename,label]) => {
    const src = join(source,group.folder,filename);
    if (!existsSync(src)) throw new Error('HTML ausente: '+src);
    const target = join(destination,'referencias',group.folder);
    mkdirSync(target,{recursive:true});
    cpSync(src,join(target,filename));
    total++;
    // Os originais de Setores ja possuem arquivos escuros proprios.
    const preview = !group.folder.startsWith('setores/');
    if (preview) {
      const darkName = filename.replace(/\.html$/i, '-previa-escura.html');
      writeFileSync(join(target,darkName),darkPreview(readFileSync(src,'utf8'),needsContrastReview(group,filename),group.folder));
      total++;
    }
    const baseCard = '<a class="item" href="./referencias/'+group.folder+'/'+filename+'" target="_blank" rel="noopener noreferrer"><span>'+esc(label)+'</span><small>Original ↗</small></a>';
    if (!preview) return baseCard;
    const darkName = filename.replace(/\.html$/i, '-previa-escura.html');
    return baseCard+'<a class="item" href="./referencias/'+group.folder+'/'+darkName+'" target="_blank" rel="noopener noreferrer"><span>'+esc(label)+' · Prévia escura NÃO homologada</span><small>Escuro ↗</small></a>';
  }).join('\n');
  return '<section id="grupo-'+index+'"><h2>'+esc(group.title)+'</h2><div class="items">'+cards+'</div></section>';
}).join('\n');
const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Homologação visual · Agenda Regional São Paulo</title><style>*{box-sizing:border-box}body{margin:0;background:#f1f5f9;color:#13253d;font:16px system-ui,-apple-system,Segoe UI,sans-serif}header{background:#102d55;color:white;padding:28px max(18px,calc((100vw - 1060px)/2))}h1{margin:0;font-size:clamp(1.4rem,3vw,2rem)}header p{opacity:.88;line-height:1.6}main{max-width:1100px;margin:26px auto;padding:0 18px 50px}nav{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:26px}nav a{background:white;padding:10px 13px;border-radius:8px;text-decoration:none;color:#102d55;border:1px solid #ced8e5}section{background:white;margin-bottom:22px;border:1px solid #dbe2ea;border-radius:12px;padding:18px}h2{font-size:1.15rem;margin:0 0 16px}.items{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.item{display:flex;justify-content:space-between;align-items:center;gap:8px;text-decoration:none;color:#102d55;border:1px solid #d9e0ea;border-radius:9px;padding:14px;min-height:66px}.item:hover,.item:focus-visible,nav a:focus-visible{outline:2px solid #2356b3;background:#eef5ff}.item small{white-space:nowrap;color:#345f9c}.notice{border-left:4px solid #3b82f6;padding:10px 16px;background:#e8f1fc;line-height:1.5;margin-bottom:25px}footer{font-size:.82rem;color:#506176;padding:0 0 20px}@media(max-width:500px){.items{grid-template-columns:1fr}.item{min-height:58px}}</style></head><body><header><h1>Homologação visual · Stitch</h1><p>Agenda Regional São Paulo — Lote 1 · '+total+' protótipos · Referências de avaliação (não são telas funcionais da Agenda)</p></header><main><div class="notice"><strong>Avaliação do Gate A.</strong> Clique em uma tela para abrir seu HTML em outra aba. Os dados e controles dos protótipos são demonstrativos. Setores: as versões unificadas foram REPROVADAS na avaliação de 24/10/2026; confrontar originais claros/escuros, que têm aprovação de direção visual CONDICIONADA, não aceite final. Nenhuma referência autoriza implementação, merge ou deploy da Agenda.</div><nav aria-label="Grupos">'+groups.map((g,i)=>'<a href="#grupo-'+i+'">'+esc(g.title)+'</a>').join('')+'</nav>'+panels+'<footer>Protótipos demonstrativos isolados · sem autenticação, dados reais nem conexão à API da Agenda.</footer></main></body></html>';
writeFileSync(join(destination,'index.html'),html);
const headersPath = join(root, 'apps/web/dist/_headers');
if (!existsSync(headersPath)) throw new Error('Headers globais ausentes no build do Vite');
const existingHeaders = readFileSync(headersPath, 'utf8');
const prototypeHeaders = '\n/homologacao-stitch/*\n  ! Content-Security-Policy\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Robots-Tag: noindex, nofollow\n/homologacao-stitch/referencias/*\n  Content-Security-Policy: sandbox allow-scripts allow-forms allow-popups\n';
writeFileSync(headersPath, existingHeaders.replace(/\s*$/, '\n') + prototypeHeaders);
console.log('Portal preparado: '+total+' HTMLs. Saída: apps/web/dist/homologacao-stitch');
