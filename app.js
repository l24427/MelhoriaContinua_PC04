const firebaseConfig = {
  apiKey: "AIzaSyCVLjjW-16azS-WR8GrhgnYvuzu0P_lzgA",
  authDomain: "quadro-interativo-4c68c.firebaseapp.com",
  projectId: "quadro-interativo-4c68c",
  storageBucket: "quadro-interativo-4c68c.firebasestorage.app",
  messagingSenderId: "463583196602",
  appId: "1:463583196602:web:10f8167cea9d69f83f5983",
  measurementId: "G-9VGRE0TTPR"
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Elementos da interface
const elements = {
  authSection: document.getElementById('authSection'),
  passwordInput: document.getElementById('passwordInput'),
  editControls: document.getElementById('editControls'),
  addForm: document.getElementById('addForm'),
  newCategory: document.getElementById('newCategory'),
  newName: document.getElementById('newName'),
  newLink: document.getElementById('newLink'),
  searchInput: document.getElementById('searchInput'),
  title: document.getElementById('editableMode')
};

// Estados globais
let isEditMode = false;
let isActionInProgress = false;
let currentItems = [];
const stateVersion = { value: 0 };
const loadingSpinner = createLoadingSpinner();

// Inicialização
window.onload = () => {
  document.body.appendChild(loadingSpinner);
  loadItems();
  elements.title.addEventListener('click', showAuthModal);
  elements.searchInput.addEventListener('input', searchFunction);
};

// ================= FUNÇÕES PRINCIPAIS =================
async function loadItems() {
  try {
    toggleUIState(true);
    const snapshot = await db.collection('pc04').get();
    stateVersion.value++;
    
    currentItems = snapshot.docs.map((doc, index) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: doc.id,
        link: data.link || '#',
        category: (data.category || 'GERAL').toUpperCase(),
        order: data.order || index,
        version: stateVersion.value
      };
    });
    
    renderItems(stateVersion.value);
  } catch (error) {
    showError('Erro ao carregar dados', error);
  } finally {
    toggleUIState(false);
  }
}

async function addNewItem() {
  if (isActionInProgress) return;
  
  try {
    toggleUIState(true);
    
    const name = elements.newName.value.trim();
    const link = elements.newLink.value.trim();
    const category = elements.newCategory.value.trim().toUpperCase() || 'GERAL';

    if (!name || !link || !category) {
      alert('Preencha todos os campos!');
      return;
    }

    const doc = await db.collection('pc04').doc(name).get();
    if (doc.exists) throw new Error('Item já existe');

    // Determinar nova ordem
    const lastOrder = Math.max(...currentItems
      .filter(i => i.category === category)
      .map(i => i.order), -1);

    stateVersion.value++;
    const newItem = {
      id: name,
      name,
      link,
      category,
      order: lastOrder + 1,
      version: stateVersion.value
    };
    
    currentItems.push(newItem);
    renderItems(stateVersion.value);

    await db.collection('pc04').doc(name).set({ 
      link, 
      category,
      order: lastOrder + 1
    });
    
    closeNewItem();
    
  } catch (error) {
    showError('Erro ao adicionar item', error);
    await loadItems();
  } finally {
    toggleUIState(false);
  }
}

// ================= RENDERIZAÇÃO =================
function renderItems(requestedVersion) {
  if (requestedVersion !== stateVersion.value) return;
  
  const mainSection = document.querySelector('.main-section');
  mainSection.innerHTML = '';

  const categoryOrder = ['EHS', 'QUALIDADE', 'PRODUTIVIDADE', 'PESSOAS', 'CUSTOS'];
  const categories = currentItems.reduce((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // Renderizar categorias ordenadas
  categoryOrder.forEach(category => {
    if (categories[category]) {
      const column = createColumn(category);
      categories[category]
        .sort((a, b) => a.order - b.order)
        .forEach(item => column.appendChild(createItemElement(item)));
      mainSection.appendChild(column);
    }
  });

  // Outras categorias
  Object.keys(categories).forEach(category => {
    if (!categoryOrder.includes(category)) {
      const column = createColumn(category);
      categories[category]
        .sort((a, b) => a.order - b.order)
        .forEach(item => column.appendChild(createItemElement(item)));
      mainSection.appendChild(column);
    }
  });
}

function createColumn(category) {
  const column = document.createElement('div');
  column.className = 'column';
  column.innerHTML = `<a class="category">${category}</a>`;
  return column;
}

function createItemElement(item) {
  const container = document.createElement('div');
  container.className = 'item-container';
  container.style.position = 'relative';
  container.dataset.id = item.name;

  const link = document.createElement('a');
  link.href = item.link;
  link.target = '_blank';
  
  const button = document.createElement('button');
  button.className = 'button';
  button.textContent = item.name;

  link.appendChild(button);
  container.appendChild(link);

  if (isEditMode) {
    const controls = document.createElement('div');
    controls.className = 'edit-controls';
    controls.style.cssText = `
      position: flex;
      display: flex;
      gap: 8px;
      z-index: 100;
      padding: 6px;
      border-radius: 25px;
    `;

    // Botões de Edição/Exclusão
    controls.appendChild(
      createControlButton('✎', '#28a745', () => showEditModal(item))
    );
    controls.appendChild(
      createControlButton('✖', '#dc3545', () => handleDelete(item))
    );

    // Divisor visual
    const divider = document.createElement('div');
    divider.style.cssText = `
      width: 1px;
      background: #ddd;
      margin: 0 4px;
    `;
    controls.appendChild(divider);

    // Botões de Movimento
    const moveGroup = document.createElement('div');
    moveGroup.style.display = 'flex';
    moveGroup.style.gap = '4px';
    moveGroup.appendChild(
      createControlButton('↑', '#ffc107', () => moveItem(item, 'up'))
    );
    moveGroup.appendChild(
      createControlButton('↓', '#ffc107', () => moveItem(item, 'down'))
    );
    
    controls.appendChild(moveGroup);
    
    container.appendChild(controls);
  }

  return container;
}
// ================= OPERAÇÕES CRUD =================
async function handleDelete(item) {
  if (isActionInProgress || !confirm(`Excluir "${item.name}"?`)) return;

  try {
    toggleUIState(true);
    
    stateVersion.value++;
    currentItems = currentItems.filter(i => i.name !== item.name);
    renderItems(stateVersion.value);

    await db.collection('pc04').doc(item.name).delete();
    
  } catch (error) {
    showError('Erro ao excluir item', error);
    await loadItems();
  } finally {
    toggleUIState(false);
  }
}

async function moveItem(item, direction) {
  if (isActionInProgress) return;

  try {
    toggleUIState(true);
    
    const categoryItems = currentItems
      .filter(i => i.category === item.category)
      .sort((a, b) => a.order - b.order);

    const currentIndex = categoryItems.findIndex(i => i.id === item.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex >= 0 && newIndex < categoryItems.length) {
      // Trocar ordens
      [categoryItems[currentIndex].order, categoryItems[newIndex].order] = 
      [categoryItems[newIndex].order, categoryItems[currentIndex].order];

      // Atualizar Firestore
      const batch = db.batch();
      batch.update(db.collection('pc04').doc(categoryItems[currentIndex].id), {
        order: categoryItems[currentIndex].order
      });
      batch.update(db.collection('pc04').doc(categoryItems[newIndex].id), {
        order: categoryItems[newIndex].order
      });
      await batch.commit();

      // Atualizar estado local
      stateVersion.value++;
      renderItems(stateVersion.value);
    }
    
  } catch (error) {
    showError('Erro ao mover item', error);
    await loadItems();
  } finally {
    toggleUIState(false);
  }
}

function showEditModal(item) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';


  const modal = document.createElement('div');
  modal.className = 'edit-modal';


  modal.innerHTML = `
    <h3>Editar ${item.name}</h3>
    <form id="editForm">
      <div class="form-group">
        <label>Nome:</label>
        <input type="text" id="editName" value="${item.name}" required>
      </div>
      <div class="form-group">
        <label>Link:</label>
        <input type="url" id="editLink" value="${item.link}" required>
      </div>
      <div class="form-group">
        <label>Categoria:</label>
        <select id="editCategory">
          ${['EHS', 'QUALIDADE', 'PRODUTIVIDADE', 'PESSOAS', 'CUSTOS']
            .map(cat => `<option value="${cat}" ${cat === item.category ? 'selected' : ''}>${cat}</option>`)
            .join('')}
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-cancel action-button">Cancelar</button>
        <button type="submit" class="btn-save action-button">Salvar</button>
      </div>
    </form>
  `;

  const form = modal.querySelector('#editForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isActionInProgress) return;

    try {
      toggleUIState(true);
      
      const newName = form.querySelector('#editName').value.trim();
      const newLink = form.querySelector('#editLink').value.trim();
      const newCategory = form.querySelector('#editCategory').value.trim();

      // Verificar conflito de nomes
      if (newName !== item.name) {
        const doc = await db.collection('pc04').doc(newName).get();
        if (doc.exists) throw new Error('Nome já existe');
      }

      // Atualização otimista
      stateVersion.value++;
      currentItems = currentItems.map(i => 
        i.name === item.name ? { 
          ...i, 
          name: newName, 
          link: newLink, 
          category: newCategory,
          version: stateVersion.value
        } : i
      );
      renderItems(stateVersion.value);

      // Operação Firestore
      const batch = db.batch();
      batch.delete(db.collection('pc04').doc(item.name));
      batch.set(db.collection('pc04').doc(newName), { 
        link: newLink, 
        category: newCategory 
      });
      await batch.commit();

      overlay.remove();
      
    } catch (error) {
      showError('Erro ao salvar', error);
      await loadItems();
    } finally {
      toggleUIState(false);
    }
  });

  modal.querySelector('.btn-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => e.target === overlay && overlay.remove());

  document.body.appendChild(overlay);
  overlay.appendChild(modal);
}

// ================= AUTENTICAÇÃO =================
async function validatePassword() {
  try {
    const password = elements.passwordInput.value.trim();
    if (!password) return;

    const doc = await db.collection('config').doc('admin').get();
    if (!doc.exists || doc.data().password !== password) {
      throw new Error('Credenciais inválidas');
    }

    isEditMode = true;
    elements.authSection.style.display = 'none';
    elements.editControls.style.display = 'grid';
    
    // Forçar nova renderização
    stateVersion.value++;
    renderItems(stateVersion.value);

  } catch (error) {
    showError('Erro de autenticação', error);
    elements.passwordInput.value = '';
  }
}

// ================= UTILITÁRIOS =================
function createControlButton(text, color, action) {
  const btn = document.createElement('button');
  btn.className = 'action-button';
  btn.innerHTML = text;
  btn.style.cssText = `
    background: ${color};
    border-radius: 50%;
    width: 25px;
    height: 25px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: none;
    transition: transform 0.2s;
  `;
  btn.onclick = () => !isActionInProgress && action();
  return btn;
}

function toggleUIState(disable = true) {
  isActionInProgress = disable;
  loadingSpinner.style.display = disable ? 'block' : 'none';
  
  const interactiveElements = [
    ...document.querySelectorAll('.action-button'),
    elements.editControls,
    elements.addForm,
    elements.searchInput,
    elements.passwordInput
  ];

  interactiveElements.forEach(el => {
    if (el) {
      el.disabled = disable;
      el.style.opacity = disable ? 0.5 : 1;
      el.style.cursor = disable ? 'not-allowed' : 'pointer';
    }
  });
}

function showError(message, error) {
  console.error(error);
  alert(`${message}: ${error.message}`);
}

function createLoadingSpinner() {
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  spinner.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 40px;
    border: 4px solid rgba(0,0,0,0.1);
    border-top-color: #007bff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    display: none;
    z-index: 1000;
  `;
  return spinner;
}

// ================= CONTROLES DA UI =================
function showAuthModal() {
  if (!isActionInProgress) {
    elements.authSection.style.display = 'flex';
    elements.passwordInput.focus();
  }
}

function closeAuthModal() {
  elements.authSection.style.display = 'none';
  elements.passwordInput.value = '';
}

function showAddForm() {
  if (!isActionInProgress) {
    elements.addForm.style.display = 'flex';
    elements.newName.focus();
  }
}
function closeNewItem() {
  elements.addForm.style.display = 'none';
  elements.newName.value = '';
  elements.newLink.value = '';
  elements.newCategory.value = '';
}

function exitEditMode() {
  if (isActionInProgress) return;
  isEditMode = false;
  elements.editControls.style.display = 'none';
  elements.addForm.style.display = 'none';
  loadItems();
  elements.passwordInput.value = '';
}

function searchFunction() {
  const term = elements.searchInput.value
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  document.querySelectorAll('.column').forEach(column => {
    let hasMatch = false;
    column.querySelectorAll('.button').forEach(button => {
      const text = button.textContent
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      
      const match = text.includes(term);
      button.parentElement.parentElement.style.display = match ? 'block' : 'none';
      if (match) hasMatch = true;
    });
    column.style.display = hasMatch ? 'block' : 'none';
  });
}

