// ==UserScript==
// @name         Super Monitor iFood - Coletor OMS (Sem Som)
// @namespace    http://tampermonkey.net/
// @version      2.10
// @description  Monitor de pedidos iFood: Coleta em tempo real e sincroniza com o Painel Linx OMS via GM_setValue/GM_getValue. Notificações sonoras executadas exclusivamente no OMS principal.
// @author       Antigravity AI
// @match        https://*.ifood.com.br/*
// @match        https://gestordepedidos.ifood.com.br/*
// @match        https://merchant.ifood.com.br/*
// @match        https://separador.ifood.com.br/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    const CHECK_INTERVAL = 3000;
    let modalElement = null;

    // --- INTERFACE VISUAL SUTIL NO PORTAL IFOOD (SEM SOM) ---
    function createVisualModal() {
        if (modalElement) return;

        const style = document.createElement('style');
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Lilita+One&display=swap');
            
            @keyframes pulseIfoodRed {
                0% { box-shadow: 0 0 25px rgba(234, 29, 44, 0.4); border-color: #ea1d2c; }
                50% { box-shadow: 0 0 60px rgba(234, 29, 44, 0.9); border-color: #ff3e3e; }
                100% { box-shadow: 0 0 25px rgba(234, 29, 44, 0.4); border-color: #ea1d2c; }
            }
            @keyframes slideInUpIfood {
                from { transform: translate(-50%, 100px); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }

            .ifood-alert-modal {
                position: fixed;
                top: 40px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, rgba(20, 0, 0, 0.95), rgba(40, 0, 0, 0.98));
                border: 4px solid #ea1d2c;
                border-radius: 24px;
                padding: 30px 50px;
                z-index: 9999999;
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                box-shadow: 0 20px 60px rgba(234, 29, 44, 0.5);
                backdrop-filter: blur(15px);
                font-family: 'Lilita One', cursive;
                color: #fff;
                animation: pulseIfoodRed 1.5s infinite ease-in-out;
            }

            .ifood-alert-modal.show {
                display: flex;
                animation: slideInUpIfood 0.5s cubic-bezier(0.16, 1, 0.3, 1), pulseIfoodRed 1.5s infinite ease-in-out;
            }

            .ifood-alert-title {
                font-size: 42px;
                font-weight: 900;
                color: #ea1d2c;
                text-transform: uppercase;
                letter-spacing: 2px;
                margin: 0 0 10px 0;
                text-shadow: 0 0 20px rgba(234, 29, 44, 0.4);
            }

            .ifood-alert-count {
                font-size: 80px;
                font-weight: 900;
                color: #ffffff;
                margin: 0;
                line-height: 1;
                text-shadow: 0 0 30px rgba(255, 255, 255, 0.3);
            }
            
            .ifood-alert-sub {
                font-size: 20px;
                font-weight: 700;
                color: rgba(255, 255, 255, 0.7);
                margin-top: 15px;
            }
        `;
        document.head.appendChild(style);

        modalElement = document.createElement('div');
        modalElement.className = 'ifood-alert-modal';
        modalElement.innerHTML = `
            <h1 class="ifood-alert-title">🚨 NOVO PEDIDO IFOOD 🚨</h1>
            <div class="ifood-alert-count" id="ifood-new-orders-val">0</div>
            <div class="ifood-alert-sub">Sincronizado com o Painel OMS (Som ativo no OMS)</div>
        `;
        document.body.appendChild(modalElement);
    }

    // --- LÓGICA PRINCIPAL DE PARSING & SINCRONIZAÇÃO GM_setValue ---
    function syncAndCheckOrders() {
        let newOrdersCount = 0;
        let aguardandoColetaCount = 0;
        let isLoggedIn = true;
        let ifoodOrderDetails = null;

        try {
            if (document.querySelector('input[type="password"]')) {
                isLoggedIn = false;
            }

            // 1. Detecção de Novos Pedidos
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

            // 2. Detecção de Pedidos na Expedição / Aguardando Coleta
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

            // 3. Detalhes de Pedido no App Separador
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

        } catch (e) {
            console.error("Erro no monitor iFood (parsing):", e);
        }

        // Atualização da Ponte GM_setValue (comunicação cross-tab para o OMS Principal)
        GM_setValue('ifoodPendingOrders', newOrdersCount);
        GM_setValue('ifoodAguardandoColeta', aguardandoColetaCount);
        GM_setValue('ifoodLastUpdate', Date.now());
        GM_setValue('ifoodLoggedIn', isLoggedIn);
        GM_setValue('ifoodOrderDetails', ifoodOrderDetails ? JSON.stringify(ifoodOrderDetails) : null);

        // Atualização Visual (sem som no iFood)
        handleLocalUiUpdate(newOrdersCount);
    }

    function handleLocalUiUpdate(count) {
        if (!modalElement) createVisualModal();

        const countEl = document.getElementById('ifood-new-orders-val');
        if (count > 0) {
            if (countEl.innerText !== String(count)) {
                countEl.innerText = count;
                modalElement.classList.add('show');
            }
            document.title = `🚨 (${count}) NOVO PEDIDO IFOOD!`;
        } else {
            modalElement.classList.remove('show');
            document.title = "Gestor de Pedidos iFood";
        }
    }

    // --- INICIALIZAÇÃO ---
    function init() {
        console.log("🚀 Monitor iFood (Silencioso - Coletor de Dados para OMS Principal) iniciado...");
        createVisualModal();
        setInterval(syncAndCheckOrders, CHECK_INTERVAL);
        syncAndCheckOrders();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
