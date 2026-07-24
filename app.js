// app.js - Coplame Quotation Web App

// Base de Datos en LocalStorage
const DB_KEY = 'coplame_quotes';

// Valores por defecto para una nueva cotización
const DEFAULT_QUOTE = {
    cliente: '',
    direccion: '',
    fecha: '',
    items: [
        { label: 'TIPO DE SERVICIO:', value: 'Desinsectización ( Fumigación )' },
        { label: 'AREA A APLICAR:', value: 'Casas y Areas Comunes ( Registros de Drenajes )' },
        { label: 'PLAGUICIDAS A APLICAR:', value: 'Insecticidas a base de Piretroides de Amplio espectro de Acción' },
        { label: 'PLAGA A CONTROLAR:', value: 'Insectos Rastreros, Voladores en General' },
        { label: 'PERIODICIDAD SUGERIDA:', value: 'Trimestral' },
        { label: 'COSTO UNITARIO POR APLICACIÓN EN CASAS INCLUYENDO REGISTRO:', value: '$ 1´000.00 A Partir de 3' },
        { label: 'COSTO POR REGISTRO:', value: '$ 350.00 A Partir de 5' },
        { label: 'CONDICIONES DE PAGO:', value: 'Contado Efectivo' },
        { label: 'VIGENCIA:', value: '2026' },
        { label: 'GARANTIA.', value: '30 DIAS' }
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
        addDynamicItemRow('', '');
        triggerPreviewSync();
    });

    // 10. Configurar Acordeones en Formulario
    initAccordions();

    // 11. Actualizar preview en tiempo real al escribir en los campos básicos
    bindFormRealtimePreview();
}

// Switch entre vistas principales
function switchTab(tabName) {
    // Desactivar todos los tabs y vistas
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));

    // Activar el tab seleccionado
    const tabEl = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
    if (tabEl) tabEl.classList.add('active');

    // Activar la vista seleccionada
    const viewEl = document.getElementById(`view-${tabName}`);
    if (viewEl) viewEl.classList.add('active');

    // Desplazarse arriba
    document.querySelector('.app-content').scrollTop = 0;

    // Si entramos a vista previa, asegurarnos de cargar la cotización actual
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
            
            // Cerrar otros
            accordions.forEach(acc => acc.classList.remove('expanded'));
            
            // Si no estaba expandido, abrirlo
            if (!isExpanded) {
                item.classList.add('expanded');
            }
        });
    });
}

// Obtener fecha de hoy formateada en español (Ej: 24 de Julio de 2026)
function getFormattedTodayDate() {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const d = new Date();
    const dia = d.getDate();
    const mes = meses[d.getMonth()];
    const anio = d.getFullYear();
    return `${dia} de ${mes} de ${anio}`;
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

    // Ordenar de más reciente a más antigua
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

        // Eventos
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

        // Click en la tarjeta entera también la abre
        card.addEventListener('click', () => {
            currentQuoteId = q.id;
            switchTab('preview');
        });

        container.appendChild(card);
    });
}

// Agregar una fila de campo dinámico en el editor
function addDynamicItemRow(label, value) {
    const container = document.getElementById('dynamic-items-container');
    const rowId = 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    const card = document.createElement('div');
    card.className = 'dynamic-item-card';
    card.id = rowId;
    card.innerHTML = `
        <div class="dynamic-item-header">
            <span>Elemento</span>
            <button type="button" class="btn-remove-item" data-row-id="${rowId}">
                <svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                Quitar
            </button>
        </div>
        <div class="form-group">
            <label>Etiqueta / Concepto (Ej. TIPO DE SERVICIO: o COSTO UNITARIO:)</label>
            <input type="text" class="item-label-input" value="${label}" placeholder="Ej. CONDICIONES DE PAGO:" required>
        </div>
        <div class="form-group">
            <label>Descripción / Valor</label>
            <textarea class="item-value-input" rows="2" placeholder="Ej. Contado Efectivo" required>${value}</textarea>
        </div>
    `;

    // Eventos
    card.querySelector('.btn-remove-item').addEventListener('click', () => {
        card.remove();
        triggerPreviewSync();
    });

    // Cambios en tiempo real
    card.querySelector('.item-label-input').addEventListener('input', () => triggerPreviewSync());
    card.querySelector('.item-value-input').addEventListener('input', () => triggerPreviewSync());

    container.appendChild(card);
}

// Abrir el editor para una cotización (nueva o existente)
function openEditor(quoteId) {
    const form = document.getElementById('quote-form');
    form.reset();

    const itemsContainer = document.getElementById('dynamic-items-container');
    itemsContainer.innerHTML = '';

    // Expandir el primer acordeón por defecto
    document.querySelectorAll('.accordion-item').forEach((acc, idx) => {
        if (idx === 0) acc.classList.add('expanded');
        else acc.classList.remove('expanded');
    });

    if (quoteId) {
        // Cargar existente
        const q = quotes.find(item => item.id === quoteId);
        if (q) {
            currentQuoteId = quoteId;
            document.getElementById('field-id').value = q.id;
            document.getElementById('field-cliente').value = q.cliente;
            document.getElementById('field-direccion').value = q.direccion;
            document.getElementById('field-fecha').value = q.fecha;
            
            // Cargar campos dinámicos
            if (q.items && Array.isArray(q.items)) {
                q.items.forEach(item => addDynamicItemRow(item.label, item.value));
            }

            document.getElementById('field-firmante').value = q.firmante;
            document.getElementById('field-puesto').value = q.puesto;
        }
    } else {
        // Nueva cotización (Valores predefinidos)
        currentQuoteId = null;
        document.getElementById('field-id').value = '';
        document.getElementById('field-cliente').value = '';
        document.getElementById('field-direccion').value = '';
        document.getElementById('field-fecha').value = getFormattedTodayDate();
        
        // Cargar campos dinámicos predeterminados
        DEFAULT_QUOTE.items.forEach(item => addDynamicItemRow(item.label, item.value));

        document.getElementById('field-firmante').value = DEFAULT_QUOTE.firmante;
        document.getElementById('field-puesto').value = DEFAULT_QUOTE.puesto;
    }

    switchTab('editor');
    
    // Forzar actualización inicial del preview con los datos cargados en el form
    triggerPreviewSync();
}

// Guardar cotización
function saveQuote() {
    const id = document.getElementById('field-id').value;
    const isNew = !id;

    // Recopilar campos dinámicos
    const items = [];
    const itemCards = document.querySelectorAll('#dynamic-items-container .dynamic-item-card');
    itemCards.forEach(card => {
        const label = card.querySelector('.item-label-input').value;
        const value = card.querySelector('.item-value-input').value;
        items.push({ label, value });
    });

    const data = {
        id: isNew ? 'q_' + Date.now() : id,
        cliente: document.getElementById('field-cliente').value,
        direccion: document.getElementById('field-direccion').value,
        fecha: document.getElementById('field-fecha').value,
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
    
    // Actualizar lista
    renderList();
    
    // Ir a la vista previa para ver el resultado final
    switchTab('preview');
}

// Duplicar cotización
function duplicateQuote(id) {
    const q = quotes.find(item => item.id === id);
    if (q) {
        const copy = {
            ...q,
            id: 'q_' + Date.now(),
            cliente: q.cliente + ' (Copia)',
            fecha: getFormattedTodayDate(),
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
                    valEl.textContent = el.value;
                }
            });
        }
    });
}

// Auxiliar para inyectar los ítems dinámicos en una hoja de cotización
function renderDynamicItemsToSheet(sheetElement, quoteData) {
    const servicesBody = sheetElement.querySelector('.val-services-table-body');
    const costsBody = sheetElement.querySelector('.val-costs-table-body');
    const folioEl = sheetElement.querySelector('.val-quote-number');
    
    if (folioEl) {
        folioEl.textContent = getFolioNumber(quoteData);
    }

    if (!servicesBody || !costsBody) return;

    servicesBody.innerHTML = '';
    costsBody.innerHTML = '';

    const itemsArray = quoteData.items;
    if (!itemsArray || !Array.isArray(itemsArray)) return;

    // Palabras clave para costos y condiciones
    const costKeywords = ['COSTO', 'PRECIO', 'CONDICION', 'PAGO', 'VIGENCIA', 'GARANTIA', 'TOTAL', '$', 'IMPORTE'];

    itemsArray.forEach(item => {
        const isCost = costKeywords.some(kw => item.label.toUpperCase().includes(kw));
        const row = document.createElement('tr');
        
        if (isCost) {
            // Formatear valor si contiene un precio para que sea súper claro y evidente
            let formattedValue = item.value;
            // Si el valor contiene un signo $, lo envolvemos en un estilo destacado
            if (item.value.includes('$')) {
                // Separar la parte del precio de la parte de texto si aplica
                // Ej: "$ 1´000.00 A Partir de 3" -> "$ 1´000.00" destacado, "A Partir de 3" secundario
                const match = item.value.match(/(\$[^\s]+)(.*)/);
                if (match) {
                    formattedValue = `<span class="cost-value-highlight">${match[1]}</span><span style="font-size: 11px; color:#555; display:block; margin-top:2px; font-weight:normal;">${match[2].trim()}</span>`;
                } else {
                    formattedValue = `<span class="cost-value-highlight">${item.value}</span>`;
                }
            } else {
                formattedValue = `<span style="font-weight: 600; color: #0b4c2b;">${item.value}</span>`;
            }

            row.innerHTML = `
                <td style="font-weight: 600; color: #2d3748; padding: 10px 12px; font-size:12px;">${item.label}</td>
                <td style="text-align: right; vertical-align: middle; padding: 10px 12px; font-size:12px;">${formattedValue}</td>
            `;
            costsBody.appendChild(row);
        } else {
            row.innerHTML = `
                <td style="font-weight: 600; color: #2d3748; padding: 10px 12px; font-size:12px;">${item.label}</td>
                <td style="padding: 10px 12px; font-size:12px; line-height: 1.4; color: #4a5568;">${item.value}</td>
            `;
            servicesBody.appendChild(row);
        }
    });

    // Si alguna de las tablas queda vacía, agregar una fila indicativa para no romper el diseño
    if (servicesBody.children.length === 0) {
        servicesBody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:#888; padding: 15px;">Sin detalles de servicio</td></tr>`;
    }
    if (costsBody.children.length === 0) {
        costsBody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:#888; padding: 15px;">Sin costos especificados</td></tr>`;
    }
}

// Forzar la sincronización manual del preview con los datos de los inputs del formulario
function triggerPreviewSync() {
    const previewSheet = document.getElementById('preview-sheet');
    
    // Limpiar preview y cargar el template nuevo
    const template = document.getElementById('quote-sheet-template');
    previewSheet.innerHTML = '';
    previewSheet.appendChild(template.content.cloneNode(true));

    // Sincronizar campos principales
    const fields = ['cliente', 'direccion', 'fecha', 'firmante', 'puesto'];
    fields.forEach(field => {
        const inputEl = document.getElementById(`field-${field}`);
        const previewValEl = previewSheet.querySelector(`.val-${field}`);
        if (inputEl && previewValEl) {
            previewValEl.textContent = inputEl.value;
        }
    });

    // Sincronizar campos dinámicos
    const items = [];
    const itemCards = document.querySelectorAll('#dynamic-items-container .dynamic-item-card');
    itemCards.forEach(card => {
        const label = card.querySelector('.item-label-input').value;
        const value = card.querySelector('.item-value-input').value;
        items.push({ label, value });
    });

    // Crear un objeto ficticio para el Folio
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

    // Llenar campos estáticos
    const fields = ['cliente', 'direccion', 'fecha', 'firmante', 'puesto'];
    fields.forEach(key => {
        const valEl = previewSheet.querySelector(`.val-${key}`);
        if (valEl) {
            valEl.textContent = quoteData[key];
        }
    });

    // Llenar campos dinámicos
    renderDynamicItemsToSheet(previewSheet, quoteData);
}

// Imprimir o guardar como PDF
function printCurrentQuote() {
    if (!currentQuoteId) return;
    
    const quote = quotes.find(q => q.id === currentQuoteId);
    if (!quote) return;

    // Poblar el contenedor para impresión
    const printDoc = document.getElementById('print-document');
    const template = document.getElementById('quote-sheet-template');
    
    printDoc.innerHTML = '';
    printDoc.appendChild(template.content.cloneNode(true));

    // Llenar campos estáticos
    const fields = ['cliente', 'direccion', 'fecha', 'firmante', 'puesto'];
    fields.forEach(key => {
        const valEl = printDoc.querySelector(`.val-${key}`);
        if (valEl) {
            valEl.textContent = quote[key];
        }
    });

    // Llenar campos dinámicos
    renderDynamicItemsToSheet(printDoc, quote);

    // Cambiar dinámicamente el título del documento
    const originalTitle = document.title;
    document.title = `Cotizacion Coplame - ${quote.cliente}`;

    // Disparar diálogo del sistema
    window.print();

    // Restaurar título
    document.title = originalTitle;
}
