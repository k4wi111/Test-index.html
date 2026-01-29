// js/app.js
'use strict';

import { el, refreshUI, checkUI, showNotification, updateUndoButton } from './ui.js';
import { debounce } from './utils.js';
import * as S from './state.js';
import { renderList, initListInteractions } from './listView.js';
import { renderAxis, renderGrid, initGridInteraction, initColumnDialog, chooseColumn } from './mapView.js';
import { renderStatsView } from './statsView.js';

let listQueued = false;
let gridQueued = false;

// Track which view is active to avoid unnecessary renders
let activeView = 'lista'; // 'lista' | 'mappa' | 'stats'

function safeDisplay(node, show){
  if (!node) return;
  node.style.display = show ? '' : 'none';
}
function safeActive(node, on){
  if (!node) return;
  node.classList.toggle('active', !!on);
}

function scheduleRenderList(){
  if (listQueued) return;
  listQueued = true;
  requestAnimationFrame(() => {
    listQueued = false;
    try { renderList(); } catch(e){ console.error('[IO Sano] renderList error:', e); }
    updateUndoButton(S.undoStack.length > 0);
  });
}

function scheduleRenderGrid(){
  if (gridQueued) return;
  gridQueued = true;
  requestAnimationFrame(() => {
    gridQueued = false;
    try { renderGrid(); } catch(e){ console.error('[IO Sano] renderGrid error:', e); }
  });
}

function scheduleRenderAll(){
  // render only what is visible
  if (activeView === 'lista') scheduleRenderList();
  if (activeView === 'mappa') scheduleRenderGrid();
  if (activeView === 'stats') {
    try { renderStatsView(); } catch(e){ console.error('[IO Sano] renderStatsView error:', e); }
  }
}

function switchTab(view){
  activeView = view;
  const L = view === 'lista';
  const M = view === 'mappa';
  const Sx = view === 'stats';

  safeDisplay(el.viewLista, L);
  safeDisplay(el.viewMappa, M);
  safeDisplay(el.viewStats, Sx);

  safeActive(el.tabLista, L);
  safeActive(el.tabMappa, M);
  safeActive(el.tabStats, Sx);

  console.log('[IO Sano] switchTab ->', view);

  if (M) scheduleRenderGrid();
  if (Sx) {
    try { renderStatsView(); } catch(e){ console.error('[IO Sano] renderStatsView error:', e); }
  }
}

function clearForm(){
  if (el.name) el.name.value = '';
  if (el.lot) el.lot.value = '';
  if (el.expiry) el.expiry.value = '';
}

function saveFromForm(){
  const name = (el.name?.value || '').trim();
  const lot = (el.lot?.value || '').trim();
  const expiryText = (el.expiry?.value || '').trim();
  if (!name && !lot && !expiryText) return;

  S.saveToUndo();
  const p = {
    id: S.uid(),
    name, lot, expiryText,
    dateAdded: new Date().toISOString(),
    inPrelievo: false
  };
  S.products.unshift(p);
  S.logEvent('add', p);

  // atomic commit
  S.commitProducts({ saveEventsToo: true });

  clearForm();
  scheduleRenderAll();
}

let editTargetId = null;

function openEditDialog(id){
  const p = S.products.find(x => x.id === id);
  if (!p || !el.editDialog) return;

  editTargetId = id;
  if (el.eName) el.eName.value = p.name || '';
  if (el.eLot) el.eLot.value = p.lot || '';
  if (el.eExpiry) el.eExpiry.value = p.expiryText || '';

  try { el.editDialog.showModal(); } catch(e){
    // fallback
    el.editDialog.setAttribute('open','');
  }
}

function initEditDialog(){
  if (!el.editDialog) return;

  el.eCancel?.addEventListener('click', () => {
    try { el.editDialog.close(); } catch(e){}
    editTargetId = null;
  });

  el.eSave?.addEventListener('click', () => {
    if (!editTargetId) return;
    const p = S.products.find(x => x.id === editTargetId);
    if (!p) return;

    S.saveToUndo();
    p.name = (el.eName?.value || '').trim();
    p.lot = (el.eLot?.value || '').trim();
    p.expiryText = (el.eExpiry?.value || '').trim();
    S.logEvent('edit', p);

    S.commitProducts({ saveEventsToo: true });

    try { el.editDialog.close(); } catch(e){}
    editTargetId = null;
    scheduleRenderAll();
  });
}

function findFirstEmptyInColumn(col){
  for (let r = 0; r < S.rows; r++){
    if (!S.productAt(r, col)) return { r };
  }
  return null;
}

function compactColumn(col){
  // keep as utility used by map/list interactions
  const colItems = S.products
    .filter(p => !p.inPrelievo && Number.isInteger(p.col) && p.col === col && Number.isInteger(p.row))
    .sort((a,b) => a.row - b.row);

  for (let i = 0; i < colItems.length; i++){
    colItems[i].row = i;
    colItems[i].col = col;
  }

  S.commitProducts();
}

function exportJson(){
  const dataStr = JSON.stringify(S.products, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `magazzino-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function initImport(){
  if (!el.importJsonFile) return;

  el.importJsonFile.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try{
        const parsed = JSON.parse(String(reader.result || '[]'));
        if (!Array.isArray(parsed)) {
          showNotification('Errore', 'Formato file non valido.', false);
          return;
        }

        S.saveToUndo();
        S.products = S.normalizeProducts(parsed);
        S.commitProducts({ saveEventsToo: true });

        showNotification('Fatto', 'Dati importati.', false);
        scheduleRenderAll();
      }catch(err){
        showNotification('Errore', 'File JSON non valido.', false);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  });
}

// Retry init map interaction if DOM refs are not ready (common when SW served mixed versions)
function initMapInteractionWithRetry({ tries = 20, delayMs = 100 } = {}){
  let attempt = 0;

  const run = () => {
    attempt++;
    refreshUI();

    if (!el.grid) {
      console.warn(`[IO Sano] initGridInteraction: el.grid is null (attempt ${attempt}/${tries}).`);
      if (attempt < tries) return setTimeout(run, delayMs);
      console.error('[IO Sano] initGridInteraction failed: grid element not found.');
      return;
    }

    try{
      initGridInteraction(scheduleRenderAll);
      console.log('[IO Sano] initGridInteraction OK');
    }catch(e){
      console.error('[IO Sano] initGridInteraction error:', e);
    }
  };

  run();
}

function wireTabs(){
  el.tabLista?.addEventListener('click', () => {
    console.log('[IO Sano] click tab Lista');
    switchTab('lista');
  });

  el.tabMappa?.addEventListener('click', () => {
    console.log('[IO Sano] click tab Mappa');
    switchTab('mappa');
  });

  el.tabStats?.addEventListener('click', () => {
    console.log('[IO Sano] click tab Statistiche');
    switchTab('stats');
  });
}

function wireCoreButtons(){
  el.undoBtn?.addEventListener('click', () => {
    console.log('[IO Sano] click Undo');
    const ok = S.undoLastAction();
    if (ok) scheduleRenderAll();
    updateUndoButton(S.undoStack.length > 0);
  });

  el.clearBtn?.addEventListener('click', clearForm);
  el.saveBtn?.addEventListener('click', saveFromForm);

  // Enter key on inputs
  const onEnter = (ev) => {
    if (ev.key === 'Enter') saveFromForm();
  };
  el.name?.addEventListener('keydown', onEnter);
  el.lot?.addEventListener('keydown', onEnter);
  el.expiry?.addEventListener('keydown', onEnter);

  // Search debounce
  if (el.search){
    const onSearch = debounce(() => scheduleRenderList(), 120);
    el.search.addEventListener('input', onSearch);
  }
  el.resetSearchBtn?.addEventListener('click', () => {
    if (el.search) el.search.value = '';
    scheduleRenderList();
  });

  el.exportJsonBtn?.addEventListener('click', exportJson);
  initImport();

  // PDF (optional)
  el.exportPdfBtn?.addEventListener('click', () => {
    showNotification('Info', 'Export PDF opzionale: integra una libreria come jsPDF se ti serve.', false);
  });

  // Filter buttons (centralized state)
  document.querySelectorAll('[data-list-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      console.log('[IO Sano] click filter:', btn.dataset.listFilter);
      document.querySelectorAll('[data-list-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      S.setListFilter(btn.dataset.listFilter);
      scheduleRenderList();
    });
  });
}

function main(){
  console.log('[IO Sano] main() starting...');
  refreshUI();
  checkUI();

  // Init state + core views
  S.initState();

  try{
    initColumnDialog();
    renderAxis();
  }catch(e){
    console.error('[IO Sano] map init (axis/col dialog) error:', e);
  }

  initMapInteractionWithRetry();

  // Init edit dialog + list interactions
  initEditDialog();

  try{
    initListInteractions({
      switchTab,
      openEditDialog,
      chooseColumn,
      findFirstEmptyInColumn,
      compactColumn,
      scheduleRenderAll
    });
  }catch(e){
    console.error('[IO Sano] initListInteractions error:', e);
  }

  wireTabs();
  wireCoreButtons();

  // Default tab
  switchTab('lista');
  scheduleRenderAll();

  console.log('[IO Sano] main() ready');
}

// Run only when DOM is ready
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[IO Sano] DOMContentLoaded');
    main();
  }, { once:true });
} else {
  // already ready
  main();
}
