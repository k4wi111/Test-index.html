// js/app.js
'use strict';

import { el, showNotification, updateUndoButton } from './ui.js';
import { debounce } from './utils.js';
import * as S from './state.js';
import { renderList, initListInteractions } from './listView.js';
import { renderAxis, renderGrid, initGridInteraction, initColumnDialog, chooseColumn } from './mapView.js';
import { renderStatsView } from './statsView.js';

let listQueued=false, gridQueued=false;

function scheduleRenderList(){
  if (listQueued) return;
  listQueued=true;
  requestAnimationFrame(()=>{ listQueued=false; renderList(); updateUndoButton(S.undoStack.length>0); });
}
function scheduleRenderGrid(){
  if (gridQueued) return;
  gridQueued=true;
  requestAnimationFrame(()=>{ gridQueued=false; renderGrid(); });
}
function scheduleRenderAll(){
  scheduleRenderList();
  if (el.viewMappa.style.display !== 'none') scheduleRenderGrid();
  if (el.viewStats.style.display !== 'none') renderStatsView();
}

function switchTab(view){
  const L=view==='lista', M=view==='mappa', Sx=view==='stats';
  el.viewLista.style.display = L?'':'none';
  el.viewMappa.style.display = M?'':'none';
  el.viewStats.style.display = Sx?'':'none';
  el.tabLista.classList.toggle('active',L);
  el.tabMappa.classList.toggle('active',M);
  el.tabStats.classList.toggle('active',Sx);
  if (M) scheduleRenderGrid();
  if (Sx) renderStatsView();
}

function clearForm(){ el.name.value=''; el.lot.value=''; el.expiry.value=''; }

function saveFromForm(){
  const name=el.name.value.trim(), lot=el.lot.value.trim(), expiryText=(el.expiry.value||'').trim();
  if (!name && !lot && !expiryText) return;
  S.saveToUndo();
  const p = { id:S.uid(), name, lot, expiryText, dateAdded:new Date().toISOString(), inPrelievo:false };
  S.products.unshift(p);
  S.logEvent('add', p);
  S.saveProducts(); S.saveEvents();
  clearForm();
  scheduleRenderAll();
}

let editTargetId=null;
function openEditDialog(id){
  const p = S.products.find(x=>x.id===id); if (!p) return;
  editTargetId=id;
  el.eName.value=p.name||''; el.eLot.value=p.lot||''; el.eExpiry.value=p.expiryText||'';
  try{ el.editDialog.showModal(); }catch(e){ el.editDialog.setAttribute('open',''); }
}
function initEditDialog(){
  el.eCancel.addEventListener('click', ()=>{ try{ el.editDialog.close(); }catch(e){} editTargetId=null; });
  el.eSave.addEventListener('click', ()=>{
    if (!editTargetId) return;
    const p = S.products.find(x=>x.id===editTargetId); if (!p) return;
    if (p.inPrelievo){ showNotification('Info','Prodotto in prelievo',false); return; }
    S.saveToUndo();
    p.name=el.eName.value.trim(); p.lot=el.eLot.value.trim(); p.expiryText=(el.eExpiry.value||'').trim();
    S.logEvent('edit', p);
    S.saveProducts(); S.saveEvents();
    try{ el.editDialog.close(); }catch(e){}
    editTargetId=null;
    scheduleRenderAll();
  });
}

function findFirstEmptyInColumn(col){
  for(let r=0;r<S.rows;r++){ if (!S.productAt(r,col)) return {r}; }
  return null;
}
function compactColumn(col){
  const colItems = S.products.filter(p=>!p.inPrelievo && Number.isInteger(p.col)&&p.col===col&&Number.isInteger(p.row)).sort((a,b)=>a.row-b.row);
  for(let i=0;i<colItems.length;i++){ colItems[i].row=i; colItems[i].col=col; }
  S.rebuildGridIndex(); S.saveProducts();
}

function exportJson(){
  try{
    const dataStr = JSON.stringify(S.products, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'magazzino-iosano.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch(e){
    showNotification('Errore','Esportazione non riuscita',false);
  }
}

function initImport(){
  el.importJsonFile.addEventListener('change', (event)=>{
    const file = (event.target.files && event.target.files.length) ? event.target.files[0] : null;
    if (!file) return;
    showNotification('Importazione','Sovrascrivere dati attuali?',true,()=>{
      const reader = new FileReader();
      reader.onload = (e) => {
        try{
          let txt = String(e.target.result || '');
          // rimuovi BOM + spazi strani
          txt = txt.replace(/^\uFEFF/, '').trim();
          const parsed = JSON.parse(txt);

          // accetta vari formati: array diretto, oppure {products:[...]}
          let arr = null;
          if (Array.isArray(parsed)) arr = parsed;
          else if (parsed && Array.isArray(parsed.products)) arr = parsed.products;
          else if (parsed && Array.isArray(parsed.items)) arr = parsed.items;

          if (arr){
            S.saveToUndo();
            S.products = S.normalizeProducts(arr);
            S.rebuildGridIndex();
            S.saveProducts();
            scheduleRenderAll();
            showNotification('Fatto','Dati importati.',false);
          } else {
            showNotification('Errore','Formato JSON valido ma struttura non riconosciuta (serve un elenco prodotti).',false);
          }
        }catch(err){
          showNotification('Errore','File JSON non valido.',false);
        }
      };
      reader.readAsText(file);
    });
    event.target.value='';
  });
}

function main(){
  S.initState();
  initColumnDialog();
  renderAxis();
  initGridInteraction(scheduleRenderAll);
  initEditDialog();

  initListInteractions({switchTab, openEditDialog, chooseColumn, findFirstEmptyInColumn, compactColumn, scheduleRenderAll});

  el.tabLista.addEventListener('click', ()=>switchTab('lista'));
  el.tabMappa.addEventListener('click', ()=>switchTab('mappa'));
  el.tabStats.addEventListener('click', ()=>switchTab('stats'));

  el.undoBtn.addEventListener('click', ()=>{
    const ok = S.undoLastAction();
    if (ok) scheduleRenderAll();
    updateUndoButton(S.undoStack.length>0);
  });

  el.clearBtn.addEventListener('click', clearForm);
  el.saveBtn.addEventListener('click', saveFromForm);

  el.search.addEventListener('input', debounce(()=>scheduleRenderList(),140));
  el.resetSearchBtn.addEventListener('click', ()=>{ el.search.value=''; scheduleRenderList(); });

  el.exportJsonBtn.addEventListener('click', exportJson);
  initImport();

  // PDF button left as-is but optional: show notice if missing library
  el.exportPdfBtn.addEventListener('click', ()=>showNotification('Info','PDF opzionale: aggiungi jspdf.umd.min.js nella root se lo vuoi.',false));

  scheduleRenderAll();
}
main();
