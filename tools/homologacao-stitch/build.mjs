import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const source = join(root, 'docs/11-ux-stitch/prototipos/lote-1');
const destination = join(root, 'apps/web/dist/homologacao-stitch');
const groups = [
  { title: 'Setores', folder: 'setores/unificados-em-avaliacao', files: [
    ['AGD-ADM-007-desktop-unificado.html','007 · Listagem desktop'],
    ['AGD-ADM-007-mobile-unificado.html','007 · Listagem mobile'],
    ['AGD-ADM-041-cadastro-unificado.html','041 · Cadastro'],
    ['AGD-ADM-042-edicao-unificado.html','042 · Edição']] },
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
let total = 0;
const panels = groups.map((group, index) => {
  const cards = group.files.map(([filename,label]) => {
    const src = join(source,group.folder,filename);
    if (!existsSync(src)) throw new Error('HTML ausente: '+src);
    const target = join(destination,'referencias',group.folder);
    mkdirSync(target,{recursive:true});
    cpSync(src,join(target,filename));
    total++;
    return '<a class="item" href="./referencias/'+group.folder+'/'+filename+'" target="_blank" rel="noopener noreferrer"><span>'+esc(label)+'</span><small>Abrir HTML ↗</small></a>';
  }).join('\n');
  return '<section id="grupo-'+index+'"><h2>'+esc(group.title)+'</h2><div class="items">'+cards+'</div></section>';
}).join('\n');
const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Homologação visual · Agenda Regional São Paulo</title><style>*{box-sizing:border-box}body{margin:0;background:#f1f5f9;color:#13253d;font:16px system-ui,-apple-system,Segoe UI,sans-serif}header{background:#102d55;color:white;padding:28px max(18px,calc((100vw - 1060px)/2))}h1{margin:0;font-size:clamp(1.4rem,3vw,2rem)}header p{opacity:.88;line-height:1.6}main{max-width:1100px;margin:26px auto;padding:0 18px 50px}nav{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:26px}nav a{background:white;padding:10px 13px;border-radius:8px;text-decoration:none;color:#102d55;border:1px solid #ced8e5}section{background:white;margin-bottom:22px;border:1px solid #dbe2ea;border-radius:12px;padding:18px}h2{font-size:1.15rem;margin:0 0 16px}.items{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.item{display:flex;justify-content:space-between;align-items:center;gap:8px;text-decoration:none;color:#102d55;border:1px solid #d9e0ea;border-radius:9px;padding:14px;min-height:66px}.item:hover,.item:focus-visible,nav a:focus-visible{outline:2px solid #2356b3;background:#eef5ff}.item small{white-space:nowrap;color:#345f9c}.notice{border-left:4px solid #3b82f6;padding:10px 16px;background:#e8f1fc;line-height:1.5;margin-bottom:25px}footer{font-size:.82rem;color:#506176;padding:0 0 20px}@media(max-width:500px){.items{grid-template-columns:1fr}.item{min-height:58px}}</style></head><body><header><h1>Homologação visual · Stitch</h1><p>Agenda Regional São Paulo — Lote 1 · '+total+' protótipos · Referências de avaliação (não são telas funcionais da Agenda)</p></header><main><div class="notice"><strong>Avaliação do Gate A.</strong> Clique em uma tela para abrir seu HTML em outra aba. Os dados e controles dos protótipos são demonstrativos. A aprovação visual não autoriza implementação, merge ou deploy da Agenda.</div><nav aria-label="Grupos">'+groups.map((g,i)=>'<a href="#grupo-'+i+'">'+esc(g.title)+'</a>').join('')+'</nav>'+panels+'<footer>Protótipos demonstrativos isolados · sem autenticação, dados reais nem conexão à API da Agenda.</footer></main></body></html>';
writeFileSync(join(destination,'index.html'),html);
const headersPath = join(root, 'apps/web/dist/_headers');
if (!existsSync(headersPath)) throw new Error('Headers globais ausentes no build do Vite');
const existingHeaders = readFileSync(headersPath, 'utf8');
const prototypeHeaders = '\n/homologacao-stitch/*\n  ! Content-Security-Policy\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Robots-Tag: noindex, nofollow\n/homologacao-stitch/referencias/*\n  Content-Security-Policy: sandbox allow-scripts allow-forms allow-popups\n';
writeFileSync(headersPath, existingHeaders.replace(/\s*$/, '\n') + prototypeHeaders);
console.log('Portal preparado: '+total+' HTMLs. Saída: apps/web/dist/homologacao-stitch');
