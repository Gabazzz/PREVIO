/* ==========================================================================
   Previo HUD — Modal Bottom Sheet Logic (create/edit/delete a transaction)
   ========================================================================== */

import { DOM } from './dom.js';
import { getCategories } from './categories.js';
import { getLocalDateStr } from './utils.js';
import { supabase, getCurrentUser } from './supabase-client.js';
import {
  transactions, setTransactions,
  activeEditId, setActiveEditId,
  activeSwipedItem, setActiveSwipedItem
} from './state.js';
import { processAndRenderAll } from './render.js';
import {
  isOnline, isTempId, generateTempId,
  queueInsert, queueUpdate, queueDelete, cacheTransactionsLocally
} from './offline.js';
import { updateOfflineBanner } from './offline-ui.js';

let selectedCategory = '';

export function openModal(type = 'saída', editId = null) {
  setActiveEditId(editId);
  DOM.modalInputValue.value = '';
  DOM.modalInputDesc.value = '';
  DOM.modalInputRecurring.checked = false;

  DOM.modalInputDate.value = getLocalDateStr();

  if (editId) {
    const tx = transactions.find(t => t.id === editId);
    if (tx) {
      DOM.modalTitle.innerText = 'Editar Lançamento';
      setModalType(tx.type);
      DOM.modalInputValue.value = tx.value;
      DOM.modalInputDesc.value = tx.description;
      DOM.modalInputDate.value = tx.date;
      DOM.modalInputRecurring.checked = tx.recurring || false;
      selectedCategory = tx.category;
      highlightSelectedCategoryChip();
      DOM.btnModalDelete.style.display = 'block';
    }
  } else {
    DOM.modalTitle.innerText = 'Registrar Lançamento';
    setModalType(type);
    DOM.btnModalDelete.style.display = 'none';
  }

  DOM.modalTransaction.classList.add('active');
}

export function closeModal() {
  DOM.modalTransaction.classList.remove('active');
  setActiveEditId(null);

  if (activeSwipedItem) {
    activeSwipedItem.style.transform = '';
    setActiveSwipedItem(null);
  }
}

export function setModalType(type) {
  if (type === 'saída') {
    DOM.toggleOptExpense.classList.add('active');
    DOM.toggleOptIncome.classList.remove('active');
  } else {
    DOM.toggleOptExpense.classList.remove('active');
    DOM.toggleOptIncome.classList.add('active');
  }

  DOM.categoryChipsList.innerHTML = '';
  const list = getCategories(type);
  list.forEach((cat, index) => {
    const chip = document.createElement('div');
    chip.className = `chip ${index === 0 && !activeEditId ? 'active' : ''}`;
    chip.innerText = cat;
    chip.addEventListener('click', () => {
      document.querySelectorAll('#category-chips-list .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedCategory = cat;
    });
    DOM.categoryChipsList.appendChild(chip);
  });

  if (!activeEditId) {
    selectedCategory = list[0];
  }
}

function highlightSelectedCategoryChip() {
  const chips = document.querySelectorAll('#category-chips-list .chip');
  chips.forEach(chip => {
    if (chip.innerText === selectedCategory) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
}

export async function handleModalSubmit() {
  const val = parseFloat(DOM.modalInputValue.value);
  const type = DOM.toggleOptExpense.classList.contains('active') ? 'saída' : 'entrada';
  const desc = DOM.modalInputDesc.value.trim();
  const date = DOM.modalInputDate.value;
  const recurring = DOM.modalInputRecurring.checked;

  if (isNaN(val) || val <= 0) { alert('Por favor, insira um valor válido maior que zero.'); return; }
  if (!date) { alert('Por favor, insira uma data válida.'); return; }

  if (activeEditId) {
    const changes = { type, value: val, category: selectedCategory, description: desc || selectedCategory, date, recurring };

    // A tempId means this row only exists locally (created offline and not
    // synced yet) — there's nothing to UPDATE on the server, so the change
    // is merged straight into the still-pending insert instead.
    if (isTempId(activeEditId)) {
      queueUpdate(activeEditId, changes);
      applyLocalChange(changes);
    } else if (isOnline()) {
      try {
        const { error } = await supabase.from('transactions').update(changes).eq('id', activeEditId);
        if (error) throw error;
        applyLocalChange(changes);
      } catch (e) {
        console.error('[handleModalSubmit] Falha ao atualizar online, salvando para sincronizar depois:', e);
        queueUpdate(activeEditId, changes);
        applyLocalChange(changes);
      }
    } else {
      queueUpdate(activeEditId, changes);
      applyLocalChange(changes);
    }

    function applyLocalChange(c) {
      const index = transactions.findIndex(t => t.id === activeEditId);
      if (index !== -1) transactions[index] = { ...transactions[index], ...c };
    }
  } else {
    const payloadBase = { type, value: val, category: selectedCategory, description: desc || selectedCategory, date, recurring };

    if (isOnline()) {
      try {
        const user = await getCurrentUser();
        const { data, error } = await supabase.from('transactions').insert({ ...payloadBase, user_id: user.id }).select().single();
        if (error) throw error;
        transactions.push({ id: data.id, date: data.date, type: data.type, category: data.category, description: data.description, value: data.value, recurring: data.recurring });
      } catch (e) {
        console.error('[handleModalSubmit] Falha ao inserir online, salvando para sincronizar depois:', e);
        const tempId = generateTempId();
        const user = await getCurrentUser();
        queueInsert(tempId, { ...payloadBase, user_id: user ? user.id : null });
        transactions.push({ id: tempId, ...payloadBase });
      }
    } else {
      const tempId = generateTempId();
      const user = await getCurrentUser();
      queueInsert(tempId, { ...payloadBase, user_id: user ? user.id : null });
      transactions.push({ id: tempId, ...payloadBase });
    }
  }

  cacheTransactionsLocally(transactions);
  updateOfflineBanner();
  processAndRenderAll();
  closeModal();
}

export async function handleModalDelete() {
  if (activeEditId) {
    if (confirm('Tem certeza que deseja excluir este lançamento?')) {
      if (isTempId(activeEditId)) {
        queueDelete(activeEditId); // just drops the still-pending insert
      } else if (isOnline()) {
        try {
          const { error } = await supabase.from('transactions').delete().eq('id', activeEditId);
          if (error) throw error;
        } catch (e) {
          console.error('[handleModalDelete] Falha ao excluir online, salvando para sincronizar depois:', e);
          queueDelete(activeEditId);
        }
      } else {
        queueDelete(activeEditId);
      }

      setTransactions(transactions.filter(t => t.id !== activeEditId));
      cacheTransactionsLocally(transactions);
      updateOfflineBanner();
      processAndRenderAll();
      closeModal();
    }
  }
}
