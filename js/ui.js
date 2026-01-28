// js/ui.js
'use strict';

import { $ } from './utils.js';

export const el = {
  undoBtn: $('undoBtn'),
  tabLista: $('tab-lista'),
  tabMappa: $('tab-mappa'),
  tabStats: $('tab-stats'),
  viewLista: $('view-lista'),
  viewMappa: $('view-mappa'),
  viewStats: $('view-stats'),

  name: $('name'),
  lot: $('lot'),
  expiry: $('expiry'),
  clearBtn: $('clearBtn'),
  saveBtn: $('saveBtn'),

  search: $('search'),
  resetSearchBtn: $('resetSearchBtn'),
  listUnplaced: $('listUnplaced'),
  listPlaced: $('listPlaced'),

  exportPdfBtn: $('exportPdfBtn'),
  exportJsonBtn: $('exportJsonBtn'),
  importJsonFile: $('importJsonFile'),

  grid: $('grid'),
  axisTop: $('axisTop'),
  axisBottom: $('axisBottom'),
  axisLeft: $('axisLeft'),
  axisRight: $('axisRight'),
  occupiedBadge: $('occupiedBadge'),

  cellDialog: $('cellDialog'),
  cellTitle: $('cellTitle'),
  dName: $('dName'),
  dLot: $('dLot'),
  dExpiry: $('dExpiry'),

  colDialog: $('colDialog'),
  colSelect: $('colSelect'),
  colCancel: $('colCancel'),
  colOk: $('colOk'),

  tpl: $('list-item-tpl'),
  editDialog: $('editDialog'),
  eName: $('eName'),
  eLot: $('eLot'),
  eExpiry: $('eExpiry'),
  eCancel: $('eCancel'),
  eSave: $('eSave'),

  statsSummary: $('statsSummary'),
  statsTopAdded: $('statsTopAdded'),
  statsTopRemoved: $('statsTopRemoved'),
  statsAvgDwell: $('statsAvgDwell'),
  statsListSkull: $('statsListSkull'),
  statsListRed: $('statsListRed'),
  statsListYellow: $('statsListYellow'),
  statsListGreen: $('statsListGreen'),

  modal: $('notification-modal'),
  modalTitle: $('modalTitle'),
  modalMessage: $('modalMessage'),
  modalConfirmBtn: $('modalConfirmBtn'),
  modalCancelBtn: $('modalCancelBtn'),

  installBar: $('installBar'),
  installBtn: $('installBtn'),
  listFilterBtns: document.querySelectorAll('[data-list-filter]'),
};

export function updateUndoButton(hasUndo){
  el.undoBtn.style.display = hasUndo ? 'inline-flex' : 'none';
}

export function closeCellDialogSafely(){
  try{
    const cd = el.cellDialog;
    if(!cd) return;
    try { cd.close(); } catch(e) {}
    try { cd.open = false; } catch(e) {}
    cd.removeAttribute('open');
    cd.style.display = 'none';
    setTimeout(() => { cd.style.display = ''; }, 0);
  }catch(e){}
}

export function showNotification(title, message, isConfirm, onConfirm){
  el.modalTitle.textContent = title;
  el.modalMessage.textContent = message;

  if (isConfirm) {
    el.modalConfirmBtn.style.display = 'inline-flex';
    el.modalCancelBtn.style.display = 'inline-flex';
    el.modalConfirmBtn.textContent = 'OK';

    el.modalConfirmBtn.onclick = () => {
      el.modal.classList.remove('show');
      if (onConfirm) onConfirm();
      closeCellDialogSafely();
    };
    el.modalCancelBtn.onclick = () => { el.modal.classList.remove('show'); };
  } else {
    el.modalConfirmBtn.style.display = 'inline-flex';
    el.modalCancelBtn.style.display = 'none';
    el.modalConfirmBtn.textContent = 'Chiudi';
    el.modalConfirmBtn.onclick = () => { el.modal.classList.remove('show'); };
  }
  el.modal.classList.add('show');
}
