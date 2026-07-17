// ==UserScript==
// @name         Linx OMS Automation & Monitor HUD - Rihappy
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Automação do fluxo logístico OMS Linx + HUD Monitor, Temporizador SLA (60m) e Auto-Print Bobina Térmica
// @author       Antigravity
// @match        https://instore.linxoms.com.br/rihappy*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('[OMS-Auto] Script iniciado (Versão HUD Monitor & Thermal Print)!');

    // ==========================================
    // MOCK DO JS-PRINT-SETUP (Para habilitar Auto-Print nativo do Linx)
    // ==========================================
    function injectJsPrintSetupMock() {
        if (document.getElementById('mock-js-print')) return;
        const script = document.createElement('script');
        script.id = 'mock-js-print';
        script.textContent = `
            if (typeof window.jsPrintSetup === 'undefined') {
                console.log('[OMS-Auto] jsPrintSetup Mock Injetado no contexto da página!');
                window.jsPrintSetup = {
                    getPrintersList: function() {
                        return "Impressora Comum,Impressora Zebra,Impressora Térmica";
                    },
                    setPrinter: function(n) { console.log("Mock JSPrint setPrinter", n); },
                    setOption: function(o, v) { console.log("Mock JSPrint setOption", o, v); },
                    setSilentPrint: function(s) { console.log("Mock JSPrint setSilentPrint", s); },
                    clearSilentPrint: function() {},
                    setPaperSizeData: function() {},
                    print: function() { 
                        console.log("Mock JSPrint print"); 
                        window.print(); 
                    },
                    printWindow: function(win) { 
                        console.log("Mock JSPrint printWindow"); 
                        if (win && typeof win.print === 'function') win.print(); 
                        else window.print(); 
                    }
                };
            }
            
            // Força a atualização da tela de configurações para reconhecer o plugin
            setInterval(function() {
                var settingsEl = document.querySelector('[ng-controller="settingsPrintsController"]');
                if (settingsEl && window.angular) {
                    var scope = angular.element(settingsEl).scope();
                    if (scope && (!scope.pluginAvailable || !scope.pluginEnabled)) {
                        scope.pluginAvailable = true;
                        scope.pluginEnabled = true;
                        scope.$apply();
                        console.log('[OMS-Auto] Angular Scope Atualizado para habilitar o painel de impressão');
                    }
                }
            }, 1000);
        `;
        (document.head || document.documentElement).appendChild(script);
    }
    
    injectJsPrintSetupMock();

    // ==========================================
    // ESTRUTURA DO HUD (Painel Flutuante)
    // ==========================================
    function initHUD() {
        if (document.getElementById('oms-hud')) return;
        const hud = document.createElement('div');
        hud.id = 'oms-hud';
        hud.style.cssText = `
            position: fixed; top: 70px; right: 20px; z-index: 999999;
            background: rgba(20, 20, 20, 0.85); color: #ddd;
            padding: 10px; border-radius: 8px; font-family: 'Segoe UI', sans-serif;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3); width: 220px;
            backdrop-filter: blur(4px); border: 1px solid #333;
            transition: opacity 0.3s; opacity: 0.6;
        `;
        hud.onmouseenter = () => hud.style.opacity = '1';
        hud.onmouseleave = () => hud.style.opacity = '0.6';

        hud.innerHTML = `
            <div id="hud-header" style="cursor: move; margin:-10px -10px 10px -10px; padding:8px; background: rgba(0,0,0,0.4); border-radius: 8px 8px 0 0; text-align:center; border-bottom:1px solid #444;">
                <h3 style="margin:0; font-size:13px; color:#fff;">🤖 OMS Monitor Ativo</h3>
            </div>
            <div id="hud-novos" style="margin-bottom:6px; font-size:13px;">🛒 Novos: <b style="color:#0f0;">0</b></div>
            <div id="hud-separacao" style="margin-bottom:6px; font-size:13px;">📦 Separação: <b style="color:#ffa500;">0</b></div>
            <div id="hud-despacho" style="margin-bottom:6px; font-size:13px; cursor:pointer; padding:3px; border-radius:4px;">
                🚚 Despacho: <b style="color:#0f0;">0</b>
            </div>
        `;
        document.body.appendChild(hud);

        // Lógica de Draggable (Arrastar)
        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        let xOffset = 0, yOffset = 0;

        const header = document.getElementById('hud-header');
        header.addEventListener('mousedown', (e) => {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
        });
        document.addEventListener('mouseup', () => {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        });
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;
                hud.style.transform = \`translate3d(\${currentX}px, \${currentY}px, 0)\`;
            }
        });
        
        // Clicar no Despacho joga direto pra tela
        document.getElementById('hud-despacho').addEventListener('click', () => {
            window.location.href = '/rihappy/fulfillments/shipping';
        });
    }

    // ==========================================
    // FUNÇÕES DE DATA E AUTO-PRINT (Bobina 80mm)
    // ==========================================
    function parseDateBR(dateStr) {
        // Formato esperado: "06/07/26 22:15"
        const parts = dateStr.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)/);
        if (!parts) return new Date();
        let [_, d, m, y, h, min] = parts;
        if (y.length === 2) y = '20' + y;
        return new Date(y, m - 1, d, h, min);
    }

    function generateThermalPrint(fulfillment) {
        let orderId = "N/A";
        let clientName = "N/A";
        let itemsHtml = '';
        
        try {
            orderId = fulfillment.getOrderId ? fulfillment.getOrderId() : (fulfillment.orderFulfillmentId || "N/A");
            clientName = fulfillment.getCustomer ? fulfillment.getCustomer().getName() : (fulfillment.customer ? fulfillment.customer.name : 'N/A');
            const items = fulfillment.getItems ? fulfillment.getItems() : (fulfillment.items || []);
            
            items.forEach(item => {
                const qtd = item.getQuantity ? item.getQuantity() : (item.quantity || 1);
                const name = item.getName ? item.getName() : (item.name || '');
                const sku = item.getSku ? item.getSku() : (item.sku || '');
                itemsHtml += `
                    <tr style="border-bottom: 1px dashed #000;">
                        <td style="padding: 4px 0; text-align:center; font-weight:bold; font-size:16px;">${qtd}</td>
                        <td style="padding: 4px; font-size:12px;">${sku}</td>
                        <td style="padding: 4px; font-size:12px; text-transform:uppercase;">${name.substring(0,35)}</td>
                    </tr>
                `;
            });
        } catch(e) {
            console.error("[OMS-Auto] Erro ao montar dados de impressão", e);
        }
        
        const html = `
            <html><head><title>Print</title></head>
            <body style="width: 80mm; margin: 0; padding: 0; font-family: sans-serif; color: #000; font-size: 12px;">
                <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px;">
                    <h1 style="font-size: 26px; margin: 0; padding: 5px 0; background: #000; color: #fff;">⭐ NOVO PEDIDO</h1>
                    <h2 style="font-size: 20px; margin: 10px 0;">PED: ${orderId}</h2>
                    <p style="margin: 0; font-size:14px;"><strong>Cliente:</strong> ${clientName}</p>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid #000;">
                            <th style="text-align:center; padding-bottom:5px;">QTD</th>
                            <th style="text-align:left; padding-bottom:5px;">SKU</th>
                            <th style="text-align:left; padding-bottom:5px;">PRODUTO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                <div style="text-align: center; margin-top: 20px;">
                    <p style="font-size:14px;">Separado por: __________________</p>
                    <p style="font-size:14px;">Data: ___/___/___ Hora: __:__</p>
                    <p style="font-size:10px; margin-top:20px;">OMS Auto-Print</p>
                </div>
                <script>
                    window.onload = function() { 
                        window.print(); 
                        setTimeout(function(){ window.close(); }, 500); 
                    }
                </script>
            </body></html>
        `;
        
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();
    }

    // ==========================================
    // MÉTRICAS GLOBAIS (VIA API LINX) E ESTILIZAÇÃO DO DOM
    // ==========================================
    const state = { WAITING: 0, PICKING: 0, SEND_READY: 0 };
    
    function getDynamicStoreId() {
        const keys = ['currentLocation', 'selectedLocation', 'location', 'store', 'current_location', 'selected_location'];
        for (const key of keys) {
            const val = localStorage.getItem(key) || sessionStorage.getItem(key);
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
        return '1187';
    }

    async function apiFetchCounts() {
        const storeId = getDynamicStoreId();

        const base = 'https://instore.linxoms.com.br/api/proxy/order-ms/clients/rihappy/fulfillments?';
        const getUrl = (statusList) => {
            return base + `filterGroups[1][filters][0][property]=locationId&filterGroups[1][filters][0][condition]=eq&filterGroups[1][filters][0][value]=${storeId}&filterGroups[1][filters][1][property]=status&filterGroups[1][filters][1][operation]=whereIn&` + statusList.map(s => `filterGroups[1][filters][1][value][]=${s}`).join('&') + '&pageSize=1';
        };

        try {
            const [rWaiting, rPicking, rDispatch] = await Promise.all([
                fetch(getUrl(['WAITING'])),
                fetch(getUrl(['PICKING', 'CHECKED', 'INVOICING', 'INVOICING_FAIL'])),
                fetch(getUrl(['SEND_READY']))
            ]);

            if (rWaiting.ok) { const j = await rWaiting.json(); state.WAITING = j.paging ? j.paging.total : 0; }
            if (rPicking.ok) { const j = await rPicking.json(); state.PICKING = j.paging ? j.paging.total : 0; }
            if (rDispatch.ok) { const j = await rDispatch.json(); state.SEND_READY = j.paging ? j.paging.total : 0; }
        } catch (e) { console.error('[OMS-Auto] Erro API Fetch', e); }
    }
    
    // Polling de 5s para métricas vitais
    setInterval(apiFetchCounts, 5000);
    setTimeout(apiFetchCounts, 500); // chamada imediata na inicialização

    // ==========================================
    // ESTILIZAÇÃO E LOOP PRINCIPAL
    // ==========================================
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.03); } 100% { transform: scale(1); } }
        @keyframes borderPulseRed { 0% { border-color: #ff4d4d; box-shadow: 0 0 15px rgba(255,77,77,0.5); } 50% { border-color: #ff1a1a; box-shadow: 0 0 25px rgba(255,26,26,0.8); } 100% { border-color: #ff4d4d; box-shadow: 0 0 15px rgba(255,77,77,0.5); } }
        @keyframes borderPulseOrange { 0% { border-color: #ffa500; box-shadow: 0 0 15px rgba(255,165,0,0.5); } 50% { border-color: #ff8c00; box-shadow: 0 0 25px rgba(255,140,0,0.8); } 100% { border-color: #ffa500; box-shadow: 0 0 15px rgba(255,165,0,0.5); } }
        .novo-pedido-highlight { border-left: 6px solid #00E676 !important; background: rgba(0, 230, 118, 0.05) !important; }
        .atrasado-highlight { border-left: 6px solid #D32F2F !important; background: rgba(211, 47, 47, 0.05) !important; }
        
        /* Classes Injetadas Dinamicamente nos Cards */
        .box-alerta-vermelho { border: 3px solid #ff1a1a !important; animation: borderPulseRed 1.5s infinite !important; background-color: rgba(255,0,0,0.05) !important; transition: all 0.3s; }
        .box-alerta-laranja { border: 3px solid #ffa500 !important; animation: borderPulseOrange 1.5s infinite !important; background-color: rgba(255,165,0,0.05) !important; transition: all 0.3s; }
        .box-ok-verde { border: 3px solid #00E676 !important; background-color: rgba(0,230,118,0.05) !important; transition: all 0.3s; }
        
        /* Ocultar HUD durante a impressão nativa */
        @media print {
            #oms-hud { display: none !important; }
        }
    `;
    document.head.appendChild(style);

    setInterval(() => {
        initHUD();
        const path = window.location.pathname;

        // 1. Atualizar HUD
        const elNovos = document.getElementById('hud-novos');
        const elSep = document.getElementById('hud-separacao');
        if (elNovos) elNovos.innerHTML = `🛒 Novos (Pendentes): <b style="color:${state.WAITING > 0 ? '#ff4d4d' : '#0f0'}; text-shadow: 0 0 5px rgba(255,255,255,0.3); font-size:16px;">${state.WAITING}</b>`;
        if (elSep) elSep.innerHTML = `📦 Separação/Faturar: <b style="color:${state.PICKING > 0 ? '#ffa500' : '#0f0'}; font-size:16px;">${state.PICKING}</b>`;
        
        const elDesp = document.getElementById('hud-despacho');
        if (elDesp) {
            if (state.SEND_READY > 0) {
                elDesp.innerHTML = `🚚 Despacho Pend.: <b style="color:#fff; font-size:18px; text-shadow: 0 0 5px rgba(0,0,0,0.5);">${state.SEND_READY} - ALERTA!</b>`;
                elDesp.style.backgroundColor = '#d32f2f'; // Vermelho forte
                elDesp.style.animation = 'pulse 1.5s infinite';
                elDesp.style.border = '2px solid #ffaaaa';
            } else {
                elDesp.innerHTML = `🚚 Despacho Pend.: <b style="color:#0f0; font-size:16px;">0 (Limpo)</b>`;
                elDesp.style.backgroundColor = 'transparent';
                elDesp.style.animation = 'none';
                elDesp.style.border = 'none';
            }
        }

        // 2. Estilizar DOM Principal (Página Inicial)
        const applyBoxStyle = (selector, count, alertClass) => {
            const el = document.querySelector(selector);
            if (!el) return;
            el.classList.remove('box-alerta-vermelho', 'box-alerta-laranja', 'box-ok-verde');
            el.classList.add(count > 0 ? alertClass : 'box-ok-verde');
            
            // Substitui toda a div .qty para evitar duplicação do front-end
            const qtyContainer = el.querySelector('.qty');
            if (qtyContainer) {
                qtyContainer.innerHTML = `<div style="font-size:26px; font-weight:bold; color:inherit; text-align:center; padding-top:10px;">${count}</div>`;
            }
        };

        if (path === '/rihappy' || path === '/rihappy/') {
            applyBoxStyle('.pending.step-box', state.WAITING, 'box-alerta-vermelho');
            applyBoxStyle('.selection.step-box', state.PICKING, 'box-alerta-laranja');
            applyBoxStyle('.shipping.step-box', state.SEND_READY, 'box-alerta-vermelho');
        }

        // 3. Estilizar Navbar Global
        const links = document.querySelectorAll('#navbar .nav-pills > li > a');
        links.forEach(a => {
            const txt = a.innerText;
            if (txt.includes('Pendentes')) {
                a.style.borderBottom = state.WAITING > 0 ? '4px solid #ff4d4d' : '4px solid #00E676';
                a.style.color = state.WAITING > 0 ? '#ff4d4d' : '';
                const badge = a.querySelector('.badge');
                if (badge) { badge.innerText = state.WAITING; badge.style.backgroundColor = state.WAITING > 0 ? '#ff4d4d' : '#00E676'; }
            }
            if (txt.includes('Seleção')) {
                a.style.borderBottom = state.PICKING > 0 ? '4px solid #ffa500' : '4px solid #00E676';
                a.style.color = state.PICKING > 0 ? '#ffa500' : '';
                const badge = a.querySelector('.badge');
                if (badge) { badge.innerText = state.PICKING; badge.style.backgroundColor = state.PICKING > 0 ? '#ffa500' : '#00E676'; }
            }
            if (txt.includes('Despacho')) {
                a.style.borderBottom = state.SEND_READY > 0 ? '4px solid #ff4d4d' : '4px solid transparent';
                a.style.color = state.SEND_READY > 0 ? '#ff4d4d' : '';
                const badge = a.querySelector('.badge');
                if (badge) { badge.innerText = state.SEND_READY; badge.style.backgroundColor = state.SEND_READY > 0 ? '#ff4d4d' : ''; }
            }
        });

        // --- TELA DO PEDIDO ESPECÍFICO (Manual Print Bobina) ---
        if (path.includes('/orders/') && path.includes('/fulfillments/')) {
            if (!document.getElementById('btn-imprimir-bobina')) {
                // Procura a barra de ações ou cabeçalho para pendurar o botão
                let btnGroup = document.querySelector('.fulfillment-header .btn-group') || document.querySelector('.page-header .btn-group') || document.querySelector('.header-buttons');
                
                // Se não achar um grupo nativo, pendura direto no header
                if (!btnGroup) {
                    btnGroup = document.querySelector('.fulfillment-header') || document.querySelector('.page-header') || document.body;
                }
                
                if (btnGroup) {
                    const btn = document.createElement('button');
                    btn.id = 'btn-imprimir-bobina';
                    btn.className = 'btn btn-primary';
                    btn.style.marginLeft = '15px';
                    btn.style.backgroundColor = '#000'; 
                    btn.style.borderColor = '#000';
                    btn.style.fontWeight = 'bold';
                    btn.innerHTML = '🖨️ Imprimir Bobina Térmica';
                    
                    btn.onclick = () => {
                        try {
                            const orderIdStr = path.split('/orders/')[1].split('/')[0];
                            // Tenta varrer o DOM buscando o scope Angular em elementos chave da página
                            let f = null;
                            const possibleElements = document.querySelectorAll('.ng-scope');
                            for (let el of possibleElements) {
                                const scope = angular.element(el).scope();
                                if (scope) {
                                    if (scope.fulfillment) f = scope.fulfillment;
                                    else if (scope.$ctrl && scope.$ctrl.fulfillment) f = scope.$ctrl.fulfillment;
                                    else if (scope.main && scope.main.fulfillment) f = scope.main.fulfillment;
                                    if (f) break;
                                }
                            }
                            
                            if (f) {
                                generateThermalPrint(f);
                            } else {
                                // Fallback total pegando dados visuais do DOM
                                const orderId = orderIdStr;
                                // tenta achar nome na página
                                const elName = document.querySelector('.customer-info h4, .customer-name, strong.ng-binding');
                                const clientName = elName ? elName.innerText.trim() : 'Cliente Local';
                                
                                const items = [];
                                document.querySelectorAll('table tbody tr').forEach(row => {
                                    const txt = row.innerText;
                                    // Se a linha tem "R$" ou algo de produto
                                    if (txt.includes('R$') && row.querySelector('td')) {
                                        const tds = row.querySelectorAll('td');
                                        if (tds.length >= 3) {
                                            const name = tds[0].innerText.split('\n')[0]; // Pega a 1a linha
                                            const qty = tds[1] ? tds[1].innerText.trim() : '1';
                                            items.push({ getName: ()=>name, getSku: ()=>'', getQuantity: ()=>qty });
                                        }
                                    }
                                });
                                
                                generateThermalPrint({
                                    getOrderId: () => orderId,
                                    getCustomer: () => ({ getName: () => clientName }),
                                    getItems: () => items
                                });
                            }
                        } catch (e) {
                            alert("Erro ao gerar impressão térmica.");
                            console.error("[OMS-Auto]", e);
                        }
                    };
                    btnGroup.appendChild(btn);
                }
            }

            // Painel de Performance de Separação
            if (!document.getElementById('oms-performance-panel')) {
                const historySteps = document.querySelectorAll('.order-history-step');
                if (historySteps.length > 0) {
                    let dtCompra = null;
                    let dtSep = null;
                    let dtConf = null;

                    historySteps.forEach(step => {
                        const statusEl = step.querySelector('.order-history-status');
                        const dateEl = step.querySelector('p');
                        if (statusEl && dateEl) {
                            const status = statusEl.innerText.trim();
                            const dtString = dateEl.innerText.replace('\n', ' ');
                            const dt = parseDateBR(dtString);
                            
                            if (status === 'Data de Compra' || status === 'Pendente') {
                                if (!dtCompra) dtCompra = dt;
                            }
                            if (status === 'Em Separação') {
                                dtSep = dt;
                            }
                            if (status === 'Conferido' || status === 'Faturado') {
                                if (!dtConf) dtConf = dt;
                            }
                        }
                    });

                    if (dtSep && dtConf) {
                        const filaMs = Math.max(0, dtSep - (dtCompra || dtSep));
                        const sepMs = Math.max(0, dtConf - dtSep);
                        const totalMs = Math.max(0, dtConf - (dtCompra || dtSep));

                        const formatMs = (ms) => {
                            const m = Math.floor(ms / 60000);
                            const h = Math.floor(m / 60);
                            const remM = m % 60;
                            if (h > 0) return `${h}h ${remM}m`;
                            return `${m}m`;
                        };

                        const panel = document.createElement('div');
                        panel.id = 'oms-performance-panel';
                        panel.style.cssText = 'background: #f8f9fa; border-left: 4px solid #1976d2; padding: 10px; margin-top: 15px; font-size: 13px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); width: fit-content;';
                        panel.innerHTML = `
                            <strong style="color: #1976d2; display:block; margin-bottom:5px;">⏱️ Performance de Separação</strong>
                            <div>Fila de Espera: <b>${formatMs(filaMs)}</b></div>
                            <div>Tempo (Picking): <b>${formatMs(sepMs)}</b></div>
                            <div style="border-top:1px dashed #ccc; margin-top:5px; padding-top:5px;">SLA Consumido: <b>${formatMs(totalMs)}</b></div>
                        `;

                        const headerArea = document.querySelector('.fulfillment-details-title');
                        if (headerArea) {
                            headerArea.appendChild(panel);
                        }
                    }
                }
            }
        }
        // --- TELA DE PENDENTES E SELEÇÃO ---
        if (path.includes('/rihappy/fulfillments') || path.includes('/rihappy/selection')) {

            const rows = document.querySelectorAll('table tbody tr');
            rows.forEach(row => {
                const statusEl = row.querySelector('.order-status');
                if (!statusEl) return;
                const status = statusEl.innerText.trim();
                
                // Pega a data de compra
                const rowText = row.innerText;
                const dateMatch = rowText.match(/(\d{2}\/\d{2}\/\d{2,4}\s+\d{2}:\d{2})/);
                
                // 1. Destaque Visual e Auto-Print (Novos Pedidos)
                if (status === 'Pendente') {
                    row.classList.add('novo-pedido-highlight');
                    
                    const orderIdEl = row.querySelector('.table-order-id span');
                    if (orderIdEl) {
                        const oid = orderIdEl.innerText.trim();
                        // Usa ID dinâmico da loja para segregar impressões
                        const storeId = getDynamicStoreId();
                        const storageKey = 'oms_printed_' + storeId + '_' + oid;
                        
                        if (!localStorage.getItem(storageKey)) {
                            console.log(`[OMS-Auto] Novo Pedido detectado: ${oid}. Imprimindo bobina térmica...`);
                            localStorage.setItem(storageKey, 'true');
                            
                            // Procura o scope do Angular para essa linha e dispara impressao
                            try {
                                if (typeof angular !== 'undefined') {
                                    const scope = angular.element(row).scope();
                                    if (scope && scope.fulfillment) {
                                        generateThermalPrint(scope.fulfillment);
                                    }
                                }
                            } catch(err) {
                                console.error("[OMS-Auto] Erro ao imprimir bobina:", err);
                            }
                        }
                    }
                }

                // 2. Temporizador de SLA (60m) - Respeitando Horário da Loja
                const blockSlaStatuses = ['Finalizado', 'Despachado', 'Cancelado', 'Aguardando retirada'];
                if (dateMatch && !blockSlaStatuses.includes(status) && !status.toLowerCase().includes('retirada')) {
                    const dateCompra = parseDateBR(dateMatch[1]);
                    
                    // Ajuste de horário de loja (10-22h seg-sab, 12-21h dom)
                    const getStoreOpeningTime = (d) => {
                        const isSun = d.getDay() === 0;
                        return { openHour: isSun ? 12 : 10, closeHour: isSun ? 21 : 22 };
                    };
                    
                    let adjustedStart = new Date(dateCompra);
                    const config = getStoreOpeningTime(adjustedStart);
                    const currentHour = adjustedStart.getHours();
                    
                    if (currentHour < config.openHour) {
                        adjustedStart.setHours(config.openHour, 0, 0, 0);
                    } else if (currentHour >= config.closeHour) {
                        adjustedStart.setDate(adjustedStart.getDate() + 1);
                        const nextConfig = getStoreOpeningTime(adjustedStart);
                        adjustedStart.setHours(nextConfig.openHour, 0, 0, 0);
                    }
                    
                    const now = new Date();
                    const SLA = 60; // Limite de 60 minutos
                    const limitTime = new Date(adjustedStart.getTime() + (SLA * 60000));
                    const diffMs = limitTime - now;
                    
                    let timerSpan = row.querySelector('.hud-timer');
                    if (!timerSpan) {
                        timerSpan = document.createElement('div');
                        timerSpan.className = 'hud-timer';
                        timerSpan.style.cssText = 'font-weight: bold; margin-top: 5px; font-size:13px; padding:2px 5px; border-radius:3px; display:inline-block;';
                        statusEl.parentNode.appendChild(timerSpan);
                    }
                    
                    if (now < adjustedStart) {
                        // Loja fechada, aguardando abrir
                        timerSpan.innerHTML = `🕒 Aguarda Abertura`;
                        timerSpan.style.background = '#e3f2fd'; timerSpan.style.color = '#1565c0';
                        row.classList.remove('atrasado-highlight');
                    } else if (diffMs > 0) {
                        // Dentro do prazo (contador reverso MM:SS)
                        const min = Math.floor(diffMs / 60000).toString().padStart(2, '0');
                        const sec = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
                        timerSpan.innerHTML = `⏳ ${min}:${sec} restantes`;
                        timerSpan.style.background = '#e8f5e9'; timerSpan.style.color = '#2e7d32';
                        row.classList.remove('atrasado-highlight');
                    } else {
                        // Atrasado
                        const absMs = Math.abs(diffMs);
                        const min = Math.floor(absMs / 60000).toString().padStart(2, '0');
                        const sec = Math.floor((absMs % 60000) / 1000).toString().padStart(2, '0');
                        timerSpan.innerHTML = `🚨 ESTOUROU: -${min}:${sec}`;
                        timerSpan.style.background = '#ffebee'; timerSpan.style.color = '#c62828';
                        row.classList.add('atrasado-highlight');
                    }
                }
            });

            // --- LÓGICA DE AUTOMAÇÃO (Módulo 1) ---
            const btnFaturar = document.querySelector('button[ng-click*="billingFulfillments"]');
            if (btnFaturar && !btnFaturar.disabled && !btnFaturar.classList.contains('ng-hide')) {
                btnFaturar.click();
            }

            const btnPreparar = document.querySelector('button[ng-click*="showVolumesCheckingModal"]:not([disabled])');
            if (btnPreparar && !btnPreparar.classList.contains('ng-hide')) {
                if (!document.querySelector('.modal-volumes-checking')) {
                    btnPreparar.click();
                }
            }

            // Anti-Esquecimento Bipagem
            if (document.querySelector('.modal-volumes-checking')) {
                sessionStorage.setItem('bipando_caixa', 'true');
            } else if (sessionStorage.getItem('bipando_caixa') === 'true') {
                const prontoEnvio = document.querySelector('.send_ready'); 
                if (prontoEnvio) {
                    sessionStorage.removeItem('bipando_caixa');
                    alert("⚠️ ATENÇÃO! A CAIXA FOI BIPADA!\n\nVocê AINDA NÃO GEROU A LISTA DE DESPACHO da Transportadora.\nClique em OK para ser redirecionado!");
                    window.location.href = "/rihappy/fulfillments/shipping";
                }
            }
        }

        // --- TELA DE LISTA DE DESPACHO ---
        if (path.includes('/rihappy/fulfillments/shipping')) {
            
            const selectAllCheck = document.querySelector('#selectedAll');
            const transporterModal = document.querySelector('.modal-transporter');
            const confirmationModal = document.querySelector('.modal-confirmation');

            if (confirmationModal) {
                const btnConfirmar = confirmationModal.querySelector('button[ng-click*="createPackingList"]');
                if (btnConfirmar && !btnConfirmar.disabled) btnConfirmar.click();
                return;
            }

            if (transporterModal) {
                const selectCarrier = transporterModal.querySelector('select[ng-model="carrierSelected"]');
                const btnProximo = transporterModal.querySelector('button[ng-click*="showShippingCreateList"]');
                if (selectCarrier && selectCarrier.options.length > 1) {
                    if (selectCarrier.selectedIndex <= 0) {
                        selectCarrier.selectedIndex = 1;
                        selectCarrier.dispatchEvent(new Event('change', { 'bubbles': true }));
                    }
                    if (btnProximo && !btnProximo.disabled) btnProximo.click();
                }
                return;
            }

            const btnCriarLista = document.querySelector('button[ng-click*="showTransporterModal"]');
            const btnFinalizarDireto = document.querySelector('button[ng-click*="showConfirmationModal"]');
            
            if (selectAllCheck && !selectAllCheck.disabled && !selectAllCheck.checked) {
                selectAllCheck.click();
            }

            if (btnFinalizarDireto && !btnFinalizarDireto.disabled && !btnFinalizarDireto.classList.contains('ng-hide')) {
                 btnFinalizarDireto.click();
            } else if (btnCriarLista && !btnCriarLista.disabled && !btnCriarLista.classList.contains('ng-hide')) {
                btnCriarLista.click();
            }
        }

    }, 1500);

})();
