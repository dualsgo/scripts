const fs = require('fs');
const path = require('path');
const cp = require('child_process');

console.log('Compilando scripts de monitoramento OMNI com escopo e variáveis completas...');

// 1. Obter o código base do TV Dashboard a partir da versão funcional histórica
const originalMaster = cp.execSync('git show 419640ea9d3ebaebb0ff1b6cf82832d98cc15d53:MASTER_SCRIPT.user.js', { encoding: 'utf8' });
const lines = originalMaster.split('\n');

// Extrair de line 271 ("Importar Fonte Premium Outfit") até line 2479 (antes do fechamento de initScriptCore)
const tvBodyLines = lines.slice(271, 2480);
let tvBodyCode = tvBodyLines.join('\n');

// Ajustar variáveis para escopo compartilhado (evitar shadow local que bloqueia checkLoginAndInit)
tvBodyCode = tvBodyCode.replace('let currentViewMode = \'TV\';', 'currentViewMode = \'TV\';');
tvBodyCode = tvBodyCode.replace('let pedidosAtivosAtuais = [];', 'pedidosAtivosAtuais = [];');
tvBodyCode = tvBodyCode.replace('let audioCtx = null;', 'audioCtx = null;');
tvBodyCode = tvBodyCode.replace('let lastAlarmPlayedTime = 0;', 'lastAlarmPlayedTime = 0;');

// Metadados do Userscript consolidado
const userScriptHeader = `// ==UserScript==
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
            style.innerHTML = \`
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
            \`;
            document.head.appendChild(style);

            ifoodModalElement = document.createElement('div');
            ifoodModalElement.className = 'ifood-alert-modal';
            ifoodModalElement.innerHTML = \`
                <div class="ifood-alert-title">🚨 NOVO PEDIDO IFOOD PENDENTE! 🚨</div>
                <div class="ifood-alert-count" id="ifood-modal-count">0</div>
                <div class="ifood-alert-sub">PEDIDO(S) AGUARDANDO ACEITE / SEPARAÇÃO</div>
            \`;
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
            style.innerHTML = \`
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
            \`;
            document.head.appendChild(style);

            rappiModalElement = document.createElement('div');
            rappiModalElement.className = 'rappi-alert-modal';
            rappiModalElement.innerHTML = \`
                <div class="rappi-alert-title">🛵 NOVO PEDIDO RAPPI PENDENTE! 🛵</div>
                <div class="rappi-alert-count" id="rappi-modal-count">0</div>
                <div class="rappi-alert-sub">PEDIDO(S) AGUARDANDO ACEITE / SEPARAÇÃO</div>
            \`;
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
                        if (/^\\d+$/.test(val.trim())) return val.trim();
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
                const match = branchEl.textContent.match(/\\b\\d{3,5}\\b/);
                if (match) return match[0];
            }
        } catch (e) { }

        try {
            const pathSegments = window.location.pathname.split('/');
            for (const segment of pathSegments) {
                if (/^\\d+$/.test(segment) && segment.length >= 3) return segment;
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
            const url = \`https://instore.linxoms.com.br/api/proxy/order-ms/clients/rihappy/fulfillments?locationId=\${storeId}&status[]=SEND_READY&pageSize=1\`;
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
        if (title) title.innerHTML = \`⚠️ Você tem \${count} item(s) na<br/>Lista de Despacho!\`;
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
                    let text = \`Faltam \${daysRemaining} dias (No prazo)\`;
                    let icon = '✅';
                    let highlight = false;

                    if (daysPassed >= DIAS_LIMITE_RETIRADA) {
                        color = '#dc3545';
                        text = \`Passaram \${daysPassed} dias (Cancelar/Expirado)\`;
                        icon = '🚨';
                        highlight = true;
                        row.style.backgroundColor = 'rgba(220, 53, 69, 0.05)';
                    } else if (daysPassed === DIAS_LIMITE_RETIRADA - 1) {
                        color = '#fd7e14';
                        text = \`Falta 1 dia (Vence amanhã)\`;
                        icon = '⚠️';
                        highlight = true;
                    } else if (daysPassed === DIAS_LIMITE_RETIRADA - 2) {
                        color = '#ffc107';
                        text = \`Faltam 2 dias\`;
                        icon = '⚠️';
                        highlight = true;
                    }

                    if (highlight) {
                        row.style.borderLeft = \`4px solid \${color}\`;
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
                        badge.textContent = \`\${icon} Retirada: \${text}\`;
                        badge.style.color = color;
                        badge.style.fontSize = '12px';
                        badge.style.fontWeight = 'bold';

                        let telefone = '';
                        const phoneEl = row.querySelector('.customer-phone, .phone');
                        if (phoneEl) {
                            telefone = phoneEl.textContent.replace(/\\D/g, '');
                            if (!telefone.startsWith('55')) telefone = '55' + telefone;
                        }

                        const msgText = encodeURIComponent(\`Olá! Seu pedido já está separado e disponível para retirada na loja. Lembramos que o pedido será cancelado caso não seja retirado em até \${daysRemaining} dia(s).\`);
                        const btnWpp = document.createElement('a');
                        btnWpp.href = telefone ? \`https://web.whatsapp.com/send?phone=\${telefone}&text=\${msgText}\` : \`https://web.whatsapp.com/send?text=\${msgText}\`;
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
                        btnWpp.innerHTML = \`<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> WhatsApp\`;

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
                let text = \`Faltam \${daysRemaining} dias (No prazo)\`;
                let icon = '✅';

                if (daysPassed >= DIAS_LIMITE_RETIRADA) {
                    color = '#dc3545';
                    text = \`Passaram \${daysPassed} dias (Cancelar)\`;
                    icon = '🚨';
                } else if (daysPassed === DIAS_LIMITE_RETIRADA - 1) {
                    color = '#fd7e14';
                    text = \`Falta 1 dia (Vence amanhã)\`;
                    icon = '⚠️';
                } else if (daysPassed === DIAS_LIMITE_RETIRADA - 2) {
                    color = '#ffc107';
                    text = \`Faltam 2 dias\`;
                    icon = '⚠️';
                }

                const titleBlock = document.querySelector('.fulfillment-details-title');
                if (titleBlock && !titleBlock.querySelector('.monitor-badge-details')) {
                    const badge = document.createElement('span');
                    badge.className = 'monitor-badge-details';
                    badge.textContent = \`\${icon} Retirada: \${text}\`;
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
                                telefone = dd.textContent.replace(/\\D/g, '');
                                if (!telefone.startsWith('55') && telefone.length > 0) telefone = '55' + telefone;
                                if (telefone.length > 0) break;
                            }
                        }
                    }

                    const msgText = encodeURIComponent(\`Olá! Seu pedido já está separado e disponível para retirada na loja. Lembramos que o pedido será cancelado caso não seja retirado em até \${daysRemaining} dia(s).\`);
                    const btnWpp = document.createElement('a');
                    btnWpp.href = telefone ? \`https://web.whatsapp.com/send?phone=\${telefone}&text=\${msgText}\` : \`https://web.whatsapp.com/send?text=\${msgText}\`;
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
                    btnWpp.innerHTML = \`💬 Enviar WhatsApp\`;
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
        style.innerHTML = \`
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
        \`;
        document.head.appendChild(style);

        const dashboard = document.createElement('div');
        dashboard.className = 'mobile-dashboard';
        dashboard.innerHTML = \`
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
        \`;
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
            const url = \`https://instore.linxoms.com.br/api/proxy/order-ms/clients/rihappy/fulfillments?locationId=\${storeId}&status[]=WAITING_STORE_CONFIRMATION&status[]=WAITING_INVOICE&status[]=WAITING_PICK&pageSize=20\`;
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

        ${tvBodyCode}
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
`;

// 2. Gravar os arquivos
const targetOmniFile = path.join(__dirname, 'MASTER_MONITOR_OMNI.user.js');
const targetMasterFile = path.join(__dirname, 'MASTER_SCRIPT.user.js');

fs.writeFileSync(targetOmniFile, userScriptHeader, 'utf8');
fs.writeFileSync(targetMasterFile, userScriptHeader, 'utf8');

console.log('✅ Arquivo MASTER_MONITOR_OMNI.user.js gerado com sucesso! (' + userScriptHeader.length + ' bytes)');
console.log('✅ Arquivo MASTER_SCRIPT.user.js sincronizado com sucesso! (' + userScriptHeader.length + ' bytes)');
