
'use strict';
import { el, refreshUI, checkUI, showNotification, updateUndoButton } from './ui.js';
import { debounce } from './utils.js';
import * as S from './state.js';
import { renderList, initListInteractions } from './listView.js';
import { renderAxis, renderGrid, initGridInteraction, initColumnDialog, chooseColumn } from './mapView.js';
import { renderStatsView } from './statsView.js';

let activeView = 'lista';

function scheduleRenderAll(){
  if (activeView === 'lista') renderList();
  if (activeView === 'mappa') renderGrid();
  if (activeView === 'stats') renderStatsView();
  updateUndoButton(S.undoStack.length > 0);
}

function switchTab(view){
  activeView = view;
  if (el.viewLista) el.viewLista.style.display = view === 'lista' ? '' : 'none';
  if (el.viewMappa) el.viewMappa.style.display = view === 'mappa' ? '' : 'none';
  if (el.viewStats) el.viewStats.style.display = view === 'stats' ? '' : 'none';
  scheduleRenderAll();
}

function initImport(){
  if (!el.importJsonFile) return;
  el.importJsonFile.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const parsed = JSON.parse(reader.result);
        const data = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.products)
            ? parsed.products
            : null;

        if (!data){
          showNotification('Errore', 'File JSON non valido', false);
          return;
        }
        S.saveToUndo();
        S.products = S.normalizeProducts(data);
        S.commitProducts({ saveEventsToo:true });
        showNotification('OK', 'Import completato', false);
        scheduleRenderAll();
      }catch(err){
        showNotification('Errore', 'File JSON non valido', false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

function main(){
  refreshUI();
  checkUI();
  S.initState();
  renderAxis();
  initColumnDialog();
  initGridInteraction(scheduleRenderAll);
  initImport();

  el.tabLista?.addEventListener('click', ()=>switchTab('lista'));
  el.tabMappa?.addEventListener('click', ()=>switchTab('mappa'));
  el.tabStats?.addEventListener('click', ()=>switchTab('stats'));

  switchTab('lista');
}

document.addEventListener('DOMContentLoaded', main, { once:true });
