// js/statsView.js
'use strict';
import { el } from './ui.js';
import { products, events } from './state.js';
import { getExpiryStatus, daysSinceProduction, daysSinceISO } from './utils.js';

function top(type){
  const m = new Map();
  for (const ev of events){
    if (ev.type !== type) continue;
    const k = (ev.name||'').trim(); if (!k) continue;
    m.set(k, (m.get(k)||0)+1);
  }
  return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
}

function renderPairs(container, pairs){
  container.textContent='';
  if (!pairs.length){ const d=document.createElement('div'); d.className='muted'; d.textContent='—'; container.appendChild(d); return; }
  for (const [name,n] of pairs){
    const d=document.createElement('div'); d.className='muted'; d.style.padding='6px 0';
    d.textContent = `${name} • ${n}`;
    container.appendChild(d);
  }
}

function renderBucket(container, arr){
  container.textContent='';
  if (!arr.length){ const d=document.createElement('div'); d.className='muted'; d.textContent='—'; container.appendChild(d); return; }
  for (const p of arr.slice(0,12)){
    const d=document.createElement('div'); d.className='muted'; d.style.padding='6px 0';
    d.textContent = `${p.name||'(senza descrizione)'} • ${p.expiryText||'—'}`;
    container.appendChild(d);
  }
}

export function renderStatsView(){
  const total = products.length;
  const inPrel = products.filter(p=>p.inPrelievo).length;
  const placed = products.filter(p=>Number.isInteger(p.row)&&Number.isInteger(p.col)&&!p.inPrelievo).length;
  const unplaced = total - placed;

  if (el.statsSummary) el.statsSummary.textContent = `Totale: ${total} • A terra: ${placed} • A scaffale: ${unplaced} • In prelievo: ${inPrel}`;

  if (el.statsTopAdded) renderPairs(el.statsTopAdded, top('add'));
  if (el.statsTopRemoved) renderPairs(el.statsTopRemoved, top('remove'));

  const days = products.map(p => (daysSinceProduction(p) ?? daysSinceISO(p.dateAdded))).filter(x=>x!=null);
  const avg = days.length ? Math.round(days.reduce((a,b)=>a+b,0)/days.length) : null;
  if (el.statsAvgDwell) el.statsAvgDwell.textContent = avg!=null ? `Giacenza media stimata: ${avg} giorni` : 'Giacenza media stimata: —';

  const buckets = { skull:[], red:[], yellow:[], green:[] };
  for (const p of products){
    if (p.inPrelievo) continue;
    const s = getExpiryStatus(p.expiryText);
    if (!s) continue;
    buckets[s.cls].push(p);
  }
  if (el.statsListSkull) renderBucket(el.statsListSkull, buckets.skull);
  if (el.statsListRed) renderBucket(el.statsListRed, buckets.red);
  if (el.statsListYellow) renderBucket(el.statsListYellow, buckets.yellow);
  if (el.statsListGreen) renderBucket(el.statsListGreen, buckets.green);
}
