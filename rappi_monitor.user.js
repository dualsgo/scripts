// ==UserScript==
// @name         Super Monitor Rappi - Coletor OMS (Sem Som)
// @namespace    http://tampermonkey.net/
// @version      1.10
// @description  Monitor de pedidos Rappi: Coleta em tempo real e sincroniza com o Painel Linx OMS via GM_setValue/GM_getValue. Notificações sonoras executadas exclusivamente no OMS principal.
// @author       Antigravity AI
// @match        https://*.rappi.com/*
// @match        https://*.rappi.com.br/*
// @match        https://mitienda.rappi.com.br/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    const CHECK_INTERVAL = 3000;
    let modalElement = null;

    // --- INTERFACE VISUAL SUTIL NO PORTAL RAPPI (SEM SOM) ---
    function createVisualModal() {
        if (modalElement) return;

        const style = document.createElement('style');
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Lilita+One&display=swap');
            
            @keyframes pulseRappiOrange {
                0% { box-shadow: 0 0 25px rgba(255, 68, 56, 0.4); border-color: #ff4438; }
                50% { box-shadow: 0 0 60px rgba(255, 68, 56, 0.9); border-color: #ff6b5c; }
                100% { box-shadow: 0 0 25px rgba(255, 68, 56, 0.4); border-color: #ff4438; }
            }
            @keyframes slideInUpRappi {
                from { transform: translate(-50%, 100px); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }

            .rappi-alert-modal {
                position: fixed;
                top: 40px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, rgba(25, 10, 5, 0.95), rgba(45, 15, 5, 0.98));
                border: 4px solid #ff4438;
                border-radius: 24px;
                padding: 30px 50px;
                z-index: 9999999;
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                box-shadow: 0 20px 60px rgba(255, 68, 56, 0.5);
                backdrop-filter: blur(15px);
                font-family: 'Lilita One', cursive;
                color: #fff;
                animation: pulseRappiOrange 1.5s infinite ease-in-out;
            }

            .rappi-alert-modal.show {
                display: flex;
                animation: slideInUpRappi 0.5s cubic-bezier(0.16, 1, 0.3, 1), pulseRappiOrange 1.5s infinite ease-in-out;
            }

            .rappi-alert-title {
                font-size: 42px;
                font-weight: 900;
                color: #ff4438;
                text-transform: uppercase;
                letter-spacing: 2px;
                margin: 0 0 10px 0;
                text-shadow: 0 0 20px rgba(255, 68, 56, 0.4);
            }

            .rappi-alert-count {
                font-size: 80px;
                font-weight: 900;
                color: #ffffff;
                margin: 0;
                line-height: 1;
                text-shadow: 0 0 30px rgba(255, 255, 255, 0.3);
            }
            
            .rappi-alert-sub {
                font-size: 20px;
                font-weight: 700;
                color: rgba(255, 255, 255, 0.7);
                margin-top: 15px;
            }
        `;
        document.head.appendChild(style);

        modalElement = document.createElement('div');
        modalElement.className = 'rappi-alert-modal';
        modalElement.innerHTML = `
            <h1 class="rappi-alert-title">🚨 NOVO PEDIDO RAPPI 🚨</h1>
            <div class="rappi-alert-count" id="rappi-new-orders-val">0</div>
            <div class="rappi-alert-sub">Sincronizado com o Painel OMS (Som ativo no OMS)</div>
        `;
        document.body.appendChild(modalElement);
    }

    // --- LÓGICA PRINCIPAL DE PARSING & SINCRONIZAÇÃO GM_setValue ---
    function syncAndCheckOrders() {
        let newOrdersCount = 0;
        let aguardandoColetaCount = 0;
        let isLoggedIn = true;

        try {
            const bodyTxt = document.body ? document.body.innerText.toLowerCase() : '';
            if (document.querySelector('input[type="password"]') || bodyTxt.includes('iniciar sesión') || bodyTxt.includes('login') || bodyTxt.includes('entrar')) {
                isLoggedIn = false;
            } else {
                // Verifica cartões de pedidos pendentes na tela da Rappi
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
        } catch (e) {
            console.error("Erro no monitor Rappi (parsing):", e);
        }

        // Sincronização via GM_setValue para o OMS Principal
        GM_setValue('rappiPendingOrders', newOrdersCount);
        GM_setValue('rappiAguardandoColeta', aguardandoColetaCount);
        GM_setValue('rappiLastUpdate', Date.now());
        GM_setValue('rappiLoggedIn', isLoggedIn);

        // Atualização Visual (sem som na Rappi)
        handleLocalUiUpdate(newOrdersCount);
    }

    function handleLocalUiUpdate(count) {
        if (!modalElement) createVisualModal();

        const countEl = document.getElementById('rappi-new-orders-val');
        if (count > 0) {
            if (countEl.innerText !== String(count)) {
                countEl.innerText = count;
                modalElement.classList.add('show');
            }
            document.title = `🚨 (${count}) NOVO PEDIDO RAPPI!`;
        } else {
            modalElement.classList.remove('show');
            document.title = "Portal Rappi - Gestor de Pedidos";
        }
    }

    // --- INICIALIZAÇÃO ---
    function init() {
        console.log("🚀 Monitor Rappi (Silencioso - Coletor de Dados para OMS Principal) iniciado...");
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
