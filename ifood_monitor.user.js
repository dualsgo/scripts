// ==UserScript==
// @name         Super Monitor iFood - Alerta TV Premium
// @namespace    http://tampermonkey.net/
// @version      1.00
// @description  Monitor de pedidos iFood: Alarme sonoro automático e aviso na tela quando houver novos pedidos.
// @author       Antigravity AI
// @match        https://gestordepedidos.ifood.com.br/*
// @match        https://merchant.ifood.com.br/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const CHECK_INTERVAL = 3000;
    const ALARM_COOLDOWN = 15000;
    
    let audioCtx = null;
    let lastAlarmTime = 0;
    let alarmActive = false;
    let modalElement = null;

    // --- AUDIO SYSTEM ---
    function initAudio() {
        if (audioCtx) return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContextClass();
        } catch (e) {
            console.error("AudioContext não suportado", e);
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
        } catch (e) {}
    }

    function playSiren() {
        playBeep(988, 0.2, 0.35); // Si (B5)
        setTimeout(() => playBeep(1318, 0.25, 0.35), 180); // Mi (E6)
    }

    // --- UI SYSTEM ---
    function createPremiumModal() {
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
                font-size: 24px;
                font-weight: 700;
                color: rgba(255, 255, 255, 0.7);
                margin-top: 15px;
            }

            /* Botão de desbloqueio de áudio */
            .audio-unlock-btn {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #ea1d2c;
                color: white;
                border: none;
                padding: 15px 30px;
                border-radius: 30px;
                font-family: 'Lilita One', cursive;
                font-weight: 900;
                font-size: 16px;
                cursor: pointer;
                z-index: 9999999;
                box-shadow: 0 10px 20px rgba(234, 29, 44, 0.4);
            }
        `;
        document.head.appendChild(style);

        modalElement = document.createElement('div');
        modalElement.className = 'ifood-alert-modal';
        modalElement.innerHTML = `
            <h1 class="ifood-alert-title">🚨 NOVO PEDIDO IFOOD 🚨</h1>
            <div class="ifood-alert-count" id="ifood-new-orders-val">0</div>
            <div class="ifood-alert-sub">Verifique o gestor imediatamente!</div>
        `;
        document.body.appendChild(modalElement);

        // Adiciona botão para liberar áudio
        const unlockBtn = document.createElement('button');
        unlockBtn.className = 'audio-unlock-btn';
        unlockBtn.innerText = 'ATIVAR ALARME SONORO';
        unlockBtn.onclick = () => {
            initAudio();
            if(audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            playBeep(800, 0.1, 0.1);
            unlockBtn.style.display = 'none';
        };
        document.body.appendChild(unlockBtn);
        
        // Esconder o botão se já estiver rodando liso
        setTimeout(() => {
            if(audioCtx && audioCtx.state === 'running') unlockBtn.style.display = 'none';
        }, 2000);
    }

    // --- CORE LOGIC ---
    function checkForNewOrders() {
        let newOrders = 0;

        // NOVA LÓGICA DE DETECÇÃO PARA APP SEPARADOR
        const pedidosLink = document.querySelector('a[href*="/order/latest"]');
        if (pedidosLink) {
            const outputEl = pedidosLink.querySelector('output');
            if (outputEl && outputEl.textContent) {
                const val = parseInt(outputEl.textContent.trim(), 10);
                if (!isNaN(val)) newOrders = val;
            }
        } else {
            // Estratégia 1: Pela <output> com aria-label específico (baseado na estrutura informada)
            const outputByAria = document.querySelector('output[aria-label*="pedidos"]');
            if (outputByAria && outputByAria.textContent) {
                const val = parseInt(outputByAria.textContent.trim(), 10);
                if (!isNaN(val)) newOrders = val;
            } 
            
            // Estratégia 2: Busca por <p> com texto "Pedidos" e acha o <output> irmão
            if (newOrders === 0) {
                const pElements = Array.from(document.querySelectorAll('p'));
                const pedidosP = pElements.find(p => p.textContent.trim().toLowerCase() === 'pedidos');
                
                if (pedidosP && pedidosP.parentElement) {
                    const outputEl = pedidosP.parentElement.querySelector('output');
                    if (outputEl && outputEl.textContent) {
                        const val = parseInt(outputEl.textContent.trim(), 10);
                        if (!isNaN(val)) newOrders = val;
                    }
                }
            }
        }

        handleOrdersUpdate(newOrders);
    }

    function handleOrdersUpdate(count) {
        if (!modalElement) createPremiumModal();

        const countEl = document.getElementById('ifood-new-orders-val');
        
        if (count > 0) {
            // Há novos pedidos
            if (!alarmActive || countEl.innerText !== String(count)) {
                // Atualiza tela
                countEl.innerText = count;
                modalElement.classList.add('show');
                alarmActive = true;
            }

            // Toca a sirene respeitando o cooldown
            const now = Date.now();
            if (now - lastAlarmTime > ALARM_COOLDOWN) {
                playSiren();
                lastAlarmTime = now;
            }
            
            // Força a aba a piscar/chamar a atenção se possível
            document.title = `🚨 (${count}) NOVO PEDIDO IFOOD!`;
        } else {
            // Limpo
            if (alarmActive) {
                modalElement.classList.remove('show');
                alarmActive = false;
                document.title = "Gestor de Pedidos"; // Título padrão genérico
            }
        }
    }

    // --- INITIALIZATION ---
    function init() {
        console.log("🚀 Super Monitor iFood carregado.");
        createPremiumModal();
        setInterval(checkForNewOrders, CHECK_INTERVAL);
    }

    // Espera o DOM e carrega
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
