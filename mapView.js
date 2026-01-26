// js/mapView.js
'use strict';

import { el, showNotification, closeCellDialogSafely } from './ui.js';
import { rows, cols, products, productAt, countOccupied, rebuildGridIndex, saveProducts, saveToUndo, uid } from './state.js';
import { getExpiryStatus } from './utils.js';

let chooseResolve = null;

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

export function renderAxis(){
  el.axisTop.style.gridTemplateColumns = `repeat(${cols}, var(--cell-w))`;
  el.axisBottom.style.gridTemplateColumns = `repeat(${cols}, var(--cell-w))`;
  el.axisTop.textContent=''; el.axisBottom.textContent=''; el.axisLeft.textContent=''; el.axisRight.textContent='';
  const mk=(n)=>{ const d=document.createElement('div'); d.className='axis-cell'; d.textContent=String(n); return d; };
  const ft=document.createDocumentFragment(), fb=document.createDocumentFragment();
  for(let c=1;c<=cols;c++){ ft.appendChild(mk(c)); fb.appendChild(mk(c)); }
  el.axisTop.appendChild(ft); el.axisBottom.appendChild(fb);
  const fl=document.createDocumentFragment(), fr=document.createDocumentFragment();
  for(let r=1;r<=rows;r++){ fl.appendChild(mk(r)); fr.appendChild(mk(r)); }
  el.axisLeft.appendChild(fl); el.axisRight.appendChild(fr);
}

export function renderGrid(){
  el.grid.textContent = '';
  el.grid.style.gridTemplateColumns = `repeat(${cols}, var(--cell-w))`;
  el.occupiedBadge.textContent = 'Occupate: ' + countOccupied();

  const frag = document.createDocumentFragment();
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const p = productAt(r,c);
      const cell = document.createElement('div');
      cell.className = 'cell' + (p ? ' occ' : '');
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = p ? (p.name || '') : '';

      const lot = document.createElement('div');
      lot.className = 'lot';
      if (p){
        const exp = getExpiryStatus(p.expiryText);
        let mark = '';
        if (exp){
          if (exp.cls === 'skull') mark = ' ☠️';
          else if (exp.cls === 'red') mark = ' 🔴';
          else if (exp.cls === 'yellow') mark = ' 🟡';
          else if (exp.cls === 'green') mark = ' 🟢';
        }
        lot.textContent = (p.lot || '') + mark;
      }
      cell.appendChild(name);
      cell.appendChild(lot);
      frag.appendChild(cell);
    }
  }
  el.grid.appendChild(frag);
}

export function initGridInteraction(scheduleRenderAll){
  el.grid.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const r = parseInt(cell.dataset.r, 10);
    const c = parseInt(cell.dataset.c, 10);
    const p = productAt(r,c);
    openCellEditor(r,c,p, scheduleRenderAll);
  });
}

function openCellEditor(r,c,p, scheduleRenderAll){
  el.cellTitle.textContent = `Cella R${r+1} C${c+1}`;
  el.dName.value = p ? (p.name || '') : '';
  el.dLot.value  = p ? (p.lot  || '') : '';
  el.dExpiry.value = p ? (p.expiryText || '') : '';

  const buttonContainer = el.cellDialog.querySelector('.row');
  buttonContainer.textContent = '';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'alt';
  saveBtn.textContent = 'Salva';
  saveBtn.addEventListener('click', () => {
    const name = el.dName.value.trim();
    const lot  = el.dLot.value.trim();
    const expiryText = (el.dExpiry.value || '').trim();
    if (!name && !lot && !expiryText){ showNotification('Attenzione','Inserisci dati',false); return; }
    saveToUndo();

    if (p){
      if (p.inPrelievo){ showNotification('Info','Prodotto in prelievo',false); return; }
      p.name=name; p.lot=lot; p.expiryText=expiryText;
    } else {
      const newProd = { id: uid(), name, lot, expiryText, dateAdded: new Date().toISOString(), row:r, col:c, inPrelievo:false };
      products.unshift(newProd);
    }
    rebuildGridIndex();
    saveProducts();
    scheduleRenderAll();
    closeCellDialogSafely();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'ghost';
  cancelBtn.textContent = 'Annulla';
  cancelBtn.addEventListener('click', () => { try{ el.cellDialog.close(); }catch(e){} });

  buttonContainer.appendChild(saveBtn);

  buttonContainer.appendChild(cancelBtn);
  try { el.cellDialog.showModal(); } catch(e){ el.cellDialog.setAttribute('open',''); }
}
