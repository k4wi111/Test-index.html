// js/state.js
'use strict';

export const rows = 7;
export const cols = 10;

export const LS_KEY = "warehouse_products_v6";
export const LS_EVENTS_KEY = "warehouse_events_v1";

export let products = [];
export let events = [];
export let undoStack = [];
export let gridMap = new Map();
export let listFilter = 'all'; // "r,c" -> product id

export const keyRC = (r,c) => `${r},${c}`;

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

export function rebuildGridIndex(){
  gridMap = new Map();
  for (const p of products){
    if (p.inPrelievo) continue;
    if (Number.isInteger(p.row) && Number.isInteger(p.col)){
      gridMap.set(keyRC(p.row, p.col), p.id);
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
    rebuildGridIndex();
    saveProducts();
    saveEvents();
    return true;
  }
  return false;
}

export function initState(){
  products = normalizeProducts(loadProducts());
  events = loadEvents();
  rebuildGridIndex();
}
