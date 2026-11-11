'use strict';
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function parseDocument(contents){
 const fail=()=>{throw Error('Este JSON não é uma leitura válida do Lume. Para arquivos antigos, use o versão Edital Claro.')};
 let d;try{d=JSON.parse(contents)}catch{fail()}
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
 const str=(x,max)=>typeof x==='string'&&x.length<=max;
 if(!object(d)||d.schema_version!=='lume/1.0'||!str(d.filename,512)||!str(d.created_at,100)||!Array.isArray(d.pages)||!d.pages.length||d.pages.length>300)fail();
 let size=0;
 const pages=d.pages.map((p,i)=>{if(!object(p)||p.number!==i+1||!str(p.text,2000000))fail();size+=p.text.length;return {number:i+1,text:p.text}});
 if(size>2000000||d.page_count!==pages.length)fail();
 const source=s=>{
  if(!object(s)||!str(s.id,100)||!Number.isInteger(s.page)||s.page<1||s.page>pages.length||!str(s.quote,1200)||!s.quote||!pages[s.page-1].text.includes(s.quote))fail();
  return {id:s.id,page:s.page,quote:s.quote};
 };
 const group=(arr,max)=>{if(!Array.isArray(arr)||arr.length>max)fail();return arr.map(source)};
 if(!object(d.summary)||!object(d.signals)||!Array.isArray(d.warnings)||d.warnings.length>50||!d.warnings.every(x=>str(x,3000))||!Array.isArray(d.keywords)||d.keywords.length>10||!d.keywords.every(x=>str(x,100)))fail();
 const summary={short:group(d.summary.short,5),detailed:group(d.summary.detailed,12)};
 const signals={actions:group(d.signals.actions,12),dates:group(d.signals.dates,12)};
 const unreadable=pages.filter(p=>p.text.trim().length<20).map(p=>p.number);
 let ai=null;
 if(d.ai!=null){
  const a=d.ai;
  if(!object(a)||!str(a.model,120)||!str(a.limitation,1500)||!Array.isArray(a.items)||a.items.length>12)fail();
  ai={model:a.model,limitation:a.limitation,notice:'Explicação por IA reaberta do arquivo. Confira as referências.',items:a.items.map(i=>{
   if(!object(i)||!['overview','key_point','action','attention','answer'].includes(i.category)||!str(i.text,2000)||!i.text.trim()||!Array.isArray(i.sources)||!i.sources.length||i.sources.length>4)fail();
   return {category:i.category,text:i.text,sources:i.sources.map(source)};
  })};
 }
 if(d.notes!==undefined&&!str(d.notes,20000))fail();
 return {schema_version:'lume/1.0',filename:d.filename,created_at:d.created_at,method:'extractive-v1',page_count:pages.length,pages,summary,signals,
  warnings:d.warnings,keywords:d.keywords,demo:d.demo===true,unreadable_pages:unreadable,
  coverage:{readable_pages:pages.length-unreadable.length,total_pages:pages.length,selected_passages:summary.detailed.length,selected_pages:[...new Set(summary.detailed.map(s=>s.page))]},
  notes:d.notes||'',ai};
}
function htmlReport(doc){
 const q=s=>'<blockquote>'+escapeHtml(s.quote)+'<footer>Página '+s.page+'</footer></blockquote>';
 const section=(title,items)=>'<section><h2>'+title+'</h2>'+(items.length?items.map(q).join(''):'<p>Nenhum trecho selecionado. Isso não prova ausência do assunto.</p>')+'</section>';
 const ai=doc.ai?'<section><h2>Explicação por IA — conferir fontes</h2><p>'+escapeHtml(doc.ai.limitation)+'</p>'+doc.ai.items.map(i=>'<p>'+escapeHtml(i.text)+'</p>'+i.sources.map(q).join('')).join('')+'</section>':'';
 return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Lume — leitura do documento</title><style>body{font:15px/1.7 Arial;color:#26323a;max-width:880px;margin:40px auto;padding:24px}h1{font-size:36px}h2{font-size:20px}blockquote{border-left:3px solid #8ca4b3;padding-left:16px;white-space:pre-wrap;margin:20px 0}footer{font-size:12px;color:#5d6971}section{border-top:1px solid #ddd;margin-top:24px}p{white-space:pre-wrap}@media print{body{margin:0}blockquote{break-inside:avoid}}</style><h1>Lume</h1><p>'+escapeHtml(doc.filename)+(doc.demo?' — EXEMPLO FICTÍCIO':'')+'</p><p>Resumo por trechos originais. '+doc.page_count+' páginas físicas.</p><p>'+doc.warnings.map(escapeHtml).join('<br>')+'</p>'+section('Panorama detalhado',doc.summary.detailed)+section('Menções a ações — conferir contexto',doc.signals.actions)+section('Menções a datas — conferir contexto',doc.signals.dates)+ai+'<section><h2>Minhas anotações</h2><p>'+escapeHtml(doc.notes||'Sem anotações.')+'</p></section></html>';
}
if(typeof module!=='undefined'&&module.exports)module.exports={parseDocument,escapeHtml,htmlReport};
if(typeof document!=='undefined'){
 const $=id=>document.getElementById(id),KEY='lume-history-v1';
 let current=null,page=1,tab='short',busy=false,dirty=false,aiConfigured=false;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
 const status=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error)};
 const canLeave=()=>!dirty||confirm('Há anotações ou respostas não salvas. Deseja trocar de documento?');
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
 function history(){
  try{const items=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(items))return [];
   return items.slice(0,5).flatMap(item=>{try{const clean=parseDocument(JSON.stringify(item));if(typeof item.id!=='string'||item.id.length>80)return [];clean.id=item.id;return [clean]}catch{return []}});
  }catch{return []}
 }
 function renderHistory(){
  const items=history();$('historyCount').textContent=items.length;$('history').replaceChildren();
  items.forEach(item=>{const row=node('div',undefined,'history-row'),open=node('button',item.filename,'history-open'),remove=node('button','×','history-delete');
   open.title=item.filename;open.onclick=()=>{if(!busy&&canLeave())load(item)};
   remove.setAttribute('aria-label','Excluir '+item.filename);remove.onclick=()=>{
    if(busy||!confirm('Excluir esta leitura salva?'))return;
    try{localStorage.setItem(KEY,JSON.stringify(history().filter(x=>x.id!==item.id)));renderHistory()}catch{status('Não foi possível alterar o histórico.',true)}
   };row.append(open,remove);$('history').append(row);
  });
 }
 function load(data){
  current=parseDocument(JSON.stringify(data));current.id=data.id||crypto.randomUUID();dirty=false;page=1;
  $('welcome').hidden=true;$('reader').hidden=false;$('filename').textContent=current.filename;
  $('documentType').textContent=current.demo?'EXEMPLO FICTÍCIO · LEITURA GERAL':'LEITURA GERAL · TRECHOS COM FONTES';
  $('metadata').textContent=current.page_count+' páginas · '+(current.keywords.length?current.keywords.slice(0,5).join(' · '):'Texto insuficiente para identificar termos frequentes');
  $('warnings').replaceChildren(...current.warnings.map(w=>node('div',w)));
  $('pagesCount').textContent=current.coverage.readable_pages+' / '+current.page_count;
  $('quoteCount').textContent=current.summary.detailed.length;$('sourceCount').textContent=current.coverage.selected_pages.length;
  $('notes').value=current.notes;$('search').value='';$('question').value='';
  $('pageSelect').replaceChildren(...current.pages.map(p=>{const o=node('option','Página '+p.number);o.value=p.number;return o}));
  setTab('short');renderPage();renderAnswer();status('');
 }
 function sourceButton(s){
  const button=node('button','Conferir fonte · pág. '+s.page,'source-button');
  button.onclick=()=>{page=s.page;$('search').value='';renderPage(s.quote);$('source').focus({preventScroll:true});const mark=$('source').querySelector('mark');if(mark)mark.scrollIntoView({block:'nearest'});$('source').scrollIntoView({block:'nearest'})};return button;
 }
 function quote(s,label){
  const card=node('article',undefined,'quote-card');
  if(label)card.append(node('p',label,'quote-label'));
  card.append(node('p',s.quote),sourceButton(s));return card;
 }
 function setTab(value){
  tab=value;
  const names={short:'shortTab',detailed:'detailTab',signals:'signalsTab'};
  Object.entries(names).forEach(([key,id])=>{$(id).setAttribute('aria-selected',String(key===value));$(id).tabIndex=key===value?0:-1});
  $('readingPanel').setAttribute('aria-labelledby',names[value]);$('quotes').replaceChildren();
  $('readingHint').textContent=value==='signals'?'Menções encontradas por palavras e formatos. Podem incluir dispensas, negações e datas que não são prazos.':'Trechos selecionados automaticamente e mantidos nas palavras do documento. A seleção não cobre todo o conteúdo.';
  if(!current)return;
  if(value==='signals'){
   $('quotes').append(node('h2','Ações e orientações mencionadas'));
   const actions=current.signals.actions,dates=current.signals.dates;
   $('quotes').append(...(actions.length?actions.map(s=>quote(s,'CONFERIR CONTEXTO')):[node('p','Nenhuma menção identificada. Isso não garante ausência de ações.','empty')]));
   $('quotes').append(node('h2','Datas mencionadas'),...(dates.length?dates.map(s=>quote(s,'DATA NO DOCUMENTO')):[node('p','Nenhuma data identificada pelos formatos atuais.','empty')]));
  }else{
   const items=current.summary[value];
   $('quotes').append(...(items.length?items.map(s=>quote(s)):[node('p','Não há texto suficiente para selecionar trechos. Confira o PDF original.','empty')]));
  }
 }
 function renderPage(quoteText=''){
  if(!current)return;
  const text=current.pages[page-1].text,term=quoteText||$('search').value.trim(),source=$('source');
  $('pageSelect').value=page;$('pageLabel').textContent=page+' / '+current.page_count;
  $('prev').disabled=page<=1;$('next').disabled=page>=current.page_count;
  source.replaceChildren();
  // Literal case-sensitive highlighting keeps character offsets reliable in all scripts.
  if(!term)source.textContent=text||'Nenhum texto extraído desta página.';
  else{let start=0,at;while((at=text.indexOf(term,start))>=0){source.append(document.createTextNode(text.slice(start,at)),node('mark',text.slice(at,at+term.length)));start=at+term.length}source.append(document.createTextNode(text.slice(start)))}
  const search=$('search').value.trim(),matches=search?current.pages.filter(p=>p.text.includes(search)).map(p=>p.number):[];
  $('searchMeta').textContent=search?(matches.length?'Encontrado nas páginas: '+matches.join(', '):'Nenhuma ocorrência. A busca diferencia maiúsculas e minúsculas.'):'Use “Conferir fonte” para localizar o trecho.';
 }
 function renderAnswer(){
  $('answer').replaceChildren();if(!current?.ai)return;
  const a=current.ai;
  $('answer').append(node('p',a.notice||'Explicação por IA. Confira as referências.','micro'));
  const categories={overview:'VISÃO GERAL',key_point:'PONTO IMPORTANTE',action:'AÇÃO MENCIONADA',attention:'ATENÇÃO',answer:'RESPOSTA'};
  for(const item of a.items){
   const card=node('article',undefined,'quote-card');card.append(node('p',categories[item.category],'quote-label'),node('p',item.text));
   item.sources.forEach(s=>card.append(sourceButton(s)));$('answer').append(card);
  }
  $('answer').append(node('p',a.limitation||'A resposta se baseia em uma seleção de trechos, não na leitura integral.','micro'));
 }
 function updateAI(){
  $('explain').disabled=!aiConfigured||busy;$('ask').disabled=!aiConfigured||busy;$('question').disabled=!aiConfigured||busy;
 }
 async function request(url,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),70000);
  try{const res=await fetch(url,{...options,signal:controller.signal}),data=await res.json();if(!res.ok)throw Error(data.error||'Não foi possível concluir a operação.');return data}
  finally{clearTimeout(timer)}
 }
 async function run(action,message,replace=true){
  if(busy||(replace&&!canLeave()))return;
  busy=true;$('reader').inert=true;$('welcome').inert=true;$('newDoc').disabled=true;updateAI();status(message);
  try{const result=await action();if(replace)load(result);else{current.ai=result;dirty=true;renderAnswer();status('Explicação pronta. Confira as fontes antes de usar.')}}catch(e){status(e.name==='AbortError'?'A operação demorou demais. Tente novamente.':e.message||'Falha de comunicação.',true)}
  finally{busy=false;$('reader').inert=false;$('welcome').inert=false;$('newDoc').disabled=false;$('pdfInput').value='';updateAI()}
 }
 async function upload(file){
  if(!file)return;if(!/\.pdf$/i.test(file.name)||!file.size||file.size>20*1024*1024){status('Selecione um PDF não vazio de até 20 MiB.',true);return}
  await run(async()=>{const result=await request('/api/v1/documents/analyze',{method:'POST',headers:{'Content-Type':'application/pdf'},body:file});result.filename=file.name;return result},'Lendo o PDF e selecionando trechos com suas fontes.');
 }
 function explain(mode,question=''){
  if(!current||!aiConfigured)return;
  return run(()=>request('/api/v1/documents/explain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pages:current.pages.map(p=>p.text),mode,question})}),'A IA local está preparando uma explicação. Isso depende dos recursos do computador.',false);
 }
 function download(contents,type,name){
  const url=URL.createObjectURL(new Blob([contents],{type})),a=node('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 $('pdfInput').onchange=e=>upload(e.target.files[0]);$('demo').onclick=()=>run(()=>request('/api/v1/documents/demo'),'Abrindo um projeto fictício para experimentar.');
 $('newDoc').onclick=()=>{if(busy||!canLeave())return;current=null;dirty=false;$('reader').hidden=true;$('welcome').hidden=false;status('')};
 $('jsonInput').onchange=async e=>{
  const input=e.target,file=input.files[0];if(!file||busy)return;
  try{if(file.size>16*1024*1024)throw Error('Selecione um JSON de até 16 MiB.');const data=parseDocument(await file.text());if(!busy&&canLeave())load(data)}catch(err){status(err.message,true)}finally{input.value=''}
 };
 const tabs=['shortTab','detailTab','signalsTab'],values=['short','detailed','signals'];
 tabs.forEach((id,i)=>{$(id).onclick=()=>setTab(values[i]);$(id).onkeydown=e=>{
  let next=i;if(e.key==='ArrowRight')next=(i+1)%3;else if(e.key==='ArrowLeft')next=(i+2)%3;else if(e.key==='Home')next=0;else if(e.key==='End')next=2;else return;
  e.preventDefault();setTab(values[next]);$(tabs[next]).focus();
 }});
 $('notes').oninput=()=>{if(current){current.notes=$('notes').value;dirty=true}};
 $('explain').onclick=()=>explain(tab==='detailed'?'detailed':'quick');
 $('questionForm').onsubmit=e=>{e.preventDefault();const q=$('question').value.trim();if(q)explain('question',q)};
 $('pageSelect').onchange=()=>{page=Number($('pageSelect').value);renderPage()};
 $('prev').onclick=()=>{if(page>1){page--;renderPage()}};
 $('next').onclick=()=>{if(current&&page<current.page_count){page++;renderPage()}};
 $('search').oninput=()=>{if(!current)return;const q=$('search').value.trim();if(q){const p=current.pages.find(p=>p.text.includes(q));if(p)page=p.number}renderPage()};
 $('save').onclick=()=>{
  if(!current||busy)return;try{const items=history().filter(x=>x.id!==current.id);items.unshift(current);localStorage.setItem(KEY,JSON.stringify(items.slice(0,5)));dirty=false;renderHistory();status('Leitura salva neste navegador. São mantidas as cinco mais recentes; o PDF original não é armazenado.')}catch{status('Não foi possível salvar. Exporte o JSON para guardar sua leitura.',true)}
 };
 $('exportJson').onclick=()=>{if(current)download(JSON.stringify(current),'application/json','lume-leitura.json')};
 $('exportHtml').onclick=()=>{if(current)download(htmlReport(current),'text/html;charset=utf-8','lume-relatorio.html')};
 const zone=$('dropzone');
 ['dragenter','dragover'].forEach(t=>zone.addEventListener(t,e=>{e.preventDefault();zone.classList.add('dragging')}));
 ['dragleave','drop'].forEach(t=>zone.addEventListener(t,e=>{e.preventDefault();zone.classList.remove('dragging')}));
 zone.addEventListener('drop',e=>{if(!busy)upload(e.dataTransfer.files[0])});
 request('/api/v1/documents/capabilities').then(c=>{
  aiConfigured=c.ai_configured;$('aiState').textContent=aiConfigured?'IA configurada via Ollama. A conexão e o modelo serão conferidos ao solicitar a explicação.':'A leitura por trechos já funciona. Para explicações e perguntas, configure a IA local conforme o Guia de uso.';updateAI();
 }).catch(()=>{$('aiState').textContent='Não foi possível verificar a configuração da IA. A leitura básica continua disponível.';updateAI()});
 renderHistory();
}

