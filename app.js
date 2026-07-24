// app.js - Coplame Quotation Web App

// Base de Datos en LocalStorage
const DB_KEY = 'coplame_quotes';

// Valores por defecto para una nueva cotización (nuevo esquema de items flexibles)
const DEFAULT_QUOTE = {
    cliente: '',
    direccion: '',
    fecha: '',
    items: [
        { concepto: 'SERVICIO DE CONTROL DE PLAGAS:', descripcion: 'Desinsectización y fumigación general en áreas comunes.', tieneCosto: true, cantidad: 1, precioUnitario: 1200.0, total: 1200.0 },
        { concepto: 'VIGENCIA:', descripcion: '30 DIAS', tieneCosto: false, cantidad: '', precioUnitario: '', total: '' },
        { concepto: 'CONDICIONES DE PAGO:', descripcion: 'Pago en efectivo', tieneCosto: false, cantidad: '', precioUnitario: '', total: '' }
    ],
    firmante: 'Alejandro Medina',
    puesto: 'Coordinador General'
};

// Array de cotizaciones guardadas
let quotes = [];
let currentQuoteId = null;

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
    loadQuotes();
    initApp();
    registerServiceWorker();
});

// Registrar Service Worker para PWA (offline)
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registrado con éxito', reg))
            .catch(err => console.warn('Error al registrar Service Worker', err));
    }
}

// Cargar cotizaciones desde LocalStorage
function loadQuotes() {
    const raw = localStorage.getItem(DB_KEY);
    quotes = raw ? JSON.parse(raw) : [];
}

// Guardar cotizaciones en LocalStorage
function saveQuotesToStorage() {
    localStorage.setItem(DB_KEY, JSON.stringify(quotes));
}

// Obtener fecha de hoy en formato local ISO (YYYY-MM-DD)
function getLocalISODate() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Formatear fecha ISO (YYYY-MM-DD) a formato amigable en español
function formatSpanishDateString(dateStr) {
    if (!dateStr) return '';
    // Si ya está formateada como texto (retrocompatibilidad), regresarla igual
    if (dateStr.includes(' de ')) return dateStr;
    
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    
    const year = parts[0];
    const monthIndex = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    return `${day} de ${meses[monthIndex]} de ${year}`;
}

// Convertir una fecha en español (ej. "24 de Julio de 2026") a formato ISO (YYYY-MM-DD)
function parseSpanishDateToISO(dateStr) {
    if (!dateStr) return getLocalISODate();
    if (dateStr.includes('-') && dateStr.split('-').length === 3) return dateStr; // ya es ISO
    
    try {
        const parts = dateStr.toLowerCase().split(' de ');
        if (parts.length !== 3) return getLocalISODate();
        
        const day = String(parseInt(parts[0])).padStart(2, '0');
        const year = parts[2].trim();
        const monthStr = parts[1].trim();
        
        const meses = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        const monthIndex = meses.indexOf(monthStr);
        if (monthIndex === -1) return getLocalISODate();
        
        const month = String(monthIndex + 1).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch(e) {
        return getLocalISODate();
    }
}

// Función auxiliar para convertir items del esquema viejo {label, value} al nuevo esquema flexible
function convertOldItemIfNeeded(item) {
    if (!item) return { concepto: '', descripcion: '', tieneCosto: false, cantidad: '', precioUnitario: '', total: '' };
    
    if (item.hasOwnProperty('label') && item.hasOwnProperty('value')) {
        const costKeywords = ['COSTO', 'PRECIO', 'TOTAL', '$', 'IMPORTE'];
        const isCost = costKeywords.some(kw => item.label.toUpperCase().includes(kw));
        
        let parsedPrice = '';
        let parsedQty = '';
        let parsedTotal = '';
        let hasCosto = false;
        
        if (isCost) {
            hasCosto = true;
            const cleanedValue = item.value.replace(/[^0-9.]/g, '').replace('´', '');
            const num = parseFloat(cleanedValue);
            if (!isNaN(num)) {
                parsedTotal = num;
            }
        }
        
        return {
            concepto: item.label,
            descripcion: item.value,
            tieneCosto: hasCosto,
            cantidad: parsedQty,
            precioUnitario: parsedPrice,
            total: parsedTotal
        };
    }
    
    return {
        concepto: item.concepto || '',
        descripcion: item.descripcion || '',
        tieneCosto: !!item.tieneCosto,
        cantidad: item.cantidad !== undefined ? item.cantidad : '',
        precioUnitario: item.precioUnitario !== undefined ? item.precioUnitario : '',
        total: item.total !== undefined ? item.total : ''
    };
}

// Inicializar vistas, eventos e interfaz
function initApp() {
    const searchInput = document.getElementById('search-input');
    const quoteForm = document.getElementById('quote-form');
    const btnNewQuote = document.getElementById('btn-new-quote');
    const btnCancel = document.getElementById('btn-cancel');
    const btnPrint = document.getElementById('btn-print');
    const btnEditCurrent = document.getElementById('btn-edit-current');
    const btnAddItem = document.getElementById('btn-add-item');
    const navTabs = document.querySelectorAll('.nav-tab');

    // 1. Renderizar lista inicial
    renderList();

    // 2. Navegación entre Pestañas (Tabs)
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // 3. Crear Nueva Cotización
    btnNewQuote.addEventListener('click', () => {
        openEditor(null);
    });

    // 4. Cancelar Edición
    btnCancel.addEventListener('click', () => {
        if (currentQuoteId) {
            switchTab('preview');
        } else {
            switchTab('list');
        }
    });

    // 5. Enviar Formulario (Guardar)
    quoteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveQuote();
    });

    // 6. Buscador
    searchInput.addEventListener('input', (e) => {
        renderList(e.target.value);
    });

    // 7. Imprimir / Generar PDF
    btnPrint.addEventListener('click', () => {
        printCurrentQuote();
    });

    // 8. Editar desde Vista Previa
    btnEditCurrent.addEventListener('click', () => {
        if (currentQuoteId) {
            openEditor(currentQuoteId);
        }
    });

    // 9. Agregar Campo Dinámico en el Editor
    btnAddItem.addEventListener('click', () => {
        addDynamicItemRow('', '', false, '', '', '');
        triggerPreviewSync();
    });

    // 10. Configurar Acordeones en Formulario
    initAccordions();

    // 11. Actualizar preview en tiempo real al escribir en los campos básicos
    bindFormRealtimePreview();

    // 12. Configuración de Sincronización y Modal
    const btnSettings = document.getElementById('btn-settings');
    const settingsModal = document.getElementById('settings-modal');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const settingsPat = document.getElementById('settings-pat');

    btnSettings.addEventListener('click', () => {
        settingsPat.value = localStorage.getItem('coplame_github_pat') || '';
        settingsModal.style.display = 'flex';
    });

    btnCloseSettings.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    btnSaveSettings.addEventListener('click', () => {
        localStorage.setItem('coplame_github_pat', settingsPat.value.trim());
        settingsModal.style.display = 'none';
        alert('Token de GitHub guardado con éxito.');
    });

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });

    // 13. Inicializar Drag and Drop para reordenar
    initDragAndDrop();
}

// Switch entre vistas principales
function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));

    const tabEl = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
    if (tabEl) tabEl.classList.add('active');

    const viewEl = document.getElementById(`view-${tabName}`);
    if (viewEl) viewEl.classList.add('active');

    document.querySelector('.app-content').scrollTop = 0;

    if (tabName === 'preview' && currentQuoteId) {
        const quote = quotes.find(q => q.id === currentQuoteId);
        if (quote) {
            updatePreview(quote);
        }
    }
}

// Configurar acordeones del formulario
function initAccordions() {
    const accordions = document.querySelectorAll('.accordion-item');
    accordions.forEach(item => {
        const header = item.querySelector('.accordion-header');
        header.addEventListener('click', () => {
            const isExpanded = item.classList.contains('expanded');
            accordions.forEach(acc => acc.classList.remove('expanded'));
            if (!isExpanded) {
                item.classList.add('expanded');
            }
        });
    });
}

// Generar Folio Corporativo único para cada cotización
function getFolioNumber(quote) {
    if (!quote.createdAt) return 'COP-000000-0001';
    const date = new Date(quote.createdAt);
    const y = String(date.getFullYear()).substr(-2);
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const suffix = quote.id ? quote.id.substr(-4) : '0001';
    return `COP-${y}${m}${d}-${suffix}`;
}

// Renderizar la lista de cotizaciones en pantalla
function renderList(query = '') {
    const container = document.getElementById('quotes-list');
    container.innerHTML = '';

    const filtered = quotes.filter(q => {
        const text = `${q.cliente} ${q.direccion}`.toLowerCase();
        return text.includes(query.toLowerCase());
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" class="icon"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2zm0 8H7v-2h10v2z"/></svg>
                <p>${query ? 'No se encontraron cotizaciones.' : 'No tienes cotizaciones guardadas.'}</p>
                ${query ? '' : '<button class="btn btn-primary btn-sm" id="btn-empty-new">Crear una ahora</button>'}
            </div>
        `;

        const btnEmptyNew = document.getElementById('btn-empty-new');
        if (btnEmptyNew) {
            btnEmptyNew.addEventListener('click', () => openEditor(null));
        }
        return;
    }

    filtered.sort((a, b) => b.updatedAt - a.updatedAt);

    filtered.forEach(q => {
        const card = document.createElement('div');
        card.className = 'quote-card';
        card.innerHTML = `
            <span class="quote-card-badge">PDF</span>
            <h4>${q.cliente}</h4>
            <p>
                <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                ${q.direccion}
            </p>
            <span class="quote-date">Folio: ${getFolioNumber(q)} | Cambio: ${new Date(q.updatedAt).toLocaleDateString('es-MX')}</span>
            
            <div class="quote-card-actions">
                <button class="btn btn-secondary btn-sm btn-delete" data-id="${q.id}">Eliminar</button>
                <button class="btn btn-secondary btn-sm btn-duplicate" data-id="${q.id}">Duplicar</button>
                <button class="btn btn-primary btn-sm btn-view" data-id="${q.id}">Ver / Exportar</button>
            </div>
        `;

        card.querySelector('.btn-view').addEventListener('click', (e) => {
            e.stopPropagation();
            currentQuoteId = q.id;
            switchTab('preview');
        });

        card.querySelector('.btn-duplicate').addEventListener('click', (e) => {
            e.stopPropagation();
            duplicateQuote(q.id);
        });

        card.querySelector('.btn-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteQuote(q.id);
        });

        card.addEventListener('click', () => {
            currentQuoteId = q.id;
            switchTab('preview');
        });

        container.appendChild(card);
    });
}

// Agregar una fila de campo dinámico y flexible en el editor
function addDynamicItemRow(concepto = '', descripcion = '', tieneCosto = false, cantidad = '', precioUnitario = '', total = '') {
    const container = document.getElementById('dynamic-items-container');
    const rowId = 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    const card = document.createElement('div');
    card.className = 'dynamic-item-card';
    card.id = rowId;
    card.setAttribute('draggable', 'true');
    card.innerHTML = `
        <div class="dynamic-item-header" style="cursor: grab;">
            <div class="drag-handle" style="display: flex; align-items: center; gap: 6px; color: var(--gray-500); width: 60%; user-select: none;">
                <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor; flex-shrink:0;"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Reordenar</span>
            </div>
            <button type="button" class="btn-remove-item" data-row-id="${rowId}">
                <svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                Quitar
            </button>
        </div>
        <div class="form-group">
            <label>Concepto / Servicio</label>
            <input type="text" class="item-concepto-input" value="${concepto}" placeholder="Ej. Servicio de Control de Plagas" required>
        </div>
        <div class="form-group">
            <label>Descripción / Detalles</label>
            <textarea class="item-descripcion-input" rows="2" placeholder="Detalles de aplicación..." required>${descripcion}</textarea>
        </div>
        
        <div class="form-group-checkbox" style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <input type="checkbox" class="item-tiene-costo-checkbox" id="check_${rowId}" ${tieneCosto ? 'checked' : ''} style="width:auto; margin:0; cursor:pointer;">
            <label for="check_${rowId}" style="margin:0; cursor:pointer; font-size:12px; text-transform:none; font-weight:600;">¿Este elemento incluye costo?</label>
        </div>
        
        <div class="cost-details-container" id="cost_details_${rowId}" style="display: ${tieneCosto ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr 1.2fr; gap:10px; margin-bottom: 10px;">
            <div class="form-group" style="margin:0;">
                <label style="font-size:10px;">Cantidad</label>
                <input type="number" class="item-cantidad-input" value="${cantidad}" min="1" step="any" placeholder="Ej. 1">
            </div>
            <div class="form-group" style="margin:0;">
                <label style="font-size:10px;">Precio Unitario ($)</label>
                <input type="number" class="item-precio-input" value="${precioUnitario}" min="0" step="any" placeholder="Ej. 1000">
            </div>
            <div class="form-group" style="margin:0;">
                <label style="font-size:10px;">Total ($)</label>
                <input type="number" class="item-total-input" value="${total}" min="0" step="any" placeholder="Ej. 1000">
            </div>
        </div>
    `;

    const checkbox = card.querySelector('.item-tiene-costo-checkbox');
    const costContainer = card.querySelector('.cost-details-container');
    const qtyInput = card.querySelector('.item-cantidad-input');
    const priceInput = card.querySelector('.item-precio-input');
    const totalInput = card.querySelector('.item-total-input');

    checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            costContainer.style.display = 'grid';
        } else {
            costContainer.style.display = 'none';
            qtyInput.value = '';
            priceInput.value = '';
            totalInput.value = '';
        }
        triggerPreviewSync();
    });

    function autoCalcTotal() {
        const qty = parseFloat(qtyInput.value);
        const price = parseFloat(priceInput.value);
        if (!isNaN(qty) && !isNaN(price)) {
            totalInput.value = (qty * price).toFixed(2);
        }
        triggerPreviewSync();
    }

    qtyInput.addEventListener('input', autoCalcTotal);
    priceInput.addEventListener('input', autoCalcTotal);
    totalInput.addEventListener('input', () => triggerPreviewSync());

    card.querySelector('.btn-remove-item').addEventListener('click', () => {
        card.remove();
        triggerPreviewSync();
    });

    card.querySelector('.item-concepto-input').addEventListener('input', () => triggerPreviewSync());
    card.querySelector('.item-descripcion-input').addEventListener('input', () => triggerPreviewSync());

    container.appendChild(card);
}

// Abrir el editor para una cotización (nueva o existente)
function openEditor(quoteId) {
    const form = document.getElementById('quote-form');
    form.reset();

    const itemsContainer = document.getElementById('dynamic-items-container');
    itemsContainer.innerHTML = '';

    document.querySelectorAll('.accordion-item').forEach((acc, idx) => {
        if (idx === 0) acc.classList.add('expanded');
        else acc.classList.remove('expanded');
    });

    if (quoteId) {
        const q = quotes.find(item => item.id === quoteId);
        if (q) {
            currentQuoteId = quoteId;
            document.getElementById('field-id').value = q.id;
            document.getElementById('field-cliente').value = q.cliente;
            document.getElementById('field-direccion').value = q.direccion;
            
            // Convertir la fecha al formato ISO YYYY-MM-DD
            document.getElementById('field-fecha').value = parseSpanishDateToISO(q.fecha);
            
            if (q.items && Array.isArray(q.items)) {
                q.items.forEach(item => {
                    const cleanItem = convertOldItemIfNeeded(item);
                    addDynamicItemRow(
                        cleanItem.concepto, 
                        cleanItem.descripcion, 
                        cleanItem.tieneCosto, 
                        cleanItem.cantidad, 
                        cleanItem.precioUnitario, 
                        cleanItem.total
                    );
                });
            }

            document.getElementById('field-firmante').value = q.firmante;
            document.getElementById('field-puesto').value = q.puesto;
        }
    } else {
        currentQuoteId = null;
        document.getElementById('field-id').value = '';
        document.getElementById('field-cliente').value = '';
        document.getElementById('field-direccion').value = '';
        document.getElementById('field-fecha').value = getLocalISODate();
        
        DEFAULT_QUOTE.items.forEach(item => {
            const cleanItem = convertOldItemIfNeeded(item);
            addDynamicItemRow(
                cleanItem.concepto, 
                cleanItem.descripcion, 
                cleanItem.tieneCosto, 
                cleanItem.cantidad, 
                cleanItem.precioUnitario, 
                cleanItem.total
            );
        });

        document.getElementById('field-firmante').value = DEFAULT_QUOTE.firmante;
        document.getElementById('field-puesto').value = DEFAULT_QUOTE.puesto;
    }

    switchTab('editor');
    triggerPreviewSync();
}

// Sincronizar cotización guardada con el repositorio de GitHub
async function syncQuoteToGitHub(quoteData) {
    const pat = localStorage.getItem('coplame_github_pat');
    if (!pat) {
        console.log("No se detectó GitHub PAT. La cotización solo se guardó de manera local.");
        return;
    }

    const repo = 'amlmedina/Coplame';
    const filePath = `cotizaciones/${quoteData.id}.json`;
    const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

    const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(quoteData, null, 2))));

    try {
        let sha = null;
        
        const getResponse = await fetch(url, {
            headers: {
                'Authorization': `token ${pat}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (getResponse.status === 200) {
            const fileData = await getResponse.json();
            sha = fileData.sha;
        }

        const body = {
            message: `Sincronizar cotización ${quoteData.id} - ${quoteData.cliente}`,
            content: contentBase64,
            branch: 'main'
        };
        if (sha) {
            body.sha = sha;
        }

        const putResponse = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${pat}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(body)
        });

        if (putResponse.status === 200 || putResponse.status === 201) {
            console.log("Cotización sincronizada en el repositorio de GitHub con éxito.");
            alert("¡Cotización guardada localmente y sincronizada con tu Google Drive!");
        } else {
            const errData = await putResponse.json();
            console.error("Error al sincronizar con GitHub:", errData);
            alert("Guardado localmente. Error de sincronización en la nube: " + (errData.message || "Token inválido"));
        }
    } catch (err) {
        console.error("Error de conexión al sincronizar con GitHub:", err);
        alert("Guardado localmente. Error de conexión con GitHub (revisa tu red).");
    }
}

// Guardar cotización
function saveQuote() {
    const id = document.getElementById('field-id').value;
    const isNew = !id;

    const items = [];
    const itemCards = document.querySelectorAll('#dynamic-items-container .dynamic-item-card');
    itemCards.forEach(card => {
        const concepto = card.querySelector('.item-concepto-input').value;
        const descripcion = card.querySelector('.item-descripcion-input').value;
        const tieneCosto = card.querySelector('.item-tiene-costo-checkbox').checked;
        const cantidad = card.querySelector('.item-cantidad-input').value;
        const precioUnitario = card.querySelector('.item-precio-input').value;
        const total = card.querySelector('.item-total-input').value;
        
        items.push({ concepto, descripcion, tieneCosto, cantidad, precioUnitario, total });
    });

    const data = {
        id: isNew ? 'q_' + Date.now() : id,
        cliente: document.getElementById('field-cliente').value,
        direccion: document.getElementById('field-direccion').value,
        fecha: document.getElementById('field-fecha').value, // se guarda en formato YYYY-MM-DD
        items: items,
        firmante: document.getElementById('field-firmante').value,
        puesto: document.getElementById('field-puesto').value,
        createdAt: isNew ? Date.now() : quotes.find(q => q.id === id).createdAt,
        updatedAt: Date.now()
    };

    if (isNew) {
        quotes.push(data);
    } else {
        const index = quotes.findIndex(q => q.id === id);
        if (index !== -1) {
            quotes[index] = data;
        }
    }

    saveQuotesToStorage();
    currentQuoteId = data.id;
    
    renderList();
    switchTab('preview');
    syncQuoteToGitHub(data);
}

// Duplicar cotización
function duplicateQuote(id) {
    const q = quotes.find(item => item.id === id);
    if (q) {
        const copy = {
            ...q,
            id: 'q_' + Date.now(),
            cliente: q.cliente + ' (Copia)',
            fecha: getLocalISODate(),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        quotes.push(copy);
        saveQuotesToStorage();
        renderList();
    }
}

// Eliminar cotización
function deleteQuote(id) {
    const q = quotes.find(item => item.id === id);
    if (q) {
        if (confirm(`¿Estás seguro de que deseas eliminar la cotización de "${q.cliente}"?`)) {
            quotes = quotes.filter(item => item.id !== id);
            saveQuotesToStorage();
            renderList();
            if (currentQuoteId === id) {
                currentQuoteId = null;
            }
        }
    }
}

// Vincular los campos del formulario con el preview interactivo
function bindFormRealtimePreview() {
    const fields = ['cliente', 'direccion', 'fecha', 'firmante', 'puesto'];

    fields.forEach(field => {
        const el = document.getElementById(`field-${field}`);
        if (el) {
            el.addEventListener('input', () => {
                const previewSheet = document.getElementById('preview-sheet');
                const valEl = previewSheet.querySelector(`.val-${field}`);
                if (valEl) {
                    if (field === 'fecha') {
                        valEl.textContent = formatSpanishDateString(el.value);
                    } else {
                        valEl.textContent = el.value;
                    }
                }
            });
        }
    });
}

// Auxiliar para inyectar los ítems dinámicos en una hoja de cotización
function renderDynamicItemsToSheet(sheetElement, quoteData) {
    const servicesBody = sheetElement.querySelector('.val-services-table-body');
    const folioEl = sheetElement.querySelector('.val-quote-number');
    
    if (folioEl) {
        folioEl.textContent = getFolioNumber(quoteData);
    }

    if (!servicesBody) return;

    servicesBody.innerHTML = '';

    const itemsArray = quoteData.items;
    if (!itemsArray || !Array.isArray(itemsArray)) return;

    let grandTotal = 0;

    itemsArray.forEach(item => {
        const cleanItem = convertOldItemIfNeeded(item);
        const row = document.createElement('tr');
        
        if (cleanItem.tieneCosto) {
            const qty = cleanItem.cantidad || '';
            const price = cleanItem.precioUnitario ? `$ ${parseFloat(cleanItem.precioUnitario).toLocaleString('es-MX', {minimumFractionDigits: 2})}` : '';
            const totalVal = cleanItem.total ? parseFloat(cleanItem.total) : 0;
            grandTotal += totalVal;
            
            const totalFormatted = `$ ${totalVal.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;

            row.innerHTML = `
                <td style="padding: 4px 8px; font-size:11px; vertical-align:top; border: 1px solid #cbd5e0;">
                    <div style="font-weight: 600; color: #2d3748; font-size: 11px;">${cleanItem.concepto}</div>
                    <div style="font-size: 10px; color: #4a5568; margin-top: 2px; line-height: 1.3; white-space: pre-wrap;">${cleanItem.descripcion}</div>
                </td>
                <td style="text-align: center; padding: 4px 8px; font-size:11px; vertical-align:top; border: 1px solid #cbd5e0;">${qty}</td>
                <td style="text-align: right; padding: 4px 8px; font-size:11px; vertical-align:top; border: 1px solid #cbd5e0;">${price}</td>
                <td style="text-align: right; font-weight: 600; color: #0b4c2b; padding: 4px 8px; font-size:11px; vertical-align:top; border: 1px solid #cbd5e0;">${totalFormatted}</td>
            `;
        } else {
            row.innerHTML = `
                <td colspan="4" style="padding: 5px 8px; font-size:11px; vertical-align:top; border: 1px solid #cbd5e0;">
                    <div style="font-size: 11px; line-height: 1.35; color: #4a5568;">
                        <strong style="color: #2d3748; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.3px; margin-right: 4px;">${cleanItem.concepto}</strong>
                        <span>${cleanItem.descripcion}</span>
                    </div>
                </td>
            `;
        }
        servicesBody.appendChild(row);
    });

    if (servicesBody.children.length === 0) {
        servicesBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#888; padding: 15px;">Sin elementos en la cotización</td></tr>`;
    }

    const grandTotalEl = sheetElement.querySelector('.val-grand-total');
    if (grandTotalEl) {
        grandTotalEl.textContent = `$ ${grandTotal.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
    }
}

// Forzar la sincronización manual del preview con los datos de los inputs del formulario
function triggerPreviewSync() {
    const previewSheet = document.getElementById('preview-sheet');
    const template = document.getElementById('quote-sheet-template');
    
    previewSheet.innerHTML = '';
    previewSheet.appendChild(template.content.cloneNode(true));

    const fields = ['cliente', 'direccion', 'fecha', 'firmante', 'puesto'];
    fields.forEach(field => {
        const inputEl = document.getElementById(`field-${field}`);
        const previewValEl = previewSheet.querySelector(`.val-${field}`);
        if (inputEl && previewValEl) {
            if (field === 'fecha') {
                previewValEl.textContent = formatSpanishDateString(inputEl.value);
            } else {
                previewValEl.textContent = inputEl.value;
            }
        }
    });

    const items = [];
    const itemCards = document.querySelectorAll('#dynamic-items-container .dynamic-item-card');
    itemCards.forEach(card => {
        const concepto = card.querySelector('.item-concepto-input').value;
        const descripcion = card.querySelector('.item-descripcion-input').value;
        const tieneCosto = card.querySelector('.item-tiene-costo-checkbox').checked;
        const cantidad = card.querySelector('.item-cantidad-input').value;
        const precioUnitario = card.querySelector('.item-precio-input').value;
        const total = card.querySelector('.item-total-input').value;
        items.push({ concepto, descripcion, tieneCosto, cantidad, precioUnitario, total });
    });

    const mockQuote = {
        id: document.getElementById('field-id').value || 'new',
        createdAt: document.getElementById('field-id').value ? quotes.find(q => q.id === document.getElementById('field-id').value).createdAt : Date.now(),
        items: items
    };

    renderDynamicItemsToSheet(previewSheet, mockQuote);
}

// Actualizar la hoja de previsualización con un objeto de cotización guardado
function updatePreview(quoteData) {
    const previewSheet = document.getElementById('preview-sheet');
    const template = document.getElementById('quote-sheet-template');
    
    previewSheet.innerHTML = '';
    previewSheet.appendChild(template.content.cloneNode(true));

    const fields = ['cliente', 'direccion', 'fecha', 'firmante', 'puesto'];
    fields.forEach(key => {
        const valEl = previewSheet.querySelector(`.val-${key}`);
        if (valEl) {
            if (key === 'fecha') {
                valEl.textContent = formatSpanishDateString(quoteData[key]);
            } else {
                valEl.textContent = quoteData[key];
            }
        }
    });

    renderDynamicItemsToSheet(previewSheet, quoteData);
}

// Imprimir o guardar como PDF
function printCurrentQuote() {
    if (!currentQuoteId) return;
    
    const quote = quotes.find(q => q.id === currentQuoteId);
    if (!quote) return;

    const printDoc = document.getElementById('print-document');
    const template = document.getElementById('quote-sheet-template');
    
    printDoc.innerHTML = '';
    printDoc.appendChild(template.content.cloneNode(true));

    const fields = ['cliente', 'direccion', 'fecha', 'firmante', 'puesto'];
    fields.forEach(key => {
        const valEl = printDoc.querySelector(`.val-${key}`);
        if (valEl) {
            if (key === 'fecha') {
                valEl.textContent = formatSpanishDateString(quote[key]);
            } else {
                valEl.textContent = quote[key];
            }
        }
    });

    renderDynamicItemsToSheet(printDoc, quote);

    const originalTitle = document.title;
    document.title = `Cotizacion Coplame - ${quote.cliente}`;

    window.print();
    document.title = originalTitle;
}

// Inicializar Drag and Drop (Soporte Mouse y Táctil Móvil)
function initDragAndDrop() {
    const container = document.getElementById('dynamic-items-container');
    let dragEl = null;

    // EVENTOS DE ESCRITORIO (HTML5 Drag & Drop)
    container.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.dynamic-item-card');
        if (!card) return;
        dragEl = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const card = e.target.closest('.dynamic-item-card');
        if (!card || card === dragEl) return;

        const rect = card.getBoundingClientRect();
        const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
        container.insertBefore(dragEl, next ? card.nextSibling : card);
    });

    container.addEventListener('dragend', () => {
        if (dragEl) {
            dragEl.classList.remove('dragging');
            dragEl = null;
            triggerPreviewSync();
        }
    });

    // EVENTOS MÓVILES (Soporte Táctil)
    let activeTouchEl = null;
    let touchStartY = 0;
    
    container.addEventListener('touchstart', (e) => {
        const handle = e.target.closest('.drag-handle') || e.target.closest('.dynamic-item-header');
        if (!handle) return;
        
        const card = e.target.closest('.dynamic-item-card');
        if (!card) return;
        
        activeTouchEl = card;
        card.classList.add('dragging');
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (!activeTouchEl) return;
        
        const touchY = e.touches[0].clientY;
        const elements = Array.from(container.querySelectorAll('.dynamic-item-card:not(.dragging)'));
        
        const target = elements.find(el => {
            const rect = el.getBoundingClientRect();
            return touchY >= rect.top && touchY <= rect.bottom;
        });

        if (target) {
            const rect = target.getBoundingClientRect();
            const next = (touchY - rect.top) / (rect.bottom - rect.top) > 0.5;
            container.insertBefore(activeTouchEl, next ? target.nextSibling : target);
        }
    }, { passive: true });

    container.addEventListener('touchend', () => {
        if (activeTouchEl) {
            activeTouchEl.classList.remove('dragging');
            activeTouchEl = null;
            triggerPreviewSync();
        }
    });
}

