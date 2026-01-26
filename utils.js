// js/utils.js
'use strict';

export const $ = (id) => document.getElementById(id);

export const debounce = (fn, wait=140) => {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

const EXP_MONTHS = { GEN:0,FEB:1,MAR:2,APR:3,MAG:4,GIU:5,LUG:6,AGO:7,SET:8,OTT:9,NOV:10,DIC:11 };

export function parseExpiryText(text){
  if(!text) return null;
  const m = String(text).toUpperCase().match(/(GEN|FEB|MAR|APR|MAG|GIU|LUG|AGO|SET|OTT|NOV|DIC)[\s\/-]?(\d{2})/);
  if(!m) return null;
  const year = 2000 + parseInt(m[2], 10);
  const month = EXP_MONTHS[m[1]];
  return new Date(year, month + 1, 0, 23,59,59);
}

export function getExpiryStatus(expiryText){
  const d = parseExpiryText(expiryText);
  if(!d) return null;
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (days < 0) return { cls:'skull', days, label:`☠️ Scaduto da ${Math.abs(days)}g` };
  if (days < 180) return { cls:'red', days, label:`🔴 Scad: ${expiryText} (${days}g)` };
  if (days < 270) return { cls:'yellow', days, label:`🟡 Scad: ${expiryText} (${days}g)` };
  return { cls:'green', days, label:`🟢 Scad: ${expiryText} (${days}g)` };
}

export function daysSinceISO(iso){
  const t = new Date(iso).getTime();
  if(!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t)/86400000));
}

export function parseLottoToDate(lotto, expiryText){
  if (!lotto) return null;
  const mDay = String(lotto).match(/^(\d{1,3})/);
  if (!mDay) return null;
  const dayOfYear = parseInt(mDay[1], 10);
  if (dayOfYear < 1 || dayOfYear > 366) return null;
  let year = null;
  const mYear = String(lotto).match(/\/(\d{2})/);
  if (mYear){
    year = 2000 + parseInt(mYear[1], 10);
  } else if (expiryText){
    const d = parseExpiryText(expiryText);
    if (d) year = d.getFullYear();
  }
  if (!year) return null;
  const date = new Date(year, 0, 1);
  date.setDate(dayOfYear);
  date.setHours(0,0,0,0);
  return date;
}

export function daysSinceProduction(p){
  const d = parseLottoToDate(p.lot, p.expiryText);
  if (!d) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

export function giacenzaStatus(days){
  if (days == null) return null;
  if (days > 180) return { cls:'red', label:`🔴 Giacenza: ${days}g` };
  if (days > 60)  return { cls:'yellow', label:`🟡 Giacenza: ${days}g` };
  return { cls:'green', label:`🟢 Giacenza: ${days}g` };
}
