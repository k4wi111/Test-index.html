// js/state.js
'use strict';

export const rows = 7;
export const cols = 10;

export const LS_KEY = "warehouse_products_v6";
export const LS_EVENTS_KEY = "warehouse_events_v1";

// UI state (in-memory)
export let listFilter = 'all'; // all | scaffale | terra | prelievo

export let products = [];
export let events = [];
export let undoStack = [];
export let gridMap = new Map(); // "r,c" -> product id

export const keyRC = (r,c) => `${r},${c}`;

export function setListFilter(value){
  const v = String(value || 'all');
  listFilter = (v === 'scaffale' || v === 'terra' || v === 'prelievo') ? v : 'all';
}

export function getListFilter(){
  return listFilter;
}

export function uid(){
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function deepClone(obj){
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

export function normalizeProducts(list){
  const out = [];
  for (const p of (Array.isArray(list)?list:[])){
    out.push({
      id: p.id || uid(),
      name: (p.name || '').toString(),
      lot: (p.lot || '').toString(),
      dateAdded: p.dateAdded || new Date().toISOString(),
      expiryText: (p.expiryText ?? p.expiry ?? '').toString(),
      row: Number.isInteger(p.row) ? p.row : undefined,
      col: Number.isInteger(p.col) ? p.col : undefined,
      inPrelievo: !!p.inPrelievo,
      _prevRow: Number.isInteger(p._prevRow) ? p._prevRow : undefined,
      _prevCol: Number.isInteger(p._prevCol) ? p._prevCol : undefined,
    });
  }
  out.sort((a,b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  return out;
}

export function loadProducts(){
  for(const key of ["warehouse_products_v6","warehouse_products_v5"]){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) continue;
      const data = JSON.parse(raw);
      if (Array.isArray(data)){
        localStorage.setItem(LS_KEY, JSON.stringify(data));
        return data;
      }
    }catch(e){}
  }
  return [];
}

export function saveProducts(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(products)); }catch(e){}
}

export function loadEvents(){
  try{
    const raw = localStorage.getItem(LS_EVENTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  }catch(e){ return []; }
}

export function saveEvents(){
  try{ localStorage.setItem(LS_EVENTS_KEY, JSON.stringify(events.slice(-5000))); }catch(e){}
}

export function logEvent(type, product){
  try{
    events.push({
      type,
      name: (product && product.name) ? String(product.name) : '',
      lot: (product && product.lot) ? String(product.lot) : '',
      expiryText: (product && product.expiryText) ? String(product.expiryText) : '',
      t: Date.now(),
      dateAdded: (product && product.dateAdded) ? String(product.dateAdded) : null
    });
    saveEvents();
  }catch(e){}
}

function isValidCell(r,c){
  return Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < rows && c >= 0 && c < cols;
}

// Sanifica posizioni fuori range e collisioni (2 prodotti stessa cella)
export function sanitizeGridPlacements(){
  const occupied = new Set();
  // products è già ordinato per dateAdded desc (più recente prima)
  for (const p of products){
    if (p.inPrelievo) continue;
    if (!isValidCell(p.row, p.col)){
      if (Number.isInteger(p.row)) delete p.row;
      if (Number.isInteger(p.col)) delete p.col;
      continue;
    }
    const k = keyRC(p.row, p.col);
    if (occupied.has(k)){
      // collisione: lasciamo la più recente in cella e togliamo la posizione alle altre
      delete p.row; delete p.col;
      continue;
    }
    occupied.add(k);
  }
}

export function rebuildGridIndex(){
  gridMap = new Map();
  for (const p of products){
    if (p.inPrelievo) continue;
    if (isValidCell(p.row, p.col)){
      const k = keyRC(p.row, p.col);
      // se ci fosse qualche collisione residua, manteniamo il primo che arriva (più recente)
      if (!gridMap.has(k)) gridMap.set(k, p.id);
    }
  }
}

export function productAt(r,c){
  const id = gridMap.get(keyRC(r,c));
  if (!id) return null;
  return products.find(p => p.id === id) || null;
}

export function countOccupied(){
  return gridMap.size;
}

// Commit atomico: prima sanifica, poi rebuild index, poi salva
export function commitProducts({saveEventsToo=false} = {}){
  try{ sanitizeGridPlacements(); }catch(e){}
  rebuildGridIndex();
  saveProducts();
  if (saveEventsToo) saveEvents();
}

export function saveToUndo(){
  try{
    undoStack.push({ state: deepClone(products), events: deepClone(events), t: Date.now() });
    if (undoStack.length > 10) undoStack.shift();
  }catch(e){}
}

export function undoLastAction(){
  if (!undoStack.length) return false;
  const last = undoStack.pop();
  if (last && last.state){
    products = deepClone(last.state);
    if (last.events) events = deepClone(last.events);
    commitProducts({saveEventsToo:true});
    return true;
  }
  return false;
}

export function initState(){
  products = normalizeProducts(loadProducts());
  events = loadEvents();
  commitProducts();
}
