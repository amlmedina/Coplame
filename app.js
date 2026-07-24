// app.js - Coplame Quotation Web App

// Base de Datos en LocalStorage
const DB_KEY = 'coplame_quotes';
const CLIENTS_KEY = 'coplame_clients';

// ---- DIRECTORIO DE CLIENTES ----

function loadClients() {
    const raw = localStorage.getItem(CLIENTS_KEY);
    return raw ? JSON.parse(raw) : [];
}

function saveClients(clients) {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
}

function addClientIfNew(nombre, direccion) {
    if (!nombre || !nombre.trim()) return;
    const clients = loadClients();
    const exists = clients.some(c => c.nombre.toLowerCase() === nombre.trim().toLowerCase());
    if (!exists) {
        clients.push({ nombre: nombre.trim(), direccion: (direccion || '').trim() });
        saveClients(clients);
    }
    refreshClientDatalist();
}

function refreshClientDatalist() {
    const clients = loadClients();
    
    // Populate cliente datalist
    const clientDl = document.getElementById('clients-datalist');
    if (clientDl) {
        clientDl.innerHTML = '';
        clients.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.nombre;
            clientDl.appendChild(opt);
        });
    }
    
    // Populate direccion datalist (all unique addresses)
    const addrDl = document.getElementById('addresses-datalist');
    if (addrDl) {
        addrDl.innerHTML = '';
        clients.filter(c => c.direccion).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.direccion;
            addrDl.appendChild(opt);
        });
    }
}

function renderClientsList() {
    const clients = loadClients();
    const container = document.getElementById('clients-list');
    if (!container) return;
    
    if (clients.length === 0) {
        container.innerHTML = `<p style="text-align:center; color: var(--gray-400); font-size: 13px; padding: 20px 0;">Sin clientes guardados aún.<br>Se guardan automáticamente al crear cotizaciones.</p>`;
        return;
    }
    
    container.innerHTML = '';
    clients.forEach((c, index) => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--gray-100);';
        item.innerHTML = `
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.nombre}</div>
                ${c.direccion ? `<div style="font-size: 11px; color: var(--gray-400); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.direccion}</div>` : ''}
            </div>
            <button class="btn btn-sm" data-index="${index}" style="padding: 4px 8px; font-size: 11px; background: var(--gray-100); color: var(--danger); border: none; border-radius: 6px; cursor: pointer; flex-shrink: 0;">✕</button>
        `;
        item.querySelector('button').addEventListener('click', () => {
            const updated = loadClients();
            updated.splice(index, 1);
            saveClients(updated);
            refreshClientDatalist();
            renderClientsList();
        });
        container.appendChild(item);
    });
}

function initClientsModule() {
    const btnClients = document.getElementById('btn-clients');
    const clientsModal = document.getElementById('clients-modal');
    const btnCloseClients = document.getElementById('btn-close-clients');
    const btnAddClient = document.getElementById('btn-add-client');
    const newClientName = document.getElementById('new-client-name');
    const newClientAddress = document.getElementById('new-client-address');
    const clienteInput = document.getElementById('field-cliente');
    
    // Auto-fill address when client is selected from datalist
    if (clienteInput) {
        clienteInput.addEventListener('change', () => {
            const clients = loadClients();
            const match = clients.find(c => c.nombre.toLowerCase() === clienteInput.value.trim().toLowerCase());
            if (match && match.direccion) {
                const dir = document.getElementById('field-direccion');
                if (dir && !dir.value) {
                    dir.value = match.direccion;
                }
            }
        });
    }

    if (btnClients) {
        btnClients.addEventListener('click', () => {
            renderClientsList();
            clientsModal.style.display = 'flex';
        });
    }

    if (btnCloseClients) {
        btnCloseClients.addEventListener('click', () => {
            clientsModal.style.display = 'none';
        });
    }

    if (clientsModal) {
        clientsModal.addEventListener('click', (e) => {
            if (e.target === clientsModal) clientsModal.style.display = 'none';
        });
    }

    if (btnAddClient) {
        btnAddClient.addEventListener('click', () => {
            const name = newClientName.value.trim();
            const address = newClientAddress.value.trim();
            if (!name) { newClientName.focus(); return; }
            addClientIfNew(name, address);
            newClientName.value = '';
            newClientAddress.value = '';
            renderClientsList();
        });
    }
    
    // Load datalists on init
    refreshClientDatalist();
}

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
    initPinLock();
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

    // 3. Crear Nuevo Documento (Modal de selección)
    const newDocModal = document.getElementById('new-doc-modal');
    const btnCloseNewDoc = document.getElementById('btn-close-new-doc');

    btnNewQuote.addEventListener('click', () => {
        if (newDocModal) newDocModal.style.display = 'flex';
    });

    if (btnCloseNewDoc) {
        btnCloseNewDoc.addEventListener('click', () => {
            newDocModal.style.display = 'none';
        });
    }

    document.querySelectorAll('.new-doc-card').forEach(card => {
        card.addEventListener('click', () => {
            const selectedType = card.getAttribute('data-type');
            if (newDocModal) newDocModal.style.display = 'none';
            openEditor(null, selectedType);
        });
    });

    // Selector de Tipo de Documento en el Editor
    const btnTypeCot = document.getElementById('btn-type-cotizacion');
    const btnTypeCert = document.getElementById('btn-type-certificado');

    if (btnTypeCot) {
        btnTypeCot.addEventListener('click', () => switchDocTypeInEditor('cotizacion'));
    }
    if (btnTypeCert) {
        btnTypeCert.addEventListener('click', () => switchDocTypeInEditor('certificado'));
    }

    // 4. Cancelar Edición
    btnCancel.addEventListener('click', () => {
        if (currentQuoteId) {
            switchTab('preview');
        } else {
            switchTab('list');
        }
    });

    // 5. Enviar Formulario Unificado (Guardar Cotización o Certificado)
    const unifiedForm = document.getElementById('unified-doc-form');
    if (unifiedForm) {
        unifiedForm.addEventListener('submit', saveDocument);
    }

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

    // 14. Inicializar Directorio de Clientes
    initClientsModule();

    // 15. Botón Compartir
    const btnShare = document.getElementById('btn-share');
    btnShare.addEventListener('click', () => shareCurrentQuote());

    // 16. Certificado de Aplicación
    initCertModule();
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

// Obtener el año y nombre del mes de una cotización para agrupación
function getQuoteYearAndMonth(q) {
    const dateStr = q.fecha;
    let dt = new Date(q.updatedAt);
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    try {
        if (dateStr && dateStr.includes('-') && dateStr.split('-').length === 3) {
            const parts = dateStr.split('-');
            const year = parts[0];
            const monthIndex = parseInt(parts[1]) - 1;
            if (monthIndex >= 0 && monthIndex < 12) {
                return { year, month: meses[monthIndex] };
            }
        } else if (dateStr && dateStr.includes(' de ')) {
            const parts = dateStr.split(' de ');
            if (parts.length === 3) {
                return { year: parts[2].trim(), month: parts[1].trim() };
            }
        }
    } catch(e) {
        console.error("Error al obtener fecha para agrupación:", e);
    }
    
    return { year: String(dt.getFullYear()), month: meses[dt.getMonth()] };
}

// Renderizar la lista de cotizaciones en pantalla agrupada por Año -> Mes -> Cliente (Ordenado alfabéticamente)
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

    // Agrupar
    const grouped = {};
    filtered.forEach(q => {
        const { year, month } = getQuoteYearAndMonth(q);
        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][month]) grouped[year][month] = [];
        grouped[year][month].push(q);
    });

    const MONTH_ORDER = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    // Ordenar años de forma descendente
    const sortedYears = Object.keys(grouped).sort((a, b) => b - a);

    sortedYears.forEach(year => {
        const yearHeader = document.createElement('div');
        yearHeader.className = 'history-year-header';
        yearHeader.innerHTML = `<h3>${year}</h3>`;
        container.appendChild(yearHeader);

        // Ordenar meses de forma descendente
        const sortedMonths = Object.keys(grouped[year]).sort((a, b) => {
            return MONTH_ORDER.indexOf(b) - MONTH_ORDER.indexOf(a);
        });

        sortedMonths.forEach(month => {
            const monthGroup = document.createElement('div');
            monthGroup.className = 'history-month-group';

            const count = grouped[year][month].length;
            const monthHeader = document.createElement('div');
            monthHeader.className = 'history-month-header';
            monthHeader.innerHTML = `
                <h4>${month}</h4>
                <span class="count-badge">${count} ${count === 1 ? 'cotización' : 'cotizaciones'}</span>
            `;
            monthGroup.appendChild(monthHeader);

            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'history-cards-container';

            // Ordenar cotizaciones por nombre del cliente alfabéticamente
            const monthQuotes = grouped[year][month].sort((a, b) => {
                return a.cliente.localeCompare(b.cliente, 'es', { sensitivity: 'base' });
            });

            monthQuotes.forEach(q => {
                const card = document.createElement('div');
                card.className = 'quote-card';
                
                const isCert = q.tipo === 'certificado';
                const badgeText = isCert ? 'CERTIFICADO' : 'COTIZACIÓN';
                const badgeClass = isCert ? 'quote-card-badge cert-badge' : 'quote-card-badge';
                const folioDisplay = isCert ? `CERT-${new Date(q.createdAt || Date.now()).getFullYear()}-${q.id.substr(-6)}` : getFolioNumber(q);

                card.innerHTML = `
                    <span class="${badgeClass}">${badgeText}</span>
                    <h4>${q.cliente}</h4>
                    <p>
                        <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                        ${q.direccion}
                    </p>
                    <span class="quote-date">Folio: ${folioDisplay} | Cambio: ${new Date(q.updatedAt).toLocaleDateString('es-MX')}</span>
                    
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

                cardsContainer.appendChild(card);
            });

            monthGroup.appendChild(cardsContainer);
            container.appendChild(monthGroup);
        });
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
        <div class="dynamic-item-header" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: var(--gray-50); border-bottom: 1px solid var(--gray-200); border-radius: var(--radius-md) var(--radius-md) 0 0;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <div class="reorder-arrows" style="display: flex; gap: 4px; align-items: center;">
                    <button type="button" class="btn-arrow-up" style="background: var(--white); border: 1px solid var(--gray-300); border-radius: 4px; padding: 4px 8px; font-size: 11px; color: var(--gray-700); cursor: pointer; display: flex; align-items: center; justify-content: center; height: 26px;">▲</button>
                    <button type="button" class="btn-arrow-down" style="background: var(--white); border: 1px solid var(--gray-300); border-radius: 4px; padding: 4px 8px; font-size: 11px; color: var(--gray-700); cursor: pointer; display: flex; align-items: center; justify-content: center; height: 26px;">▼</button>
                </div>
                <div class="drag-handle" style="display: flex; align-items: center; gap: 3px; color: var(--gray-500); cursor: grab; user-select: none;">
                    <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor; flex-shrink:0;"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                    <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;">Reordenar</span>
                </div>
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

    card.querySelector('.btn-arrow-up').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const prev = card.previousElementSibling;
        if (prev) {
            container.insertBefore(card, prev);
            triggerPreviewSync();
        }
    });

    card.querySelector('.btn-arrow-down').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = card.nextElementSibling;
        if (next) {
            container.insertBefore(card, next.nextSibling);
            triggerPreviewSync();
        }
    });

    card.querySelector('.btn-remove-item').addEventListener('click', () => {
        card.remove();
        triggerPreviewSync();
    });

    card.querySelector('.item-concepto-input').addEventListener('input', () => triggerPreviewSync());
    card.querySelector('.item-descripcion-input').addEventListener('input', () => triggerPreviewSync());

    container.appendChild(card);
}


// Cambiar pestaña activa en el selector de tipo de documento dentro del Editor
function switchDocTypeInEditor(type) {
    const docTypeInput = document.getElementById('field-doc-type');
    if (docTypeInput) docTypeInput.value = type;

    const btnCot = document.getElementById('btn-type-cotizacion');
    const btnCert = document.getElementById('btn-type-certificado');
    const secCot = document.getElementById('editor-sections-cotizacion');
    const secCert = document.getElementById('editor-sections-certificado');

    if (type === 'certificado') {
        if (btnCot) btnCot.classList.remove('active');
        if (btnCert) btnCert.classList.add('active');
        if (secCot) secCot.style.display = 'none';
        if (secCert) secCert.style.display = 'block';
    } else {
        if (btnCert) btnCert.classList.remove('active');
        if (btnCot) btnCot.classList.add('active');
        if (secCert) secCert.style.display = 'none';
        if (secCot) secCot.style.display = 'block';
    }
}

// Abrir el editor unificado para cargar un documento existente o crear uno nuevo
function openEditor(quoteId, defaultType = 'cotizacion') {
    const form = document.getElementById('unified-doc-form');
    if (form) form.reset();

    const dynamicContainer = document.getElementById('dynamic-items-container');
    if (dynamicContainer) dynamicContainer.innerHTML = '';

    if (quoteId) {
        const q = quotes.find(item => item.id === quoteId);
        if (q) {
            currentQuoteId = quoteId;
            document.getElementById('field-id').value = q.id;

            const isCert = q.tipo === 'certificado';
            const docType = isCert ? 'certificado' : 'cotizacion';
            switchDocTypeInEditor(docType);

            if (isCert) {
                const certFields = [
                    'cliente', 'direccion', 'fecha-aplicacion',
                    'tipo-servicio', 'area', 'plaga',
                    'producto', 'dosis', 'metodo',
                    'tecnico', 'puesto', 'proxima'
                ];
                certFields.forEach(f => {
                    const el = document.getElementById(`cert-${f}`);
                    if (el && q[f]) el.value = q[f];
                });
            } else {
                document.getElementById('field-cliente').value = q.cliente || '';
                document.getElementById('field-direccion').value = q.direccion || '';
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

                document.getElementById('field-firmante').value = q.firmante || DEFAULT_QUOTE.firmante;
                document.getElementById('field-puesto').value = q.puesto || DEFAULT_QUOTE.puesto;
            }
        }
    } else {
        currentQuoteId = null;
        document.getElementById('field-id').value = '';
        switchDocTypeInEditor(defaultType);

        if (defaultType === 'certificado') {
            document.getElementById('cert-fecha-aplicacion').value = getLocalISODate();
            document.getElementById('cert-tecnico').value = DEFAULT_QUOTE.firmante;
            document.getElementById('cert-puesto').value = DEFAULT_QUOTE.puesto;
        } else {
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
    }

    switchTab('editor');
    triggerPreviewSync();
}

// Sincronizar cotización guardada con el repositorio de GitHub
async function syncQuoteToGitHub(quoteData) {
    let pat = localStorage.getItem('coplame_github_pat');
    if (!pat) {
        pat = prompt("🔑 Para sincronizar automáticamente con Google Drive, ingresa tu GitHub Personal Access Token (PAT):");
        if (pat && pat.trim()) {
            pat = pat.trim();
            localStorage.setItem('coplame_github_pat', pat);
        } else {
            alert("ℹ️ El documento se guardó localmente en este dispositivo. Para subirlo a Google Drive, configura tu Token de GitHub en el ícono de engranaje (⚙️).");
            return;
        }
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
            alert("✅ ¡Documento sincronizado en Google Drive!");
        } else {
            const errData = await putResponse.json();
            console.error("Error al sincronizar con GitHub:", errData);
            alert("⚠️ Error al sincronizar con Google Drive: " + (errData.message || "Token inválido"));
        }
    } catch (err) {
        console.error("Error de conexión al sincronizar con GitHub:", err);
        alert("⚠️ No se pudo conectar con Google Drive. Revisa tu conexión o token.");
    }
}

// Guardar documento (Cotización o Certificado)
function saveDocument(e) {
    if (e) e.preventDefault();

    const id = document.getElementById('field-id').value;
    const isNew = !id;
    const docTypeInput = document.getElementById('field-doc-type');
    const docType = docTypeInput ? docTypeInput.value : 'cotizacion';
    const isCert = docType === 'certificado';

    let data = {};

    if (isCert) {
        const certFields = [
            'cliente', 'direccion', 'fecha-aplicacion',
            'tipo-servicio', 'area', 'plaga',
            'producto', 'dosis', 'metodo',
            'tecnico', 'puesto', 'proxima'
        ];
        
        data = {
            id: isNew ? 'q_' + Date.now() : id,
            tipo: 'certificado',
            createdAt: isNew ? Date.now() : (quotes.find(q => q.id === id)?.createdAt || Date.now()),
            updatedAt: Date.now()
        };

        certFields.forEach(f => {
            const el = document.getElementById(`cert-${f}`);
            if (el) data[f] = el.value;
        });

        if (data.cliente) addClientIfNew(data.cliente, data.direccion);
    } else {
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

        data = {
            id: isNew ? 'q_' + Date.now() : id,
            tipo: 'cotizacion',
            cliente: document.getElementById('field-cliente').value,
            direccion: document.getElementById('field-direccion').value,
            fecha: document.getElementById('field-fecha').value,
            items: items,
            firmante: document.getElementById('field-firmante').value,
            puesto: document.getElementById('field-puesto').value,
            createdAt: isNew ? Date.now() : (quotes.find(q => q.id === id)?.createdAt || Date.now()),
            updatedAt: Date.now()
        };

        if (data.cliente) addClientIfNew(data.cliente, data.direccion);
    }

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
    updatePreview(data);
    switchTab('preview');
    syncQuoteToGitHub(data);
}

// Duplicar cotización
function duplicateQuote(id) {
    const q = quotes.find(item => item.id === id);
    if (q) {
        const isCert = q.tipo === 'certificado';
        const copy = {
            ...q,
            id: 'q_' + Date.now(),
            cliente: q.cliente + ' (Copia)',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        if (isCert) {
            copy['fecha-aplicacion'] = getLocalISODate();
        } else {
            copy.fecha = getLocalISODate();
        }
        
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
    const quoteFields = ['cliente', 'direccion', 'fecha', 'firmante', 'puesto'];
    quoteFields.forEach(field => {
        const el = document.getElementById(`field-${field}`);
        if (el) {
            el.addEventListener('input', () => triggerPreviewSync());
        }
    });

    const certFields = [
        'cliente', 'direccion', 'fecha-aplicacion',
        'tipo-servicio', 'area', 'plaga',
        'producto', 'dosis', 'metodo',
        'tecnico', 'puesto', 'proxima'
    ];
    certFields.forEach(field => {
        const el = document.getElementById(`cert-${field}`);
        if (el) {
            el.addEventListener('input', () => triggerPreviewSync());
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
    const docTypeInput = document.getElementById('field-doc-type');
    const docType = docTypeInput ? docTypeInput.value : 'cotizacion';
    const isCert = docType === 'certificado';

    const templateId = isCert ? 'cert-sheet-template' : 'quote-sheet-template';
    const template = document.getElementById(templateId);
    if (!template || !previewSheet) return;
    
    previewSheet.innerHTML = '';
    previewSheet.appendChild(template.content.cloneNode(true));

    if (isCert) {
        const certFields = [
            'cliente', 'direccion', 'fecha-aplicacion',
            'tipo-servicio', 'area', 'plaga',
            'producto', 'dosis', 'metodo',
            'tecnico', 'puesto', 'proxima'
        ];
        const certData = {
            id: document.getElementById('field-id').value || 'new',
            createdAt: Date.now()
        };
        certFields.forEach(f => {
            const el = document.getElementById(`cert-${f}`);
            if (el) certData[f] = el.value;
        });

        renderCertificateToSheet(previewSheet, certData);
    } else {
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
            createdAt: document.getElementById('field-id').value ? (quotes.find(q => q.id === document.getElementById('field-id').value)?.createdAt || Date.now()) : Date.now(),
            items: items
        };

        renderDynamicItemsToSheet(previewSheet, mockQuote);
    }
}

// Actualizar la hoja de previsualización con un objeto de cotización guardado
function updatePreview(quoteData) {
    const previewSheet = document.getElementById('preview-sheet');
    const isCert = quoteData.tipo === 'certificado';
    const templateId = isCert ? 'cert-sheet-template' : 'quote-sheet-template';
    const template = document.getElementById(templateId);
    
    previewSheet.innerHTML = '';
    previewSheet.appendChild(template.content.cloneNode(true));

    if (isCert) {
        renderCertificateToSheet(previewSheet, quoteData);
    } else {
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
}

// Imprimir o guardar como PDF
function printCurrentQuote() {
    if (!currentQuoteId) return;
    
    const quote = quotes.find(q => q.id === currentQuoteId);
    if (!quote) return;

    const isCert = quote.tipo === 'certificado';
    const printDoc = document.getElementById(isCert ? 'print-certificate' : 'print-document');
    const templateId = isCert ? 'cert-sheet-template' : 'quote-sheet-template';
    const template = document.getElementById(templateId);
    
    printDoc.innerHTML = '';
    printDoc.appendChild(template.content.cloneNode(true));

    if (isCert) {
        renderCertificateToSheet(printDoc, quote);
    } else {
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
    }

    const originalTitle = document.title;
    const docName = isCert ? 'Certificado' : 'Cotizacion';
    document.title = `${docName} Coplame - ${quote.cliente}`;
    
    printDoc.setAttribute('data-print-active', 'true');
    
    setTimeout(() => {
        window.print();
        setTimeout(() => {
            printDoc.removeAttribute('data-print-active');
            document.title = originalTitle;
        }, 100);
    }, 50);
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

// Compartir cotización actual o certificado (Genera archivo PDF real para WhatsApp / Web Share)
async function shareCurrentQuote() {
    if (!currentQuoteId) return;
    const quote = quotes.find(q => q.id === currentQuoteId);
    if (!quote) return;

    const isCert = quote.tipo === 'certificado';
    const docType = isCert ? 'Certificado' : 'Cotizacion';
    const title = `${docType} Coplame - ${quote.cliente}`;
    const folio = isCert ? `CERT-${new Date(quote.createdAt || Date.now()).getFullYear()}-${quote.id.substr(-6)}` : getFolioNumber(quote);
    const dateField = isCert ? quote['fecha-aplicacion'] : quote.fecha;
    const text = `${docType} Coplame para ${quote.cliente}\nFolio: ${folio}\nFecha: ${formatSpanishDateString(dateField)}`;
    const sanitizedClient = (quote.cliente || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${docType}_Coplame_${sanitizedClient}_${folio}.pdf`;

    const previewSheet = document.getElementById('preview-sheet');
    const btnShare = document.getElementById('btn-share');
    const originalContent = btnShare ? btnShare.innerHTML : '';
    if (btnShare) btnShare.innerHTML = '⏳ Generando PDF...';

    try {
        let pdfFile = null;
        if (window.html2pdf && previewSheet) {
            const opt = {
                margin: [5, 5, 5, 5],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
            };
            
            // Usar outputPdf('blob') de html2pdf.js
            const pdfBlob = await html2pdf().set(opt).from(previewSheet).outputPdf('blob');
            pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
        }

        if (pdfFile && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
            await navigator.share({
                title: title,
                text: text,
                files: [pdfFile]
            });
        } else if (pdfFile) {
            // Fallback para escritorios / navegadores sin compartir archivo nativo: Descargar el PDF directamente
            const opt = {
                margin: [5, 5, 5, 5],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
            };
            await html2pdf().set(opt).from(previewSheet).save();
        } else if (navigator.share) {
            await navigator.share({ title, text });
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.warn('Share error:', err);
            alert("⚠️ No se pudo compartir el PDF directamente. Utiliza el botón 'Imprimir / PDF' para guardarlo.");
        }
    } finally {
        if (btnShare) btnShare.innerHTML = originalContent;
    }
}

function initCertModule() {
    // Unificado en el módulo principal del Editor
}

function renderCertificateToSheet(container, certData) {
    const fields = [
        'cliente', 'direccion', 'fecha-aplicacion',
        'tipo-servicio', 'area', 'plaga',
        'producto', 'dosis', 'metodo',
        'tecnico', 'puesto'
    ];

    fields.forEach(field => {
        const valEl = container.querySelector(`.cert-val-${field}`);
        if (valEl) {
            const val = certData[field] || '';
            valEl.textContent = field.includes('fecha') && val ? formatSpanishDateString(val) : val;
        }
    });

    // Próxima aplicación
    const proximaEl = container.querySelector('.cert-val-proxima');
    if (proximaEl) {
        proximaEl.textContent = certData['proxima']
            ? formatSpanishDateString(certData['proxima'])
            : 'A definir';
    }

    // Folio del certificado
    const folioEl = container.querySelector('.cert-val-folio');
    if (folioEl) {
        const ts = certData.id ? certData.id.substr(-6) : Date.now().toString().substr(-6);
        folioEl.textContent = `CERT-${new Date(certData.createdAt || Date.now()).getFullYear()}-${ts}`;
    }
}

// ---- PANTALLA DE BLOQUEO PIN ----
const CORRECT_PIN = "3465";
let enteredPin = "";

function initPinLock() {
    const lockScreen = document.getElementById('pin-lock-screen');
    const dots = document.querySelectorAll('.pin-dot');
    const statusMsg = document.getElementById('pin-status-msg');
    
    if (sessionStorage.getItem('coplame_authenticated') === 'true') {
        lockScreen.style.display = 'none';
        return;
    }
    
    // Mostrar pantalla de bloqueo
    lockScreen.style.display = 'flex';
    
    const updateDots = () => {
        dots.forEach((dot, idx) => {
            if (idx < enteredPin.length) {
                dot.classList.add('filled');
            } else {
                dot.classList.remove('filled');
            }
        });
    };
    
    const keys = document.querySelectorAll('.pin-key');
    keys.forEach(key => {
        key.addEventListener('click', () => {
            const val = key.getAttribute('data-val');
            
            if (val === 'clear') {
                enteredPin = "";
                statusMsg.textContent = "Ingresa el PIN de acceso";
                statusMsg.classList.remove('error-text');
                dots.forEach(d => {
                    d.classList.remove('error');
                    d.classList.remove('filled');
                });
                updateDots();
            } else if (val === 'back') {
                if (enteredPin.length > 0) {
                    enteredPin = enteredPin.slice(0, -1);
                    statusMsg.textContent = "Ingresa el PIN de acceso";
                    statusMsg.classList.remove('error-text');
                    dots.forEach(d => d.classList.remove('error'));
                    updateDots();
                }
            } else {
                if (enteredPin.length < 4) {
                    enteredPin += val;
                    updateDots();
                    
                    if (enteredPin.length === 4) {
                        if (enteredPin === CORRECT_PIN) {
                            sessionStorage.setItem('coplame_authenticated', 'true');
                            lockScreen.style.opacity = '0';
                            setTimeout(() => {
                                lockScreen.style.display = 'none';
                            }, 300);
                        } else {
                            // PIN Incorrecto
                            enteredPin = "";
                            statusMsg.textContent = "PIN Incorrecto. Intenta de nuevo.";
                            statusMsg.classList.add('error-text');
                            dots.forEach(d => {
                                d.classList.add('error');
                                setTimeout(() => d.classList.remove('error'), 300);
                            });
                            setTimeout(() => {
                                updateDots();
                            }, 300);
                        }
                    }
                }
            }
        });
    });
}

