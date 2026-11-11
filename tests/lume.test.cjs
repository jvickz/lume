'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {parseDocument,htmlReport}=require('../web/lume.js');
const fixture=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/general.json'),'utf8'));
test('reopens general reading preserving notes and sources',()=>{
 const d=fixture();d.notes='Conferir a data antes de divulgar.';const r=parseDocument(JSON.stringify(d));
 assert.equal(r.notes,d.notes);assert.equal(r.summary.short[0].quote,d.summary.short[0].quote);
 assert.ok(r.summary.short.every(s=>r.pages[s.page-1].text.includes(s.quote)));
});
test('rejects forged quotes and invalid physical pages',()=>{
 for(const change of [d=>d.summary.short[0].quote='Informação que não está no documento.',d=>d.summary.short[0].page=99,d=>d.pages[0].number=4]){
  const d=fixture();change(d);assert.throws(()=>parseDocument(JSON.stringify(d)));
 }
});
test('rejects old specialist backup without changing its format',()=>{
 const d=fixture();d.schema_version='1.0';assert.throws(()=>parseDocument(JSON.stringify(d)),/versão Edital Claro/);
});
test('escapes imported text, file names and notes in HTML export',()=>{
 const d=fixture();d.filename='<script>alert(1)</script>.pdf';d.notes='<img src=x onerror=alert(1)>';
 const r=htmlReport(parseDocument(JSON.stringify(d)));
 assert.ok(!r.includes('<script>'));assert.ok(!r.includes('<img'));assert.ok(r.includes('&lt;img'));
});
test('rejects AI output with absent evidence on reimport',()=>{
 const d=fixture();d.ai={model:'test',limitation:'',items:[{category:'answer',text:'Resposta',sources:[]}]};
 assert.throws(()=>parseDocument(JSON.stringify(d)));
});
test('all static DOM ids used by Lume exist',()=>{
 const script=fs.readFileSync(path.join(__dirname,'../web/lume.js'),'utf8'),html=fs.readFileSync(path.join(__dirname,'../web/home.html'),'utf8');
 for(const [,id] of script.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes('id="'+id+'"'),id);
});

const vm=require('node:vm');
function ui(){
 class Element{
  constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.textContent='';this.attributes={};this.classList={toggle(){},add(){},remove(){}}}
  append(...items){this.children.push(...items)}
  replaceChildren(...items){this.children=[...items]}
  setAttribute(k,v){this.attributes[k]=v}
  addEventListener(){}
  focus(){}
  scrollIntoView(){}
  querySelector(tag){return this.children.find(e=>e.tag===tag)||null}
 }
 const elements=new Map(),storage=new Map(),doc=fixture();
 const context=vm.createContext({console,crypto:require('node:crypto').webcrypto,AbortController,setTimeout,clearTimeout,
  document:{getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)},createElement:t=>new Element(t),createTextNode:t=>({textContent:t})},
  window:{addEventListener(){}},confirm:()=>true,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  fetch:async url=>({ok:true,json:async()=>url.endsWith('capabilities')?{ai_configured:false}:doc})});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/lume.js'),'utf8'),context);
 return {elements,storage};
}
test('general demo opens, switches modes, saves notes and restores history',async()=>{
 const b=ui(),e=b.elements;
 await e.get('demo').onclick();
 assert.equal(e.get('reader').hidden,false);
 assert.ok(e.get('quotes').children.length);
 e.get('signalsTab').onclick();assert.ok(e.get('quotes').children.some(n=>n.textContent==='Datas mencionadas'));
 e.get('notes').value='Conferir com a equipe.';e.get('notes').oninput();
 e.get('save').onclick();
 assert.match([...b.storage.values()][0],/Conferir com a equipe/);
 e.get('newDoc').onclick();assert.equal(e.get('reader').hidden,true);
 e.get('history').children[0].children[0].onclick();
 assert.equal(e.get('notes').value,'Conferir com a equipe.');
 assert.equal(e.get('explain').disabled,true);
});
test('source button opens exact evidence with highlighting',async()=>{
 const {elements:e}=ui();await e.get('demo').onclick();
 const card=e.get('quotes').children[0],button=card.children.find(n=>n.tag==='button');
 button.onclick();
 assert.ok(e.get('source').children.some(n=>n.tag==='mark'));
});

