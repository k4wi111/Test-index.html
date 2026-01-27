// js/mapView.js
'use strict';

import { el, showNotification, closeCellDialogSafely } from './ui.js';
import { rows, cols, products, productAt, countOccupied, rebuildGridIndex, saveProducts, saveToUndo } from './state.js';
import { getExpiryStatus } from './utils.js';

let chooseResolve = null;

export function chooseColumn(){
  return new Promise((resolve) => {
    chooseResolve = resolve;
    el.colSelect.textContent = '';
    for(let c=0;c<cols;c++){
      const opt = document.createElement('option');
      opt.value = String(c);
      opt.textContent = 'Colonna ' + (c+1);
      el.colSelect.appendChild(opt);
    }
    try { el.colDialog.showModal(); } catch(e){ el.colDialog.setAttribute('open',''); }
  });
}

export function initColumnDialog(){
  el.colCancel.addEventListener('click', () => {
    try{ el.colDialog.close(); }catch(e){}
    if (chooseResolve){ chooseResolve(null); chooseResolve = null; }
  });
  el.colOk.addEventListener('click', () => {
    const v = parseInt(el.colSelect.value, 10);
    try{ el.colDialog.close(); }catch(e){}
    if (chooseResolve){ chooseResolve(Number.isFinite(v)?v:null); chooseResolve = null; }
  });
}

export function renderAxis(){
  el.axisTop.style.gridTemplateColumns = `repeat(${cols}, var(--cell-w))`;
  el.axisBottom.style.gridTemplateColumns = `repeat(${cols}, var(--cell-w))`;
  el.axisTop.textContent=''; el.axisBottom.textContent=''; el.axisLeft.textContent=''; el.axisRight.textContent='';
  const mk=(n)=>{ const d=document.createElement('div'); d.className='axis-cell'; d.textContent=String(n); return d; };
  for(let c=1;c<=cols;c++){ el.axisTop.appendChild(mk(c)); el.axisBottom.appendChild(mk(c)); }
  for(let r=1;r<=rows;r++){ el.axisLeft.appendChild(mk(r)); el.axisRight.appendChild(mk(r)); }
}

export function renderGrid(){
  el.grid.textContent = '';
  el.grid.style.gridTemplateColumns = `repeat(${cols}, var(--cell-w))`;
  el.occupiedBadge.textContent = 'Occupate: ' + countOccupied();

  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const p = productAt(r,c);
      const cell = document.createElement('div');
      cell.className = 'cell' + (p ? ' occ' : '');
      cell.dataset.r = r;
      cell.dataset.c = c;

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = p ? p.name : '';

      const lot = document.createElement('div');
      lot.className = 'lot';
      if (p){
        const exp = getExpiryStatus(p.expiryText);
        let mark = '';
        if (exp){
          if (exp.cls==='skull') mark='☠️';
          else if (exp.cls==='red') mark='🔴';
          else if (exp.cls==='yellow') mark='🟡';
          else if (exp.cls==='green') mark='🟢';
        }
        lot.textContent = (p.lot||'') + ' ' + mark;
      }

      cell.appendChild(name);
      cell.appendChild(lot);
      el.grid.appendChild(cell);
    }
  }
}

export function initGridInteraction(scheduleRenderAll){
  el.grid.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const r = parseInt(cell.dataset.r,10);
    const c = parseInt(cell.dataset.c,10);
    const p = productAt(r,c);
    openCellDialog(r,c,p,scheduleRenderAll);
  });
}

function openCellDialog(r,c,p,scheduleRenderAll){
  el.cellTitle.textContent = `Cella R${r+1} C${c+1}`;
  el.dName.value = p ? p.name : '';
  el.dLot.value = p ? p.lot : '';
  el.dExpiry.value = p ? p.expiryText : '';

  const btnRow = el.cellDialog.querySelector('.row');
  btnRow.textContent = '';

  const saveBtn = mkBtn('Salva','alt',()=>{
    saveToUndo();
    if (!p){
      const name = el.dName.value.trim();
      const lot = el.dLot.value.trim();
      const expiryText = el.dExpiry.value.trim();
      if (!name && !lot && !expiryText) return;
      const newProd = { id: Math.random().toString(36).slice(2), name, lot, expiryText, dateAdded: new Date().toISOString(), row: r, col: c, inPrelievo: false };
      products.unshift(newProd);
      rebuildGridIndex(); saveProducts(); scheduleRenderAll(); closeCellDialogSafely(); return;
    }
    saveToUndo();
    p.name = el.dName.value.trim();
    p.lot = el.dLot.value.trim();
    p.expiryText = el.dExpiry.value.trim();
    rebuildGridIndex(); saveProducts(); scheduleRenderAll();
    closeCellDialogSafely();
  });
  btnRow.appendChild(saveBtn);

  if (p){
    btnRow.appendChild(mkBtn('Metti a scaffale','remove-grid',()=>{
      saveToUndo();
      delete p.row; delete p.col;
      rebuildGridIndex(); saveProducts(); scheduleRenderAll();
      closeCellDialogSafely();
    }));

    btnRow.appendChild(mkBtn('Sposta in colonna','secondary',()=>{
      chooseColumn().then(col=>{
        if(col==null) return;
        saveToUndo();
        p.col = col; p.row = 0;
        rebuildGridIndex(); saveProducts(); scheduleRenderAll();
        closeCellDialogSafely();
      });
    }));

    btnRow.appendChild(mkBtn('Metti in prelievo','secondary',()=>{
      saveToUndo();
      p._prevRow = p.row; p._prevCol = p.col;
      delete p.row; delete p.col;
      p.inPrelievo = true;
      rebuildGridIndex(); saveProducts(); scheduleRenderAll();
      closeCellDialogSafely();
    }));

    btnRow.appendChild(mkBtn('Elimina','danger',()=>{
      showNotification('Conferma','Eliminare prodotto?',true,()=>{
        saveToUndo();
        const idx = products.findIndex(x=>x.id===p.id);
        if(idx>=0) products.splice(idx,1);
        rebuildGridIndex(); saveProducts(); scheduleRenderAll();
      });
      closeCellDialogSafely();
    }));
  }

  btnRow.appendChild(mkBtn('Annulla','ghost',()=>closeCellDialogSafely()));

  try{ el.cellDialog.showModal(); }catch(e){ el.cellDialog.setAttribute('open',''); }
}

function mkBtn(label,cls,fn){
  const b=document.createElement('button');
  b.type='button';
  b.className=cls;
  b.textContent=label;
  b.onclick=fn;
  return b;
}
