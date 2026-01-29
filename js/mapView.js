// js/mapView.js
'use strict';

import { el, showNotification, closeCellDialogSafely } from './ui.js';
import { rows, cols, products, productAt, countOccupied, commitProducts, saveToUndo, uid } from './state.js';
import { getExpiryStatus } from './utils.js';

function isValidColumn(col){
  return Number.isInteger(col) && col >= 0 && col < cols;
}

function compactColumnGrid(col){
  // Ricompone la colonna: nessun buco tra le righe (0..rows-1)
  if (!isValidColumn(col)) return;

  const items = products
    .filter(p => !p.inPrelievo && Number.isInteger(p.col) && p.col === col && Number.isInteger(p.row))
    .sort((a,b) => a.row - b.row);

  for (let i = 0; i < items.length; i++){
    if (i < rows){
      items[i].row = i;
      items[i].col = col;
    } else {
      // Se per qualunque motivo ci sono più prodotti della capacità della colonna,
      // evitiamo che restino "incastrati" fuori griglia.
      delete items[i].row;
      delete items[i].col;
    }
  }
}

function nextRowInColumn(col){
  if (!isValidColumn(col)) return rows;
  return products.filter(p => !p.inPrelievo && Number.isInteger(p.col) && p.col === col && Number.isInteger(p.row) && p.row >= 0 && p.row < rows).length;
}

let chooseResolve = null;

export function chooseColumn(){
  return new Promise((resolve) => {
    chooseResolve = resolve;
    if (!el.colSelect) return resolve(null);
    el.colSelect.textContent = '';
    for(let c=0;c<cols;c++){
      const opt = document.createElement('option');
      opt.value = String(c);
      opt.textContent = 'Colonna ' + (c+1);
      el.colSelect.appendChild(opt);
    }
    if (el.colDialog){
      try { el.colDialog.showModal(); } catch(e){ el.colDialog.setAttribute('open',''); }
    } else {
      resolve(null);
    }
  });
}

export function initColumnDialog(){
  if (el.colCancel){
    el.colCancel.addEventListener('click', () => {
      try{ el.colDialog?.close(); }catch(e){}
      if (chooseResolve){ chooseResolve(null); chooseResolve = null; }
    });
  }
  if (el.colOk){
    el.colOk.addEventListener('click', () => {
      const v = el.colSelect ? parseInt(el.colSelect.value, 10) : NaN;
      try{ el.colDialog?.close(); }catch(e){}
      if (chooseResolve){ chooseResolve(Number.isFinite(v)?v:null); chooseResolve = null; }
    });
  }
}

export function renderAxis(){
  if (!el.axisTop || !el.axisBottom || !el.axisLeft || !el.axisRight || !el.gridFrame) return;

  // CSS-driven grid: settiamo solo variabili
  el.gridFrame.style.setProperty('--cols', String(cols));
  el.gridFrame.style.setProperty('--rows', String(rows));

  el.axisTop.textContent = '';
  el.axisBottom.textContent = '';
  el.axisLeft.textContent = '';
  el.axisRight.textContent = '';

  const mk = (n) => {
    const d = document.createElement('div');
    d.className = 'axis-cell';
    d.textContent = String(n);
    return d;
  };

  for (let c = 1; c <= cols; c++){
    el.axisTop.appendChild(mk(c));
    el.axisBottom.appendChild(mk(c));
  }
  for (let r = 1; r <= rows; r++){
    el.axisLeft.appendChild(mk(r));
    el.axisRight.appendChild(mk(r));
  }
}

export function renderGrid(){
  if (!el.grid || !el.occupiedBadge || !el.gridFrame) return;

  el.gridFrame.style.setProperty('--cols', String(cols));
  el.gridFrame.style.setProperty('--rows', String(rows));

  el.grid.textContent = '';
  el.occupiedBadge.textContent = 'Occupate: ' + countOccupied();

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
          if (exp.cls==='skull') mark='☠️';
          else if (exp.cls==='red') mark='🔴';
          else if (exp.cls==='yellow') mark='🟡';
          else if (exp.cls==='green') mark='🟢';
        }
        lot.textContent = (p.lot||'') + (mark ? (' ' + mark) : '');
      }

      cell.appendChild(name);
      cell.appendChild(lot);
      el.grid.appendChild(cell);
    }
  }
}

export function initGridInteraction(scheduleRenderAll){
  if (!el.grid) return;
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
  if (!el.cellDialog || !el.cellTitle || !el.dName || !el.dLot || !el.dExpiry) return;

  el.cellTitle.textContent = `Cella R${r+1} C${c+1}`;
  el.dName.value = p ? (p.name || '') : '';
  el.dLot.value = p ? (p.lot || '') : '';
  el.dExpiry.value = p ? (p.expiryText || '') : '';

  const btnRow = el.cellDialog.querySelector('.row');
  if (!btnRow) return;
  btnRow.textContent = '';

  const saveBtn = mkBtn('Salva','alt',()=>{
    saveToUndo();

    if (!p){
      const name = el.dName.value.trim();
      const lot = el.dLot.value.trim();
      const expiryText = el.dExpiry.value.trim();
      if (!name && !lot && !expiryText) return;

      const newProd = { id: uid(), name, lot, expiryText, dateAdded: new Date().toISOString(), row: r, col: c, inPrelievo: false };
      products.unshift(newProd);
      commitProducts();
      scheduleRenderAll();
      closeCellDialogSafely();
      return;
    }

    // modifica
    p.name = el.dName.value.trim();
    p.lot = el.dLot.value.trim();
    p.expiryText = el.dExpiry.value.trim();
    commitProducts();
    scheduleRenderAll();
    closeCellDialogSafely();
  });
  btnRow.appendChild(saveBtn);

  if (p){
    btnRow.appendChild(mkBtn('Metti a scaffale','remove-grid',()=>{
      saveToUndo();
      const oldCol = p.col;
      delete p.row; delete p.col;
      if (isValidColumn(oldCol)) compactColumnGrid(oldCol);
      commitProducts();
      scheduleRenderAll();
      closeCellDialogSafely();
    }));

    btnRow.appendChild(mkBtn('Sposta in colonna','secondary',()=>{
      chooseColumn().then(col=>{
        if (col==null) return;
        const targetCol = Number(col);
        if (!isValidColumn(targetCol)) return;

        saveToUndo();

        const oldCol = p.col;

        // sgancia dalla colonna origine e compatta
        if (isValidColumn(oldCol) && Number.isInteger(p.row)){
          delete p.row; delete p.col;
          compactColumnGrid(oldCol);
        }

        // compatta colonna target e inserisci in fondo
        compactColumnGrid(targetCol);
        const rr = nextRowInColumn(targetCol);

        if (rr >= rows){
          showNotification('Colonna Piena','Non ci sono righe libere in questa colonna.',false);

          // ripristina: se ho una colonna origine, rimetto in fondo (se c'è spazio)
          if (isValidColumn(oldCol)){
            compactColumnGrid(oldCol);
            const back = nextRowInColumn(oldCol);
            if (back < rows){ p.col = oldCol; p.row = back; }
          }

          commitProducts();
          scheduleRenderAll();
          return;
        }

        p.col = targetCol;
        p.row = rr;
        commitProducts();
        scheduleRenderAll();
        closeCellDialogSafely();
      });
    }));

    btnRow.appendChild(mkBtn('Metti in prelievo','secondary',()=>{
      saveToUndo();
      const oldCol = p.col;
      p._prevRow = p.row; p._prevCol = p.col;
      delete p.row; delete p.col;
      p.inPrelievo = true;
      if (isValidColumn(oldCol)) compactColumnGrid(oldCol);
      commitProducts();
      scheduleRenderAll();
      closeCellDialogSafely();
    }));

    btnRow.appendChild(mkBtn('Elimina','danger',()=>{
      showNotification('Conferma','Eliminare prodotto?',true,()=>{
        saveToUndo();
        const oldCol = p.col;
        const idx = products.findIndex(x=>x.id===p.id);
        if (idx>=0) products.splice(idx,1);
        if (isValidColumn(oldCol)) compactColumnGrid(oldCol);
        commitProducts();
        scheduleRenderAll();
      });
      closeCellDialogSafely();
    }));
  }

  btnRow.appendChild(mkBtn('Annulla','ghost',()=>closeCellDialogSafely()));

  try{ el.cellDialog.showModal(); }catch(e){ el.cellDialog.setAttribute('open',''); }
}

function mkBtn(label, cls, fn){
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.onclick = fn;
  return b;
}
