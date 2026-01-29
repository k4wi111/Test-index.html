// js/listView.js
'use strict';

import { el, showNotification } from './ui.js';
import { products, saveToUndo, commitProducts, getListFilter } from './state.js';
import { getExpiryStatus, daysSinceProduction, daysSinceISO, giacenzaStatus } from './utils.js';

export function makeBtn(cls, text, action, id){
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = text;
  b.dataset.action = action;
  b.dataset.id = id;
  return b;
}

function setEmptyState(message){
  if (!el.listEmptyState) return;
  if (!message){
    el.listEmptyState.style.display = 'none';
    el.listEmptyState.textContent = '';
    return;
  }
  el.listEmptyState.textContent = message;
  el.listEmptyState.style.display = '';
}

export function renderList(){
  if (!el.search || !el.listUnplaced || !el.listPlaced || !el.tpl) return;

  const q = (el.search.value || '').trim().toLowerCase();
  const f = getListFilter();

  const unplaced = [];
  const placed = [];

  for (const p of products){
    if (f==='prelievo' && !p.inPrelievo) continue;
    if (f==='terra' && (p.inPrelievo || !Number.isInteger(p.row))) continue;
    if (f==='scaffale' && (p.inPrelievo || Number.isInteger(p.row))) continue;

    if (q){
      const n = (p.name || '').toLowerCase();
      const l = (p.lot || '').toLowerCase();
      if (!n.includes(q) && !l.includes(q)) continue;
    }

    if (Number.isInteger(p.row) && Number.isInteger(p.col)) placed.push(p);
    else unplaced.push(p);
  }

  // Empty state globale (nessun prodotto / filtri senza risultati)
  if (!products.length){
    setEmptyState('Nessun prodotto presente. Inserisci il primo prodotto con il form qui sopra.');
  } else if (!unplaced.length && !placed.length){
    const label = f === 'all' ? 'con questi filtri' : `nel filtro "${f}"`;
    setEmptyState(`Nessun risultato ${label}. Prova a cambiare filtro o a svuotare la ricerca.`);
  } else {
    setEmptyState('');
  }

  el.listUnplaced.textContent = '';
  el.listPlaced.textContent = '';

  const buildFrag = (arr, isPlaced) => {
    const frag = document.createDocumentFragment();
    for (const p of arr) frag.appendChild(buildItem(p, isPlaced));
    return frag;
  };

  if (!unplaced.length){
    const d = document.createElement('div');
    d.className='muted';
    d.style.padding='20px';
    d.style.textAlign='center';
    d.style.fontStyle='italic';
    d.textContent = f === 'scaffale'
      ? 'Nessun prodotto a scaffale (secondo i filtri attuali).'
      : 'Nessun prodotto in attesa di posizionamento.';
    el.listUnplaced.appendChild(d);
  } else {
    el.listUnplaced.appendChild(buildFrag(unplaced,false));
  }

  if (!placed.length){
    const d = document.createElement('div');
    d.className='muted';
    d.style.padding='20px';
    d.style.textAlign='center';
    d.style.fontStyle='italic';
    d.textContent = f === 'terra'
      ? 'Nessun prodotto a terra (secondo i filtri attuali).'
      : 'Il magazzino è vuoto.';
    el.listPlaced.appendChild(d);
  } else {
    el.listPlaced.appendChild(buildFrag(placed,true));
  }
}

function buildItem(p, isPlaced){
  const node = el.tpl.content.firstElementChild.cloneNode(true);
  node.querySelector('.abbr').textContent = p.name || '(senza descrizione)';

  const detail = node.querySelector('[data-detail]');
  detail.textContent = '🏷️ ' + (p.lot || '—');
  if (isPlaced){
    detail.innerHTML = `🏷️ ${(p.lot||'—')} <span style="margin-left:8px; color:#667eea; font-weight:700">📍 R${p.row+1} C${p.col+1}</span>`;
  }
  if (p.inPrelievo){
    detail.innerHTML += ` <span class="pill-prel">IN PRELIEVO</span>`;
  }

  const meta = document.createElement('div');
  meta.className='smallmeta';
  meta.textContent = 'Inserito: ' + new Date(p.dateAdded).toLocaleDateString('it-IT');
  node.querySelector('div[style="min-width:0"]').appendChild(meta);

  const tagsWrap = document.createElement('div');
  tagsWrap.className='tagline';

  const exp = getExpiryStatus(p.expiryText);
  if (p.expiryText && exp){
    const t=document.createElement('div');
    t.className='tag '+exp.cls;
    t.textContent=exp.label;
    tagsWrap.appendChild(t);
  }

  const gDays = (daysSinceProduction(p) ?? daysSinceISO(p.dateAdded));
  const g = giacenzaStatus(gDays);
  if (g){
    const t2=document.createElement('div');
    t2.className='tag '+g.cls;
    t2.textContent=g.label;
    tagsWrap.appendChild(t2);
  }

  if (tagsWrap.childNodes.length) node.querySelector('div[style="min-width:0"]').appendChild(tagsWrap);

  const btns = node.querySelector('[data-btns]');
  btns.appendChild(makeBtn('secondary','Modifica','edit',p.id));
  if (!p.inPrelievo) btns.appendChild(makeBtn('secondary','Metti in prelievo','prel',p.id));
  if (p.inPrelievo) btns.appendChild(makeBtn('remove-grid','Completa prelievo','prel_done',p.id));
  if (isPlaced){
    btns.appendChild(makeBtn('remove-grid','Metti a scaffale','unplace',p.id));
    btns.appendChild(makeBtn('go-to-map','Mappa','map',p.id));
  } else {
    btns.appendChild(makeBtn('add-grid','Posiziona a terra','place',p.id));
  }
  btns.appendChild(makeBtn('danger','Elimina','del',p.id));
  return node;
}

export function initListInteractions({switchTab, openEditDialog, chooseColumn, findFirstEmptyInColumn, compactColumn, scheduleRenderAll}){
  if (!el.listUnplaced || !el.listPlaced) return;

  function onClick(e){
    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const p = products.find(x => x.id === id);
    if (!p) return;

    if (action === 'map'){ switchTab('mappa'); return; }
    if (action === 'edit'){ openEditDialog(id); return; }

    if (action === 'prel'){
      const name = (p.name||'').trim();
      if (products.some(x => x!==p && (x.name||'').trim()===name && x.inPrelievo)){
        showNotification('Info','Prodotto già in prelievo',true);
        return;
      }
      saveToUndo();
      if (Number.isInteger(p.row) && Number.isInteger(p.col)){
        p._prevRow = p.row;
        p._prevCol = p.col;
        delete p.row; delete p.col;
      }
      p.inPrelievo = true;
      commitProducts();
      scheduleRenderAll();
      return;
    }

    if (action === 'prel_done'){
      saveToUndo();
      p.inPrelievo = false;
      if (Number.isInteger(p._prevRow) && Number.isInteger(p._prevCol)){
        p.row = p._prevRow;
        p.col = p._prevCol;
        delete p._prevRow; delete p._prevCol;
      }
      commitProducts();
      scheduleRenderAll();
      return;
    }

    if (action === 'unplace'){
      if (p.inPrelievo) return;
      saveToUndo();
      const oldCol = p.col;
      delete p.row; delete p.col;
      if (Number.isInteger(oldCol)) compactColumn(oldCol);
      commitProducts();
      scheduleRenderAll();
      return;
    }

    if (action === 'place'){
      if (p.inPrelievo) return;
      chooseColumn().then((col)=>{
        if (col==null) return;
        const spot = findFirstEmptyInColumn(col);
        if (!spot){
          showNotification('Colonna Piena',"Scegli un'altra colonna.",false);
          return;
        }
        saveToUndo();
        p.row = spot.r;
        p.col = col;
        commitProducts();
        scheduleRenderAll();
      });
      return;
    }

    if (action === 'del'){
      showNotification('Conferma','Eliminare questo prodotto?',true,()=>{
        saveToUndo();
        const oldCol = p.col;
        const idx = products.findIndex(x => x.id === id);
        if (idx>=0) products.splice(idx,1);
        if (Number.isInteger(oldCol)) compactColumn(oldCol);
        commitProducts();
        scheduleRenderAll();
      });
      return;
    }
  }

  el.listUnplaced.addEventListener('click', onClick);
  el.listPlaced.addEventListener('click', onClick);
}
