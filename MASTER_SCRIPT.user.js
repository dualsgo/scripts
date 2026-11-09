// ==UserScript==
// @name         Super Master Monitor OMNI - Linx OMS, iFood & Rappi
// @namespace    http://tampermonkey.net/
// @version      8.1.0
// @description  Suíte completa e unificada de Monitoramento OMNI: Dashboard de TV Fullscreen, Alertas Sonoros, Monitor PC Separação & Despacho, SLA 7 Dias Retirada Loja com WhatsApp, Modo Mobile e Coletores em tempo real de iFood e Rappi.
// @author       Antigravity AI
// @match        https://*.linxoms.com.br/*
// @match        *://*.linxoms.com.br/*
// @match        https://*.ifood.com.br/*
// @match        https://gestordepedidos.ifood.com.br/*
// @match        https://merchant.ifood.com.br/*
// @match        https://separador.ifood.com.br/*
// @match        https://*.rappi.com/*
// @match        https://*.rappi.com.br/*
// @match        https://mitienda.rappi.com.br/*
// @connect      linxoms.com.br
// @connect      rihappy.com.br
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

/**
 * ============================================================================
 * SUPER MASTER MONITOR OMNI (VERSÃO CONSOLIDADA 8.1.0)
 * ============================================================================
 * Módulos compilados neste arquivo único:
 * 1. MÓDULO IFOOD (Coleta em segundo plano + Alerta visual no portal do iFood)
 * 2. MÓDULO RAPPI (Coleta em segundo plano + Alerta visual no portal da Rappi)
 * 3. MÓDULO PC SEPARAÇÃO & DESPACHO (Linx OMNI - Lista de Despacho & Retirada 7 Dias)
 * 4. MÓDULO MOBILE OMNI (Layout compacto para celulares/coletores com som em background)
 * 5. MÓDULO PRINCIPAL TV DASHBOARD OMS (Painel Fullscreen Neon, SLA, Rotação e Sirene)
 * ============================================================================
 */

(function () {
    'use strict';

    const currentHost = window.location.hostname;
    const currentHref = window.location.href;

    // Roteamento inteligente de domínios
    const isIfood = currentHost.includes('ifood.com.br');
    const isRappi = currentHost.includes('rappi.com');
    const isLinxOms = currentHost.includes('linxoms.com.br') || currentHost.includes('rihappy.com.br');

    console.log('[OMNI MONITOR] Iniciando no domínio:', currentHost);

    // =========================================================================
    // 1. MÓDULO DE MONITORAMENTO & COLETA IFOOD
    // =========================================================================
    if (isIfood) {
        let ifoodModalElement = null;

        function createIfoodVisualModal() {
            if (ifoodModalElement) return;

            const fontLink = document.createElement('link');
            fontLink.rel = 'stylesheet';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Lilita+One&display=swap';
            document.head.appendChild(fontLink);

            const style = document.createElement('style');
            style.innerHTML = `
                @keyframes pulseIfoodRed {
                    0% { box-shadow: 0 0 25px rgba(234, 29, 44, 0.4); border-color: #ea1d2c; }
                    50% { box-shadow: 0 0 60px rgba(234, 29, 44, 0.9); border-color: #ff3e3e; }
                    100% { box-shadow: 0 0 25px rgba(234, 29, 44, 0.4); border-color: #ea1d2c; }
                }
                .ifood-alert-modal {
                    position: fixed;
                    top: 40px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: linear-gradient(135deg, rgba(20, 0, 0, 0.95), rgba(40, 0, 0, 0.98));
                    border: 4px solid #ea1d2c;
                    border-radius: 24px;
                    padding: 25px 45px;
                    z-index: 9999999;
                    display: none;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 20px 60px rgba(234, 29, 44, 0.5);
                    backdrop-filter: blur(15px);
                    font-family: 'Lilita One', cursive, sans-serif;
                    color: #fff;
                    animation: pulseIfoodRed 1.5s infinite ease-in-out;
                    pointer-events: none;
                }
                .ifood-alert-modal.show {
                    display: flex;
                }
                .ifood-alert-title {
                    font-size: 26px;
                    color: #ff3e3e;
                    text-transform: uppercase;
                    margin-bottom: 8px;
                    letter-spacing: 1px;
                }
                .ifood-alert-count {
                    font-size: 48px;
                    color: #fff;
                    margin: 5px 0;
                    text-shadow: 0 0 20px #ea1d2c;
                }
                .ifood-alert-sub {
                    font-size: 16px;
                    color: #aaa;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
            `;
            document.head.appendChild(style);

            ifoodModalElement = document.createElement('div');
            ifoodModalElement.className = 'ifood-alert-modal';
            ifoodModalElement.innerHTML = `
                <div class="ifood-alert-title">🚨 NOVO PEDIDO IFOOD PENDENTE! 🚨</div>
                <div class="ifood-alert-count" id="ifood-modal-count">0</div>
                <div class="ifood-alert-sub">PEDIDO(S) AGUARDANDO ACEITE / SEPARAÇÃO</div>
            `;
            document.body.appendChild(ifoodModalElement);
        }

        function updateIfoodModal(count) {
            createIfoodVisualModal();
            if (!ifoodModalElement) return;
            const countEl = document.getElementById('ifood-modal-count');
            if (count > 0) {
                if (countEl) countEl.innerText = count;
                ifoodModalElement.classList.add('show');
            } else {
                ifoodModalElement.classList.remove('show');
            }
        }

        setInterval(() => {
            let newOrdersCount = 0;
            let aguardandoColetaCount = 0;
            let isLoggedIn = true;

            try {
                if (document.querySelector('input[type="password"]')) {
                    isLoggedIn = false;
                }

                const pedidosLink = document.querySelector('a[href*="/order/latest"]');
                if (pedidosLink) {
                    const outputEl = pedidosLink.querySelector('output');
                    if (outputEl && outputEl.textContent) {
                        const val = parseInt(outputEl.textContent.trim(), 10);
                        if (!isNaN(val)) newOrdersCount = val;
                    }
                } else {
                    const outputByAria = document.querySelector('output[aria-label*="pedidos"]');
                    if (outputByAria && outputByAria.textContent) {
                        const val = parseInt(outputByAria.textContent.trim(), 10);
                        if (!isNaN(val)) newOrdersCount = val;
                    } else {
                        const pElements = Array.from(document.querySelectorAll('p'));
                        const pedidosP = pElements.find(p => p.textContent && p.textContent.trim().toLowerCase() === 'pedidos');
                        if (pedidosP && pedidosP.parentElement) {
                            const outputEl = pedidosP.parentElement.querySelector('output');
                            if (outputEl && outputEl.textContent) {
                                const val = parseInt(outputEl.textContent.trim(), 10);
                                if (!isNaN(val)) newOrdersCount = val;
                            }
                        }
                    }
                }

                try {
                    const expedicaoLink = document.querySelector('a[href*="/order/expedition"]');
                    if (expedicaoLink) {
                        const outputEl = expedicaoLink.querySelector('output');
                        if (outputEl && outputEl.textContent) {
                            const val = parseInt(outputEl.textContent.replace(/[^0-9]/g, ''), 10);
                            if (!isNaN(val)) aguardandoColetaCount = val;
                        }
                    }

                    if (aguardandoColetaCount === 0) {
                        const headers = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, span, div, button'));
                        const prontoEl = headers.find(el => {
                            const t = el.textContent ? el.textContent.trim().toLowerCase() : '';
                            return t === 'prontos' || t === 'pronto' || t === 'aguardando entregador' || t === 'aguardando coleta' || t === 'expedição';
                        });
                        if (prontoEl && prontoEl.parentElement) {
                            const numEl = prontoEl.parentElement.querySelector('output, span.badge, div.badge');
                            if (numEl && numEl.textContent) {
                                const val = parseInt(numEl.textContent.replace(/[^0-9]/g, ''), 10);
                                if (!isNaN(val)) aguardandoColetaCount = val;
                            } else {
                                const txt = prontoEl.parentElement.textContent.replace(/[^0-9]/g, '');
                                if (txt) aguardandoColetaCount = parseInt(txt, 10);
                            }
                        }
                    }
                } catch (e) { }

                let ifoodOrderDetails = null;
                try {
                    const h1s = Array.from(document.querySelectorAll('h1'));
                    const orderH1 = h1s.find(h => h.textContent && h.textContent.includes('IFOOD') && h.textContent.includes('#'));
                    if (orderH1) {
                        let prazo = "NOVO PEDIDO IFOOD PENDENTE SEPARAÇÃO";
                        const pElements = Array.from(document.querySelectorAll('p'));
                        const prazoEl = pElements.find(p => p.textContent && (p.textContent.toLowerCase().includes('inicie em') || p.textContent.toLowerCase().includes('separar até')));
                        if (prazoEl) {
                            prazo = prazoEl.textContent.trim().toUpperCase();
                        } else {
                            const h1Times = h1s.find(h => h.textContent && h.textContent.includes(':'));
                            if (h1Times) prazo = "INICIE EM " + h1Times.textContent.trim() + " HORAS";
                        }

                        let items = [];
                        const productNames = document.querySelectorAll('[data-testid^="product-card-"] p[id^="product-name-"]');
                        if (productNames.length === 0) {
                            const fallbackNames = document.querySelectorAll('[id^="product-name-"]');
                            fallbackNames.forEach(p => { items.push({ name: p.textContent.trim(), quantity: 1, imageUrl: '' }); });
                        } else {
                            productNames.forEach(p => {
                                let imgUrl = '';
                                const card = p.closest('[data-testid^="product-card-"]');
                                if (card) {
                                    const img = card.querySelector('img');
                                    if (img) imgUrl = img.src;
                                }
                                items.push({ name: p.textContent.trim(), quantity: 1, imageUrl: imgUrl });
                            });
                        }

                        if (items.length > 0) {
                            ifoodOrderDetails = {
                                id: 'IFOOD-DETALHADO',
                                statusNativo: 'WAITING',
                                createdAt: new Date().toISOString(),
                                isExpress: true,
                                carrier: prazo,
                                deliveryType: 'EXPRESS',
                                customerName: 'App Separador iFood',
                                items: items
                            };
                        }
                    }
                } catch (e) { }

                GM_setValue('ifoodOrderDetails', ifoodOrderDetails ? JSON.stringify(ifoodOrderDetails) : null);
                updateIfoodModal(newOrdersCount);

            } catch (e) {
                console.error("[OMNI MONITOR] Erro no coletor iFood:", e);
            }

            GM_setValue('ifoodPendingOrders', newOrdersCount);
            GM_setValue('ifoodAguardandoColeta', aguardandoColetaCount);
            GM_setValue('ifoodLastUpdate', Date.now());
            GM_setValue('ifoodLoggedIn', isLoggedIn);
        }, 3000);

        console.log("[OMNI MONITOR] Coletor iFood ativo e sincronizando via GM Storage.");
        return;
    }

    // =========================================================================
    // 2. MÓDULO DE MONITORAMENTO & COLETA RAPPI
    // =========================================================================
    if (isRappi) {
        let rappiModalElement = null;

        function createRappiVisualModal() {
            if (rappiModalElement) return;

            const fontLink = document.createElement('link');
            fontLink.rel = 'stylesheet';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Lilita+One&display=swap';
            document.head.appendChild(fontLink);

            const style = document.createElement('style');
            style.innerHTML = `
                @keyframes pulseRappiOrange {
                    0% { box-shadow: 0 0 25px rgba(255, 68, 56, 0.4); border-color: #ff4438; }
                    50% { box-shadow: 0 0 60px rgba(255, 68, 56, 0.9); border-color: #ff6b5c; }
                    100% { box-shadow: 0 0 25px rgba(255, 68, 56, 0.4); border-color: #ff4438; }
                }
                .rappi-alert-modal {
                    position: fixed;
                    top: 40px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: linear-gradient(135deg, rgba(25, 10, 5, 0.95), rgba(45, 15, 5, 0.98));
                    border: 4px solid #ff4438;
                    border-radius: 24px;
                    padding: 25px 45px;
                    z-index: 9999999;
                    display: none;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 20px 60px rgba(255, 68, 56, 0.5);
                    backdrop-filter: blur(15px);
                    font-family: 'Lilita One', cursive, sans-serif;
                    color: #fff;
                    animation: pulseRappiOrange 1.5s infinite ease-in-out;
                    pointer-events: none;
                }
                .rappi-alert-modal.show {
                    display: flex;
                }
                .rappi-alert-title {
                    font-size: 26px;
                    color: #ff6b5c;
                    text-transform: uppercase;
                    margin-bottom: 8px;
                    letter-spacing: 1px;
                }
                .rappi-alert-count {
                    font-size: 48px;
                    color: #fff;
                    margin: 5px 0;
                    text-shadow: 0 0 20px #ff4438;
                }
                .rappi-alert-sub {
                    font-size: 16px;
                    color: #aaa;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
            `;
            document.head.appendChild(style);

            rappiModalElement = document.createElement('div');
            rappiModalElement.className = 'rappi-alert-modal';
            rappiModalElement.innerHTML = `
                <div class="rappi-alert-title">🛵 NOVO PEDIDO RAPPI PENDENTE! 🛵</div>
                <div class="rappi-alert-count" id="rappi-modal-count">0</div>
                <div class="rappi-alert-sub">PEDIDO(S) AGUARDANDO ACEITE / SEPARAÇÃO</div>
            `;
            document.body.appendChild(rappiModalElement);
        }

        function updateRappiModal(count) {
            createRappiVisualModal();
            if (!rappiModalElement) return;
            const countEl = document.getElementById('rappi-modal-count');
            if (count > 0) {
                if (countEl) countEl.innerText = count;
                rappiModalElement.classList.add('show');
            } else {
                rappiModalElement.classList.remove('show');
            }
        }

        setInterval(() => {
            let isLoggedIn = true;
            let newOrdersCount = 0;
            let aguardandoColetaCount = 0;

            try {
                if (document.querySelector('input[type="password"]')) {
                    isLoggedIn = false;
                } else {
                    const cards = document.querySelectorAll('app-kind-order .order-card, app-kind-order .order-item, app-order-card, .order-card-container');
                    newOrdersCount = cards.length;

                    try {
                        const tabs = Array.from(document.querySelectorAll('a, button, div.tab, span'));
                        const prontoTab = tabs.find(el => {
                            const t = el.textContent ? el.textContent.trim().toLowerCase() : '';
                            return t.includes('pronto') || t.includes('entregador') || t.includes('coleta');
                        });
                        if (prontoTab) {
                            const val = parseInt(prontoTab.textContent.replace(/[^0-9]/g, ''), 10);
                            if (!isNaN(val)) aguardandoColetaCount = val;
                        }
                    } catch (e) { }
                }

                updateRappiModal(newOrdersCount);
            } catch (e) {
                console.error("[OMNI MONITOR] Erro no coletor Rappi:", e);
            }

            GM_setValue('rappiPendingOrders', newOrdersCount);
            GM_setValue('rappiAguardandoColeta', aguardandoColetaCount);
            GM_setValue('rappiLastUpdate', Date.now());
            GM_setValue('rappiLoggedIn', isLoggedIn);
        }, 3000);

        console.log("[OMNI MONITOR] Coletor Rappi ativo e sincronizando via GM Storage.");
        return;
    }

    // =========================================================================
    // 3. MÓDULOS LINX OMS
    // =========================================================================
    if (!isLinxOms) return;

    // Leitura Dinâmica da Filial
    function getDynamicStoreId() {
        const keys = ['currentLocation', 'selectedLocation', 'location', 'store', 'current_location', 'selected_location'];
        for (let storage of [localStorage, sessionStorage]) {
            for (const key of keys) {
                const val = storage.getItem(key);
                if (val) {
                    try {
                        const parsed = JSON.parse(val);
                        if (parsed && typeof parsed === 'object') {
                            const storeVal = parsed.id || parsed.code || parsed.locationId || parsed.storeId;
                            if (storeVal) return String(storeVal).trim();
                        }
                    } catch (e) {
                        if (/^\d+$/.test(val.trim())) return val.trim();
                    }
                }
            }
        }

        try {
            if (window.linx && window.linx.session) {
                const user = window.linx.session.currentUser;
                const locId = user && user.currentLocation && user.currentLocation.id;
                if (locId) return String(locId).trim();
            }
        } catch (e) { }

        try {
            const branchEl = document.querySelector('.branch h2, .branch');
            if (branchEl && branchEl.textContent) {
                const match = branchEl.textContent.match(/\b\d{3,5}\b/);
                if (match) return match[0];
            }
        } catch (e) { }

        try {
            const pathSegments = window.location.pathname.split('/');
            for (const segment of pathSegments) {
                if (/^\d+$/.test(segment) && segment.length >= 3) return segment;
            }
        } catch (e) { }

        return '1187';
    }

    // =========================================================================
    // 3.1 SUB-MÓDULO: PC SEPARAÇÃO, LISTA DE DESPACHO & RETIRADA LOJA (7 DIAS)
    // =========================================================================
    const DIAS_LIMITE_RETIRADA = 7;
    let lastSendReadyCount = -1;
    let isDespachoModalMinimized = false;

    function parseBrazilianDate(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.trim().split(' ');
        if (parts.length < 2) return null;
        const dateParts = parts[0].split('/');
        const timeParts = parts[1].split(':');
        if (dateParts.length !== 3 || timeParts.length < 2) return null;
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        let year = parseInt(dateParts[2], 10);
        if (year < 100) year += 2000;
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        return new Date(year, month, day, hours, minutes);
    }

    function getDaysDifference(date1, date2) {
        const diffTime = date2 - date1;
        if (diffTime < 0) return 0;
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    async function checkListaDespacho() {
        const storeId = getDynamicStoreId();
        if (!storeId) return;

        try {
            const url = `https://instore.linxoms.com.br/api/proxy/order-ms/clients/rihappy/fulfillments?locationId=${storeId}&status[]=SEND_READY&pageSize=1`;
            const token = localStorage.getItem('token') ? localStorage.getItem('token').replace(/"/g, '') : '';
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Authorization': token ? 'Bearer ' + token : ''
                }
            });

            if (response.ok) {
                const data = await response.json();
                const total = data.totalElements || data.totalCount || (data.items ? data.items.length : 0);
                if (total > 0) {
                    showDespachoAlert(total);
                } else {
                    hideDespachoAlert();
                }
            }
        } catch (error) { }
    }

    function createDespachoModalUI() {
        if (document.getElementById('despacho-alerta-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'despacho-alerta-modal';
        modal.style.position = 'fixed';
        modal.style.top = '20px';
        modal.style.left = '50%';
        modal.style.transform = 'translateX(-50%)';
        modal.style.backgroundColor = '#ffffff';
        modal.style.border = '2px solid #e74c3c';
        modal.style.borderRadius = '8px';
        modal.style.padding = '15px 25px';
        modal.style.boxShadow = '0 4px 15px rgba(231, 76, 60, 0.3)';
        modal.style.zIndex = '999999';
        modal.style.display = 'none';
        modal.style.flexDirection = 'column';
        modal.style.alignItems = 'center';
        modal.style.fontFamily = 'Arial, sans-serif';
        modal.style.transition = 'all 0.3s ease';

        const title = document.createElement('div');
        title.id = 'despacho-alerta-title';
        title.style.color = '#e74c3c';
        title.style.fontSize = '18px';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '10px';
        title.style.textAlign = 'center';

        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '10px';
        btnGroup.style.width = '100%';

        const btnAcessar = document.createElement('a');
        btnAcessar.textContent = 'Acessar Lista';
        btnAcessar.style.flex = '1';
        btnAcessar.style.textAlign = 'center';
        btnAcessar.style.backgroundColor = '#e74c3c';
        btnAcessar.style.color = '#fff';
        btnAcessar.style.padding = '8px 12px';
        btnAcessar.style.borderRadius = '4px';
        btnAcessar.style.textDecoration = 'none';
        btnAcessar.style.fontWeight = 'bold';
        btnAcessar.style.cursor = 'pointer';
        btnAcessar.onclick = () => {
            const currentUrl = window.location.href;
            if (currentUrl.includes('/store/fulfillments')) {
                const tabs = document.querySelectorAll('a, button');
                for (let t of tabs) {
                    if (t.textContent.trim().toLowerCase() === 'despacho' || t.textContent.trim().toLowerCase().includes('send_ready')) {
                        t.click();
                        break;
                    }
                }
            } else {
                window.location.href = '/store/fulfillments';
            }
            minimizeDespachoAlert();
        };

        const btnMinimizar = document.createElement('button');
        btnMinimizar.textContent = 'Minimizar';
        btnMinimizar.style.flex = '1';
        btnMinimizar.style.backgroundColor = '#f1f1f1';
        btnMinimizar.style.color = '#333';
        btnMinimizar.style.border = '1px solid #ccc';
        btnMinimizar.style.padding = '8px 12px';
        btnMinimizar.style.borderRadius = '4px';
        btnMinimizar.style.fontWeight = 'bold';
        btnMinimizar.style.cursor = 'pointer';
        btnMinimizar.onclick = () => minimizeDespachoAlert();

        btnGroup.appendChild(btnAcessar);
        btnGroup.appendChild(btnMinimizar);
        modal.appendChild(title);
        modal.appendChild(btnGroup);
        document.body.appendChild(modal);

        const icon = document.createElement('div');
        icon.id = 'despacho-alerta-icon';
        icon.style.position = 'fixed';
        icon.style.top = '20px';
        icon.style.right = '20px';
        icon.style.backgroundColor = '#e74c3c';
        icon.style.color = '#fff';
        icon.style.width = '42px';
        icon.style.height = '42px';
        icon.style.borderRadius = '50%';
        icon.style.display = 'none';
        icon.style.alignItems = 'center';
        icon.style.justifyContent = 'center';
        icon.style.fontWeight = 'bold';
        icon.style.fontSize = '16px';
        icon.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        icon.style.zIndex = '999999';
        icon.style.cursor = 'pointer';
        icon.title = 'Clique para abrir alerta de Lista de Despacho';
        icon.onclick = () => restoreDespachoAlert();
        document.body.appendChild(icon);
    }

    function showDespachoAlert(count) {
        createDespachoModalUI();
        const modal = document.getElementById('despacho-alerta-modal');
        const icon = document.getElementById('despacho-alerta-icon');
        const title = document.getElementById('despacho-alerta-title');

        lastSendReadyCount = count;
        if (title) title.innerHTML = `⚠️ Você tem ${count} item(s) na<br/>Lista de Despacho!`;
        if (icon) icon.textContent = count;

        if (!isDespachoModalMinimized) {
            if (modal) modal.style.display = 'flex';
            if (icon) icon.style.display = 'none';
        } else {
            if (icon) {
                icon.style.display = 'flex';
                icon.style.transform = 'scale(1.2)';
                setTimeout(() => { icon.style.transform = 'scale(1)'; }, 500);
            }
        }
    }

    function hideDespachoAlert() {
        const modal = document.getElementById('despacho-alerta-modal');
        const icon = document.getElementById('despacho-alerta-icon');
        if (modal) modal.style.display = 'none';
        if (icon) icon.style.display = 'none';
    }

    function minimizeDespachoAlert() {
        isDespachoModalMinimized = true;
        const modal = document.getElementById('despacho-alerta-modal');
        const icon = document.getElementById('despacho-alerta-icon');
        if (modal) modal.style.display = 'none';
        if (icon && lastSendReadyCount > 0) icon.style.display = 'flex';
    }

    function restoreDespachoAlert() {
        isDespachoModalMinimized = false;
        const modal = document.getElementById('despacho-alerta-modal');
        const icon = document.getElementById('despacho-alerta-icon');
        if (icon) icon.style.display = 'none';
        if (modal && lastSendReadyCount > 0) modal.style.display = 'flex';
    }

    function checkRetiradaFulfillmentsList() {
        const table = document.querySelector('table.pickup-fulfillments, table.fulfillments-table, table');
        if (!table) return;

        const rows = table.querySelectorAll('tbody tr');
        const today = new Date();

        rows.forEach(row => {
            if (row.classList.contains('monitor-retirada-checked')) return;

            const paymentDateElement = row.querySelector('.payment-date') || row.querySelector('td:nth-child(2)');
            if (paymentDateElement) {
                const dateText = paymentDateElement.textContent;
                const paymentDate = parseBrazilianDate(dateText);

                if (paymentDate) {
                    const daysPassed = getDaysDifference(paymentDate, today);
                    const daysRemaining = DIAS_LIMITE_RETIRADA - daysPassed;

                    let color = '#28a745';
                    let text = `Faltam ${daysRemaining} dias (No prazo)`;
                    let icon = '✅';
                    let highlight = false;

                    if (daysPassed >= DIAS_LIMITE_RETIRADA) {
                        color = '#dc3545';
                        text = `Passaram ${daysPassed} dias (Cancelar/Expirado)`;
                        icon = '🚨';
                        highlight = true;
                        row.style.backgroundColor = 'rgba(220, 53, 69, 0.05)';
                    } else if (daysPassed === DIAS_LIMITE_RETIRADA - 1) {
                        color = '#fd7e14';
                        text = `Falta 1 dia (Vence amanhã)`;
                        icon = '⚠️';
                        highlight = true;
                    } else if (daysPassed === DIAS_LIMITE_RETIRADA - 2) {
                        color = '#ffc107';
                        text = `Faltam 2 dias`;
                        icon = '⚠️';
                        highlight = true;
                    }

                    if (highlight) {
                        row.style.borderLeft = `4px solid ${color}`;
                    }

                    let statusCell = row.querySelector('.order-status') || row.querySelector('td:last-child');
                    if (statusCell && !row.querySelector('.monitor-badge-container')) {
                        const badgeContainer = document.createElement('div');
                        badgeContainer.className = 'monitor-badge-container';
                        badgeContainer.style.display = 'flex';
                        badgeContainer.style.alignItems = 'center';
                        badgeContainer.style.gap = '8px';
                        badgeContainer.style.marginTop = '6px';

                        const badge = document.createElement('div');
                        badge.textContent = `${icon} Retirada: ${text}`;
                        badge.style.color = color;
                        badge.style.fontSize = '12px';
                        badge.style.fontWeight = 'bold';

                        let telefone = '';
                        const phoneEl = row.querySelector('.customer-phone, .phone');
                        if (phoneEl) {
                            telefone = phoneEl.textContent.replace(/\D/g, '');
                            if (!telefone.startsWith('55')) telefone = '55' + telefone;
                        }

                        const msgText = encodeURIComponent(`Olá! Seu pedido já está separado e disponível para retirada na loja. Lembramos que o pedido será cancelado caso não seja retirado em até ${daysRemaining} dia(s).`);
                        const btnWpp = document.createElement('a');
                        btnWpp.href = telefone ? `https://web.whatsapp.com/send?phone=${telefone}&text=${msgText}` : `https://web.whatsapp.com/send?text=${msgText}`;
                        btnWpp.target = '_blank';
                        btnWpp.style.backgroundColor = '#25D366';
                        btnWpp.style.color = '#fff';
                        btnWpp.style.padding = '3px 8px';
                        btnWpp.style.borderRadius = '4px';
                        btnWpp.style.textDecoration = 'none';
                        btnWpp.style.fontSize = '11px';
                        btnWpp.style.fontWeight = 'bold';
                        btnWpp.style.display = 'flex';
                        btnWpp.style.alignItems = 'center';
                        btnWpp.style.gap = '4px';
                        btnWpp.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> WhatsApp`;

                        badgeContainer.appendChild(badge);
                        badgeContainer.appendChild(btnWpp);

                        if (statusCell.parentNode) {
                            statusCell.parentNode.insertBefore(badgeContainer, statusCell.nextSibling);
                        }
                    }
                }
            }
            row.classList.add('monitor-retirada-checked');
        });
    }

    function checkRetiradaOrderDetails() {
        const detailsContainer = document.querySelector('.order-details');
        if (!detailsContainer || detailsContainer.classList.contains('monitor-retirada-checked')) return;

        const dts = detailsContainer.querySelectorAll('dt');
        let orderDateText = null;

        for (let dt of dts) {
            if (dt.textContent.trim().toLowerCase().includes('compra:')) {
                const dd = dt.nextElementSibling;
                if (dd && dd.tagName.toLowerCase() === 'dd') {
                    orderDateText = dd.textContent;
                    break;
                }
            }
        }

        if (orderDateText) {
            const orderDate = parseBrazilianDate(orderDateText);
            const today = new Date();

            if (orderDate) {
                const daysPassed = getDaysDifference(orderDate, today);
                const daysRemaining = DIAS_LIMITE_RETIRADA - daysPassed;

                let color = '#28a745';
                let text = `Faltam ${daysRemaining} dias (No prazo)`;
                let icon = '✅';

                if (daysPassed >= DIAS_LIMITE_RETIRADA) {
                    color = '#dc3545';
                    text = `Passaram ${daysPassed} dias (Cancelar)`;
                    icon = '🚨';
                } else if (daysPassed === DIAS_LIMITE_RETIRADA - 1) {
                    color = '#fd7e14';
                    text = `Falta 1 dia (Vence amanhã)`;
                    icon = '⚠️';
                } else if (daysPassed === DIAS_LIMITE_RETIRADA - 2) {
                    color = '#ffc107';
                    text = `Faltam 2 dias`;
                    icon = '⚠️';
                }

                const titleBlock = document.querySelector('.fulfillment-details-title');
                if (titleBlock && !titleBlock.querySelector('.monitor-badge-details')) {
                    const badge = document.createElement('span');
                    badge.className = 'monitor-badge-details';
                    badge.textContent = `${icon} Retirada: ${text}`;
                    badge.style.display = 'inline-block';
                    badge.style.padding = '4px 10px';
                    badge.style.borderRadius = '6px';
                    badge.style.backgroundColor = color;
                    badge.style.color = '#fff';
                    badge.style.fontSize = '14px';
                    badge.style.fontWeight = 'bold';
                    badge.style.marginLeft = '15px';
                    badge.style.verticalAlign = 'middle';
                    titleBlock.appendChild(badge);

                    let telefone = '';
                    const dtsAll = detailsContainer.querySelectorAll('dt');
                    for (let dt of dtsAll) {
                        const t = dt.textContent.trim().toLowerCase();
                        if (t.includes('telefone:') || t.includes('cliente:')) {
                            const parentTable = dt.closest('.table-details');
                            const parentH5 = parentTable ? parentTable.querySelector('h5') : null;
                            if (t.includes('cliente:') && (!parentH5 || !parentH5.textContent.toLowerCase().includes('telefone'))) {
                                continue;
                            }
                            const dd = dt.nextElementSibling;
                            if (dd && dd.tagName.toLowerCase() === 'dd') {
                                telefone = dd.textContent.replace(/\D/g, '');
                                if (!telefone.startsWith('55') && telefone.length > 0) telefone = '55' + telefone;
                                if (telefone.length > 0) break;
                            }
                        }
                    }

                    const msgText = encodeURIComponent(`Olá! Seu pedido já está separado e disponível para retirada na loja. Lembramos que o pedido será cancelado caso não seja retirado em até ${daysRemaining} dia(s).`);
                    const btnWpp = document.createElement('a');
                    btnWpp.href = telefone ? `https://web.whatsapp.com/send?phone=${telefone}&text=${msgText}` : `https://web.whatsapp.com/send?text=${msgText}`;
                    btnWpp.target = '_blank';
                    btnWpp.style.display = 'inline-block';
                    btnWpp.style.backgroundColor = '#25D366';
                    btnWpp.style.color = '#fff';
                    btnWpp.style.padding = '4px 12px';
                    btnWpp.style.borderRadius = '6px';
                    btnWpp.style.textDecoration = 'none';
                    btnWpp.style.fontSize = '14px';
                    btnWpp.style.fontWeight = 'bold';
                    btnWpp.style.marginLeft = '10px';
                    btnWpp.style.verticalAlign = 'middle';
                    btnWpp.innerHTML = `💬 Enviar WhatsApp`;
                    titleBlock.appendChild(btnWpp);
                }
            }
        }
        detailsContainer.classList.add('monitor-retirada-checked');
    }

    function initSeparacaoModule() {
        setInterval(checkListaDespacho, 30000);
        setTimeout(checkListaDespacho, 3000);

        setInterval(() => {
            checkRetiradaFulfillmentsList();
            checkRetiradaOrderDetails();
        }, 2000);

        const observer = new MutationObserver(() => {
            checkRetiradaFulfillmentsList();
            checkRetiradaOrderDetails();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // =========================================================================
    // 3.2 SUB-MÓDULO: MOBILE OMNI (CELULAR / COLETOR COM SOM EM SEGUNDO PLANO)
    // =========================================================================
    function initMobileMonitor() {
        console.log('[OMNI MONITOR] Modo Mobile ativado.');
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Lilita+One&display=swap';
        document.head.appendChild(fontLink);

        let mobileAudioCtx = null;
        let lastMobileAlarmPlayed = 0;

        function initMobileAudio() {
            if (mobileAudioCtx) return;
            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                mobileAudioCtx = new AudioContextClass();
            } catch (e) { }
        }

        function playMobileBeep(freq, duration, vol) {
            if (!mobileAudioCtx) initMobileAudio();
            if (!mobileAudioCtx || mobileAudioCtx.state === 'suspended') return;
            try {
                const osc = mobileAudioCtx.createOscillator();
                const gain = mobileAudioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, mobileAudioCtx.currentTime);
                gain.gain.setValueAtTime(vol || 0.2, mobileAudioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, mobileAudioCtx.currentTime + duration);
                osc.connect(gain);
                gain.connect(mobileAudioCtx.destination);
                osc.start();
                osc.stop(mobileAudioCtx.currentTime + duration);
            } catch (e) { }
        }

        function playMobileSiren() {
            playMobileBeep(988, 0.2, 0.5);
            setTimeout(() => playMobileBeep(1318, 0.25, 0.5), 180);
            setTimeout(() => playMobileBeep(988, 0.2, 0.5), 400);
            setTimeout(() => playMobileBeep(1318, 0.25, 0.5), 580);
        }

        const style = document.createElement('style');
        style.innerHTML = `
            .mobile-dashboard {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: #0b0b0f; color: #fff; font-family: 'Lilita One', cursive;
                z-index: 200000; display: flex; flex-direction: column;
                box-sizing: border-box; overflow-y: auto; padding-bottom: 20px;
            }
            .mobile-header {
                padding: 18px; text-align: center; background: rgba(255,255,255,0.05);
                border-bottom: 2px solid rgba(255,255,255,0.1);
            }
            .mobile-title { font-size: 22px; font-weight: 900; color: #00ff88; text-transform: uppercase; }
            .mobile-status-card {
                margin: 15px; padding: 25px 20px; border-radius: 20px;
                text-align: center; border: 3px solid rgba(255,255,255,0.1);
                background: rgba(20,20,30,0.8); box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                transition: all 0.3s ease;
            }
            .mobile-status-card.alert {
                border-color: #ff3e3e; background: rgba(255, 62, 62, 0.1);
                box-shadow: 0 0 25px rgba(255, 62, 62, 0.4);
            }
            .mobile-status-value { font-size: 72px; font-weight: 900; line-height: 1; margin: 10px 0; color: #00ff88; }
            .mobile-status-card.alert .mobile-status-value { color: #ff3e3e; }
            .mobile-btn-hide {
                position: fixed; bottom: 20px; right: 20px; background: #222; color: #00ff88;
                width: 50px; height: 50px; border-radius: 50%; font-size: 20px; border: 2px solid #00ff88;
                z-index: 250000; box-shadow: 0 5px 15px rgba(0,0,0,0.5); cursor: pointer;
            }
        `;
        document.head.appendChild(style);

        const dashboard = document.createElement('div');
        dashboard.className = 'mobile-dashboard';
        dashboard.innerHTML = `
            <div class="mobile-header">
                <div class="mobile-title">Linx OMS Mobile</div>
                <div style="font-size:12px; color:#888; margin-top:5px;" id="mob-last-sync">Conectando...</div>
            </div>
            <div class="mobile-status-card" id="mob-status-card">
                <div style="font-size:16px; color:#aaa; text-transform:uppercase;">Pendências Loja</div>
                <div class="mobile-status-value" id="mob-val-waiting">0</div>
                <div style="font-size:14px; color:#aaa;" id="mob-status-text">Tudo em dia</div>
            </div>
            <div id="mob-order-list" style="margin: 0 15px; display: flex; flex-direction: column; gap: 10px;"></div>
        `;
        document.body.appendChild(dashboard);

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'mobile-btn-hide';
        toggleBtn.innerHTML = '📱';
        toggleBtn.title = 'Alternar Monitor Mobile';
        toggleBtn.onclick = () => {
            dashboard.style.display = dashboard.style.display === 'none' ? 'flex' : 'none';
        };
        document.body.appendChild(toggleBtn);

        async function fetchMobileWaiting() {
            const storeId = getDynamicStoreId();
            const url = `https://instore.linxoms.com.br/api/proxy/order-ms/clients/rihappy/fulfillments?locationId=${storeId}&status[]=WAITING_STORE_CONFIRMATION&status[]=WAITING_INVOICE&status[]=WAITING_PICK&pageSize=20`;
            try {
                const token = localStorage.getItem('token') ? localStorage.getItem('token').replace(/"/g, '') : '';
                const r = await fetch(url, { headers: { 'Accept': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' } });
                if (!r.ok) return null;
                return await r.json();
            } catch (e) { return null; }
        }

        async function checkMobile() {
            const data = await fetchMobileWaiting();
            const syncEl = document.getElementById('mob-last-sync');
            if (syncEl) syncEl.innerText = 'Sync: ' + new Date().toLocaleTimeString();

            if (data && data.items) {
                const count = data.totalElements || data.items.length;
                const card = document.getElementById('mob-status-card');
                const valEl = document.getElementById('mob-val-waiting');
                const textEl = document.getElementById('mob-status-text');

                if (valEl) valEl.innerText = count;

                if (count > 0) {
                    if (card) card.classList.add('alert');
                    if (textEl) {
                        textEl.innerText = "SEPARAÇÃO PENDENTE!";
                        textEl.style.color = '#ff3e3e';
                    }
                    const now = Date.now();
                    if (now - lastMobileAlarmPlayed > 15000) {
                        playMobileSiren();
                        lastMobileAlarmPlayed = now;
                    }
                } else {
                    if (card) card.classList.remove('alert');
                    if (textEl) {
                        textEl.innerText = "Tudo em dia";
                        textEl.style.color = '#aaa';
                    }
                }
            }
        }

        setInterval(checkMobile, 5000);
        setTimeout(checkMobile, 1000);
    }

    // =========================================================================
    // 3.3 MÓDULO PRINCIPAL: TV DASHBOARD OMS (FULLSCREEN NEON & SLA)
    // =========================================================================
    let tvDashboard = null;
    let toggleBtn = null;
    let integrationsUI = null;
    let audioOverlay = null;
    let isCoreInitialized = false;

    // Estado compartilhado do Monitor OMS
    let currentViewMode = 'TV';
    let pedidosAtivosAtuais = [];
    let audioCtx = null;
    let lastAlarmPlayedTime = 0;

    function initScriptCore() {
        // Inicializa o módulo operacional de Separação & Despacho
        initSeparacaoModule();

                // Importar Fonte Premium Outfit
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Lilita+One&display=swap';
        document.head.appendChild(fontLink);

        // --- CONFIGURAÇÕES ---
        let LOJA_ID = '1187'; // ID Padrão/Fallback da loja
        const CHECK_INTERVAL = 3000; // Sincronização a cada 3 segundos (tempo real)
        const ALARM_COOLDOWN = 15000; // Alarme toca a cada 15 segundos se houver pendências
        const TEMPO_LIMITE_MINUTOS = 60; // SLA padrão da loja

        // --- ESTADO INTERNO ---
        pedidosAtivosAtuais = [];
        audioCtx = null;
        let alarmInterval = null;
        currentViewMode = 'TV'; // Por padrão, inicia no modo TV fullscreen
        lastAlarmPlayedTime = 0;
        let activeRotationalIndex = 0;
        let lastRotationTime = 0;

        let activeOrderItemIndex = 0;
        let lastOrderItemRotationTime = 0;

        // --- LEITURA DINÂMICA DO ID DA LOJA ATIVA ---
        function getDynamicStoreId() {
            const keys = ['currentLocation', 'selectedLocation', 'location', 'store', 'current_location', 'selected_location'];

            // 1. Tentar ler do localStorage
            for (const key of keys) {
                const val = localStorage.getItem(key);
                if (val) {
                    try {
                        const parsed = JSON.parse(val);
                        if (parsed && typeof parsed === 'object') {
                            const storeVal = parsed.id || parsed.code || parsed.locationId || parsed.storeId;
                            if (storeVal) return String(storeVal).trim();
                        }
                    } catch (e) {
                        if (/^\d+$/.test(val.trim())) {
                            return val.trim();
                        }
                    }
                }
            }

            // 2. Tentar ler do sessionStorage
            for (const key of keys) {
                const val = sessionStorage.getItem(key);
                if (val) {
                    try {
                        const parsed = JSON.parse(val);
                        if (parsed && typeof parsed === 'object') {
                            const storeVal = parsed.id || parsed.code || parsed.locationId || parsed.storeId;
                            if (storeVal) return String(storeVal).trim();
                        }
                    } catch (e) {
                        if (/^\d+$/.test(val.trim())) {
                            return val.trim();
                        }
                    }
                }
            }

            // 3. Tentar ler da URL
            try {
                const pathSegments = window.location.pathname.split('/');
                for (const segment of pathSegments) {
                    if (/^\d+$/.test(segment) && segment.length >= 3) {
                        return segment;
                    }
                }
            } catch (e) { }

            return null;
        }

        // --- SISTEMA DE AUDIO (CONTEXT LOCK BYPASS) ---
        function initAudio() {
            if (audioCtx) return;
            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                audioCtx = new AudioContextClass();
            } catch (e) {
                console.error("AudioContext não suportado neste navegador", e);
            }
        }

        function playBeep(freq, duration, vol) {
            if (!audioCtx) initAudio();
            if (!audioCtx || audioCtx.state === 'suspended') return;

            try {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
                gain.gain.setValueAtTime(vol || 0.1, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + duration);
            } catch (e) {
                console.error("Erro ao emitir sinal sonoro:", e);
            }
        }

        function playStartupChime() {
            if (!audioCtx) initAudio();
            if (!audioCtx || audioCtx.state === 'suspended') return;

            try {
                const now = audioCtx.currentTime;
                // Frequências para um arpejo ascendente de Dó Maior 9 (C5, E5, G5, B5, C6)
                const freqs = [523.25, 659.25, 783.99, 987.77, 1046.50];

                freqs.forEach((freq, index) => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + (index * 0.08));

                    gain.gain.setValueAtTime(0.0, now + (index * 0.08));
                    gain.gain.linearRampToValueAtTime(0.06, now + (index * 0.08) + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + (index * 0.08) + 0.45);

                    osc.connect(gain);
                    gain.connect(audioCtx.destination);

                    osc.start(now + (index * 0.08));
                    osc.stop(now + (index * 0.08) + 0.45);
                });
            } catch (e) {
                console.error("Erro ao emitir chime de inicialização:", e);
            }
        }

        function playSiren() {
            // Alarme de emergência com volume máximo e padrão intermitente
            const volume = 1.0;
            const duracao = 0.15;

            // Sequência de tons agudos em padrão de alarme
            playBeep(1000, duracao, volume);
            setTimeout(() => playBeep(1200, duracao, volume), 100);
            setTimeout(() => playBeep(1400, duracao, volume), 200);
            setTimeout(() => playBeep(1200, duracao, volume), 300);
            setTimeout(() => playBeep(1000, duracao, volume), 400);
            setTimeout(() => playBeep(1400, duracao, volume), 500);
            setTimeout(() => playBeep(1600, 0.2, volume), 600);
        }

        function playNotificationChime() {
            if (!audioCtx) initAudio();
            if (!audioCtx || audioCtx.state === 'suspended') return;

            try {
                const now = audioCtx.currentTime;
                // Lindo acorde arpejado suave e ascendente de Dó Maior (C5 -> E5 -> G5)
                const freqs = [523.25, 659.25, 783.99];
                freqs.forEach((freq, index) => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + (index * 0.05));

                    gain.gain.setValueAtTime(0.0, now + (index * 0.05));
                    gain.gain.linearRampToValueAtTime(0.08, now + (index * 0.05) + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + (index * 0.05) + 0.35);

                    osc.connect(gain);
                    gain.connect(audioCtx.destination);

                    osc.start(now + (index * 0.05));
                    osc.stop(now + (index * 0.05) + 0.4);
                });
            } catch (e) {
                console.error("Erro ao emitir chime de notificação:", e);
            }
        }

        // --- DESIGN SYSTEM PREMIUM PARA TV (MODO TV EM TELA CHEIA) ---
        const style = document.createElement('style');
        style.innerHTML = `
        :root {
            --neon-green: #00ff88;
            --neon-yellow: #f1c40f;
            --neon-red: #ff3e3e;
            --neon-orange: #ff9f43;
            --neon-blue: #00d2ff;
            --bg-dark-tv: #0b0b0f;
            --card-bg-tv: rgba(20, 20, 25, 0.95);
            --font-main: 'Lilita One', cursive;
        }

        /* Container Principal do Modo TV */
        .oms-tv-dashboard {
            position: fixed;
            top: 0; left: 0;
            width: 100vw; height: 100vh;
            background: var(--bg-dark-tv) !important;
            color: #fff !important;
            font-family: var(--font-main);
            z-index: 200000;
            display: flex;
            flex-direction: column;
            padding: 20px 30px;
            box-sizing: border-box;
            overflow: hidden;
            transition: all 0.5s ease;
        }

        /* Animações e Pulsações Neon */
        @keyframes pulseRedGlow {
            0%, 100% { box-shadow: 0 0 15px rgba(255, 62, 62, 0.4); border-color: var(--neon-red); }
            50% { box-shadow: 0 0 35px rgba(255, 62, 62, 0.8); border-color: #ff6b6b; }
        }
        @keyframes pulseGreenGlow {
            0%, 100% { box-shadow: 0 0 15px rgba(0, 255, 136, 0.3); border-color: var(--neon-green); }
            50% { box-shadow: 0 0 30px rgba(0, 255, 136, 0.7); border-color: #55efc4; }
        }
        @keyframes pulseYellowGlow {
            0%, 100% { box-shadow: 0 0 12px rgba(241, 196, 15, 0.3); border-color: var(--neon-yellow); }
            50% { box-shadow: 0 0 25px rgba(241, 196, 15, 0.6); border-color: #f39c12; }
        }
        @keyframes heartbeat {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.8; }
            100% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Top Header do Painel */
        .tv-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid rgba(255, 255, 255, 0.08);
            padding-bottom: 15px;
            margin-bottom: 20px;
            flex-shrink: 0;
        }
        .tv-title-group {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .tv-main-title {
            font-size: clamp(24px, 2.5vw, 36px);
            font-weight: 900;
            letter-spacing: 1px;
            background: linear-gradient(90deg, var(--neon-green), var(--neon-blue));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 0 30px rgba(0, 255, 136, 0.1);
        }
        .tv-subtitle {
            font-size: 14px;
            font-weight: 700;
            color: rgba(255, 255, 255, 0.5);
            letter-spacing: 2px;
            text-transform: uppercase;
        }
        .tv-clock-group {
            text-align: right;
            display: flex;
            flex-direction: column;
        }
        .tv-clock {
            font-size: clamp(28px, 2.8vw, 42px);
            font-weight: 900;
            color: #fff;
            line-height: 1;
        }
        .tv-date {
            font-size: 13px;
            font-weight: 700;
            color: rgba(255, 255, 255, 0.4);
            letter-spacing: 1px;
            margin-top: 4px;
        }

        /* Container do Pipeline Horizontal Superior */
        .tv-summary-pipeline {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 20px;
            margin-bottom: 25px;
            flex-shrink: 0;
        }
        .pipeline-card {
            background: rgba(18, 28, 48, 0.6) !important;
            border: 2px solid rgba(255, 255, 255, 0.08) !important;
            border-radius: 20px !important;
            padding: 14px 20px !important;
            display: flex !important;
            align-items: center !important;
            gap: 15px !important;
            backdrop-filter: blur(15px) !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3) !important;
        }
        .pipeline-card:hover {
            transform: translateY(-4px) !important;
            border-color: rgba(255, 255, 255, 0.2) !important;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4) !important;
        }
        .pipeline-icon-container {
            width: 46px;
            height: 46px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            flex-shrink: 0;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
        }
        .pipeline-info {
            display: flex;
            flex-direction: column;
            flex: 1;
        }
        .pipeline-label {
            font-size: 11px !important;
            font-weight: 800 !important;
            color: rgba(255, 255, 255, 0.4) !important;
            letter-spacing: 1.2px !important;
            text-transform: uppercase !important;
        }
        .pipeline-val {
            font-size: 42px !important; /* Aumentado a pedido do usuario */
            font-weight: 900 !important;
            margin-top: 1px !important;
            font-family: 'Lilita One', cursive !important;
            line-height: 1 !important;
        }

        /* Pod Glow States */
        .pod-waiting { border-color: rgba(0, 255, 136, 0.25) !important; }
        .pod-waiting .pipeline-icon-container { background: rgba(0, 255, 136, 0.1); border-color: rgba(0, 255, 136, 0.3); box-shadow: 0 0 15px rgba(0, 255, 136, 0.2); }

        .pod-picking { border-color: rgba(241, 196, 15, 0.25) !important; }
        .pod-picking .pipeline-icon-container { background: rgba(241, 196, 15, 0.1); border-color: rgba(241, 196, 15, 0.3); box-shadow: 0 0 15px rgba(241, 196, 15, 0.2); }

        .pod-invoicing { border-color: rgba(52, 152, 219, 0.25) !important; }
        .pod-invoicing .pipeline-icon-container { background: rgba(52, 152, 219, 0.1); border-color: rgba(52, 152, 219, 0.3); box-shadow: 0 0 15px rgba(52, 152, 219, 0.2); }

        .pod-checked { border-color: rgba(230, 126, 34, 0.25) !important; }
        .pod-checked .pipeline-icon-container { background: rgba(230, 126, 34, 0.1); border-color: rgba(230, 126, 34, 0.3); box-shadow: 0 0 15px rgba(230, 126, 34, 0.2); }

        /* Grid Principal de Conteúdo (Esquerda vs Direita) */
        .tv-main-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            flex: 1;
            min-height: 0; /* Impede overflow no grid */
        }
        .tv-column {
            display: flex;
            flex-direction: column;
            min-height: 0;
        }
        .tv-column-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 20px;
            border-radius: 12px;
            font-weight: 900;
            font-size: 18px;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 15px;
            flex-shrink: 0;
        }
        .tv-column-title {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .tv-column-counter {
            font-size: 20px;
            font-weight: 900;
            background: rgba(0, 0, 0, 0.2);
            padding: 2px 10px;
            border-radius: 6px;
        }
        .column-novos-header {
            background: linear-gradient(135deg, rgba(0, 255, 136, 0.15), rgba(0, 210, 255, 0.05));
            border: 1px solid rgba(0, 255, 136, 0.3);
            color: var(--neon-green);
        }
        .column-gargalos-header {
            background: linear-gradient(135deg, rgba(255, 62, 62, 0.15), rgba(255, 159, 67, 0.05));
            border: 1px solid rgba(255, 62, 62, 0.3);
            color: var(--neon-red);
        }

        /* Lista de Pedidos com Scroll Integrado */
        .tv-orders-list {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 15px;
            padding-right: 8px;
        }

        /* Cards Operacionais Gigantes */
        .tv-order-card {
            background: var(--card-bg-tv);
            border: 3px solid rgba(255, 255, 255, 0.06);
            border-radius: 16px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            position: relative;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            transition: all 0.3s ease;
        }

        /* Cores dos Cards e Pulsações */
        .tv-card-green { border-color: var(--neon-green) !important; animation: pulseGreenGlow 2.5s infinite; }
        .tv-card-orange { border-color: var(--neon-orange) !important; animation: pulseYellowGlow 1.8s infinite; }
        .tv-card-red { border-color: var(--neon-red) !important; animation: pulseRedGlow 1s infinite; }

        /* Estrutura interna dos Cards gigantes */
        .tv-card-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .tv-card-id {
            font-size: clamp(20px, 2.2vw, 28px);
            font-weight: 900;
            color: #fff;
            letter-spacing: 0.5px;
        }
        .tv-card-badge {
            font-size: clamp(14px, 1.4vw, 18px);
            font-weight: 900;
            padding: 6px 14px;
            border-radius: 8px;
            text-transform: uppercase;
        }
        .badge-green { background: rgba(0, 255, 136, 0.15); color: var(--neon-green); border: 1px solid var(--neon-green); }
        .badge-orange { background: rgba(255, 159, 67, 0.15); color: var(--neon-orange); border: 1px solid var(--neon-orange); }
        .badge-red { background: rgba(255, 62, 62, 0.15); color: var(--neon-red); border: 1px solid var(--neon-red); }

        .tv-card-carrier {
            font-size: clamp(18px, 1.8vw, 24px);
            font-weight: 900;
            text-transform: uppercase;
        }
        .carrier-pickup { color: var(--neon-yellow); }
        .carrier-delivery { color: var(--neon-blue); }

        .tv-card-time {
            font-size: clamp(20px, 2.2vw, 30px);
            font-weight: 900;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .time-green { color: var(--neon-green); text-shadow: 0 0 10px rgba(0,255,136,0.2); }
        .time-orange { color: var(--neon-yellow); text-shadow: 0 0 10px rgba(241,196,15,0.2); }
        .time-red { color: var(--neon-red); text-shadow: 0 0 15px rgba(255,62,62,0.3); }

        .tv-card-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid rgba(255,255,255,0.06);
            padding-top: 8px;
            font-size: clamp(12px, 1.2vw, 16px);
            font-weight: 700;
            color: rgba(255, 255, 255, 0.5);
        }
        .tv-card-customer {
            max-width: 70%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .tv-bottleneck-alert {
            background: rgba(255, 62, 62, 0.1);
            border: 1px dashed var(--neon-red);
            border-radius: 8px;
            padding: 8px 12px;
            font-size: clamp(12px, 1.3vw, 16px);
            font-weight: 900;
            color: #ff8b8b;
            text-align: center;
            margin-top: 4px;
        }

        /* Layout de Estado Vazio / Tudo em Dia */
        .tv-empty-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 40px;
        }
        .tv-empty-glow {
            width: 140px; height: 140px;
            background: rgba(0, 255, 136, 0.05);
            border: 4px solid var(--neon-green);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 64px;
            box-shadow: 0 0 40px rgba(0, 255, 136, 0.3);
            margin-bottom: 25px;
            animation: heartbeat 2s infinite ease-in-out;
        }
        .tv-empty-title {
            font-size: clamp(28px, 3vw, 42px);
            font-weight: 900;
            color: var(--neon-green);
            letter-spacing: 1px;
            margin-bottom: 10px;
        }
        .tv-empty-sub {
            font-size: clamp(16px, 1.6vw, 22px);
            font-weight: 700;
            color: rgba(255, 255, 255, 0.6);
            max-width: 600px;
            line-height: 1.4;
        }

        /* Estilos do Destaque da Etapa Despacho */
        @keyframes pulseRedBorderDespacho {
            0%, 100% { box-shadow: 0 0 15px rgba(255, 62, 62, 0.4); border-color: var(--neon-red); }
            50% { box-shadow: 0 0 35px rgba(255, 62, 62, 0.8); border-color: #ff6b6b; }
        }
        .despacho-card-alerta {
            border: 2px solid var(--neon-red) !important;
            animation: pulseRedBorderDespacho 1.2s infinite ease-in-out !important;
            background: rgba(255, 62, 62, 0.08) !important;
        }
        .despacho-card-ok {
            border: 2px solid var(--neon-green) !important;
            background: rgba(0, 255, 136, 0.05) !important;
            box-shadow: none !important;
        }

        /* Banner de Alerta de Lista de Despacho */
        @keyframes pulseDispatchBanner {
            0%, 100% { box-shadow: 0 0 20px rgba(255, 62, 62, 0.4), inset 0 0 30px rgba(255, 62, 62, 0.05); border-color: var(--neon-red); }
            50% { box-shadow: 0 0 50px rgba(255, 62, 62, 0.9), inset 0 0 60px rgba(255, 62, 62, 0.12); border-color: #ff8080; }
        }
        .dispatch-alert-banner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 22px 35px;
            border-radius: 16px;
            border: 3px solid var(--neon-red);
            background: linear-gradient(135deg, rgba(255, 62, 62, 0.15), rgba(255, 62, 62, 0.05));
            animation: pulseDispatchBanner 1.4s infinite ease-in-out;
            margin-bottom: 20px;
            flex-shrink: 0;
        }
        .dispatch-alert-banner-icon {
            font-size: 60px;
            line-height: 1;
            animation: heartbeat 1s infinite;
        }
        .dispatch-alert-banner-text {
            flex: 1;
            margin: 0 25px;
        }
        .dispatch-alert-banner-title {
            font-size: 32px;
            font-weight: 900;
            color: var(--neon-red);
            text-transform: uppercase;
            letter-spacing: 1px;
            line-height: 1;
        }
        .dispatch-alert-banner-sub {
            font-size: 18px;
            font-weight: 700;
            color: rgba(255,255,255,0.75);
            margin-top: 6px;
        }
        .dispatch-alert-banner-count {
            font-size: 70px;
            font-weight: 900;
            color: var(--neon-red);
            font-family: 'Lilita One', cursive;
            line-height: 1;
            text-shadow: 0 0 25px rgba(255,62,62,0.7);
            min-width: 100px;
            text-align: center;
        }

        /* Animações e Efeitos Holográficos para Novo Pedido */
        @keyframes pulseHologram {
            0% { box-shadow: 0 0 25px rgba(0, 255, 136, 0.4); border-color: var(--neon-green); }
            50% { box-shadow: 0 0 50px rgba(0, 255, 136, 0.8); border-color: #00ffcc; }
            100% { box-shadow: 0 0 25px rgba(0, 255, 136, 0.4); border-color: var(--neon-green); }
        }
        @keyframes slideInUp {
            from { transform: translate(-50%, 100px); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
        }

        @keyframes marqueeScroll {
            0% { transform: translate(-100%, 0); left: 0; }
            100% { transform: translate(0, 0); left: 100%; }
        }

        @keyframes pulseHologramBlue {
            0% { box-shadow: 0 0 25px rgba(0, 210, 255, 0.4); border-color: var(--neon-blue); }
            50% { box-shadow: 0 0 50px rgba(0, 210, 255, 0.8); border-color: #00d2ff; }
            100% { box-shadow: 0 0 25px rgba(0, 210, 255, 0.4); border-color: var(--neon-blue); }
        }

        .new-order-modal {
            position: fixed;
            top: 80px;
            bottom: 25px;
            left: 30px;
            right: 30px;
            width: auto !important;
            max-width: none !important;
            background: linear-gradient(135deg, rgba(10, 25, 47, 0.98), rgba(2, 12, 27, 0.99)) !important;
            border: 3px solid var(--neon-green) !important;
            border-radius: 24px !important;
            padding: 20px 30px !important;
            z-index: 500000 !important;
            box-shadow: 0 20px 60px rgba(0, 255, 136, 0.3) !important;
            backdrop-filter: blur(20px) !important;
            animation: slideInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1), pulseHologram 2s infinite ease-in-out !important;
            font-family: 'Lilita One', cursive !important;
            color: #ffffff !important;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            transition: all 0.5s ease-in-out;
        }

        .new-order-modal.rotate-mode {
            position: fixed;
            top: 80px;
            bottom: 25px;
            left: 30px;
            right: 30px;
            width: auto !important;
            max-width: none !important;
            border-color: var(--neon-blue) !important;
            box-shadow: 0 20px 60px rgba(0, 210, 255, 0.4) !important;
            animation: slideInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1), pulseHologramBlue 2s infinite ease-in-out !important;
        }

        .new-order-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid rgba(255, 255, 255, 0.08);
            padding-bottom: 15px;
            margin-bottom: 20px;
            flex-shrink: 0;
        }

        .new-order-modal-title {
            font-size: clamp(20px, 2vw, 28px);
            font-weight: 900;
            color: var(--neon-green);
            letter-spacing: 1px;
            text-transform: uppercase;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .new-order-modal.rotate-mode .new-order-modal-title {
            color: var(--neon-blue);
        }

        .new-order-modal-id {
            font-size: clamp(24px, 2.5vw, 36px);
            font-weight: 900;
            color: #ffffff;
            font-family: 'Lilita One', cursive;
            text-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
        }

        .new-order-items-container {
            display: flex;
            flex-direction: column;
            gap: 20px;
            flex: 1;
            overflow-y: auto;
            padding-right: 6px;
        }

        .new-order-item-row {
            display: flex;
            align-items: center;
            gap: 20px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 15px 20px;
            transition: all 0.2s ease;
        }
        .new-order-item-row:hover {
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(255, 255, 255, 0.15);
        }

        .new-order-item-image {
            width: 170px;
            height: 170px;
            border-radius: 16px;
            object-fit: cover;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 64px;
            flex-shrink: 0;
        }

        .new-order-item-info {
            display: flex;
            flex-direction: column;
            flex: 1;
        }

        .new-order-item-name {
            font-size: clamp(20px, 2.2vw, 32px);
            font-weight: 900;
            color: #ffffff;
            line-height: 1.3;
        }

        .new-order-item-sku {
            font-size: clamp(14px, 1.4vw, 20px);
            color: rgba(255, 255, 255, 0.5);
            font-weight: 700;
            margin-top: 8px;
        }

        .new-order-item-qty {
            font-size: clamp(28px, 3vw, 42px) !important;
            font-weight: 900 !important;
            color: var(--neon-green) !important;
            background: rgba(0, 255, 136, 0.08) !important;
            border: 1px solid rgba(0, 255, 136, 0.2) !important;
            padding: 12px 25px !important;
            border-radius: 16px !important;
            white-space: nowrap;
        }

        .new-order-modal.rotate-mode .new-order-item-qty {
            color: var(--neon-blue) !important;
            background: rgba(0, 210, 255, 0.08) !important;
            border-color: rgba(0, 210, 255, 0.2) !important;
        }

        /* Overlay para Autoplay de Áudio */
        .tv-audio-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.9); z-index: 300000;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-family: var(--font-main); text-align: center; cursor: pointer;
        }
        .tv-audio-button {
            padding: 25px 50px;
            background: linear-gradient(135deg, var(--neon-green), #00d2ff);
            color: #000; border: none; border-radius: 20px;
            font-size: 26px; font-weight: 900; letter-spacing: 1px;
            box-shadow: 0 10px 40px rgba(0,255,136,0.3);
            animation: heartbeat 1.5s infinite;
        }

        /* Botão Corner de Alternar para Modo Web normal - Design Premium com Alto Contraste */
        .tv-toggle-mode-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 250000;
            background: #111c30 !important; /* Fundo escuro azul sólido para alto contraste */
            border: 2px solid #00ff88 !important; /* Borda neon green brilhante */
            color: #ffffff !important; /* Fonte branca */
            padding: 12px 24px !important; /* Maior e mais fácil de clicar */
            border-radius: 30px !important;
            font-family: var(--font-main) !important;
            font-size: 14px !important;
            font-weight: 900 !important;
            cursor: pointer !important;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4) !important;
            backdrop-filter: blur(10px) !important;
            transition: all 0.2s ease !important;
            letter-spacing: 1px !important;
            text-transform: uppercase !important;
        }
        .tv-toggle-mode-btn:hover {
            background: #00ff88 !important;
            color: #0b0f19 !important;
            border-color: #00ff88 !important;
            transform: translateY(-3px) scale(1.05) !important;
            box-shadow: 0 15px 30px rgba(0, 255, 136, 0.4) !important;
        }

        /* Letreiro Neon / Premium Marquee */
        .oms-marquee-container {
            width: 100%;
            overflow: hidden;
            white-space: nowrap;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 10px 0;
            margin-top: 5px;
            margin-bottom: 15px;
            box-sizing: border-box;
            position: relative;
        }
        .oms-marquee-content {
            display: inline-block;
            white-space: nowrap;
            padding-left: 100%;
            animation: omsMarqueeAnim 20s linear infinite;
            font-size: clamp(16px, 1.8vw, 24px);
            font-weight: 900;
            letter-spacing: 1.5px;
            text-transform: uppercase;
        }
        @keyframes omsMarqueeAnim {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-100%, 0, 0); }
        }

        /* Scrollbar Premium */
        .tv-orders-list::-webkit-scrollbar { width: 10px; }
        .tv-orders-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
        .tv-orders-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; border: 2px solid var(--bg-dark-tv); }
        .tv-orders-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

        /* Ajustes de Impressão */
        @media print { .oms-tv-dashboard, .tv-toggle-mode-btn { display: none !important; } }
    `;
        document.head.appendChild(style);



        // --- CONSTRUÇÃO DA ESTRUTURA DO WIDGET MODO TV ---
        tvDashboard = document.createElement('div');
        tvDashboard.className = 'oms-tv-dashboard';
        tvDashboard.style.display = currentViewMode === 'TV' ? 'flex' : 'none';
        tvDashboard.innerHTML = `
        <div class="tv-loading-container" style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            width: 100%;
            font-family: 'Lilita One', cursive;
            color: #ffffff;
            text-align: center;
            margin: auto;
        ">
            <div class="tv-loading-spinner" style="
                width: 65px;
                height: 65px;
                border: 5px solid rgba(0, 210, 255, 0.1);
                border-top: 5px solid var(--neon-blue);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 25px;
                box-shadow: 0 0 15px rgba(0, 210, 255, 0.2);
            "></div>
            <div style="font-size: 28px; font-weight: 900; letter-spacing: 1px; margin-bottom: 12px; background: linear-gradient(90deg, var(--neon-green), var(--neon-blue)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                SINCRONIZANDO MONITOR OPERACIONAL
            </div>
            <div style="font-size: 14px; font-weight: 700; color: rgba(255, 255, 255, 0.4); letter-spacing: 2px; text-transform: uppercase;">
                AGUARDE, COMUNICANDO COM O LINX OMS...
            </div>
        </div>
    `;
        document.body.appendChild(tvDashboard);

        // Botão para alternar entre os Modos (TV, Apoio, Nativo)
        const toggleStyle = document.createElement('style');
        toggleStyle.innerHTML = `
        /* Status das Integrações */
        .tv-integrations-status {
            position: fixed;
            bottom: 30px;
            left: 30px;
            display: flex;
            gap: 12px;
            z-index: 250000;
        }
        .integration-pill {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(10, 15, 30, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 8px 16px;
            border-radius: 30px;
            font-size: 14px;
            font-weight: 900;
            color: #fff;
            letter-spacing: 1px;
            backdrop-filter: blur(5px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        }
        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
        }
        .dot-green { background: #00ff88; box-shadow: 0 0 10px #00ff88; }
        .dot-red { background: #ff3e3e; box-shadow: 0 0 10px #ff3e3e; animation: heartbeat 1s infinite; }
        .dot-gray { background: #555; }

        .tv-toggle-mode-btn {
            position: fixed; bottom: 30px; right: 30px; z-index: 250000;
            background: #111c30 !important; border: 2px solid #00ff88 !important;
            color: #ffffff !important; padding: 12px 24px !important;
            border-radius: 30px !important; font-family: var(--font-main) !important;
            font-size: 14px !important; font-weight: 900 !important; cursor: pointer !important;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4) !important;
            backdrop-filter: blur(10px) !important; transition: all 0.2s ease !important;
            letter-spacing: 1px !important; text-transform: uppercase !important;
        }
        .tv-toggle-mode-btn:hover {
            background: #00ff88 !important; color: #0b0f19 !important;
            border-color: #00ff88 !important; transform: translateY(-3px) scale(1.05) !important;
            box-shadow: 0 15px 30px rgba(0, 255, 136, 0.4) !important;
        }
        @media print { .tv-toggle-mode-btn { display: none !important; } }
        `;
        document.head.appendChild(toggleStyle);

        toggleBtn = document.createElement('button');
        toggleBtn.className = 'tv-toggle-mode-btn';

        function updateToggleButton() {
            if (currentViewMode === 'TV') toggleBtn.innerText = '🖥️ Ver OMS Nativo';
            else toggleBtn.innerText = '📺 Modo TV';
        }
        updateToggleButton();
        document.body.appendChild(toggleBtn);

        integrationsUI = document.createElement('div');
        integrationsUI.className = 'tv-integrations-status';
        document.body.appendChild(integrationsUI);

        function updateIntegrationsStatus() {
            if (currentViewMode !== 'TV') {
                integrationsUI.style.display = 'none';
                return;
            }
            integrationsUI.style.display = 'flex';

            const ifoodLast = parseInt(GM_getValue('ifoodLastUpdate', 0), 10);
            const ifoodLogged = GM_getValue('ifoodLoggedIn', false);
            const ifoodActive = (Date.now() - ifoodLast) < 60000;

            const rappiLast = parseInt(GM_getValue('rappiLastUpdate', 0), 10);
            const rappiLogged = GM_getValue('rappiLoggedIn', false);
            const rappiActive = (Date.now() - rappiLast) < 60000;

            let ifoodDot = 'dot-gray'; let ifoodText = 'iFood: Inativo';
            if (ifoodActive) {
                if (ifoodLogged) { ifoodDot = 'dot-green'; ifoodText = 'iFood: Online'; }
                else { ifoodDot = 'dot-red'; ifoodText = 'iFood: Deslogado'; }
            }

            let rappiDot = 'dot-gray'; let rappiText = 'Rappi: Inativo';
            if (rappiActive) {
                if (rappiLogged) { rappiDot = 'dot-green'; rappiText = 'Rappi: Online'; }
                else { rappiDot = 'dot-red'; rappiText = 'Rappi: Deslogado'; }
            }

            integrationsUI.innerHTML = `
                <div class="integration-pill">
                    <div class="status-dot ${ifoodDot}"></div>
                    <div>${ifoodText}</div>
                </div>
                <div class="integration-pill">
                    <div class="status-dot ${rappiDot}"></div>
                    <div>${rappiText}</div>
                </div>
            `;
        }
        setInterval(updateIntegrationsStatus, 3000);
        updateIntegrationsStatus();


        toggleBtn.onclick = () => {
            if (currentViewMode === 'TV') currentViewMode = 'NATIVE';
            else currentViewMode = 'TV';

            tvDashboard.style.display = currentViewMode === 'TV' ? 'flex' : 'none';

            updateToggleButton();

            if (currentViewMode !== 'NATIVE') {
                initAudio();
                check();
            }
        };

        // Overlay de Ativação do Áudio Inicial (Chrome AutoPlay Bypass)
        audioOverlay = document.createElement('div');
        audioOverlay.className = 'tv-audio-overlay';
        audioOverlay.innerHTML = `
        <div style="max-width: 600px; padding: 20px;">
            <div style="font-size: 54px; margin-bottom: 20px;">📺🔊</div>
            <h1 style="font-size: 32px; font-weight: 900; margin-bottom: 15px; color:#fff;">SISTEMA OPERACIONAL DA TV</h1>
            <p style="font-size: 18px; color: rgba(255,255,255,0.7); margin-bottom: 30px; line-height:1.5;">O navegador exige um clique inicial na tela para autorizar os avisos sonoros de novos pedidos.</p>
            <button class="tv-audio-button">ATIVAR ÁUDIO & INICIAR</button>
        </div>
    `;
        document.body.appendChild(audioOverlay);

        audioOverlay.onclick = () => {
            initAudio();
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
            playStartupChime(); // Lindo chime arpejado de confirmação
            audioOverlay.style.display = 'none';
        };

        // --- PARSER E ENGINE DE ENTREGAS ---
        function parseDeliveryInfo(p) {
            const carrierText = String(p.carrier || p.domCarrierFallback || '').toLowerCase();
            const typeText = String(p.deliveryType || '').toLowerCase();
            const apiType = String(p.apiType || '').toUpperCase();

            const isPickup = apiType === 'PICKUP' || carrierText.includes('retirada') || carrierText.includes('loja') || typeText.includes('retirada') || typeText.includes('loja');
            const isExpress = carrierText.includes('uber') || typeText.includes('express') || typeText.includes('3 horas');

            if (isPickup) {
                return { label: '🏪 RETIRADA LOJA', isExpress: false, isPickup: true };
            }

            let labelName = p.carrier || p.deliveryType || 'ENTREGA';
            if (carrierText.includes('uber')) labelName = 'UBER';
            if (carrierText.includes('sedex')) labelName = 'SEDEX';

            if (labelName.length > 20) {
                labelName = labelName.substring(0, 17) + '...';
            }

            return { label: '🚚 ' + labelName.toUpperCase(), isExpress: isExpress, isPickup: false };
        }

        // --- LÓGICA DE PRAZOS E SLA OPERACIONAL ---
        function getStoreOpeningTime(date) {
            const day = date.getDay();
            const isSunday = (day === 0);
            const openHour = isSunday ? 12 : 10;
            const closeHour = isSunday ? 21 : 22;
            return { openHour, closeHour, isSunday };
        }

        function getAdjustedStartTime(createdAt) {
            if (!createdAt) return new Date();
            let date = new Date(createdAt);
            if (isNaN(date.getTime())) date = new Date();

            const config = getStoreOpeningTime(date);
            const currentHour = date.getHours();

            if (currentHour < config.openHour) {
                date.setHours(config.openHour, 0, 0, 0);
            }
            else if (currentHour >= config.closeHour) {
                date.setDate(date.getDate() + 1);
                const nextConfig = getStoreOpeningTime(date);
                date.setHours(nextConfig.openHour, 0, 0, 0);
            }
            return date;
        }

        function getSLAInfo(createdAt, isExpress) {
            const now = new Date();
            const startTime = getAdjustedStartTime(createdAt);

            if (now < startTime) {
                return { minutes: 999, text: "🕒 AGUARDA ABERTURA", cardClass: "tv-card-green", urgency: 1, textClass: "time-green" };
            }

            const limit = new Date(startTime.getTime() + (TEMPO_LIMITE_MINUTOS * 60 * 1000));
            const diff = limit - now;
            const absDiff = Math.abs(diff);
            const mins = Math.floor(absDiff / 60000);
            const secs = Math.floor((absDiff % 60000) / 1000);
            const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

            if (diff < 0) return { minutes: -mins, text: `🚨 ESTOURADO! -${timeStr}`, cardClass: "tv-card-red", urgency: 3, textClass: "time-red" };
            if (isExpress || mins < 15) return { minutes: mins, text: `🔥 CRÍTICO: ${timeStr}`, cardClass: "tv-card-red", urgency: 3, textClass: "time-red" };
            if (mins < 40) return { minutes: mins, text: `⏳ ATENÇÃO: ${timeStr}`, cardClass: "tv-card-orange", urgency: 2, textClass: "time-orange" };

            return { minutes: mins, text: `✅ SEGURO: ${timeStr}`, cardClass: "tv-card-green", urgency: 1, textClass: "time-green" };
        }

        // --- IDENTIFICAÇÃO DE GARGALOS E ATRASOS GLOBAIS ---
        function getBottleneckInfo(o) {
            if (!o) return null;
            const now = new Date();
            const updated = new Date(o.updatedAt || o.createdAt || now);
            const diffMins = (now - updated) / 60000;

            const isRetirada = o.isPickup;

            if (o.statusNativo === 'INVOICING' && diffMins > 10) {
                return { label: '🧾 FATURAMENTO TRAVADO (>10 MIN)', isCritical: true, color: 'var(--neon-red)', stage: 'FATURANDO' };
            }
            if (o.statusNativo === 'INVOICING_FAIL') {
                return { label: '❌ ERRO FISCAL: FALHA AO EMITIR NOTA', isCritical: true, color: 'var(--neon-red)', stage: 'FATURANDO' };
            }
            if (o.statusNativo === 'PICKING' && diffMins > 30) {
                return { label: '⏳ SEPARAÇÃO LENTA NO ESTOQUE (>30 MIN)', isCritical: true, color: 'var(--neon-orange)', stage: 'SEPARANDO' };
            }
            if (o.statusNativo === 'CHECKED' && diffMins > 15) {
                return { label: '📢 CONFERIDO: FALTA FATURAR NO OMS (>15 MIN)', isCritical: true, color: 'var(--neon-orange)', stage: 'CONFERIDOS' };
            }
            if (o.statusNativo === 'SEND_READY') {
                if (!isRetirada && diffMins > 60) {
                    return { label: '🚨 CRIAR LISTA DE DESPACHO (>60 MIN)', isCritical: true, color: 'var(--neon-red)', stage: 'DESPACHOS' };
                }
                if (isRetirada && diffMins > 60) {
                    return { label: '⏳ PRONTO PARA RETIRADA (>60 MIN)', isCritical: false, color: 'var(--neon-yellow)', stage: 'RETIRADAS' };
                }
            }
            return null;
        }

        // --- RENDERIZAÇÃO DO LAYOUT EM TELA CHEIA (MODO TV) ---
        function renderTvView(list) {
            if (currentViewMode === 'NATIVE') {
                const modalEl = document.getElementById('oms-persistent-new-order-modal');
                if (modalEl) modalEl.style.display = 'none';
                return;
            }

            // Gravar posições de rolagem antes de qualquer atualização do DOM
            const retiradasListEl = document.getElementById('tv-list-retiradas');
            const entregasListEl = document.getElementById('tv-list-entregas');
            const scrollRetiradas = retiradasListEl ? retiradasListEl.scrollTop : 0;
            const scrollEntregas = entregasListEl ? entregasListEl.scrollTop : 0;

            // Filtrar pendências reais (pedidos ativos nas etapas iniciais)
            const pedidosPendentes = list.filter(o => ['WAITING', 'PICKING', 'INVOICING', 'CHECKED'].includes(o.statusNativo));

            // Filtrar gargalos operacionais (de outras etapas que falharam ou excederam tempo)
            const gargalos = list.filter(o => { const b = getBottleneckInfo(o); return !['WAITING', 'PICKING', 'INVOICING', 'CHECKED'].includes(o.statusNativo) && b && b.isCritical; });

            let visibleOrders = [...pedidosPendentes, ...gargalos];

            // Separar por canal (Retirada vs Entrega)
            const retiradas = visibleOrders.filter(o => o.isPickup);
            const entregas = visibleOrders.filter(o => !o.isPickup);

            // --- INJETAR CARDS MOCK DO IFOOD NAS ENTREGAS ---
            const ifoodPendingCards = parseInt(GM_getValue('ifoodPendingOrders', 0), 10);
            const ifoodUpdateCards = parseInt(GM_getValue('ifoodLastUpdate', 0), 10);
            const isIfoodAliveCards = (Date.now() - ifoodUpdateCards) < 60000;

            let ifoodOrderDetails = null;
            try {
                const detailsStr = GM_getValue('ifoodOrderDetails', null);
                if (detailsStr) ifoodOrderDetails = JSON.parse(detailsStr);
            } catch (e) { }

            if (isIfoodAliveCards && ifoodPendingCards > 0) {
                if (ifoodOrderDetails) {
                    entregas.unshift(ifoodOrderDetails);
                } else {
                    for (let i = 0; i < ifoodPendingCards; i++) {
                        entregas.unshift({
                            id: `NOVO-IFOOD-${i + 1}`,
                            statusNativo: 'WAITING',
                            createdAt: new Date().toISOString(),
                            isExpress: true,
                            carrier: 'NOVO PEDIDO IFOOD PENDENTE SEPARAÇÃO',
                            deliveryType: 'EXPRESS',
                            customerName: 'Acesse o App Separador',
                            items: []
                        });
                    }
                }
            }

            // --- INJETAR CARDS MOCK DO RAPPI NAS ENTREGAS ---
            const rappiPendingCards = parseInt(GM_getValue('rappiPendingOrders', 0), 10);
            const rappiUpdateCards = parseInt(GM_getValue('rappiLastUpdate', 0), 10);
            const isRappiAliveCards = (Date.now() - rappiUpdateCards) < 60000;

            if (isRappiAliveCards && rappiPendingCards > 0) {
                for (let i = 0; i < rappiPendingCards; i++) {
                    entregas.unshift({
                        id: `NOVO-RAPPI-${i + 1}`,
                        statusNativo: 'WAITING',
                        createdAt: new Date().toISOString(),
                        isExpress: true,
                        carrier: 'ACEITAR NO GESTOR RAPPI',
                        deliveryType: 'EXPRESS',
                        customerName: 'Pedido Rappi Pendente',
                        items: []
                    });
                }
            }

            // Agrupamento para pipeline horizontal superior e monitor de Apoio
            const counts = { WAITING: 0, PICKING: 0, INVOICING: 0, CHECKED: 0, SEND_READY: 0, PICKUP_READY: 0 };
            list.forEach(o => {
                if (o.statusNativo === 'INVOICING_FAIL') counts.INVOICING++;
                else if (o.statusNativo === 'PICKUP_READY' || o.statusNativo === 'PICKUP_PAID') counts.PICKUP_READY++;
                else if (counts[o.statusNativo] !== undefined) counts[o.statusNativo]++;
            });



            // 1. Atualizar relógio local
            const clockTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const clockDate = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();

            // 2. Determinar status de saúde geral
            const temPendentes = pedidosPendentes.length > 0;
            const temGargalosGraves = gargalos.length > 0;

            let statusBadgeHtml = '';
            if (temPendentes || temGargalosGraves) {
                statusBadgeHtml = `<div style="background:var(--neon-red); color:#000; font-size:16px; font-weight:900; padding:8px 18px; border-radius:30px; letter-spacing:1px; animation: heartbeat 1s infinite;">🚨 AÇÃO IMEDIATA REQUERIDA</div>`;
            } else {
                statusBadgeHtml = `<div style="background:var(--neon-green); color:#000; font-size:16px; font-weight:900; padding:8px 18px; border-radius:30px; letter-spacing:1px;">✅ TUDO EM DIA</div>`;
            }

            // --- LEITURA DO GESTOR IFOOD VIA TAMPERMONKEY STORAGE ---
            let ifoodAlertHtml = '';
            const ifoodPending = parseInt(GM_getValue('ifoodPendingOrders', 0), 10);
            const ifoodUpdate = parseInt(GM_getValue('ifoodLastUpdate', 0), 10);
            const isIfoodAlive = (Date.now() - ifoodUpdate) < 60000; // atualizado no ultimo minuto

            if (isIfoodAlive && ifoodPending > 0) {
                ifoodAlertHtml = `
                <div style="background: linear-gradient(135deg, rgba(234, 29, 44, 0.2), rgba(234, 29, 44, 0.05)); border: 3px solid #ea1d2c; border-radius: 16px; padding: 15px 30px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; animation: pulseRedGlow 1.5s infinite ease-in-out; flex-shrink: 0;">
                    <div style="display:flex; align-items:center; gap: 20px;">
                        <span style="font-size: 50px; animation: heartbeat 1s infinite;">🛵</span>
                        <div>
                            <div style="font-size: 26px; font-weight: 900; color: #ea1d2c; text-transform: uppercase; letter-spacing: 1px;">NOVO PEDIDO IFOOD PENDENTE SEPARAÇÃO</div>
                            <div style="font-size: 16px; font-weight: 700; color: rgba(255,255,255,0.8);">Abra o App Separador do iFood para visualizar e separar o pedido.</div>
                        </div>
                    </div>
                    <div style="font-size: 60px; font-weight: 900; color: #ea1d2c; font-family: 'Lilita One', cursive; line-height: 1; text-shadow: 0 0 20px rgba(234, 29, 44, 0.5);">${ifoodPending}</div>
                </div>`;

                // Dispara sirene se iFood tem pedido
                const now = Date.now();
                if (now - lastAlarmPlayedTime > ALARM_COOLDOWN) {
                    playSiren();
                    lastAlarmPlayedTime = now;
                }
            }

            // --- LEITURA DO GESTOR RAPPI VIA TAMPERMONKEY STORAGE ---
            let rappiAlertHtml = '';
            const rappiPending = parseInt(GM_getValue('rappiPendingOrders', 0), 10);
            const rappiUpdate = parseInt(GM_getValue('rappiLastUpdate', 0), 10);
            const isRappiAlive = (Date.now() - rappiUpdate) < 60000;

            if (isRappiAlive && rappiPending > 0) {
                rappiAlertHtml = `
                <div style="background: linear-gradient(135deg, rgba(255, 69, 0, 0.2), rgba(255, 69, 0, 0.05)); border: 3px solid #ff4500; border-radius: 16px; padding: 15px 30px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; animation: pulseRedGlow 1.5s infinite ease-in-out; flex-shrink: 0;">
                    <div style="display:flex; align-items:center; gap: 20px;">
                        <span style="font-size: 50px; animation: heartbeat 1s infinite;">🛵</span>
                        <div>
                            <div style="font-size: 26px; font-weight: 900; color: #ff4500; text-transform: uppercase; letter-spacing: 1px;">GESTOR RAPPI: ATENÇÃO!</div>
                            <div style="font-size: 16px; font-weight: 700; color: rgba(255,255,255,0.8);">Há ${rappiPending} pedido(s) esperando aceite no portal do Rappi que não integraram no OMS.</div>
                        </div>
                    </div>
                    <div style="font-size: 60px; font-weight: 900; color: #ff4500; font-family: 'Lilita One', cursive; line-height: 1; text-shadow: 0 0 20px rgba(255, 69, 0, 0.5);">${rappiPending}</div>
                </div>`;

                const now = Date.now();
                if (now - lastAlarmPlayedTime > ALARM_COOLDOWN) {
                    playSiren();
                    lastAlarmPlayedTime = now;
                }
            }

            // Criar estrutura base do Dashboard se vazio (Considerando integrações externas e despachos)
            const isListEmpty = (pedidosPendentes.length === 0 && gargalos.length === 0 && counts.SEND_READY === 0 && !(isIfoodAlive && ifoodPending > 0) && !(isRappiAlive && rappiPending > 0));

            // 3. Checar Destaques dos primeiros 30 segundos (Alta Prioridade)
            let discoveryTimes = {};
            try {
                discoveryTimes = JSON.parse(sessionStorage.getItem('oms_order_discovery_times') || '{}');
            } catch (e) {
                discoveryTimes = {};
            }

            const newOrdersInHighlight = list.filter(o =>
                o.statusNativo === 'WAITING' &&
                discoveryTimes[o.id] &&
                (Date.now() - discoveryTimes[o.id]) < ((o.id.includes('IFOOD') || o.id.includes('RAPPI')) ? 10000 : 30000)
            );

            let activeHighlightOrder = null;
            let elapsedMs = 0;
            let remainingMs = 0;
            let percent = 0;
            let isRotation = false;

            // 4. Checar Alertas Críticos (Prioridade Máxima Absoluta - TRAVA A TELA)
            const criticalAlerts = [];
            // iFood e Rappi removidos daqui para não travarem a tela (pedidos OMS não prejudicados)
            if (counts.SEND_READY > 0) criticalAlerts.push({ type: 'DISPATCH', count: counts.SEND_READY, id: 'VIRTUAL-DISPATCH', title: 'LISTA DE DESPACHO', color: 'var(--neon-yellow)' });

            if (criticalAlerts.length > 0) {
                // Rotaciona entre os alertas críticos se houver mais de um (a cada 5 segundos)
                const alertIndex = Math.floor(Date.now() / 5000) % criticalAlerts.length;
                activeHighlightOrder = {
                    isVirtualAlert: true,
                    ...criticalAlerts[alertIndex]
                };
                isRotation = false; // Trava a tela
                elapsedMs = 0;
                remainingMs = 0;
                percent = 100;
            } else if (newOrdersInHighlight.length > 0) {
                // Focar no novo pedido mais recentemente descoberto
                newOrdersInHighlight.sort((a, b) => (discoveryTimes[b.id] || 0) - (discoveryTimes[a.id] || 0));
                activeHighlightOrder = newOrdersInHighlight[0];
                elapsedMs = Date.now() - discoveryTimes[activeHighlightOrder.id];
                remainingMs = Math.max(0, 30000 - elapsedMs);
                percent = (remainingMs / 30000) * 100;
                isRotation = false;
            } else {
                // Sem novos pedidos nos últimos 30s: Rotacionar entre todas as pendências da lista
                const rotationCandidates = [...pedidosPendentes, ...gargalos];
                if (rotationCandidates.length > 0) {
                    const nowMs = Date.now();
                    if (lastRotationTime === 0) {
                        lastRotationTime = nowMs;
                    }

                    let cycleMs = nowMs - lastRotationTime;

                    // Ciclo total de 60 segundos (30s mostrando + 30s oculto)
                    if (cycleMs >= 60000) {
                        activeRotationalIndex = (activeRotationalIndex + 1) % rotationCandidates.length;
                        lastRotationTime = nowMs;
                        cycleMs = 0;
                    }

                    // Garantir limites caso o tamanho da lista tenha encolhido
                    if (activeRotationalIndex >= rotationCandidates.length) {
                        activeRotationalIndex = 0;
                        lastRotationTime = nowMs;
                        cycleMs = 0;
                    }

                    const isShowPhase = cycleMs < 30000;

                    if (isShowPhase) {
                        activeHighlightOrder = rotationCandidates[activeRotationalIndex];
                        elapsedMs = cycleMs;
                        remainingMs = Math.max(0, 30000 - elapsedMs);
                        percent = (remainingMs / 30000) * 100;
                        isRotation = true;
                    } else {
                        activeHighlightOrder = null;
                        isRotation = false;
                    }
                } else {
                    activeHighlightOrder = null;
                    activeRotationalIndex = 0;
                    lastRotationTime = 0;
                }
            }

            // 4. Gerenciamento do Modal de Destaque Persistente e Sem Piscadas (Flicker-Free)
            let modalEl = document.getElementById('oms-persistent-new-order-modal');
            if (!modalEl) {
                modalEl = document.createElement('div');
                modalEl.id = 'oms-persistent-new-order-modal';
                modalEl.className = 'new-order-modal';
                modalEl.style.display = 'none';
                document.body.appendChild(modalEl);
            }

            if (activeHighlightOrder) {
                if (activeHighlightOrder.isVirtualAlert) {
                    // --- RENDERIZA O MODAL DE ALERTA CRÍTICO (TELA TRAVADA) ---
                    const currentShowingId = modalEl.getAttribute('data-showing-id');
                    if (currentShowingId !== activeHighlightOrder.id) {
                        const now = Date.now();
                        if (now - lastAlarmPlayedTime > ALARM_COOLDOWN) {
                            playSiren();
                            lastAlarmPlayedTime = now;
                        }
                    }
                    modalEl.setAttribute('data-showing-id', activeHighlightOrder.id);
                    modalEl.setAttribute('data-is-rotation', 'false');
                    modalEl.className = 'new-order-modal'; // reset de animação
                    modalEl.style.borderColor = activeHighlightOrder.color;
                    modalEl.style.boxShadow = `0 20px 60px ${activeHighlightOrder.color}80`;

                    const aType = activeHighlightOrder.type;
                    let msg = '';
                    if (aType === 'DISPATCH') msg = 'Acesse o OMS &rarr; Lista de Despacho e realize a expedição dos pedidos conferidos antes de iniciar novas separações.';
                    else msg = `Há ${activeHighlightOrder.count} pedido(s) esperando aceite no portal que não integraram no OMS. Aceite-os manualmente.`;

                    modalEl.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; background: radial-gradient(circle, rgba(20,10,10,0.95) 0%, rgba(10,0,0,0.95) 100%); border-radius: 12px; border: 5px solid ${activeHighlightOrder.color}; animation: pulseRedGlow 1.5s infinite; text-align: center; padding: 40px; box-sizing: border-box;">
                        <div style="font-size: 120px; animation: heartbeat 1s infinite; margin-bottom: 20px;">🚨</div>
                        <div style="font-size: 80px; font-weight: 900; color: ${activeHighlightOrder.color}; text-transform: uppercase; line-height: 1; margin-bottom: 30px; text-shadow: 0 0 30px ${activeHighlightOrder.color};">
                            ${activeHighlightOrder.title} PENDENTE!
                        </div>
                        <div style="font-size: 32px; color: #fff; font-weight: 700; max-width: 80%; line-height: 1.4; margin-bottom: 50px;">
                            ${msg}
                        </div>
                        <div style="background: ${activeHighlightOrder.color}20; border: 3px solid ${activeHighlightOrder.color}; padding: 20px 60px; border-radius: 20px;">
                            <div style="font-size: 24px; color: rgba(255,255,255,0.7); text-transform: uppercase; font-weight: 900; margin-bottom: 10px;">QUANTIDADE PENDENTE</div>
                            <div style="font-size: 100px; color: #fff; font-weight: 900; line-height: 1; text-shadow: 0 0 20px ${activeHighlightOrder.color};">${activeHighlightOrder.count}</div>
                        </div>
                    </div>
                    `;
                    modalEl.style.display = 'block';

                } else {
                    // --- RENDERIZA O CARROSSEL DE SEPARAÇÃO (PEDIDOS) ---
                    const deliveryInfo = parseDeliveryInfo(activeHighlightOrder);

                    // 3. Determinar o tema de cor de acordo com o canal de venda
                    const labelStr = String(deliveryInfo.label).toUpperCase();
                    const isIfood = labelStr.includes('IFOOD');
                    const isRappi = labelStr.includes('RAPPI');

                    let themeColor = 'var(--neon-blue)'; // Azul neon padrão para revezamentos
                    let themeGlow = 'rgba(0, 210, 255, 0.4)';

                    if (!isRotation) {
                        themeColor = 'var(--neon-green)';
                        themeGlow = 'rgba(0, 255, 136, 0.4)';
                    }

                    // Substituições de cores de marca (iFood/Rappi)
                    if (isIfood) {
                        themeColor = '#FF002E'; // Vermelho iFood Neon
                        themeGlow = 'rgba(255, 0, 46, 0.45)';
                    } else if (isRappi) {
                        themeColor = '#FF4500'; // Laranja Rappi Neon
                        themeGlow = 'rgba(255, 69, 0, 0.45)';
                    }

                    // Aplicar estilos dinâmicos de borda e sombra no modal
                    modalEl.style.borderColor = themeColor;
                    modalEl.style.boxShadow = `0 20px 60px ${themeGlow}`;

                    // 4. Determinar se o SLA geral do pedido está estourado (meta real)
                    const orderSla = getSLAInfo(activeHighlightOrder.createdAt, activeHighlightOrder.isExpress);
                    const isSlaExpired = orderSla.urgency === 3 && orderSla.text.includes('ESTOURADO');

                    let marqueeContent = '';
                    if (isSlaExpired) {
                        marqueeContent = '🚨 PRAZO DE SLA EXCEDIDO! REALIZAR A SEPARAÇÃO DE IMEDIATO! 🚨 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; '.repeat(3);
                    } else if (!isRotation) {
                        marqueeContent = '🚨 NOVO PEDIDO PENDENTE DE SEPARAÇÃO IMEDIATA! 🚨 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; '.repeat(3);
                    } else {
                        marqueeContent = '⚠️ ATENÇÃO: PEDIDO PENDENTE DE SEPARAÇÃO OPERACIONAL! ⚠️ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; '.repeat(3);
                    }

                    // Se mudou o pedido ativo ou o modal estava escondido, ou se for hora de rotacionar os itens
                    const currentShowingId = modalEl.getAttribute('data-showing-id');
                    const currentHighlightType = modalEl.getAttribute('data-is-rotation');
                    const hasTypeChanged = currentHighlightType !== String(isRotation);

                    const apiItemsList = Array.isArray(activeHighlightOrder.items) ? activeHighlightOrder.items : [];

                    // Rotação dos itens do pedido a cada 5 segundos
                    const nowSecs = Math.floor(Date.now() / 1000);
                    let itemRotationTriggered = false;
                    if (apiItemsList.length > 1) {
                        if (nowSecs - lastOrderItemRotationTime >= 5) {
                            activeOrderItemIndex = (activeOrderItemIndex + 1) % apiItemsList.length;
                            lastOrderItemRotationTime = nowSecs;
                            itemRotationTriggered = true;
                        }
                    } else {
                        activeOrderItemIndex = 0;
                    }

                    // Zera o índice ao mudar de pedido
                    if (currentShowingId !== activeHighlightOrder.id) {
                        activeOrderItemIndex = 0;
                        lastOrderItemRotationTime = nowSecs;
                    }

                    if (currentShowingId !== activeHighlightOrder.id || modalEl.style.display === 'none' || hasTypeChanged || itemRotationTriggered) {
                        if (currentShowingId !== activeHighlightOrder.id || modalEl.style.display === 'none') {
                            playNotificationChime(); // Toca apenas quando abre um pedido novo
                        }

                        modalEl.setAttribute('data-showing-id', activeHighlightOrder.id);
                        modalEl.setAttribute('data-is-rotation', String(isRotation));

                        if (isRotation) {
                            modalEl.classList.add('rotate-mode');
                        } else {
                            modalEl.classList.remove('rotate-mode');
                        }

                        const item = apiItemsList[activeOrderItemIndex] || {};
                        const isMultiple = Number(item.quantity) > 1;
                        const qtyBadgeStyle = isMultiple
                            ? `background: rgba(255, 69, 0, 0.2); border: 3px solid #FF4500; color: #FF4500; box-shadow: 0 0 20px rgba(255, 69, 0, 0.6);`
                            : `background: rgba(0, 255, 136, 0.1); border: 2px solid rgba(0, 255, 136, 0.3); color: var(--neon-green);`;
                        const qtyText = isMultiple ? `⚠️ QTD: ${item.quantity}` : `QTD: ${item.quantity || 1}`;
                        const imgUrl = item.imageUrl || '';

                        const modalTitle = isRotation ? '⚠️ PEDIDO PENDENTE' : '🚨 NOVO PEDIDO';
                        const subSlaTitle = isRotation ? 'TELA OPERACIONAL CONGELA EM' : 'SLA DE SEPARAÇÃO IMEDIATO';
                        const countdownLabel = isRotation ? 'OCULTA EM' : 'FALTA EM';

                        const isAtrasado = orderSla.text.includes('ESTOURADO');
                        const statusText = isAtrasado ? 'ATRASADO' : 'NOVO';
                        let rawCarrier = String(activeHighlightOrder.carrier || activeHighlightOrder.deliveryType || (deliveryInfo.isPickup ? 'RETIRADA' : 'ENTREGA')).toUpperCase();
                        if (rawCarrier.length > 20) rawCarrier = rawCarrier.substring(0, 17) + '...';
                        const tipoText = rawCarrier;
                        const tipoColor = deliveryInfo.isPickup ? 'var(--neon-yellow)' : 'var(--neon-blue)';
                        const statusColor = isAtrasado ? 'var(--neon-red)' : 'var(--neon-green)';

                        modalEl.innerHTML = `
                    <div style="display: flex; height: 100%; width: 100%; background: radial-gradient(circle, rgba(11,11,15,0.95) 0%, rgba(20,20,30,0.95) 100%); overflow: hidden; font-family: 'Lilita One', cursive; border-radius: 12px; box-sizing: border-box;">
                        <!-- Lado Esquerdo: Produto -->
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px; position: relative;">
                            <div style="position: absolute; top: 30px; left: 40px; font-size: 50px; color: rgba(255,255,255,0.1); white-space: nowrap; font-weight: 900; text-transform: uppercase;">
                                ITEM ${activeOrderItemIndex + 1} DE ${apiItemsList.length}
                            </div>

                            <!-- Imagem -->
                            <div style="height: 40vh; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; width: 100%;">
                                ${imgUrl
                                ? `<img src="${imgUrl}" style="max-height: 100%; max-width: 100%; object-fit: contain; filter: drop-shadow(0 20px 30px rgba(0,0,0,0.5)); border-radius: 20px; z-index: 2;">`
                                : `<div style="font-size: 100px; filter: grayscale(1);">🧸</div>`
                            }
                            </div>

                            <div style="font-size: 40px; color: #fff; text-align: center; max-width: 90%; line-height: 1.1; margin-bottom: 30px; z-index: 2; text-shadow: 0 4px 10px rgba(0,0,0,0.5); font-family: sans-serif; font-weight: bold;">
                                ${item.name || 'Produto sem nome'}
                            </div>

                            <div style="display: flex; gap: 20px; justify-content: center; width: 100%; z-index: 2;">
                                <div style="background: rgba(100, 180, 255, 0.1); padding: 15px 30px; border-radius: 15px; font-family: monospace; font-size: 36px; font-weight: 900; color: #aae9ff; border: 2px solid rgba(100, 180, 255, 0.3); letter-spacing: 2px; text-shadow: 0 0 10px rgba(100,180,255,0.3);">
                                    SAP: ${item.sku || '---'}
                                </div>
                                <div style="background: rgba(255, 220, 100, 0.1); padding: 15px 30px; border-radius: 15px; font-family: monospace; font-size: 36px; font-weight: 900; color: #ffe6aa; border: 2px solid rgba(255, 220, 100, 0.3); letter-spacing: 2px; text-shadow: 0 0 10px rgba(255,220,100,0.3);">
                                    EAN: ${item.ean || '---'}
                                </div>
                                <div style="${qtyBadgeStyle} padding: 15px 30px; border-radius: 15px; font-size: 36px; font-weight: 900; letter-spacing: 2px;">
                                    ${qtyText}
                                </div>
                            </div>
                        </div>

                        <!-- Lado Direito: Resumo do Pedido -->
                        <div style="width: 350px; background: rgba(0,0,0,0.4); border-left: 2px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 40px 20px; box-sizing: border-box;">

                            <div style="text-align: center; width: 100%;">
                                <div style="font-size: 20px; font-weight: 900; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">${modalTitle}</div>
                                <div style="font-size: 36px; font-weight: 900; color: ${tipoColor}; text-shadow: 0 0 20px ${tipoColor}40; line-height: 1.1; margin-bottom: 20px; word-break: break-word;">${tipoText}</div>

                                <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 15px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 30px; width: 100%; box-sizing: border-box;">
                                    <div style="font-size: 16px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Pedido OMS</div>
                                    <div style="font-size: 32px; color: #fff; font-weight: 900; word-break: break-all; line-height: 1.1;">#${activeHighlightOrder.id}</div>
                                </div>
                            </div>

                            <div style="text-align: center; width: 100%;">
                                <div style="font-size: 18px; font-weight: 900; color: ${statusColor}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; background: ${statusColor}20; padding: 10px; border-radius: 10px; border: 1px solid ${statusColor}40;">
                                    STATUS: ${statusText}
                                </div>

                                <!-- Cronômetro SLA Original -->
                                <div style="margin-bottom: 30px;">
                                    <div style="font-size: 14px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">SLA do Pedido</div>
                                    <div id="modal-sla-time" style="font-size: 50px; font-weight: 900; color: ${isAtrasado ? 'var(--neon-red)' : '#fff'}; text-shadow: 0 0 20px ${isAtrasado ? 'rgba(255,0,0,0.5)' : 'rgba(255,255,255,0.2)'}; line-height: 1;">
                                        ${orderSla.text.split(' ').pop()}
                                    </div>
                                </div>

                                <!-- Barra de Progresso de Alerta -->
                                <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 15px; border: 1px solid rgba(255,255,255,0.05); width: 100%; box-sizing: border-box;">
                                    <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 800; color: rgba(255,255,255,0.4); margin-bottom: 10px;">
                                        <span>${subSlaTitle}</span>
                                    </div>
                                    <div style="font-size: 30px; font-weight: 900; color: #fff; margin-bottom: 15px;" id="oms-new-order-countdown-text">
                                        ${countdownLabel} ${Math.ceil(remainingMs / 1000)}s
                                    </div>
                                    <div style="background: rgba(255,255,255,0.1); border-radius: 8px; height: 10px; overflow: hidden; width: 100%;">
                                        <div id="oms-new-order-progress-bar" style="background: ${themeColor}; height: 100%; width: ${percent}%; box-shadow: 0 0 15px ${themeColor}; transition: width 0.2s linear;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                        modalEl.style.display = 'block';
                    } else {
                        // Se é o mesmo pedido, ATUALIZAR APENAS a timeline, o countdown do modal (Flicker-Free!)
                        const countdownTextEl = document.getElementById('oms-new-order-countdown-text');
                        const progressBarEl = document.getElementById('oms-new-order-progress-bar');
                        const countdownLabel = isRotation ? 'OCULTA EM' : 'FALTA EM';

                        if (countdownTextEl) {
                            countdownTextEl.innerText = `${countdownLabel} ${Math.ceil(remainingMs / 1000)}s`;
                        }
                        if (progressBarEl) {
                            progressBarEl.style.width = `${percent}%`;
                            progressBarEl.style.background = themeColor;
                            progressBarEl.style.boxShadow = `0 0 10px ${themeColor}`;
                        }

                        const modalSlaTimeEl = document.getElementById('modal-sla-time');
                        if (modalSlaTimeEl) {
                            const isAtrasado = orderSla.text.includes('ESTOURADO');
                            modalSlaTimeEl.innerText = orderSla.text.split(' ').pop();
                            modalSlaTimeEl.style.color = isAtrasado ? 'var(--neon-red)' : '#fff';
                        }

                        // Ticking do cronômetro de picking recomendado em tempo real
                        const timerWrapperEl = document.getElementById('oms-picking-timer-wrapper');
                        const timerValueEl = document.getElementById('oms-picking-timer-value');

                        if (timerValueEl) {
                            timerValueEl.innerText = pickingTimerExpired ? '🚨 LIMITE EXCEDIDO' : pickingTimerStr;
                        }
                        if (timerWrapperEl) {
                            timerWrapperEl.style.borderColor = pickingTimerColor;
                            timerWrapperEl.style.animation = pickingTimerPulse;
                        }
                    } // FIM DO UPDATE TIMER
                } // FIM DO ELSE (CARROSSEL)
            } else {
                modalEl.style.display = 'none';
                modalEl.removeAttribute('data-showing-id');
                modalEl.removeAttribute('data-is-rotation');
            }

            let emptyStateHtml = '';
            if (isListEmpty) {
                const ifoodAguardando = parseInt(GM_getValue('ifoodAguardandoColeta', 0), 10);
                const rappiAguardando = parseInt(GM_getValue('rappiAguardandoColeta', 0), 10);
                emptyStateHtml = `
                    <div style="display: flex; height: 100vh; background: radial-gradient(circle, rgba(11,11,15,1) 0%, rgba(20,20,30,1) 100%); width: 100vw; overflow: hidden; font-family: 'Lilita One', cursive; align-items: center; justify-content: center;">

                        <!-- Lado Esquerdo: Relógio Gigante e Status -->
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; border-right: 2px solid rgba(255,255,255,0.05);">
                            <div style="font-size: 200px; font-weight: 900; color: #fff; line-height: 1; text-shadow: 0 0 40px rgba(255,255,255,0.2);">${clockTime}</div>
                            <div style="font-size: 50px; color: rgba(255,255,255,0.5); font-weight: 700; margin-top: 10px; text-transform: uppercase;">${clockDate}</div>
                            <div style="margin-top: 60px; padding: 20px 40px; background: rgba(0, 255, 136, 0.1); border: 2px solid var(--neon-green); border-radius: 30px; color: var(--neon-green); font-size: 28px; font-weight: 900; letter-spacing: 2px; animation: heartbeat 2s infinite;">
                                ✅ NENHUMA PENDÊNCIA NO MOMENTO
                            </div>
                        </div>

                        <!-- Lado Direito: Monitor de Coleta -->
                        <div style="width: 500px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; margin-right: 80px;">

                            <div style="text-align: center; background: rgba(0, 0, 0, 0.4); border: 2px solid rgba(255, 255, 255, 0.1); padding: 30px; border-radius: 24px; width: 100%; box-sizing: border-box; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                                <div style="font-size: 28px; color: #fff; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 30px;">
                                    🛵 Aguardando Coleta
                                </div>

                                <div style="display: flex; flex-direction: column; gap: 20px;">
                                    <!-- iFood -->
                                    <div style="background: ${ifoodAguardando > 0 ? 'rgba(234, 29, 44, 0.15)' : 'rgba(255, 255, 255, 0.05)'}; border: 2px solid ${ifoodAguardando > 0 ? '#ea1d2c' : 'rgba(255,255,255,0.1)'}; padding: 20px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; ${ifoodAguardando > 0 ? 'animation: pulseRedGlow 2s infinite;' : ''}">
                                        <div style="display: flex; align-items: center; gap: 15px;">
                                            <span style="font-size: 40px;">🔴</span>
                                            <span style="font-size: 28px; font-weight: bold; color: ${ifoodAguardando > 0 ? '#ea1d2c' : 'rgba(255,255,255,0.5)'};">iFood</span>
                                        </div>
                                        <span style="font-size: 50px; font-weight: 900; color: ${ifoodAguardando > 0 ? '#ea1d2c' : 'rgba(255,255,255,0.3)'}; font-family: 'Lilita One', cursive; line-height: 1;">${ifoodAguardando}</span>
                                    </div>

                                    <!-- Rappi -->
                                    <div style="background: ${rappiAguardando > 0 ? 'rgba(255, 69, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)'}; border: 2px solid ${rappiAguardando > 0 ? '#ff4500' : 'rgba(255,255,255,0.1)'}; padding: 20px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; ${rappiAguardando > 0 ? 'animation: pulseYellowGlow 2s infinite;' : ''}">
                                        <div style="display: flex; align-items: center; gap: 15px;">
                                            <span style="font-size: 40px;">🟠</span>
                                            <span style="font-size: 28px; font-weight: bold; color: ${rappiAguardando > 0 ? '#ff4500' : 'rgba(255,255,255,0.5)'};">Rappi</span>
                                        </div>
                                        <span style="font-size: 50px; font-weight: 900; color: ${rappiAguardando > 0 ? '#ff4500' : 'rgba(255,255,255,0.3)'}; font-family: 'Lilita One', cursive; line-height: 1;">${rappiAguardando}</span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                `;
            }

            tvDashboard.innerHTML = `
            ${isListEmpty ? emptyStateHtml : `
                <div style="padding: 20px; flex-shrink: 0; padding-bottom: 0;">
                    ${ifoodAlertHtml}
                    ${rappiAlertHtml}
                </div>

                <!-- Top Header Consolidado -->
                <div class="tv-header" style="justify-content: center; padding: 20px 40px; border-bottom: 2px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.5); display: flex; gap: 40px; align-items: center;">
                    <!-- Card de Fluxo Operacional Consolidado -->
                    <div style="display: flex; gap: 40px; background: rgba(255,255,255,0.03); padding: 15px 40px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08);">
                        <div style="text-align: center;">
                            <div style="font-size: 16px; color: var(--neon-yellow); font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Separando</div>
                            <div style="font-size: 45px; color: var(--neon-yellow); font-weight: 900; line-height: 1.1;">${counts.PICKING}</div>
                        </div>
                        <div style="width: 2px; background: rgba(255,255,255,0.1);"></div>
                        <div style="text-align: center;">
                            <div style="font-size: 16px; color: var(--neon-blue); font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Faturando</div>
                            <div style="font-size: 45px; color: var(--neon-blue); font-weight: 900; line-height: 1.1;">${counts.INVOICING}</div>
                        </div>
                        <div style="width: 2px; background: rgba(255,255,255,0.1);"></div>
                        <div style="text-align: center;">
                            <div style="font-size: 16px; color: var(--neon-orange); font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Preparar Entrega</div>
                            <div style="font-size: 45px; color: var(--neon-orange); font-weight: 900; line-height: 1.1;">${counts.CHECKED}</div>
                        </div>
                    </div>

                    <!-- Clock -->
                    <div class="tv-clock-group" style="display: flex; flex-direction: column; align-items: flex-end;">
                        <div class="tv-clock" style="font-size: 55px; line-height: 1; font-weight: 900; color: #fff;">${clockTime}</div>
                        <div class="tv-date" style="font-size: 20px; color: rgba(255,255,255,0.6);">${clockDate}</div>
                    </div>
                </div>

                <!-- Alerta de Lista de Despacho (aparece quando SEND_READY > 0) -->
                ${counts.SEND_READY > 0 ? `
                <div class="dispatch-alert-banner" style="margin: 20px 20px 0 20px;">
                    <div class="dispatch-alert-banner-icon">🚨</div>
                    <div class="dispatch-alert-banner-text">
                        <div class="dispatch-alert-banner-title">LISTA DE DESPACHO PENDENTE!</div>
                        <div class="dispatch-alert-banner-sub">Acesse o OMS &rarr; Lista de Despacho e realize a expedição dos pedidos conferidos antes de iniciar novas separações.</div>
                    </div>
                    <div class="dispatch-alert-banner-count">${counts.SEND_READY}</div>
                </div>
                ` : ''}

                <!-- Grid de Pedidos Retirada vs Entrega -->
                <div class="tv-main-grid">
                    <!-- Coluna Esquerda: Retiradas -->
                    <div class="tv-column tv-column-left">
                        <div class="tv-column-header tv-header-yellow" style="font-size: 26px; padding: 20px; background: linear-gradient(135deg, rgba(241, 196, 15, 0.15), rgba(241, 196, 15, 0.05)); border: 1px solid rgba(241, 196, 15, 0.3); color: var(--neon-yellow);">
                            <span class="tv-column-title"><span style="font-size: 34px;">🏪</span> RETIRADA EM LOJA</span>
                            <span class="tv-column-counter" style="background:#000; color:var(--neon-yellow); font-size: 48px; padding: 5px 20px; border-radius: 12px; border: 2px solid var(--neon-yellow);">${retiradas.length}</span>
                        </div>
                        <div class="tv-orders-list" id="tv-list-retiradas">
                            ${retiradas.map(o => renderTVCard(o)).join('')}
                        </div>
                    </div>

                    <!-- Coluna Direita: Entregas -->
                    <div class="tv-column tv-column-right">
                        <div class="tv-column-header tv-header-blue" style="font-size: 26px; padding: 20px; background: linear-gradient(135deg, rgba(0, 210, 255, 0.15), rgba(0, 210, 255, 0.05)); border: 1px solid rgba(0, 210, 255, 0.3); color: var(--neon-blue);">
                            <span class="tv-column-title"><span style="font-size: 34px;">🚚</span> SHIPFROM - IFOOD - RAPPI</span>
                            <span class="tv-column-counter" style="background:#000; color:var(--neon-blue); font-size: 48px; padding: 5px 20px; border-radius: 12px; border: 2px solid var(--neon-blue);">${entregas.length}</span>
                        </div>
                        <div class="tv-orders-list" id="tv-list-entregas">
                            ${entregas.map(o => renderTVCard(o)).join('')}
                        </div>
                    </div>
                </div>
            `}

            <!-- Footer Informativo -->
            <div style="font-size: 11px; color:rgba(255,255,255,0.2); text-align:center; padding-top:15px; border-top:1px solid rgba(255,255,255,0.05); margin-top:10px; flex-shrink:0;">
                ATUALIZAÇÃO EM TEMPO REAL OPERACIONAL DE SLA • SYNC: ${new Date().toLocaleTimeString()}
            </div>
        `;

            // Restaurar posições de rolagem instantaneamente
            const retiradasListElNew = document.getElementById('tv-list-retiradas');
            const entregasListElNew = document.getElementById('tv-list-entregas');
            if (retiradasListElNew) retiradasListElNew.scrollTop = scrollRetiradas;
            if (entregasListElNew) entregasListElNew.scrollTop = scrollEntregas;

            // Tocar alarme de lembrete sonoro se necessário (hands-free alarm loop)
            const now = Date.now();
            if ((temPendentes || temGargalosGraves) && (now - lastAlarmPlayedTime > ALARM_COOLDOWN)) {
                playSiren();
                lastAlarmPlayedTime = now;
            }
        }

        // --- RENDERIZADOR DE CARDS PARA TV ---
        function renderTVCard(o) {
            const delivery = parseDeliveryInfo(o);
            const sla = getSLAInfo(o.createdAt, o.isExpress);
            const bottleneck = getBottleneckInfo(o);

            // Escolhe o estilo de borda do card baseado na urgência e no gargalo
            let cardStyleClass = sla.cardClass;
            if (bottleneck && bottleneck.isCritical) {
                cardStyleClass = 'tv-card-red';
            }

            const isPickupOrder = delivery.isPickup;
            const carrierClass = isPickupOrder ? 'carrier-pickup' : 'carrier-delivery';

            let bottleneckHtml = '';
            if (bottleneck) {
                bottleneckHtml = `
                <div class="tv-bottleneck-alert" style="
                    background: linear-gradient(90deg, rgba(255, 62, 62, 0.15) 0%, rgba(255, 62, 62, 0.02) 100%);
                    border-left: 4px solid var(--neon-red);
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 800;
                    color: #ff8b8b;
                    letter-spacing: 0.3px;
                    margin-top: 4px;
                ">
                    ⚠️ ${bottleneck.label}
                </div>
            `;
            }

            // Determina a etiqueta de status do pedido
            let stageLabel = o.statusNativo;
            if (o.statusNativo === 'WAITING') stageLabel = 'NOVO';
            if (o.statusNativo === 'PICKING') stageLabel = 'SEPARANDO';
            if (o.statusNativo === 'CHECKED') stageLabel = 'CONFERIDO';
            if (o.statusNativo === 'INVOICING') stageLabel = 'FATURANDO';
            if (o.statusNativo === 'INVOICING_FAIL') stageLabel = 'FALHA DE FATURAMENTO';
            if (o.statusNativo === 'SEND_READY') stageLabel = 'CONFERIDO';

            let badgeStyleClass = 'badge-green';
            if (sla.urgency === 2) badgeStyleClass = 'badge-orange';
            if (sla.urgency === 3 || (bottleneck && bottleneck.isCritical)) badgeStyleClass = 'badge-red';

            const isIfood = delivery.label.includes('IFOOD');
            const isRappi = delivery.label.includes('RAPPI');
            let deliveryGlowStyle = 'border-left: 3px solid var(--neon-blue); padding-left: 8px;';
            if (isPickupOrder) {
                deliveryGlowStyle = 'border-left: 3px solid var(--neon-yellow); padding-left: 8px;';
            } else if (isIfood) {
                deliveryGlowStyle = 'border-left: 3px solid #ea1d2c; padding-left: 8px;';
            } else if (isRappi) {
                deliveryGlowStyle = 'border-left: 3px solid #ff7800; padding-left: 8px;';
            }

            let deliveryAppTipHtml = '';
            if (isIfood) {
                deliveryAppTipHtml = `
                <div class="tv-delivery-app-tip" style="
                    background: rgba(234, 29, 44, 0.18);
                    border: 1px solid rgba(234, 29, 44, 0.4);
                    color: #ff5c6c;
                    font-size: 11px;
                    font-weight: 900;
                    padding: 8px 12px;
                    border-radius: 8px;
                    text-align: center;
                    margin-top: 6px;
                    margin-bottom: 4px;
                    letter-spacing: 0.5px;
                    animation: heartbeat 2s infinite;
                ">
                    📱 ACOMPANHAR/VERIFICAR NO APP GESTOR IFOOD!
                </div>
            `;
            } else if (isRappi) {
                deliveryAppTipHtml = `
                <div class="tv-delivery-app-tip" style="
                    background: rgba(255, 120, 0, 0.18);
                    border: 1px solid rgba(255, 120, 0, 0.4);
                    color: #ff9b4d;
                    font-size: 11px;
                    font-weight: 900;
                    padding: 8px 12px;
                    border-radius: 8px;
                    text-align: center;
                    margin-top: 6px;
                    margin-bottom: 4px;
                    letter-spacing: 0.5px;
                    animation: heartbeat 2s infinite;
                ">
                    📱 ACOMPANHAR/VERIFICAR NO PORTAL RAPPI!
                </div>
            `;
            }

            const isAtrasado = sla.text.includes('ESTOURADO');
            const statusText = isAtrasado ? 'ATRASADO' : 'NOVO';
            const tipoText = isPickupOrder ? 'RETIRADA' : 'ENTREGA';
            const tipoColor = isPickupOrder ? 'var(--neon-yellow)' : 'var(--neon-blue)';
            const statusColor = isAtrasado ? 'var(--neon-red)' : 'var(--neon-green)';

            return `
            <div class="tv-order-card ${cardStyleClass}" style="
                background: linear-gradient(135deg, rgba(20, 32, 54, 0.95), rgba(13, 22, 38, 0.98)) !important;
                border-width: 2px !important;
                box-shadow: 0 12px 30px rgba(0,0,0,0.6) !important;
            ">
                <!-- Top Row: NUMERO | TIPO | STATUS | TEMPO -->
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 10px 15px; border-radius: 10px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-size: 10px; color: rgba(255,255,255,0.4); font-weight: 800; text-transform: uppercase;">PEDIDO</span>
                        <span style="font-size: 18px; font-weight: 900; color: #fff; font-family: 'Lilita One', cursive;">#${o.id}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-size: 10px; color: rgba(255,255,255,0.4); font-weight: 800; text-transform: uppercase;">TIPO</span>
                        <span style="font-size: 16px; font-weight: 900; color: ${tipoColor};">${tipoText}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-size: 10px; color: rgba(255,255,255,0.4); font-weight: 800; text-transform: uppercase;">STATUS</span>
                        <span style="font-size: 16px; font-weight: 900; color: ${statusColor};">${statusText}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 2px; align-items: flex-end;">
                        <span style="font-size: 10px; color: rgba(255,255,255,0.4); font-weight: 800; text-transform: uppercase;">TEMPO SEPARAÇÃO</span>
                        <span style="font-size: 20px; font-weight: 900; color: ${isAtrasado ? 'var(--neon-red)' : '#fff'}; font-family: 'Lilita One', cursive;">${sla.text.split(' ').pop()}</span>
                    </div>
                </div>

                ${bottleneckHtml}
                ${deliveryAppTipHtml}

                <!-- Product Items Detail List -->
                ${(() => {
                    const itemsList = Array.isArray(o.items) ? o.items : [];
                    if (itemsList.length === 0) return '';
                    let itemsHtml = `
                        <div class="tv-card-items-sublist" style="
                            display: flex;
                            flex-direction: column;
                            gap: 10px;
                            background: rgba(0, 0, 0, 0.25);
                            padding: 12px;
                            border-radius: 8px;
                            margin-top: 5px;
                            border: 1px solid rgba(255, 255, 255, 0.04);
                        ">
                    `;
                    itemsList.forEach((item, index) => {
                        const imgHtml = item.imageUrl
                            ? `<img src="${item.imageUrl}" style="width: 48px; height: 48px; border-radius: 6px; object-fit: cover; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08);" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />`
                            : '';
                        const fallbackImgHtml = `<div style="width: 48px; height: 48px; border-radius: 6px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); display: ${item.imageUrl ? 'none' : 'flex'}; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">🧸</div>`;

                        const isLast = index === itemsList.length - 1;
                        const borderStyle = isLast ? '' : 'border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px;';

                        itemsHtml += `
                            <div style="display: flex; flex-direction: column; gap: 8px; ${borderStyle}">
                                <span style="font-size: 14px; font-weight: 800; color: #ffffff; line-height: 1.3;">${item.name}</span>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    ${imgHtml}
                                    ${fallbackImgHtml}
                                    <div style="display: flex; flex-direction: column; flex: 1;">
                                        <span style="font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.5);">SAP: ${item.sku} | EAN: ${item.ean || '---'}</span>
                                    </div>
                                    <span style="font-size: 16px; font-weight: 900; color: var(--neon-green); background: rgba(0, 255, 136, 0.08); padding: 4px 12px; border-radius: 6px; border: 1px solid rgba(0, 255, 136, 0.15); flex-shrink: 0;">QTD: ${item.quantity}</span>
                                </div>
                            </div>
                        `;
                    });
                    itemsHtml += `</div>`;
                    return itemsHtml;
                })()}
            </div>
        `;
        }

        // --- REQUISIÇÕES DA API LINX OMS ---
        async function apiFetch(statuses) {
            const activeStoreId = getDynamicStoreId() || LOJA_ID;
            const base = 'https://instore.linxoms.com.br/api/proxy/order-ms/clients/rihappy/fulfillments?';
            const filter = `filterGroups[1][filters][0][property]=locationId&filterGroups[1][filters][0][condition]=eq&filterGroups[1][filters][0][value]=${activeStoreId}` +
                `&filterGroups[1][filters][1][property]=status&filterGroups[1][filters][1][operation]=whereIn&` +
                statuses.map(s => `filterGroups[1][filters][1][value][]=${s}`).join('&');

            try {
                const r = await fetch(base + filter + '&includes[]=order&pageSize=100');
                if (!r.ok) throw new Error(`HTTP Error: ${r.status}`);
                return await r.json();
            } catch (e) {
                console.error("Erro na API Linx OMS:", e);
                return null;
            }
        }

        function getDeliveryFromDOM(orderId) {
            if (!orderId) return { carrier: null, type: null, fullId: null };
            const baseId = String(orderId).replace('#', '').split('-')[0].trim().toLowerCase();
            const rows = document.querySelectorAll('table tbody tr');

            for (const row of rows) {
                let rowId = '';
                const idElement = row.querySelector('.table-order-id span');
                if (idElement) rowId = idElement.innerText.trim();

                if (rowId.toLowerCase().includes(baseId) || row.innerHTML.toLowerCase().includes(baseId)) {
                    let finalId = orderId;
                    if (rowId && rowId.toLowerCase().includes(baseId)) {
                        finalId = rowId;
                    } else {
                        const regex = new RegExp(baseId + '[-_\\.][0-9]+', 'i');
                        const fullIdMatch = row.innerHTML.match(regex);
                        if (fullIdMatch) finalId = fullIdMatch[0];
                    }

                    let typeText = '';
                    const typeSpan = row.querySelector('.shipping-type');
                    if (typeSpan) typeText = typeSpan.innerText.trim();

                    let carrierText = '';
                    const cells = row.querySelectorAll('td');
                    cells.forEach(cell => {
                        const text = cell.innerText.trim();
                        if (text.toLowerCase().includes('retirada em loja') || text.toLowerCase().includes('uber next day') || text.toLowerCase().includes('sedex')) {
                            carrierText = text;
                        }
                    });

                    return { carrier: carrierText || null, type: typeText || null, fullId: finalId };
                }
            }
            return { carrier: null, type: null, fullId: orderId };
        }

        // --- CONTROLLER PRINCIPAL DE DADOS (CHECKER) ---
        async function check() {
            // Se o usuário foi desconectado, deslogou ou retornou para a tela de autenticação
            if (!isLinxOmsLoggedIn()) {
                console.warn("Monitor TV: Sessão encerrada ou tela de login detectada. Ocultando monitor...");
                if (tvDashboard) tvDashboard.style.display = 'none';
                if (toggleBtn) toggleBtn.style.display = 'none';
                if (integrationsUI) integrationsUI.style.display = 'none';
                if (audioOverlay) audioOverlay.style.display = 'none';
                const modal = document.getElementById('oms-new-order-modal');
                if (modal) modal.style.display = 'none';
                return;
            } else {
                if (tvDashboard && currentViewMode === 'TV' && tvDashboard.style.display === 'none') {
                    tvDashboard.style.display = 'flex';
                }
                if (toggleBtn && toggleBtn.style.display === 'none') {
                    toggleBtn.style.display = 'block';
                }
                if (integrationsUI && currentViewMode === 'TV' && integrationsUI.style.display === 'none') {
                    integrationsUI.style.display = 'flex';
                }
            }

            let newList = [];

            // Consulta assíncrona em paralelo para velocidade máxima
            const [d1, d2, d3] = await Promise.all([
                apiFetch(['WAITING']),
                apiFetch(['SEND_READY', 'PICKUP_READY', 'PICKUP_PAID']),
                apiFetch(['PICKING', 'CHECKED', 'INVOICING', 'INVOICING_FAIL'])
            ]);

            // Persistir tempos de descoberta para o destaque dos primeiros 30 segundos
            let discoveryTimes = {};
            try {
                discoveryTimes = JSON.parse(sessionStorage.getItem('oms_order_discovery_times') || '{}');
            } catch (e) {
                discoveryTimes = {};
            }

            const processData = (data) => {
                if (data && data.data) {
                    data.data.forEach(o => {
                        let orderBaseId = (o.order && o.order.id) || (o.order && o.order.code) || o.orderId;
                        let fulfillSuffix = o.fulfillmentId || o.name || o.code || o.id;
                        let fullFulfillmentId = fulfillSuffix || orderBaseId;

                        if (orderBaseId && fulfillSuffix && orderBaseId !== fulfillSuffix) {
                            let suffixStr = fulfillSuffix.toString().replace('-', '');
                            if (suffixStr.length === 1 && !isNaN(suffixStr)) suffixStr = '0' + suffixStr;
                            if (suffixStr.length <= 4) {
                                fullFulfillmentId = orderBaseId + '-' + suffixStr;
                            } else if (fulfillSuffix.toString().includes(orderBaseId)) {
                                fullFulfillmentId = fulfillSuffix;
                            }
                        }
                        const domInfo = getDeliveryFromDOM(fullFulfillmentId);

                        const apiCarrier = (o.carrier && o.carrier.tradingName) || (o.carrier && o.carrier.companyName) || (o.order && o.order.carrier && o.order.carrier.tradingName) || '';
                        const apiDeliveryType = (o.shipment && o.shipment.method) || (o.freightMethod && o.freightMethod.name) || '';

                        const deliveryFallback = parseDeliveryInfo({
                            carrier: apiCarrier || domInfo.carrier,
                            deliveryType: apiDeliveryType || domInfo.type,
                            apiType: o.type || o.fulfillmentType
                        });

                        let finalId = fullFulfillmentId;
                        if (domInfo.fullId && domInfo.fullId.length > finalId.length) {
                            finalId = domInfo.fullId;
                        }

                        const isPickupOrder = deliveryFallback.isPickup;

                        // Inicializar timestamp de descoberta do pedido se não existir
                        if (!discoveryTimes[finalId]) {
                            discoveryTimes[finalId] = Date.now();
                        }

                        // Mapeamento detalhado de produtos/itens da Ri Happy
                        const itemsData = [];
                        const apiItems = Array.isArray(o.items)
                            ? o.items
                            : ((o.order && Array.isArray(o.order.items)) ? o.order.items : []);
                        apiItems.forEach(item => {
                            itemsData.push({
                                sku: item.sku || item.productCode || item.code || '---',
                                ean: item.ean || item.barcode || item.gtin || (item.product && item.product.ean) || (item.product && item.product.barcode) || '---',
                                name: item.name || (item.product && item.product.name) || item.description || 'Produto Ri Happy',
                                quantity: item.quantity || item.amount || 1,
                                imageUrl: item.imageUrl || item.image || (item.product && item.product.imageUrl) || ''
                            });
                        });

                        if (itemsData.length === 0) {
                            itemsData.push({
                                sku: 'PROD-OMS',
                                ean: '---',
                                name: 'Produtos Logísticos da Ri Happy',
                                quantity: o.totalItems || 1,
                                imageUrl: ''
                            });
                        }

                        newList.push({
                            id: finalId,
                            createdAt: o.createdAt || (o.order && o.order.createdAt),
                            updatedAt: o.updatedAt,
                            customer: (o.customer && o.customer.fullName) || (o.order && o.order.customer && o.order.customer.fullName) || '---',
                            deliveryType: deliveryFallback.label,
                            carrier: apiCarrier || domInfo.carrier || '',
                            statusNativo: o.status || o.fulfillmentStatus || 'WAITING',
                            isExpress: deliveryFallback.isExpress,
                            isPickup: isPickupOrder,
                            itemsCount: (o.items && o.items.length) || o.totalItems || 1,
                            items: itemsData
                        });
                    });
                }
            };

            processData(d1);
            processData(d2);
            processData(d3);

            try {
                sessionStorage.setItem('oms_order_discovery_times', JSON.stringify(discoveryTimes));
            } catch (e) { }

            pedidosAtivosAtuais = newList;

            // Renderizar a tela de TV
            renderTvView(newList);
        }

        // --- BACKGROUND WEB WORKER PARA IMPEDIR THROTTLING DO NAVEGADOR ---
        const workerBlob = new Blob([`
        setInterval(() => postMessage('tick'), ${CHECK_INTERVAL});
    `], { type: 'application/javascript' });

        try {
            const worker = new Worker(URL.createObjectURL(workerBlob));
            worker.onmessage = (e) => { if (e.data === 'tick') check(); };
        } catch (e) {
            console.warn("Background worker indisponível, usando fallback de setInterval local.");
            setInterval(check, CHECK_INTERVAL);
        }

        // Inicialização da primeira verificação rápida
        setTimeout(check, 1000);

        // Relógio e refresh visual a cada 1 segundo para clocks de SLA
        setInterval(() => {
            if (currentViewMode !== 'NATIVE' && pedidosAtivosAtuais.length > 0) {
                renderTvView(pedidosAtivosAtuais);
            }
        }, 1000);

    } // Fim de initScriptCore

    // --- VERIFICAÇÃO POSITIVA DE AUTENTICAÇÃO NO LINX OMS ---
    function isLinxOmsLoggedIn() {
        const hostname = window.location.hostname.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        const url = window.location.href.toLowerCase();

        // 1. Domínios de autenticação / SSO da Linx
        if (hostname.includes('accounts.linxoms') || hostname.includes('accounts.linx')) {
            return false;
        }

        // 2. Rotas típicas de login/autenticação do Keycloak
        if (url.includes('/realms/') || url.includes('/login-actions/') || url.includes('/auth') || url.includes('/signin') || pathname.startsWith('/login')) {
            return false;
        }

        // 3. Indicadores diretos do DOM de Login
        if (document.querySelector('input[type="password"], input#password, #kc-form-login, .login-pf')) {
            return false;
        }

        // 4. Se tiver token no localStorage/sessionStorage, está logado com certeza
        try {
            if (localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('id_token') || sessionStorage.getItem('id_token')) {
                return true;
            }
        } catch (e) { }

        // 5. Elementos estruturais que só existem após o login concluído
        const hasHeader = !!document.querySelector('#header, .navbar, nav.navbar, [ui-view="header"], header.main-header, .navbar-fixed-top');
        const hasMainContent = !!document.querySelector('.main-content, [ui-view="main"], .fulfillments-flow, .step-box, .welcome-title, [ng-controller], .container');
        const hasUserMenu = !!document.querySelector('.user-info, .navbar-nav, .user-profile, .dropdown-user, .store-info, .branch, #mobile-menu');
        const hasLinxSession = !!(window.linx && window.linx.session && (window.linx.session.currentUser || window.linx.session.currentStore));

        if (hasHeader || hasMainContent || hasUserMenu || hasLinxSession) {
            return true;
        }

        // 6. Confirmação complementar por rota e filial
        if (pathname.includes('/store/') || pathname.includes('/fulfillments')) {
            return true;
        }

        const storeId = getDynamicStoreId();
        if (storeId && document.querySelector('body > div, body > nav, [ng-app], .container')) {
            return true;
        }

        return false;
    }

    // --- BOOTSTRAP / VERIFICAÇÃO DE LOGIN ---
    function checkLoginAndInit() {
        const url = window.location.href.toLowerCase();

        // Domínios de integração (iFood / Rappi) rodam em background silencioso
        if (url.includes('ifood.com.br') || url.includes('rappi.com')) {
            initScriptCore();
            return;
        }

        // Se estiver no domínio de login SSO (accounts.linxoms), suspende o monitor
        if (window.location.hostname.includes('accounts.linxoms')) {
            setTimeout(checkLoginAndInit, 1500);
            return;
        }

        // Verifica se o usuário já completou o login no Linx OMS
        if (isLinxOmsLoggedIn()) {
            if (!isCoreInitialized) {
                isCoreInitialized = true;
                console.log("Monitor TV: ✅ Usuário autenticado no Linx OMS! Inicializando painel da TV...");
                initScriptCore();
            } else {
                if (tvDashboard && currentViewMode === 'TV') {
                    tvDashboard.style.display = 'flex';
                }
                if (toggleBtn) toggleBtn.style.display = 'block';
                if (integrationsUI && currentViewMode === 'TV') integrationsUI.style.display = 'flex';
            }
        } else {
            setTimeout(checkLoginAndInit, 1000);
        }
    }

    // Ponto de entrada do Linx OMS
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const isMobile = (window.innerWidth <= 768) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            if (isMobile && window.location.search.includes('mobile=1')) {
                initMobileMonitor();
            } else {
                checkLoginAndInit();
            }
        });
    } else {
        const isMobile = (window.innerWidth <= 768) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile && window.location.search.includes('mobile=1')) {
            initMobileMonitor();
        } else {
            checkLoginAndInit();
        }
    }

})();
