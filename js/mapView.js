
'use strict';
import { el } from './ui.js';
import * as S from './state.js';

export function renderAxis(){
  if (!el.axisTop || !el.axisBottom || !el.axisLeft || !el.axisRight) return;

  el.axisTop.innerHTML = '';
  el.axisBottom.innerHTML = '';
  for (let c=0;c<S.cols;c++){
    const t=document.createElement('div');
    t.textContent=c+1;
    el.axisTop.appendChild(t);
    const b=t.cloneNode(true);
    el.axisBottom.appendChild(b);
  }

  el.axisLeft.innerHTML='';
  el.axisRight.innerHTML='';
  for (let r=0;r<S.rows;r++){
    const l=document.createElement('div');
    l.textContent=r+1;
    el.axisLeft.appendChild(l);
    const rr=l.cloneNode(true);
    el.axisRight.appendChild(rr);
  }
}

export function renderGrid(){
  if (!el.grid) return;
  el.grid.style.setProperty('--cols', S.cols);
  el.grid.style.setProperty('--rows', S.rows);
}

export function initGridInteraction(cb){
  if (!el.grid) return;
  el.grid.addEventListener('click', ()=>cb && cb());
}

export function initColumnDialog(){}
export function chooseColumn(){}
