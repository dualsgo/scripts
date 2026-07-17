// ==UserScript==
// @name         Super Monitor Linx OMS - Versão Mobile Alerta
// @namespace    http://tampermonkey.net/
// @version      1.00
// @description  Monitor de pedidos OMS otimizado para celular: Focado em notificação sonora em segundo plano e exibição de novos pedidos pendentes.
// @author       Antigravity AI
// @match        https://*.linxoms.com.br/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    function initScriptCore() {
        // Importar Fonte
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Lilita+One&display=swap';
        document.head.appendChild(fontLink);

        let LOJA_ID = '1187';
        const CHECK_INTERVAL = 5000;
        const ALARM_COOLDOWN = 10000; 

        let audioCtx = null;
        let lastAlarmPlayedTime = 0;
        let lastKnownWaitingCount = 0;

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
            try {
                const pathSegments = window.location.pathname.split('/');
                for (const segment of pathSegments) {
                    if (/^\d+$/.test(segment) && segment.length >= 3) return segment;
                }
            } catch (e) { }
            return null;
        }

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
            playBeep(988, 0.2, 0.5); 
            setTimeout(() => playBeep(1318, 0.25, 0.5), 180);
            setTimeout(() => playBeep(988, 0.2, 0.5), 400);
            setTimeout(() => playBeep(1318, 0.25, 0.5), 580);
        }

        function playStartupChime() {
            if (!audioCtx || audioCtx.state === 'suspended') return;
            try {
                const now = audioCtx.currentTime;
                const freqs = [523.25, 659.25, 783.99, 1046.50];
                freqs.forEach((freq, index) => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + (index * 0.1));
                    gain.gain.setValueAtTime(0.0, now + (index * 0.1));
                    gain.gain.linearRampToValueAtTime(0.1, now + (index * 0.1) + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + (index * 0.1) + 0.5);
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.start(now + (index * 0.1));
                    osc.stop(now + (index * 0.1) + 0.5);
                });
            } catch (e) {}
        }

        // Estilos Mobile
        const style = document.createElement('style');
        style.innerHTML = `
        :root {
            --bg: #0b0b0f;
            --neon-green: #00ff88;
            --neon-red: #ff3e3e;
            --font-main: 'Lilita One', cursive;
        }
        .mobile-dashboard {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: var(--bg); color: #fff; font-family: var(--font-main);
            z-index: 200000; display: flex; flex-direction: column;
            box-sizing: border-box; overflow-y: auto; padding-bottom: 20px;
        }
        .mobile-header {
            padding: 20px; text-align: center; background: rgba(255,255,255,0.05);
            border-bottom: 2px solid rgba(255,255,255,0.1);
        }
        .mobile-title { font-size: 24px; font-weight: 900; color: var(--neon-green); text-transform: uppercase; }
        
        .status-card {
            margin: 20px; padding: 30px 20px; border-radius: 20px;
            text-align: center; border: 3px solid rgba(255,255,255,0.1);
            background: rgba(20,20,30,0.8);
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            transition: all 0.3s ease;
        }
        .status-card.alert {
            border-color: var(--neon-red);
            background: rgba(255, 62, 62, 0.1);
            box-shadow: 0 0 25px rgba(255, 62, 62, 0.4);
            animation: pulseAlert 1.5s infinite;
        }
        @keyframes pulseAlert {
            0%, 100% { box-shadow: 0 0 20px rgba(255, 62, 62, 0.4); }
            50% { box-shadow: 0 0 40px rgba(255, 62, 62, 0.8); }
        }
        
        .status-value { font-size: 80px; font-weight: 900; line-height: 1; margin: 10px 0; }
        .status-card.alert .status-value { color: var(--neon-red); }
        .status-card:not(.alert) .status-value { color: var(--neon-green); }
        
        .status-label { font-size: 18px; font-weight: 700; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 2px; }

        .order-list { margin: 0 20px; display: flex; flex-direction: column; gap: 15px; }
        .order-item {
            background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px;
            border-left: 5px solid var(--neon-red);
        }
        .order-id { font-size: 20px; font-weight: 900; }
        .order-time { font-size: 14px; color: rgba(255,255,255,0.6); margin-top: 5px; }

        .mobile-audio-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.95); z-index: 300000;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-family: var(--font-main); text-align: center; cursor: pointer; padding: 20px; box-sizing: border-box;
        }
        .mobile-audio-btn {
            padding: 20px 40px; background: var(--neon-green); color: #000;
            border: none; border-radius: 15px; font-size: 22px; font-weight: 900;
            box-shadow: 0 0 30px rgba(0,255,136,0.4); animation: heartbeat 1.5s infinite;
        }
        @keyframes heartbeat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        
        .btn-hide {
            position: fixed; bottom: 20px; right: 20px; background: #333; color: #fff;
            padding: 15px; border-radius: 50%; font-size: 20px; border: none; z-index: 250000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.5);
        }
        `;
        document.head.appendChild(style);

        const dashboard = document.createElement('div');
        dashboard.className = 'mobile-dashboard';
        dashboard.innerHTML = `
            <div class="mobile-header">
                <div class="mobile-title">Monitor Mobile</div>
                <div style="font-size:12px; color:#888; margin-top:5px;" id="last-sync">Aguardando sync...</div>
            </div>
            <div class="status-card" id="status-card">
                <div class="status-label">Pendentes</div>
                <div class="status-value" id="val-waiting">0</div>
                <div style="font-size:14px; color:#aaa; margin-top:10px;" id="status-text">Tudo em dia</div>
            </div>
            <div class="order-list" id="order-list"></div>
        `;
        document.body.appendChild(dashboard);

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn-hide';
        toggleBtn.innerHTML = '👁️';
        toggleBtn.onclick = () => {
            if(dashboard.style.display === 'none') {
                dashboard.style.display = 'flex';
                toggleBtn.style.opacity = '1';
            } else {
                dashboard.style.display = 'none';
                toggleBtn.style.opacity = '0.5';
            }
        };
        document.body.appendChild(toggleBtn);

        const audioOverlay = document.createElement('div');
        audioOverlay.className = 'mobile-audio-overlay';
        audioOverlay.innerHTML = `
            <div style="font-size:60px; margin-bottom:20px;">🔊</div>
            <h2 style="color:#fff; margin-bottom:10px;">Ativar Alertas no Celular</h2>
            <p style="color:#aaa; margin-bottom:30px; font-size:16px;">O navegador exige um toque na tela para permitir alertas sonoros de novos pedidos em segundo plano.</p>
            <button class="mobile-audio-btn">TOCAR PARA INICIAR</button>
        `;
        document.body.appendChild(audioOverlay);
        
        audioOverlay.onclick = () => {
            initAudio();
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
            playStartupChime();
            audioOverlay.style.display = 'none';
        };

        async function apiFetchWaiting() {
            const activeStoreId = getDynamicStoreId() || LOJA_ID;
            const url = `https://instore.linxoms.com.br/api/proxy/order-ms/clients/rihappy/fulfillments?filterGroups[1][filters][0][property]=locationId&filterGroups[1][filters][0][condition]=eq&filterGroups[1][filters][0][value]=${activeStoreId}&filterGroups[1][filters][1][property]=status&filterGroups[1][filters][1][operation]=whereIn&filterGroups[1][filters][1][value][]=WAITING&filterGroups[1][filters][1][value][]=PICKING&filterGroups[1][filters][1][value][]=INVOICING&filterGroups[1][filters][1][value][]=CHECKED&pageSize=50`;
            try {
                const r = await fetch(url);
                if (!r.ok) return null;
                return await r.json();
            } catch (e) { return null; }
        }

        async function check() {
            const data = await apiFetchWaiting();
            document.getElementById('last-sync').innerText = 'Sync: ' + new Date().toLocaleTimeString();
            
            if (data && data.data) {
                const waitingOrders = data.data;
                const count = waitingOrders.length;
                
                const card = document.getElementById('status-card');
                const valEl = document.getElementById('val-waiting');
                const textEl = document.getElementById('status-text');
                const listEl = document.getElementById('order-list');
                
                valEl.innerText = count;
                
                if (count > 0) {
                    card.classList.add('alert');
                    textEl.innerText = "SEPARAÇÃO IMEDIATA!";
                    textEl.style.color = 'var(--neon-red)';
                    
                    const now = Date.now();
                    if (now - lastAlarmPlayedTime > ALARM_COOLDOWN) {
                        playSiren();
                        lastAlarmPlayedTime = now;
                    }
                    
                    listEl.innerHTML = waitingOrders.slice(0,10).map(o => {
                        const id = o.orderId || o.id;
                        const date = new Date(o.createdAt || new Date()).toLocaleTimeString();
                        return \`
                        <div class="order-item">
                            <div class="order-id">#\${id}</div>
                            <div class="order-time">Criado às \${date}</div>
                        </div>\`;
                    }).join('');
                } else {
                    card.classList.remove('alert');
                    textEl.innerText = "Tudo em dia";
                    textEl.style.color = '#aaa';
                    listEl.innerHTML = '';
                }
                lastKnownWaitingCount = count;
            }
        }

        const workerBlob = new Blob([\`
            setInterval(() => postMessage('tick'), \${CHECK_INTERVAL});
        \`], { type: 'application/javascript' });

        try {
            const worker = new Worker(URL.createObjectURL(workerBlob));
            worker.onmessage = () => check();
        } catch (e) {
            setInterval(check, CHECK_INTERVAL);
        }

        setTimeout(check, 1000);
    }

    function checkLoginAndInit() {
        const url = window.location.href.toLowerCase();
        const isLogin = url.includes('accounts.linxoms') || url.includes('/auth') || url.includes('/login') || document.querySelector('input[type="password"]');

        if (isLogin) {
            setTimeout(checkLoginAndInit, 2000);
        } else {
            initScriptCore();
        }
    }

    checkLoginAndInit();

})();
