

// ==UserScript==
// @name         Super Monitor Linx OMS - Versão Acompanhar Operacional
// @namespace    http://tampermonkey.net/
// @version      7.00
// @description  Monitor de pedidos OMS silencioso para operadores: Reorganização nativa em grid neon de 6 colunas, cronômetros de SLA em tempo real, painel lateral deslizante com detalhes e trava de foco no leitor de código de barras.
// @author       Antigravity AI
// @match        https://*.linxoms.com.br/*
// @connect      linxoms.com.br
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Importar Fonte Premium Outfit
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap';
    document.head.appendChild(fontLink);

    // --- CONFIGURAÇÕES ---
    let LOJA_ID = '1187'; // ID Padrão/Fallback da loja
    const CHECK_INTERVAL = 3000; // Sincronização a cada 3 segundos
    const TEMPO_LIMITE_MINUTOS = 60; // SLA padrão da loja

    // --- ESTADO INTERNO ---
    let pedidosAtivosAtuais = [];
    let currentURL = window.location.href;
    let activeStageKey = null; // Controla qual etapa está expandida no painel lateral
    let audioCtx = null;
    let audioMuted = localStorage.getItem('oms_audio_muted') === 'true';
    let lastWaitingCount = 0;
    let lastCheckedUrgency = 0;
    let lastGroupsData = {};
    let checklistState = JSON.parse(localStorage.getItem('oms_checklist_state')) || {};

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
        } catch (e) {}

        return null;
    }

    function getStoreSlug() {
        const parts = window.location.pathname.split('/');
        return parts[1] || 'rihappy';
    }

    function getOrderDetailsUrl(orderId) {
        const storeSlug = getStoreSlug();
        const parts = orderId.split('-');
        if (parts.length === 2) {
            return `/${storeSlug}/channels/site/orders/${parts[0]}/fulfillments/${parts[1]}`;
        }
        return `/${storeSlug}/orders/${orderId}/fulfillments/${orderId}`;
    }

    function getAngularData(row) {
        try {
            if (typeof angular === 'undefined') return null;
            const el = angular.element(row);
            const scope = el.scope();
            if (!scope) return null;

            const fulfillment = scope.fulfillment || scope.item?.fulfillmentItem || (scope.item && scope.item.fulfillment);
            if (!fulfillment) return null;

            const customer = fulfillment.customer || fulfillment.order?.customer;
            const customerName = customer?.fullName || customer?.name;

            let phone = customer?.phoneMobile || customer?.phone || customer?.mobilePhone || "";
            if (!phone && Array.isArray(customer?.phones)) {
                phone = customer.phones[0]?.number || (customer.phones[0]?.ddd ? String(customer.phones[0].ddd) + String(customer.phones[0].number) : "");
            }

            return {
                customerName: customerName ? customerName.trim() : null,
                phone: phone ? String(phone).replace(/\D/g, '') : null,
                orderId: fulfillment.orderId || fulfillment.order?.code || null
            };
        } catch (e) {
            console.warn("[OMS Premium] Error reading angular scope:", e);
            return null;
        }
    }

    const STAGE_STEPS = {
        'WAITING': [
            'Imprimir Lista de Separação',
            'Coletar todos os produtos'
        ],
        'PICKING': [
            'Conferir código de barras',
            'Finalizar a separação'
        ],
        'INVOICING': [
            'Aguardar faturamento automático',
            'Verificar pendências fiscais'
        ],
        'CHECKED': [
            'Embalar e selar pacotes',
            'Colar etiqueta ou declaração'
        ],
        'SEND_READY_DELIVERY': [
            'Entregar para transportadora',
            'Gerar a lista de despacho'
        ],
        'SEND_READY_PICKUP': [
            'Organizar na prateleira física',
            'Notificar cliente via WhatsApp'
        ]
    };

    const STAGES_CONFIG = {
        'WAITING': { label: 'PENDENTES', icon: '📥', color: '#00ff88', class: 'stage-waiting', selector: '.pending.step-box' },
        'PICKING': { label: 'SEPARAÇÃO', icon: '🔍', color: '#f1c40f', class: 'stage-picking', selector: '.picking.step-box' },
        'INVOICING': { label: 'FATURAMENTO', icon: '🧾', color: '#3498db', class: 'stage-invoicing', selector: '.billing.step-box' },
        'CHECKED': { label: 'PREPARAR ENTREGA', icon: '📦', color: '#e67e22', class: 'stage-preparing', selector: '.preparing.step-box' },
        'SEND_READY_DELIVERY': { label: 'LISTA DE DESPACHO', icon: '🚚', color: '#9b59b6', class: 'stage-shipping', selector: '.shipping.step-box' },
        'SEND_READY_PICKUP': { label: 'LISTA DE RETIRADA', icon: '🏪', color: '#ff3e3e', class: 'stage-pickup', selector: '.pickup.step-box' }
    };

    // --- PARSER DE ENTREGAS ---
    function parseDeliveryInfo(p) {
        const carrierText = String(p.carrier || p.domCarrierFallback || '').toLowerCase();
        const typeText = String(p.deliveryType || '').toLowerCase();
        const apiType = String(p.apiType || '').toUpperCase();

        const isPickup = apiType === 'PICKUP' || carrierText.includes('retirada') || carrierText.includes('loja') || typeText.includes('retirada') || typeText.includes('loja');
        const isExpress = carrierText.includes('uber') || typeText.includes('express') || typeText.includes('3 horas');

        if (isPickup) {
            return { label: '🏪 RETIRADA', isExpress: false, isPickup: true };
        }

        let labelName = p.carrier || p.deliveryType || 'ENTREGA';
        if (carrierText.includes('uber')) labelName = 'UBER';
        if (carrierText.includes('sedex')) labelName = 'SEDEX';

        if (labelName.length > 25) {
            labelName = labelName.substring(0, 22) + '...';
        }

        return { label: '🚚 ' + labelName.toUpperCase(), isExpress: isExpress, isPickup: false };
    }

    // --- SISTEMA DE DESIGN PREMIUM COM ANIMAÇÕES (ESTILO OPERACIONAL ESCURO) ---
    const style = document.createElement('style');
    style.innerHTML = `
        :root {
            --neon-green: #00ff88;
            --neon-yellow: #f1c40f;
            --neon-red: #ff3e3e;
            --neon-orange: #e67e22;
            --neon-blue: #3498db;
            --neon-purple: #9b59b6;
            --bg-dark: rgba(18, 18, 18, 0.92);
            --card-bg: rgba(28, 28, 28, 0.95);
            --font-main: 'Outfit', sans-serif;
        }

        /* Animações dos Containers Nativos */
        @keyframes pulseRedBorder {
            0%, 100% { box-shadow: 0 0 15px rgba(255, 62, 62, 0.5), inset 0 0 8px rgba(255, 62, 62, 0.2); border-color: var(--neon-red); }
            50% { box-shadow: 0 0 30px rgba(255, 62, 62, 0.9), inset 0 0 20px rgba(255, 62, 62, 0.4); border-color: #ff6b6b; }
        }
        @keyframes pulseNormalBorder {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.005); }
        }

        .oms-pulse-red-container {
            animation: pulseRedBorder 1.2s infinite ease-in-out !important;
            background-color: rgba(255, 62, 62, 0.03) !important;
        }
        .oms-pulse-normal-container {
            animation: pulseNormalBorder 3s infinite ease-in-out;
        }

        /* Normalização Premium dos Containers Nativos */
        .step-box {
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            min-height: 140px !important;
            height: 100% !important;
            align-self: stretch !important;
            padding: 22px 20px !important;
            box-sizing: border-box !important;
            position: relative !important;
            float: none !important;
            width: 100% !important;
            margin: 0 !important;

            /* Força o design escuro premium de alto contraste */
            background: rgba(20, 20, 20, 0.95) !important;
            color: #fff !important;
            border: 2px solid rgba(255, 255, 255, 0.05) !important;
            border-radius: 14px !important;
            backdrop-filter: blur(10px) !important;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        /* Garante que nenhum elemento nativo interno sobreponha fundos ou cores claras */
        .step-box *:not(.oms-native-badge):not(.oms-native-info-box):not(.oms-native-info-box *) {
            color: #fff !important;
            background: transparent !important;
            box-shadow: none !important;
        }

        /* Os demais cards secundários ficam embaixo, discretos e sem brilho neon */
        .step-box.delivered,
        .step-box.receive,
        .step-box.packing-list {
            display: flex !important;
            order: 10 !important;
            grid-column: span 2 !important; /* Cada um ocupa 2 das 6 colunas, cabendo perfeitamente os 3 na segunda linha! */
            background: rgba(28, 28, 28, 0.95) !important;
            color: #ffffff !important;
            border: 1.5px dashed rgba(255, 255, 255, 0.45) !important;
            box-shadow: none !important;
            min-height: 100px !important;
            border-radius: 12px !important;
            padding: 14px 18px !important;
        }

        /* Deixa o texto interno dos cards secundários limpo e visível */
        .step-box.delivered *,
        .step-box.receive *,
        .step-box.packing-list * {
            color: #ffffff !important;
            text-shadow: none !important;
            background: transparent !important;
            opacity: 0.95 !important;
        }

        /* Layout em Grid de 6 Colunas para o Fluxo Logístico */
        .oms-grid-parent {
            display: grid !important;
            grid-template-columns: repeat(6, 1fr) !important;
            grid-gap: 16px !important;
            margin: 25px 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
            float: none !important;
            clear: both !important;
        }

        /* Ordenação e Posicionamento dos Cards no Grid de Fluxo */
        .pending.step-box { order: 1 !important; grid-column: span 1 !important; }
        .picking.step-box { order: 2 !important; grid-column: span 1 !important; }
        .billing.step-box { order: 3 !important; grid-column: span 1 !important; }
        .preparing.step-box { order: 4 !important; grid-column: span 1 !important; }
        .shipping.step-box { order: 5 !important; grid-column: span 1 !important; }
        .pickup.step-box { order: 6 !important; grid-column: span 1 !important; }

        /* Oculta a descrição longa nativa e a quantidade redundante nativa */
        .step-box .description p,
        .step-box .qty {
            display: none !important;
        }

        /* Estilização Premium do Título do Card Nativo */
        .step-box .description h3 {
            margin: 0 !important;
            font-size: 15px !important;
            font-weight: 900 !important;
            color: #fff !important;
            font-family: 'Outfit', sans-serif !important;
            letter-spacing: 0.8px !important;
            text-transform: uppercase !important;
        }

        /* Estilo da Barra Lateral de Acompanhamento (Draggable Drawer) */
        .oms-support-dashboard {
            position: fixed; z-index: 99999;
            background: var(--bg-dark) !important; color: #fff;
            border-radius: 20px; border: 2px solid rgba(255,255,255,0.1);
            backdrop-filter: blur(25px); box-shadow: 0 20px 40px rgba(0,0,0,0.6);
            width: 360px; font-family: var(--font-main); overflow: hidden; user-select: none;
            transition: border-color 0.3s ease;
        }

        @media print { .oms-support-dashboard { display: none !important; } }

        .oms-support-handle {
            background: rgba(255,255,255,0.06); padding: 15px 20px; cursor: move;
            font-size: 11px; color: #fff; font-weight: 900; display: flex;
            justify-content: space-between; align-items: center; letter-spacing: 1.5px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .oms-support-content { padding: 15px; }

        .support-stage-row {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.05);
            border-radius: 10px; cursor: pointer; transition: all 0.2s ease;
            margin-bottom: 4px;
        }
        .support-stage-row:hover {
            background: rgba(255,255,255,0.05);
        }
        .support-stage-row.active {
            background: rgba(255,255,255,0.08);
            border-bottom-left-radius: 0; border-bottom-right-radius: 0;
            margin-bottom: 0;
        }

        .stage-label-group {
            display: flex; align-items: center; gap: 10px;
        }
        .stage-icon {
            font-size: 16px; width: 20px; text-align: center;
        }
        .stage-title {
            font-size: 12px; font-weight: 700; color: #ffffff;
        }

        .stage-count-badge {
            font-size: 14px; font-weight: 900; padding: 2px 8px;
            border-radius: 6px; background: rgba(255,255,255,0.08);
            color: rgba(255, 255, 255, 0.4); transition: all 0.2s ease;
        }

        .support-stage-row.has-items .stage-count-badge {
            color: #ffffff; font-weight: 900;
        }

        .stage-waiting.has-items .stage-count-badge { background: rgba(0, 255, 136, 0.2); color: var(--neon-green); }
        .stage-picking.has-items .stage-count-badge { background: rgba(241, 196, 15, 0.2); color: var(--neon-yellow); }
        .stage-checked.has-items .stage-count-badge { background: rgba(230, 126, 34, 0.2); color: var(--neon-orange); }
        .stage-invoicing.has-items .stage-count-badge { background: rgba(52, 152, 219, 0.2); color: var(--neon-blue); }
        .stage-shipping.has-items .stage-count-badge { background: rgba(155, 89, 182, 0.2); color: var(--neon-purple); }
        .stage-pickup.has-items .stage-count-badge { background: rgba(255, 62, 62, 0.2); color: var(--neon-red); }

        .stage-detail-panel {
            background: rgba(0, 0, 0, 0.2);
            border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;
            padding: 10px 12px; border: 1px solid rgba(255,255,255,0.05);
            border-top: none; max-height: 220px; overflow-y: auto;
            margin-bottom: 8px; display: none;
            scrollbar-width: thin;
        }

        .stage-detail-panel.open {
            display: block;
        }

        .support-order-card {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px; padding: 10px; margin-bottom: 8px;
            font-size: 12px; transition: transform 0.15s ease;
        }
        .support-order-card:hover {
            transform: scale(1.01);
            background: rgba(255,255,255,0.1);
            border-color: rgba(255,255,255,0.3);
        }
        .support-card-row {
            display: flex; justify-content: space-between; align-items: center;
        }
        .support-card-id {
            font-weight: 900; color: #ffffff; cursor: pointer; text-decoration: underline;
        }
        .support-card-badge {
            padding: 2px 6px; border-radius: 4px; font-size: 9px;
        }
        .support-card-desc {
            color: #ffffff; font-weight: 900;
        }
        .support-card-items {
            color: #ffffff; font-weight: 700; opacity: 0.9;
        }
        .support-card-customer {
            color: #ffffff; font-size: 11px; font-weight: 700; opacity: 0.85;
        }
        .support-bottleneck-label {
            font-size: 10px; font-weight: 900; margin-top: 6px;
            background: rgba(0,0,0,0.25); padding: 4px 8px; border-radius: 4px;
            text-align: center;
        }
        .support-no-orders {
            text-align: center; color: #ffffff; opacity: 0.7; padding: 20px 0; font-size: 12px; font-style: italic;
        }
        .support-toast {
            position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.85); color: var(--neon-green); padding: 6px 12px;
            border-radius: 8px; font-size: 10px; font-weight: bold; border: 1px solid var(--neon-green);
            opacity: 0; transition: opacity 0.2s ease; z-index: 100000; pointer-events: none;
        }
        .support-toast.show { opacity: 1; }

        .status-dot {
            width: 8px; height: 8px; background: var(--neon-green); border-radius: 50%;
            display: inline-block; margin-right: 8px; box-shadow: 0 0 8px var(--neon-green);
        }

        /* Scrollbar styling */
        .stage-detail-panel::-webkit-scrollbar { width: 5px; }
        .stage-detail-panel::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .stage-detail-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

        /* Stepper Flow do Operador */
        .oms-stepper-container {
            width: 100% !important;
            background: rgba(20, 20, 20, 0.95) !important;
            border: 2px solid rgba(255, 255, 255, 0.08) !important;
            border-radius: 16px !important;
            padding: 16px 20px !important;
            box-sizing: border-box !important;
            margin-bottom: 20px !important;
            font-family: 'Outfit', sans-serif !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
            position: relative !important;
            backdrop-filter: blur(10px) !important;
        }

        .oms-stepper-title {
            font-size: 11px !important;
            font-weight: 900 !important;
            letter-spacing: 1.5px !important;
            color: rgba(255, 255, 255, 0.5) !important;
            text-transform: uppercase !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
        }

        .oms-stepper-steps {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            gap: 8px !important;
            position: relative !important;
            margin: 6px 0 !important;
        }

        .oms-stepper-step {
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            padding: 10px 6px !important;
            background: rgba(255, 255, 255, 0.03) !important;
            border: 1px solid rgba(255, 255, 255, 0.06) !important;
            border-radius: 10px !important;
            text-align: center !important;
            position: relative !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            cursor: pointer !important;
        }

        .oms-stepper-step:hover {
            background: rgba(255, 255, 255, 0.07) !important;
            border-color: rgba(255, 255, 255, 0.2) !important;
        }

        .oms-stepper-step.active-step {
            background: rgba(255, 255, 255, 0.07) !important;
            border-color: var(--neon-color) !important;
            box-shadow: 0 0 15px var(--neon-color-alpha) !important;
        }

        .oms-stepper-step-num {
            font-size: 9px !important;
            font-weight: 900 !important;
            color: rgba(255, 255, 255, 0.4) !important;
            margin-bottom: 2px !important;
        }

        .oms-stepper-step.active-step .oms-stepper-step-num {
            color: var(--neon-color) !important;
        }

        .oms-stepper-step-label {
            font-size: 11px !important;
            font-weight: 700 !important;
            color: #ffffff !important;
            letter-spacing: 0.3px !important;
        }

        .oms-stepper-step-badge {
            position: absolute !important;
            top: -8px !important;
            right: -4px !important;
            background: #ff3e3e !important;
            color: #000 !important;
            font-size: 9px !important;
            font-weight: 900 !important;
            padding: 2px 6px !important;
            border-radius: 20px !important;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important;
        }

        .oms-stepper-connector {
            color: rgba(255, 255, 255, 0.15) !important;
            font-weight: 900 !important;
            font-size: 14px !important;
            user-select: none !important;
        }

        .oms-stepper-action-banner {
            background: rgba(255, 255, 255, 0.04) !important;
            border-left: 4px solid var(--accent-color, var(--neon-green)) !important;
            border-radius: 8px !important;
            padding: 12px 16px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 12px !important;
            box-shadow: inset 0 0 10px rgba(255,255,255,0.01) !important;
        }

        .oms-stepper-action-info {
            display: flex !important;
            flex-direction: column !important;
            gap: 2px !important;
        }

        .oms-stepper-action-title {
            font-size: 12px !important;
            font-weight: 900 !important;
            color: #ffffff !important;
            letter-spacing: 0.3px !important;
        }

        .oms-stepper-action-desc {
            font-size: 11px !important;
            color: rgba(255, 255, 255, 0.7) !important;
            font-weight: 500 !important;
        }

        .oms-stepper-action-btn {
            background: var(--accent-color, var(--neon-green)) !important;
            color: #000000 !important;
            border: none !important;
            padding: 8px 16px !important;
            border-radius: 8px !important;
            font-size: 11px !important;
            font-weight: 900 !important;
            cursor: pointer !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
            white-space: nowrap !important;
            transition: all 0.2s ease !important;
            box-shadow: 0 4px 12px var(--accent-color-alpha, rgba(0, 255, 136, 0.3)) !important;
        }

        .oms-stepper-action-btn:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 6px 16px var(--accent-color-alpha, rgba(0, 255, 136, 0.4)) !important;
        }

        /* Checklists das Etapas */
        .oms-checklist-container {
            margin-top: 10px !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 6px !important;
            width: 100% !important;
        }

        .oms-checklist-item {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            font-size: 10px !important;
            font-weight: 700 !important;
            color: rgba(255, 255, 255, 0.8) !important;
            line-height: 1.3 !important;
        }

        .oms-checklist-checkbox {
            width: 12px !important;
            height: 12px !important;
            border: 1px solid rgba(255, 255, 255, 0.3) !important;
            border-radius: 3px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            user-select: none !important;
            color: #000000 !important;
            font-size: 8px !important;
            font-weight: 900 !important;
            background: rgba(0,0,0,0.25) !important;
            transition: all 0.2s ease !important;
            flex-shrink: 0 !important;
        }

        .oms-checklist-checkbox.checked {
            background: var(--stage-color) !important;
            border-color: var(--stage-color) !important;
            color: #000000 !important;
            box-shadow: 0 0 6px var(--stage-color) !important;
        }

        .oms-checklist-btn {
            margin-top: 12px !important;
            width: 100% !important;
            background: var(--stage-color) !important;
            color: #000000 !important;
            border: none !important;
            padding: 8px 12px !important;
            border-radius: 8px !important;
            font-size: 10px !important;
            font-weight: 900 !important;
            cursor: pointer !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
            transition: all 0.2s ease !important;
            box-shadow: 0 4px 10px var(--stage-color-alpha) !important;
            text-align: center !important;
        }

        .oms-checklist-btn:hover {
            transform: translateY(-1.5px) !important;
            box-shadow: 0 6px 14px var(--stage-color-alpha) !important;
        }

        /* Responsividade para Monitores Menores e Laptops */
        @media (max-width: 1400px) {
            .oms-grid-parent {
                grid-template-columns: repeat(3, 1fr) !important;
            }
            .step-box {
                grid-column: span 1 !important;
                min-height: 150px !important;
            }
            .step-box.delivered,
            .step-box.receive,
            .step-box.packing-list {
                grid-column: span 1 !important;
                min-height: 120px !important;
            }
        }

        @media (max-width: 900px) {
            .oms-stepper-steps {
                flex-wrap: wrap !important;
                justify-content: center !important;
                gap: 12px !important;
            }
            .oms-stepper-connector {
                display: none !important;
            }
            .oms-stepper-step {
                flex: 1 1 120px !important;
            }
        }

        @media (max-width: 768px) {
            .oms-grid-parent {
                grid-template-columns: 1fr !important;
            }
            .step-box,
            .step-box.delivered,
            .step-box.receive,
            .step-box.packing-list {
                grid-column: span 1 !important;
            }
        }

        /* Estilização Dark Neon da Tabela Nativa de Retiradas */
        .oms-pickup-panel {
            background: rgba(20, 20, 20, 0.95) !important;
            border: 2px solid rgba(255, 255, 255, 0.08) !important;
            border-radius: 16px !important;
            padding: 20px !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
            font-family: 'Outfit', sans-serif !important;
            margin-top: 15px !important;
        }
        .oms-pickup-panel .panel-heading {
            background: transparent !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
            color: #ffffff !important;
            font-weight: 900 !important;
            font-size: 16px !important;
            padding: 12px 0 !important;
        }
        .oms-pickup-table {
            background: transparent !important;
            color: #ffffff !important;
        }
        .oms-pickup-table th {
            background: rgba(255, 255, 255, 0.03) !important;
            color: rgba(255, 255, 255, 0.5) !important;
            font-weight: 900 !important;
            text-transform: uppercase !important;
            font-size: 11px !important;
            letter-spacing: 0.8px !important;
            border-bottom: 2px solid rgba(255, 255, 255, 0.08) !important;
            padding: 12px !important;
        }
        .oms-pickup-table td {
            border-bottom: 1px solid rgba(255, 255, 255, 0.04) !important;
            padding: 14px 12px !important;
            vertical-align: middle !important;
        }

        /* Estilização Premium da Página de Detalhes do Pedido - Tema Escuro Imersivo para Alto Contraste */
        body.oms-order-page-active {
            background: #0b0f19 !important; /* Fundo escuro azul ardósia profundo */
            color: #f8fafc !important;
        }

        body.oms-order-page-active .page-content,
        body.oms-order-page-active .main-container,
        body.oms-order-page-active .container,
        body.oms-order-page-active #content,
        body.oms-order-page-active .content-wrapper {
            background: #0b0f19 !important;
            color: #f8fafc !important;
        }

        body.oms-order-page-active .order-resume,
        body.oms-order-page-active .panel,
        body.oms-order-page-active .panel-default {
            background: #111c30 !important; /* Painéis com azul marinho escuro */
            border: 2px solid rgba(255, 255, 255, 0.12) !important;
            border-radius: 16px !important;
            padding: 24px !important;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5) !important;
            color: #ffffff !important;
            margin-bottom: 25px !important;
        }

        body.oms-order-page-active h1,
        body.oms-order-page-active h2,
        body.oms-order-page-active h3,
        body.oms-order-page-active h4,
        body.oms-order-page-active h5,
        body.oms-order-page-active .panel-title,
        body.oms-order-page-active .order-title {
            color: #ffffff !important;
            font-family: 'Outfit', sans-serif !important;
            font-weight: 900 !important;
            letter-spacing: 0.5px !important;
            text-transform: uppercase !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;
            padding-bottom: 12px !important;
            margin-bottom: 18px !important;
        }

        body.oms-order-page-active dl dt,
        body.oms-order-page-active dt {
            color: rgba(255, 255, 255, 0.55) !important;
            font-family: 'Outfit', sans-serif !important;
            font-weight: 900 !important;
            text-transform: uppercase !important;
            font-size: 10px !important;
            letter-spacing: 0.5px !important;
            margin-top: 8px !important;
        }

        body.oms-order-page-active dl dd,
        body.oms-order-page-active dd,
        body.oms-order-page-active .ng-binding {
            color: #ffffff !important;
            font-family: 'Outfit', sans-serif !important;
            font-weight: 700 !important;
            font-size: 13px !important;
            margin-bottom: 12px !important;
        }

        /* Tabelas Internas do Detalhe */
        body.oms-order-page-active table,
        body.oms-order-page-active .table,
        body.oms-order-page-active .table-bordered {
            background: #111c30 !important;
            color: #ffffff !important;
            border: 1px solid rgba(255, 255, 255, 0.15) !important;
            border-collapse: collapse !important;
        }

        body.oms-order-page-active table th,
        body.oms-order-page-active .table th {
            background: rgba(255, 255, 255, 0.05) !important;
            color: rgba(255, 255, 255, 0.6) !important;
            font-weight: 900 !important;
            text-transform: uppercase !important;
            font-size: 11px !important;
            letter-spacing: 0.8px !important;
            border: 1px solid rgba(255, 255, 255, 0.15) !important;
            padding: 12px !important;
        }

        body.oms-order-page-active table td,
        body.oms-order-page-active .table td {
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            padding: 14px 12px !important;
            vertical-align: middle !important;
            color: #ffffff !important;
            font-weight: 700 !important;
            background: transparent !important;
        }

        /* Linhas listradas em dark */
        body.oms-order-page-active .table-striped tbody tr:nth-of-type(odd) {
            background-color: rgba(255, 255, 255, 0.02) !important;
        }
        body.oms-order-page-active .table-striped tbody tr:hover {
            background-color: rgba(255, 255, 255, 0.05) !important;
        }

        /* Histórico do Pedido (Linha do Tempo) */
        body.oms-order-page-active .order-history-step,
        body.oms-order-page-active .order-timeline-step,
        body.oms-order-page-active .order-step {
            border-left: 2px solid rgba(255, 255, 255, 0.15) !important;
            padding-left: 20px !important;
            margin-left: 10px !important;
            position: relative !important;
            margin-bottom: 18px !important;
        }
        body.oms-order-page-active .order-history-step::before,
        body.oms-order-page-active .order-timeline-step::before {
            content: '' !important;
            position: absolute !important;
            left: -7px !important;
            top: 4px !important;
            width: 12px !important;
            height: 12px !important;
            border-radius: 50% !important;
            background: rgba(255, 255, 255, 0.3) !important;
            border: 2px solid #0b0f19 !important;
            transition: all 0.3s ease !important;
        }
        body.oms-order-page-active .order-history-step.active::before,
        body.oms-order-page-active .order-timeline-step.active::before {
            background: var(--neon-green) !important;
            box-shadow: 0 0 10px var(--neon-green) !important;
        }
        body.oms-order-page-active .order-history-status,
        body.oms-order-page-active .order-timeline-status,
        body.oms-order-page-active .order-history-step .lead {
            color: #ffffff !important;
            font-weight: 900 !important;
            font-size: 13px !important;
            text-transform: uppercase !important;
            margin: 0 !important;
        }
        body.oms-order-page-active .order-history-date,
        body.oms-order-page-active .order-timeline-date,
        body.oms-order-page-active .order-history-step small {
            color: rgba(255, 255, 255, 0.65) !important;
            font-size: 11px !important;
            font-weight: 700 !important;
        }
    `;
    style.id = 'oms-premium-global-stylesheet';
    document.head.appendChild(style);

    // --- INICIALIZAÇÃO DA INTERFACE OPERACIONAL ---
    const dashboard = document.createElement('div');
    dashboard.id = 'oms-premium-side-drawer';
    dashboard.className = "oms-support-dashboard";

    const savedPos = {
        top: localStorage.getItem('oms_support_top') || '80px',
        left: localStorage.getItem('oms_support_left') || 'auto',
        right: localStorage.getItem('oms_support_right') || '30px'
    };
    Object.assign(dashboard.style, savedPos);

    const handle = document.createElement('div');
    handle.className = "oms-support-handle";
    handle.innerHTML = `
        <div><span class="status-dot"></span>ACOMPANHAMENTO OMS</div>
        <div style="display:flex; align-items:center; gap:10px;">
            <button id="oms-audio-toggle" style="
                background:none; border:none; padding:0; margin:0;
                cursor:pointer; font-size:12px; color:${audioMuted ? 'rgba(255,255,255,0.3)' : 'var(--neon-green)'};
                transition:color 0.2s; display:flex; align-items:center;
            ">${audioMuted ? '🔇' : '🔊'}</button>
            <div style="opacity:0.5; font-size:10px;">LOJA ${LOJA_ID}</div>
        </div>
    `;
    dashboard.appendChild(handle);

    const dashContent = document.createElement('div');
    dashContent.className = "oms-support-content";
    dashboard.appendChild(dashContent);
    document.body.appendChild(dashboard);



    const toast = document.createElement('div');
    toast.className = "support-toast";
    toast.innerText = "CÓDIGO COPIADO!";
    dashboard.appendChild(toast);

    const audioToggle = handle.querySelector('#oms-audio-toggle');
    if (audioToggle) {
        audioToggle.onclick = (e) => {
            e.stopPropagation();
            audioMuted = !audioMuted;
            localStorage.setItem('oms_audio_muted', audioMuted);
            audioToggle.innerText = audioMuted ? '🔇' : '🔊';
            audioToggle.style.color = audioMuted ? 'rgba(255,255,255,0.3)' : 'var(--neon-green)';

            initAudio();
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            playSuccessBeep();
        };
    }

    // --- ENGINE DE DRAG COM LIMITES DA TELA ---
    let isDragging = false;
    let dragTarget = null;
    let offsetX, offsetY;

    document.addEventListener('mousedown', (e) => {
        const handle = e.target.closest('.oms-support-handle');
        if (!handle) return;

        // Evita arrastar quando clica no botão de áudio!
        if (e.target.closest('#oms-audio-toggle')) return;

        dragTarget = handle.closest('.oms-support-dashboard');
        if (!dragTarget) return;

        isDragging = true;
        offsetX = e.clientX - dragTarget.getBoundingClientRect().left;
        offsetY = e.clientY - dragTarget.getBoundingClientRect().top;
        handle.style.cursor = 'grabbing';
        dragTarget.style.transition = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !dragTarget) return;

        let x = e.clientX - offsetX;
        let y = e.clientY - offsetY;

        x = Math.max(0, Math.min(x, window.innerWidth - dragTarget.offsetWidth));
        y = Math.max(0, Math.min(y, window.innerHeight - dragTarget.offsetHeight));

        dragTarget.style.left = x + 'px';
        dragTarget.style.top = y + 'px';
        dragTarget.style.right = 'auto';
        dragTarget.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging && dragTarget) {
            const handle = dragTarget.querySelector('.oms-support-handle');
            if (handle) handle.style.cursor = 'move';
            dragTarget.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

            localStorage.setItem('oms_support_top', dragTarget.style.top);
            localStorage.setItem('oms_support_left', dragTarget.style.left);
        }
        isDragging = false;
        dragTarget = null;
    });

    // --- SÍNTESE DE AUDIO WEB AUDIO API (SINALIZAÇÕES CRISTALINAS) ---
    function initAudio() {
        if (audioCtx) return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContextClass();
        } catch (e) {}
    }

    function playCopyBeep() {
        if (audioMuted) return;
        initAudio();
        if (!audioCtx || audioCtx.state === 'suspended') return;
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.03, audioCtx.currentTime); // Volume discreto (3%)
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.05);
        } catch (e) {}
    }

    function playSuccessBeep() {
        if (audioMuted) return;
        initAudio();
        if (!audioCtx || audioCtx.state === 'suspended') return;
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000, audioCtx.currentTime); // Beep de leitura do scanner
            gain.gain.setValueAtTime(0.04, audioCtx.currentTime); // 4% volume
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.08);
        } catch (e) {}
    }

    function playErrorBuzz() {
        if (audioMuted) return;
        initAudio();
        if (!audioCtx || audioCtx.state === 'suspended') return;
        try {
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(120, audioCtx.currentTime);
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(122, audioCtx.currentTime);

            gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(audioCtx.destination);

            osc1.start();
            osc2.start();
            osc1.stop(audioCtx.currentTime + 0.35);
            osc2.stop(audioCtx.currentTime + 0.35);
        } catch (e) {}
    }

    function playNewOrderChime() {
        if (audioMuted) return;
        initAudio();
        if (!audioCtx || audioCtx.state === 'suspended') return;
        try {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.setValueAtTime(880, now + 0.12); // A5

            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(now + 0.3);
        } catch (e) {}
    }

    function playCriticalChime() {
        if (audioMuted) return;
        initAudio();
        if (!audioCtx || audioCtx.state === 'suspended') return;
        try {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now); // A4
            osc.frequency.setValueAtTime(349.23, now + 0.15); // F4

            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(now + 0.4);
        } catch (e) {}
    }

    function showScreenFlash(isSuccess) {
        let flash = document.getElementById('oms-screen-flash');
        if (!flash) {
            flash = document.createElement('div');
            flash.id = 'oms-screen-flash';
            flash.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                z-index: 1000000; pointer-events: none; opacity: 0;
                transition: opacity 0.15s ease-out;
            `;
            document.body.appendChild(flash);
        }

        flash.style.background = isSuccess ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 62, 62, 0.2)';
        flash.style.boxShadow = isSuccess ? 'inset 0 0 100px rgba(0, 255, 136, 0.4)' : 'inset 0 0 100px rgba(255, 62, 62, 0.5)';
        flash.style.opacity = '1';

        setTimeout(() => {
            flash.style.opacity = '0';
        }, 300);
    }

    function triggerStageAction(stageKey) {
        const el = document.querySelector(STAGES_CONFIG[stageKey].selector);
        if (el) {
            el.click();
        } else {
            if (stageKey === 'PICKING') {
                window.location.href = window.location.origin + '/selection';
            } else if (stageKey === 'SEND_READY_PICKUP') {
                window.location.href = window.location.origin + '/fulfillments/pickup';
            } else {
                window.location.href = window.location.origin + '/';
            }
        }
    }

    // --- ENHANCERS DE TABELAS GLOBAIS ---
    function enhanceListPage() {
        if (window.location.href.includes('/orders/')) return;

        const rows = document.querySelectorAll('table tbody tr');
        rows.forEach(row => {
            let carrierText = '';
            const cells = row.querySelectorAll('td');

            cells.forEach(cell => {
                const text = cell.innerText.trim();
                if (text.toLowerCase().includes('retirada em loja') || text.toLowerCase().includes('uber next day') || text.toLowerCase().includes('sedex')) {
                    carrierText = text;
                }
            });

            const transportCell = row.querySelector('.shipping-type') || row.querySelector('[ng-if*="shipping-type"]');

            if (carrierText && transportCell && !transportCell.dataset.omsModified) {
                const info = parseDeliveryInfo({ domCarrierFallback: carrierText });

                if (info.label.includes('RETIRADA')) {
                    transportCell.innerHTML = `<b style="color:var(--neon-yellow); background:rgba(0,0,0,0.4); padding:3px 8px; border-radius:6px; font-size:11px; display:inline-block; border:1px solid rgba(241, 196, 15, 0.3);">${info.label}</b>`;
                } else {
                    transportCell.innerHTML = `<b style="color:var(--neon-green); background:rgba(0,0,0,0.4); padding:3px 8px; border-radius:6px; font-size:11px; display:inline-block; border:1px solid rgba(0, 255, 136, 0.3);">${info.label}</b>`;
                }
                transportCell.dataset.omsModified = "true";
            }

            cells.forEach(cell => {
                if (cell.textContent.toLowerCase().includes('uber')) {
                    cell.style.color = 'var(--neon-red)';
                    cell.style.fontWeight = 'bold';
                }
            });
        });
    }

    setInterval(enhanceListPage, 2000);

    // --- LÓGICA OPERACIONAL DE SLA ---
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
            return { minutes: 999, text: "🕒 ABER.", cardClass: "bg-card-verde", urgency: 1 };
        }

        const limit = new Date(startTime.getTime() + (TEMPO_LIMITE_MINUTOS * 60 * 1000));
        const diff = limit - now;
        const absDiff = Math.abs(diff);
        const mins = Math.floor(absDiff / 60000);
        const secs = Math.floor((absDiff % 60000) / 1000);
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        if (diff < 0) return { minutes: -mins, text: `🚨 -${timeStr}`, cardClass: "bg-card-vermelho", urgency: 3 };
        if (isExpress || mins < 15) return { minutes: mins, text: `🔥 ${timeStr}`, cardClass: "bg-card-vermelho", urgency: 3 };
        if (mins < 40) return { minutes: mins, text: `⚠️ ${timeStr}`, cardClass: "bg-card-laranja", urgency: 2 };

        return { minutes: mins, text: `✅ ${timeStr}`, cardClass: "bg-card-verde", urgency: 1 };
    }

    function getBottleneckInfo(o) {
        if (!o) return null;
        const now = new Date();
        const updated = new Date(o.updatedAt || o.createdAt || now);
        const diffMins = (now - updated) / 60000;

        const isRetirada = o.isPickup;

        if (o.statusNativo === 'INVOICING' && diffMins > 10) {
            return { label: '🧾 FATURAMENTO LENTO (>10 MIN)', isCritical: true, color: '#e74c3c' };
        }
        if (o.statusNativo === 'INVOICING_FAIL') {
            return { label: '❌ FALHA NO FATURAMENTO (ERRO)', isCritical: true, color: '#e74c3c' };
        }
        if (o.statusNativo === 'PICKING' && diffMins > 30) {
            return { label: '⏳ SEPARAÇÃO LENTA (>30 MIN)', isCritical: true, color: '#f39c12' };
        }
        if (o.statusNativo === 'CHECKED' && diffMins > 15) {
            return { label: '📢 CONFERIDO: FALTA FATURAR (>15 MIN)', isCritical: true, color: '#f39c12' };
        }
        if (o.statusNativo === 'SEND_READY' || o.statusNativo === 'PICKUP_READY' || o.statusNativo === 'PICKUP_PAID') {
            if (!isRetirada && diffMins > 60) {
                return { label: '🚨 CRIAR LISTA DE DESPACHO (>60 MIN)', isCritical: true, color: '#9b59b6' };
            }
            if (isRetirada && diffMins > 60) {
                const limitMs = 15 * 24 * 60 * 60 * 1000;
                const remainingMs = (updated.getTime() + limitMs) - now.getTime();
                const diffDays = remainingMs / (24 * 60 * 60 * 1000);
                let label = '';
                if (diffDays <= 0) {
                    label = '🚨 RETIRADA EXPIRADA! CANCELAR NO OMS';
                } else if (diffDays < 1) {
                    label = `⚠️ ÚLTIMO DIA DE RETIRADA! FALTAM ${Math.ceil(diffDays * 24)}H`;
                } else {
                    label = `⏳ RETIRADA PENDENTE: FALTAM ${Math.floor(diffDays)} DIAS`;
                }
                return { label: label, isCritical: true, color: '#e67e22' };
            }
        }
        return null;
    }

    // --- REORGANIZAÇÃO DO PAINEL NATIVO INSTORE ---
    function updateNativeDOMAlerts(groups) {
        const firstBox = document.querySelector('.pending.step-box');
        if (firstBox && firstBox.parentElement) {
            firstBox.parentElement.classList.add('oms-grid-parent');
        }

        const nativeMapping = {
            'WAITING': {
                selector: '.pending.step-box',
                color: '#00ff88',
                numberedTitle: 'ETAPA 1: PENDENTES',
                emptyBadge: '0',
                emptyTitle: '🎉 FILA ZERADA',
                emptySub: 'Nenhum pedido novo pendente no momento.',
                activeBadge: 'PENDENTES',
                instruction: '👉 IMPRIMA A LISTA DE SEPARAÇÃO E PROCURE O PRODUTO'
            },
            'PICKING': {
                selector: '.picking.step-box',
                color: '#f1c40f',
                numberedTitle: 'ETAPA 2: SEPARAÇÃO',
                emptyBadge: '0',
                emptyTitle: '🔍 TUDO COLETADO',
                emptySub: 'Sem mercadorias pendentes de separação.',
                activeBadge: 'SEPARAÇÃO',
                instruction: '👉 COM O PRODUTO EM MÃOS, FAÇA A LEITURA DO CÓDIGO DE BARRAS'
            },
            'INVOICING': {
                selector: '.billing.step-box',
                color: '#3498db',
                numberedTitle: 'ETAPA 3: FATURAMENTO',
                emptyBadge: '0',
                emptyTitle: '🧾 NOTAS EMITIDAS',
                emptySub: 'Sem faturamentos pendentes ou erros fiscais.',
                activeBadge: 'FATURAMENTO',
                instruction: '👉 AGUARDE O FATURAMENTO AUTOMÁTICO. SE DEMORAR MAIS QUE 1 MINUTO FIQUE ATENTO!'
            },
            'CHECKED': {
                selector: '.preparing.step-box',
                color: '#e67e22',
                numberedTitle: 'ETAPA 4: PREPARAR ENTREGA',
                emptyBadge: '0',
                emptyTitle: '📦 TUDO PRONTO',
                emptySub: 'Caixas conferidas e seladas para entrega.',
                activeBadge: 'PREPARAR ENTREGA',
                instruction: '👉 FATURADO, IMPRIMA ETIQUETA DE RETIRADA/DECLARAÇÃO DE CONTEÚDO'
            },
            'SEND_READY_DELIVERY': {
                selector: '.shipping.step-box',
                color: '#9b59b6',
                numberedTitle: 'ETAPA 5-A: DESPACHO',
                emptyBadge: '0',
                emptyTitle: '🚚 EXPEDIÇÃO EM ROTA',
                emptySub: 'Todos os volumes despachados com a transportadora.',
                activeBadge: 'EXPEDIÇÃO',
                instruction: '👉 GERAR LISTA DE DESPACHO IMEDIATAMENTE!'
            },
            'SEND_READY_PICKUP': {
                selector: '.pickup.step-box',
                color: '#ff3e3e',
                numberedTitle: 'ETAPA 5-B: RETIRADA',
                emptyBadge: '0',
                emptyTitle: '🏪 LOCKER VAZIO',
                emptySub: 'Todas as sacolas já foram retiradas pelos clientes.',
                activeBadge: 'RETIRADA',
                instruction: '👉 COPIE O TELEFONE DO CLIENTE E AVISE QUE O PEDIDO ESTÁ PRONTO'
            }
        };

        Object.entries(nativeMapping).forEach(([stageKey, conf]) => {
            const el = document.querySelector(conf.selector);
            if (!el) return;

            const list = groups[stageKey] || [];
            el.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            el.style.borderRadius = '14px';

            const titleEl = el.querySelector('.description h3');
            if (titleEl) titleEl.innerText = conf.numberedTitle;

            let infoBox = el.querySelector('.oms-native-info-box');
            if (!infoBox) {
                infoBox = document.createElement('div');
                infoBox.className = 'oms-native-info-box';
                infoBox.style.cssText = `
                    margin-top: 12px; padding: 0; background: none !important;
                    border: none !important; box-shadow: none !important;
                    font-family: 'Outfit', sans-serif; text-align: left;
                    z-index: 5; transition: all 0.3s ease; width: 100%;
                `;
                el.appendChild(infoBox);
            }

            let badge = el.querySelector('.oms-native-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'oms-native-badge';
                badge.style.cssText = `
                    position: absolute; top: 12px; right: 18px;
                    font-size: 9px; font-weight: 900; padding: 4px 10px;
                    border-radius: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                    z-index: 10; font-family: 'Outfit', sans-serif;
                    letter-spacing: 0.5px; transition: all 0.3s ease;
                `;
                el.style.position = 'relative';
                el.appendChild(badge);
            }

            if (list.length > 0) {
                let temUrgente = false;
                if (stageKey === 'WAITING' || stageKey === 'PICKING') {
                    temUrgente = list.some(o => {
                        const delivery = parseDeliveryInfo(o);
                        const sla = getSLAInfo(o.createdAt, delivery.isExpress);
                        return sla.urgency >= 2;
                    });
                } else {
                    temUrgente = list.some(o => {
                        const bottleneck = getBottleneckInfo(o);
                        return bottleneck && bottleneck.isCritical;
                    });
                }

                if (temUrgente) {
                    el.style.border = '3px solid #ff3e3e';
                    el.style.boxShadow = '0 0 25px rgba(255, 62, 62, 0.8), inset 0 0 15px rgba(255, 62, 62, 0.2)';
                    el.classList.add('oms-pulse-red-container');
                    el.classList.remove('oms-pulse-normal-container');
                } else {
                    el.style.border = `3px solid ${conf.color}`;
                    el.style.boxShadow = `0 0 18px ${conf.color}aa, inset 0 0 8px ${conf.color}33`;
                    el.classList.add('oms-pulse-normal-container');
                    el.classList.remove('oms-pulse-red-container');
                }

                badge.innerText = temUrgente ? `${list.length} 🚨` : `${list.length}`;
                badge.style.background = temUrgente ? '#ff3e3e' : conf.color;
                badge.style.color = '#000';
                badge.style.boxShadow = temUrgente ? '0 0 10px rgba(255,62,62,0.5)' : `0 0 10px ${conf.color}55`;

                let checklistHtml = '';
                const steps = STAGE_STEPS[stageKey] || [];
                steps.forEach((stepText, index) => {
                    const stepKey = `${stageKey}_${index}`;
                    const isChecked = checklistState[stepKey] === true;
                    checklistHtml += `
                        <div class="oms-checklist-item">
                            <span class="oms-checklist-checkbox ${isChecked ? 'checked' : ''}"
                                  style="--stage-color:${conf.color};"
                                  data-checkbox-key="${stepKey}">
                                ${isChecked ? '✓' : ''}
                            </span>
                            <span style="${isChecked ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${stepText}</span>
                        </div>
                    `;
                });

                let subMetricHtml = '';
                if (stageKey === 'WAITING' || stageKey === 'PICKING') {
                    let mostUrgentSLA = null;
                    list.forEach(o => {
                        const delivery = parseDeliveryInfo(o);
                        const sla = getSLAInfo(o.createdAt, delivery.isExpress);
                        if (!mostUrgentSLA || sla.urgency > mostUrgentSLA.urgency || (sla.urgency === mostUrgentSLA.urgency && sla.minutes < mostUrgentSLA.minutes)) {
                            mostUrgentSLA = sla;
                        }
                    });
                    subMetricHtml = `⏱️ URGENTE: <span style="color:${mostUrgentSLA.urgency >= 2 ? '#ff3e3e' : '#00ff88'}; font-weight: 900;">${mostUrgentSLA.text}</span>`;
                } else if (stageKey === 'SEND_READY_PICKUP') {
                    let minDays = 999;
                    let minDaysText = '';
                    list.forEach(o => {
                        const now = new Date();
                        const readyDate = new Date(o.updatedAt || o.createdAt || now);
                        const limitMs = 15 * 24 * 60 * 60 * 1000;
                        const diffMs = (readyDate.getTime() + limitMs) - now.getTime();
                        const diffDays = diffMs / (24 * 60 * 60 * 1000);
                        if (diffDays < minDays) {
                            minDays = diffDays;
                            if (diffDays <= 0) {
                                minDaysText = `🚨 EXPIRADO!`;
                            } else if (diffDays < 1) {
                                minDaysText = `⚠️ ÚLTIMO DIA (${Math.ceil(diffDays * 24)}h rest.)`;
                            } else {
                                minDaysText = `⏳ ${Math.floor(diffDays)} DIAS REST.`;
                            }
                        }
                    });
                    subMetricHtml = `🏪 MAIS ANTIGO: <span style="color:${minDays < 4 ? '#ff3e3e' : '#ff7979'}; font-weight: 900;">${minDaysText}</span>`;
                } else {
                    let totalAtrasados = 0;
                    list.forEach(o => {
                        const bottleneck = getBottleneckInfo(o);
                        if (bottleneck && bottleneck.isCritical) totalAtrasados++;
                    });
                    subMetricHtml = `⚠️ GARGALOS: <span style="color:${totalAtrasados > 0 ? '#ff3e3e' : '#00ff88'}; font-weight: 900;">${totalAtrasados}</span>`;
                }

                const actionLabels = {
                    'WAITING': '📂 VER PENDENTES',
                    'PICKING': '⚡ BIPAR PRODUTOS',
                    'INVOICING': '🧾 CONFERIR NOTAS',
                    'CHECKED': '📦 EMBALAR PEDIDOS',
                    'SEND_READY_DELIVERY': '🚚 GERAR DESPACHO',
                    'SEND_READY_PICKUP': '🏪 ENTREGAR RETIRADA'
                };

                infoBox.innerHTML = `
                    <div style="font-size: 24px; font-weight: 900; color: ${conf.color}; text-shadow: 0 0 12px ${conf.color}33; line-height: 1; letter-spacing: -0.5px;">${list.length} ${list.length === 1 ? 'PEDIDO' : 'PEDIDOS'}</div>
                    <div style="font-size: 11px; font-weight: 700; color: #ffffff; margin-top: 4px; letter-spacing: 0.5px;">${subMetricHtml}</div>
                    <div class="oms-checklist-container">
                        ${checklistHtml}
                    </div>
                    <button class="oms-checklist-btn" style="--stage-color: ${conf.color}; --stage-color-alpha: ${conf.color}33;" data-action-stage="${stageKey}">
                        ${actionLabels[stageKey]}
                    </button>
                `;

            } else {
                // Estado Vazio / Tudo limpo para a etapa
                el.style.border = '2px dashed rgba(255, 255, 255, 0.3)';
                el.style.boxShadow = 'none';
                el.classList.remove('oms-pulse-red-container', 'oms-pulse-normal-container');

                badge.innerText = conf.emptyBadge;
                badge.style.background = 'rgba(255,255,255,0.06)';
                badge.style.color = '#ffffff';
                badge.style.boxShadow = 'none';

                infoBox.innerHTML = `
                    <div style="font-size: 15px; font-weight: 900; color: #ffffff; opacity: 0.85; margin-top: 5px; text-transform: uppercase; letter-spacing: 0.5px; text-shadow: 0 0 10px rgba(255,255,255,0.25);">${conf.emptyTitle}</div>
                    <div style="font-size: 11px; color: #ffffff; opacity: 0.6; line-height: 1.35; margin-top: 5px; font-weight: 700;">${conf.emptySub}</div>
                `;
            }
        });
    }

    // --- RENDERIZADOR DO PAINEL DRAWER LATERAL DE SUPORTE ---
    function renderSupportDashboard(groups) {
        lastGroupsData = groups;
        const priority = analyzeSystemPriority(groups);

        let html = '';
        if (priority.stage) {
            html += `
                <div class="oms-drawer-priority-card" style="
                    background: rgba(255, 255, 255, 0.04);
                    border-left: 4px solid ${priority.color};
                    border-radius: 10px; padding: 12px 14px; margin-bottom: 12px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    display: flex; flex-direction: column; gap: 6px;
                ">
                    <div style="font-size:9px; font-weight:900; color:rgba(255,255,255,0.4); letter-spacing:1px; text-transform:uppercase;">🎯 PRÓXIMO PASSO RECOMENDADO</div>
                    <div style="font-size:12px; font-weight:900; color:#fff; display:flex; align-items:center; gap:6px;">
                        <span style="display:inline-block; width:6px; height:6px; background:${priority.color}; border-radius:50%; box-shadow:0 0 6px ${priority.color}"></span>
                        ${priority.title}
                    </div>
                    <div style="font-size:10.5px; color:rgba(255,255,255,0.7); font-weight:500; line-height:1.3;">${priority.desc}</div>
                    <button class="oms-drawer-priority-btn" style="
                        background: ${priority.color}; color: #000; border: none;
                        padding: 6px 12px; border-radius: 6px; font-size: 10px;
                        font-weight: 900; cursor: pointer; text-transform: uppercase;
                        letter-spacing: 0.5px; width: 100%; transition: all 0.2s ease;
                        margin-top: 4px; box-shadow: 0 3px 8px ${priority.color}44;
                        text-align: center;
                    ">${priority.actionLabel}</button>
                </div>
            `;
        }

        Object.entries(STAGES_CONFIG).forEach(([stageKey, conf]) => {
            const list = groups[stageKey] || [];
            const isOpen = activeStageKey === stageKey;

            let stageClass = conf.class;
            if (list.length > 0) stageClass += ' has-items';

            html += `
                <div class="support-stage-row ${stageClass} ${isOpen ? 'active' : ''}" data-stage-key="${stageKey}">
                    <div class="stage-label-group">
                        <span class="stage-icon">${conf.icon}</span>
                        <span class="stage-title">${conf.label}</span>
                    </div>
                    <span class="stage-count-badge">${list.length}</span>
                </div>
                <div class="stage-detail-panel ${isOpen ? 'open' : ''}">
            `;

            if (list.length === 0) {
                html += `<div class="support-no-orders">Nenhum pedido nesta fila.</div>`;
            } else {
                list.forEach(o => {
                    const delivery = parseDeliveryInfo(o);
                    const bottleneck = getBottleneckInfo(o);
                    const sla = getSLAInfo(o.createdAt, delivery.isExpress);

                    let cardClass = sla.cardClass;
                    let bottleneckHtml = '';

                    if (bottleneck) {
                        cardClass = 'bg-card-vermelho';
                        bottleneckHtml = `<div class="support-bottleneck-label" style="background:${bottleneck.color}22; color:${bottleneck.color}; border: 1px solid ${bottleneck.color}44">⚠️ ${bottleneck.label}</div>`;
                    }

                    let slaTextHtml = '';
                    if (stageKey === 'WAITING' || stageKey === 'PICKING') {
                        slaTextHtml = `<span style="font-weight:900; font-size:11px; color:${sla.urgency >= 2 ? '#ff3e3e' : '#00ff88'}">${sla.text}</span>`;
                    } else {
                        const now = new Date();
                        const updated = new Date(o.updatedAt || o.createdAt || now);
                        const mins = Math.floor((now - updated) / 60000);
                        slaTextHtml = `<span style="color:#aaa; font-weight:700">⏳ ${mins}M ATIVO</span>`;
                    }

                    let idHtml = `<span class="support-card-id" data-copy-id="${o.id}">#${o.id}</span>`;
                    if (stageKey === 'SEND_READY_PICKUP') {
                        // Para Lista de Retirada, não coloca data-copy-id para que o clique propague e navegue diretamente ao pedido em vez de copiar!
                        idHtml = `<span class="support-card-id" style="text-decoration: underline; cursor: pointer;">#${o.id}</span>`;
                    }

                    html += `
                        <div class="support-order-card" data-detail-url="${o.detailUrl || ''}">
                            <div class="support-card-row">
                                ${idHtml}
                                ${slaTextHtml}
                            </div>
                            <div class="support-card-row" style="margin-top:6px;">
                                <span class="support-card-desc" style="color:${delivery.isExpress ? 'var(--neon-red)' : 'var(--neon-blue)'}">${delivery.label}</span>
                                <span class="support-card-items">📦 ${o.itemsCount} ${o.itemsCount === 1 ? 'item' : 'itens'}</span>
                            </div>
                            ${bottleneckHtml}
                            <div class="support-card-customer" style="margin-top:5px; border-top:1px solid rgba(255,255,255,0.03); padding-top:4px;">
                                👤 ${o.customer}
                            </div>
                        </div>
                    `;
                });
            }

            html += `</div>`;
        });

        // Injeta um Guia de Operação Rápida no rodapé do Drawer para colaboradores novos
        html += `
            <div class="oms-drawer-guide-card" style="
                background: rgba(255, 255, 255, 0.02);
                border: 1px dashed rgba(255, 255, 255, 0.08);
                border-radius: 10px; padding: 10px 12px; margin-top: 15px;
                font-family: 'Outfit', sans-serif;
            ">
                <details>
                    <summary style="font-size: 10px; font-weight: 900; color: var(--neon-blue); cursor: pointer; display: flex; align-items: center; gap: 5px; user-select: none;">
                        📘 GUIA DE OPERAÇÃO RÁPIDA (COLLAB)
                    </summary>
                    <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px; font-size: 10px; color: rgba(255,255,255,0.75); line-height: 1.45;">
                        <div>
                            <b style="color:#00ff88">📥 1. PENDENTES:</b><br>
                            Imprima a lista de separação no Instore e colete as mercadorias no estoque físico da loja.
                        </div>
                        <div>
                            <b style="color:#f1c40f">🔍 2. SEPARAÇÃO:</b><br>
                            Utilize o leitor de código de barras para bipar e certificar que coletou o produto correto.
                        </div>
                        <div>
                            <b style="color:#3498db">🧾 3. FATURAMENTO:</b><br>
                            Notas fiscais devem emitir automaticamente. Se travar por mais de 1 min, avise o gerente imediatamente!
                        </div>
                        <div>
                            <b style="color:#e67e22">📦 4. PREPARAR ENTREGA:</b><br>
                            Confira os itens, embale na caixa ou sacola correta e cole a etiqueta de envio na embalagem.
                        </div>
                        <div>
                            <b style="color:#9b59b6">🚚 5-A. DESPACHO:</b><br>
                            Entregue para as transportadoras (Uber, Correios) e emita a lista de despacho nativa do sistema.
                        </div>
                        <div>
                            <b style="color:#ff3e3e">🏪 5-B. RETIRADA:</b><br>
                            Guarde na gôndola de retirada e copie o WhatsApp para notificar que a sacola está pronta para coleta.
                        </div>
                    </div>
                </details>
            </div>
        `;

        dashContent.innerHTML = html;

        // --- ASSOCIAÇÃO DE EVENTOS DE CLIQUE E LIFECYCLE DO DRAWER ---
        const rows = dashContent.querySelectorAll('.support-stage-row');
        rows.forEach(row => {
            row.onclick = () => {
                const key = row.dataset.stageKey;
                activeStageKey = (activeStageKey === key) ? null : key;
                renderSupportDashboard(groups);
            };
        });

        // 1. Clique para copiar ID do pedido
        const copyTriggers = dashContent.querySelectorAll('[data-copy-id]');
        copyTriggers.forEach(el => {
            el.onclick = (e) => {
                e.stopPropagation();
                const text = el.dataset.copyId;
                navigator.clipboard.writeText(text).then(() => {
                    playCopyBeep();
                    toast.classList.add('show');
                    setTimeout(() => toast.classList.remove('show'), 2000);
                });
            };
        });

        // 2. Clique no card para navegar ao pedido nativo
        const cards = dashContent.querySelectorAll('.support-order-card');
        cards.forEach(card => {
            card.onclick = () => {
                const url = card.dataset.detailUrl;
                if (url) {
                    window.location.href = url;
                }
            };
        });
    }

    // --- REQUISIÇÕES DA API LINX OMS ---
    async function apiFetch(statuses) {
        const activeStoreId = getDynamicStoreId() || LOJA_ID;
        const base = 'https://instore.linxoms.com.br/api/proxy/order-ms/clients/rihappy/fulfillments?';
        const filter = `filterGroups[1][filters][0][property]=locationId&filterGroups[1][filters][0][condition]=eq&filterGroups[1][filters][0][value]=${activeStoreId}` +
                       `&filterGroups[1][filters][1][property]=status&filterGroups[1][filters][1][operation]=whereIn&` +
                       statuses.map(s => `filterGroups[1][filters][1][value][]=${s}`).join('&');

        try {
            const r = await fetch(base + filter + `&includes[]=order&pageSize=100&_nocache=${Date.now()}`);
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

    // --- CONTROLLER PRINCIPAL DE DADOS (SYNC) ---
    async function check() {
        let newList = [];

        // Consulta paralela assíncrona
        const [d1, d2, d3] = await Promise.all([
            apiFetch(['WAITING']),
            apiFetch(['SEND_READY', 'PICKUP_READY', 'PICKUP_PAID']),
            apiFetch(['PICKING','CHECKED','INVOICING','INVOICING_FAIL'])
        ]);

        const processData = (data) => {
            if (data?.data) {
                data.data.forEach(o => {
                    let orderBaseId = o.order?.id || o.order?.code || o.orderId;
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

                    const apiCarrier = o.carrier?.tradingName || o.carrier?.companyName || o.order?.carrier?.tradingName || '';
                    const apiDeliveryType = o.shipment?.method || o.freightMethod?.name || '';

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

                    let detailUrl = '';
                    if (o.id && o.orderId) {
                        detailUrl = 'https://instore.linxoms.com.br' + getOrderDetailsUrl(`${o.orderId}-${o.id}`);
                    } else if (finalId) {
                        detailUrl = 'https://instore.linxoms.com.br' + getOrderDetailsUrl(finalId);
                    }

                    newList.push({
                        id: finalId,
                        createdAt: o.createdAt || o.order?.createdAt,
                        updatedAt: o.updatedAt,
                        customer: o.customer?.fullName || o.order?.customer?.fullName || '---',
                        deliveryType: deliveryFallback.label,
                        carrier: apiCarrier || domInfo.carrier || '',
                        statusNativo: o.status || o.fulfillmentStatus || 'WAITING',
                        isExpress: deliveryFallback.isExpress,
                        isPickup: isPickupOrder,
                        itemsCount: o.items?.length || o.totalItems || 1,
                        detailUrl: detailUrl
                    });
                });
            }
        };

        processData(d1);
        processData(d2);
        processData(d3);

        pedidosAtivosAtuais = newList;

        // Distribuição nos 6 grupos operacionais do grid
        const groups = {
            'WAITING': [], 'PICKING': [], 'INVOICING': [], 'CHECKED': [],
            'SEND_READY_DELIVERY': [], 'SEND_READY_PICKUP': []
        };

        newList.forEach(o => {
            const k = o.statusNativo;
            if (groups[k]) {
                groups[k].push(o);
                return;
            }
            if (k === 'INVOICING_FAIL') {
                groups['INVOICING'].push(o);
                return;
            }
            if (k === 'SEND_READY' || k === 'PICKUP_READY' || k === 'PICKUP_PAID') {
                if (o.isPickup || k === 'PICKUP_READY' || k === 'PICKUP_PAID') {
                    groups['SEND_READY_PICKUP'].push(o);
                } else {
                    groups['SEND_READY_DELIVERY'].push(o);
                }
                return;
            }
        });

        // Ordenação de prioridade (SLA mais curto primeiro)
        const sortSLA = (a, b) => {
            const da = parseDeliveryInfo(a);
            const db = parseDeliveryInfo(b);
            const sa = getSLAInfo(a.createdAt, da.isExpress);
            const sb = getSLAInfo(b.createdAt, db.isExpress);
            return sa.urgency !== sb.urgency ? sb.urgency - sa.urgency : sa.minutes - sb.minutes;
        };

        groups['WAITING'].sort(sortSLA);
        groups['PICKING'].sort(sortSLA);

        // --- NOTIFICAÇÕES SONORAS INTELIGENTES ---
        const currentWaitingCount = groups['WAITING']?.length || 0;
        if (currentWaitingCount > lastWaitingCount && lastWaitingCount !== 0) {
            playNewOrderChime();
        }
        lastWaitingCount = currentWaitingCount;

        let maxUrgencySeen = 0;
        newList.forEach(o => {
            const dev = parseDeliveryInfo(o);
            const sla = getSLAInfo(o.createdAt, dev.isExpress);
            if (sla.urgency > maxUrgencySeen) {
                maxUrgencySeen = sla.urgency;
            }
        });
        if (maxUrgencySeen > lastCheckedUrgency && lastCheckedUrgency !== 0) {
            if (maxUrgencySeen >= 2) {
                playCriticalChime();
            }
        }
        lastCheckedUrgency = maxUrgencySeen;

        // Atualização da UI
        updateNativeDOMAlerts(groups);
        renderSupportDashboard(groups);
        updateTopStepper(groups);
    }

    // --- PARSER DE DATAS E HORAS RESILIENTE ---
    function parseDate(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.trim().split(/[\s/:]+/);
        if (parts.length < 3) return null;
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const hour = parts[3] ? parseInt(parts[3], 10) : 12;
        const min = parts[4] ? parseInt(parts[4], 10) : 0;
        return new Date(year, month, day, hour, min);
    }

    // --- INJEÇÃO DE AVISOS NA PÁGINA INTERNA DE DETALHES DO PEDIDO ---
    function injectOrderPageAlert() {
        if (document.getElementById('oms-expiration-alert')) return;

        const resumeEl = document.querySelector('.order-resume');
        if (!resumeEl) return;

        const isPickup = document.body.innerText.toLowerCase().includes('retirada') ||
                          document.querySelector('.order-status.pickup_ready') !== null;
        if (!isPickup) return;

        let readyDate = null;

        const textElements = Array.from(resumeEl.querySelectorAll('td, span, div, p, li'));
        textElements.forEach(el => {
            const txt = el.innerText || '';
            if (txt.includes('Data de entrega cliente:')) {
                const val = txt.replace('Data de entrega cliente:', '').trim();
                readyDate = parseDate(val);
            }
        });

        if (!readyDate) {
            const steps = document.querySelectorAll('.order-history-step');
            steps.forEach(step => {
                const statusEl = step.querySelector('.order-history-status');
                const dateEl = step.querySelector('.lead');
                if (statusEl && dateEl && statusEl.innerText.toLowerCase().includes('separação')) {
                    readyDate = parseDate(dateEl.innerText);
                }
            });
        }

        if (!readyDate) {
            textElements.forEach(el => {
                const txt = el.innerText || '';
                if (txt.includes('Compra:')) {
                    const val = txt.replace('Compra:', '').trim();
                    readyDate = parseDate(val);
                }
            });
        }

        if (!readyDate) return;

        const now = new Date();
        const diffTime = Math.abs(now - readyDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let alertColor = 'var(--neon-green)';
        let alertBg = 'rgba(0, 255, 136, 0.03)';
        let alertText = `Este pedido está na loja há <b>${diffDays} dias</b> (desde a separação em ${readyDate.toLocaleDateString()}).`;
        let isCritical = false;

        if (diffDays >= 11) {
            alertColor = 'var(--neon-red)';
            alertBg = 'rgba(255, 62, 62, 0.04)';
            alertText = `🚨 <b>CRÍTICO:</b> Este pedido está na loja há <b>${diffDays} dias</b> e corre <b>alto risco de cancelamento automático</b> (limite de 15 dias)!`;
            isCritical = true;
        } else if (diffDays >= 6) {
            alertColor = 'var(--neon-orange)';
            alertBg = 'rgba(230, 126, 34, 0.04)';
            alertText = `⚠️ <b>ATENÇÃO:</b> Este pedido está na loja há <b>${diffDays} dias</b> (separado em ${readyDate.toLocaleDateString()}).`;
        }

        // Tentar obter dados reais via AngularJS da tela de pedido
        let customerName = "";
        let phone = "";
        try {
            if (typeof angular !== 'undefined') {
                const el = angular.element(resumeEl);
                const scope = el.scope();
                if (scope) {
                    const fulfillment = scope.fulfillment || scope.order?.fulfillment || scope.order || scope.item?.fulfillmentItem;
                    const customer = fulfillment?.customer || fulfillment?.order?.customer || scope.customer;
                    if (customer) {
                        customerName = customer.fullName || customer.name || "";
                        phone = customer.phoneMobile || customer.phone || customer.mobilePhone || "";
                        if (!phone && Array.isArray(customer.phones)) {
                            phone = customer.phones[0]?.number || (customer.phones[0]?.ddd ? String(customer.phones[0].ddd) + String(customer.phones[0].number) : "");
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("[OMS Premium] Error reading order details scope:", e);
        }

        // Fallback DOM para telefone se necessário
        if (!phone) {
            const phoneMatch = document.body.innerText.match(/\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}/);
            if (phoneMatch) {
                phone = phoneMatch[0].replace(/\D/g, '');
            }
        }

        // Fallback DOM para nome se necessário
        if (!customerName || customerName === "CLIENTE" || customerName.length > 50 || customerName.includes('\n')) {
            // 1. Tentar buscar pelo relacionamento direto DT (Nome) + DD no container da Linx
            const parentDl = document.querySelector('dl.dl-horizontal.dl-second-col');
            if (parentDl) {
                const children = Array.from(parentDl.children);
                for (let i = 0; i < children.length - 1; i++) {
                    if (children[i].tagName === 'DT' && children[i].innerText.toLowerCase().includes('nome')) {
                        const nextSibling = children[i + 1];
                        if (nextSibling && nextSibling.tagName === 'DD') {
                            const nameVal = nextSibling.innerText.trim();
                            if (nameVal && nameVal.length > 2 && nameVal.length < 50 && !/\d/.test(nameVal)) {
                                customerName = nameVal;
                                break;
                            }
                        }
                    }
                }
            }

            // 2. Fallback secundário: buscar em tags <dd> excluindo CPF, e-mail e telefones
            if (!customerName || customerName === "CLIENTE" || customerName.length > 50 || customerName.includes('\n')) {
                const dds = Array.from(document.querySelectorAll('dd.ng-binding, dl dd, dd'));
                for (const dd of dds) {
                    const text = dd.innerText.trim();
                    if (text && text.length > 2 && text.length < 50 && !text.includes('@') && !/\d/.test(text)) {
                        customerName = text;
                        break;
                    }
                }
            }
        }

        if (!customerName || customerName === "CLIENTE" || customerName.length > 50 || customerName.includes('\n')) {
            const bodyText = document.body.innerText;
            // 2. Procura pelo padrão "DADOS DO CLIENTE [NOME] CPF:"
            const match1 = bodyText.match(/DADOS DO CLIENTE\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]{3,50}?)\s+(?:CPF|E-mail|Telefone)/i);
            if (match1 && match1[1] && !match1[1].includes('\n')) {
                customerName = match1[1].trim();
            } else {
                // 3. Procura pelo padrão "Cliente: [NOME]" ou "Nome: [NOME]" em linhas simples
                const match2 = bodyText.match(/(?:Cliente|Nome):\s*([A-Za-zÀ-ÖØ-öø-ÿ\s]{3,40})/i);
                if (match2 && match2[1] && !match2[1].includes('\n')) {
                    customerName = match2[1].trim();
                } else {
                    // 4. Fallback seguro buscando elementos menores no DOM (excluindo containers gigantes)
                    const tds = Array.from(resumeEl.querySelectorAll('td, span, p, div'));
                    for (let i = 0; i < tds.length; i++) {
                        const el = tds[i];
                        if (el.children.length > 0) continue;
                        const text = el.innerText || '';
                        if (text.toLowerCase().includes('cliente:') || text.toLowerCase().includes('nome:')) {
                            const nameVal = text.replace(/(cliente:|nome:)/gi, '').trim();
                            if (nameVal && nameVal.length > 2 && nameVal.length < 50 && !nameVal.includes('\n')) {
                                customerName = nameVal;
                                break;
                            }
                        }
                    }
                }
            }
        }
        if (!customerName) {
            const h1 = document.querySelector('h1, h2, .order-title');
            if (h1 && !h1.innerText.includes('Pedido')) {
                customerName = h1.innerText.trim();
            }
        }
        if (!customerName) {
            customerName = "CLIENTE";
        }

        // Extrai ID do Pedido robustamente
        const orderIdMatch = window.location.href.match(/orders\/([^\/]+)(?:\/fulfillments\/([^\/]+))?/);
        let fullOrderId = "";
        if (orderIdMatch) {
            const orderCode = orderIdMatch[1];
            const fulfillmentId = orderIdMatch[2];
            fullOrderId = fulfillmentId ? `${orderCode}-${fulfillmentId}` : orderCode;
        }

        const alertDiv = document.createElement('div');
        alertDiv.id = 'oms-expiration-alert';
        alertDiv.style.cssText = `
            background: rgba(15, 23, 42, 0.95) !important;
            border: 2.5px solid ${alertColor} !important;
            border-radius: 16px !important;
            padding: 24px !important;
            margin: 25px 0 !important;
            font-family: 'Outfit', sans-serif !important;
            box-shadow: 0 12px 32px rgba(0,0,0,0.3) !important;
            transition: all 0.3s ease !important;
            position: relative;
            overflow: hidden;
            animation: ${isCritical ? 'pulseRedBorder 1.5s infinite ease-in-out' : 'none'} !important;
        `;

        // Conteúdo formatado de forma premium
        let contentHtml = `
            <div style="font-size: 16px; font-weight: 900; color: ${alertColor}; margin-bottom: 12px; letter-spacing: 0.5px; text-transform: uppercase; display: flex; align-items: center; gap: 8px;">
                ${isCritical ? '🚨 ALERTA DE CANCELAMENTO AUTOMÁTICO!' : '🏪 STATUS DE RETIRADA DO CLIENTE'}
            </div>

            <div style="font-size: 13px; color: rgba(255,255,255,0.9); margin-bottom: 20px; font-weight: 700; line-height: 1.5;">
                ${alertText}
            </div>

            <!-- Painel de Informações do Cliente -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 16px;">
                    <div style="font-size: 10px; color: rgba(255,255,255,0.5); font-weight: 900; text-transform: uppercase; margin-bottom: 4px;">👤 Nome do Cliente</div>
                    <div style="font-size: 13px; color: #ffffff; font-weight: 900; text-transform: uppercase;">${customerName}</div>
                </div>

                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 16px;">
                    <div style="font-size: 10px; color: rgba(255,255,255,0.5); font-weight: 900; text-transform: uppercase; margin-bottom: 4px;">📦 Código do Pedido</div>
                    <div style="font-size: 13px; color: #38bdf8; font-weight: 900;">${fullOrderId || 'N/A'}</div>
                </div>

                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 16px;">
                    <div style="font-size: 10px; color: rgba(255,255,255,0.5); font-weight: 900; text-transform: uppercase; margin-bottom: 4px;">⏳ Dias Decorridos</div>
                    <div style="font-size: 13px; color: ${alertColor}; font-weight: 900;">${diffDays} dias na loja</div>
                </div>
            </div>

            <div style="background: rgba(255,62,62,0.06); border: 1px dashed rgba(255,62,62,0.3); padding: 14px; border-radius: 10px; color: #ff8b8b; font-weight: 700; font-size: 11.5px; letter-spacing: 0.3px; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 20px;">
                📢 ENVIOU O AVISO AO CLIENTE? Os pedidos ficam no máximo 15 dias na loja antes do cancelamento automático.
            </div>
        `;

        alertDiv.innerHTML = contentHtml;

        // Botões de Ação Centralizados e Premium
        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'display: flex; gap: 12px; justify-content: center; margin-top: 20px; flex-wrap: wrap;';

        let whatsappHtml = '';
        if (phone) {
            const formattedPhone = phone.startsWith('55') ? phone : '55' + phone;
            whatsappHtml = `
                <a href="https://wa.me/${formattedPhone}?text=Ol%C3%A1%2C%20seu%20pedido%20da%20Ri%20Happy%20est%C3%A1%20pronto%20para%20retirada%20na%20nossa%20loja%21%20Aguardamos%20sua%20visita."
                   target="_blank"
                   style="background: #25d366; color: #ffffff !important; font-weight: 900; padding: 10px 20px; border-radius: 8px; font-size: 11px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #1ebea5; font-family: 'Outfit', sans-serif; box-shadow: 0 4px 12px rgba(37,211,102,0.3); transition: all 0.2s ease; text-transform: uppercase;">
                   💬 CHAMAR NO WHATSAPP
                </a>
            `;
        }

        let copyIdHtml = '';
        if (fullOrderId) {
            copyIdHtml = `
                <button id="oms-order-detail-copy-btn"
                        style="background: rgba(255, 255, 255, 0.08); color: #ffffff !important; border: 1px solid rgba(255, 255, 255, 0.2); font-size: 11px; font-weight: 900; padding: 10px 20px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; font-family: 'Outfit', sans-serif; display: inline-flex; align-items: center; gap: 8px;">
                   📋 COPIAR ID PEDIDO (${fullOrderId})
                </button>
            `;
        }

        actionsDiv.innerHTML = whatsappHtml + copyIdHtml;
        alertDiv.appendChild(actionsDiv);

        const copyBtn = actionsDiv.querySelector('#oms-order-detail-copy-btn');
        if (copyBtn && fullOrderId) {
            copyBtn.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(fullOrderId).then(() => {
                    playCopyBeep();
                    copyBtn.innerHTML = '✅ ID COPIADO!';
                    copyBtn.style.borderColor = 'var(--neon-green)';
                    copyBtn.style.color = 'var(--neon-green) !important';
                    setTimeout(() => {
                        copyBtn.innerHTML = `📋 COPIAR ID PEDIDO (${fullOrderId})`;
                        copyBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        copyBtn.style.color = '#ffffff !important';
                    }, 1500);
                });
            };
        }

        resumeEl.parentNode.insertBefore(alertDiv, resumeEl);
    }

    // --- GERADORES DE ALERTAS GLOBAIS DE TOPO DE TELA ---
    function injectSelectionTopAlert(expiredCount, warningCount) {
        let alertEl = document.getElementById('oms-selection-top-alert');
        if (expiredCount === 0 && warningCount === 0) {
            if (alertEl) alertEl.remove();
            return;
        }

        const container = document.querySelector('.page-content, .panel, .table-responsive, table')?.parentElement;
        if (!container) return;

        if (!alertEl) {
            alertEl = document.createElement('div');
            alertEl.id = 'oms-selection-top-alert';
            container.insertBefore(alertEl, container.firstChild);
        }

        let alertColor = 'var(--neon-orange)';
        let alertBg = 'rgba(230, 126, 34, 0.08)';
        let alertText = `⚠️ <b>ATENÇÃO:</b> Existem <b>${warningCount} pedidos</b> com tempo de separação crítico (menos de 30 minutos restantes)!`;
        let isCritical = false;

        if (expiredCount > 0) {
            alertColor = 'var(--neon-red)';
            alertBg = 'rgba(255, 62, 62, 0.1)';
            alertText = `🚨 <b>CRÍTICO:</b> Existem <b>${expiredCount} pedidos com tempo de separação VENCIDO</b>! Priorize a coleta destes itens imediatamente para evitar perda de SLA!`;
            isCritical = true;
        }

        alertEl.style.cssText = `
            background: ${alertBg} !important; border: 2.5px solid ${alertColor} !important;
            border-radius: 12px !important; padding: 18px 24px !important; margin: 15px 0 !important;
            font-family: 'Outfit', sans-serif !important; text-align: center !important;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2) !important; transition: all 0.3s ease !important;
            animation: ${isCritical ? 'pulseRedBorder 1.5s infinite ease-in-out' : 'none'} !important;
        `;

        alertEl.innerHTML = `
            <div style="font-size: 15px; font-weight: 900; color: ${alertColor}; margin-bottom: 6px; letter-spacing: 0.5px; text-transform: uppercase;">
                ${isCritical ? '🚨 ALERTA DE SEPARAÇÃO CRÍTICA!' : '⚠️ ALERTA DE COLETA PENDENTE'}
            </div>
            <div style="font-size: 13px; color: #ffffff; font-weight: 700;">
                ${alertText}
            </div>
        `;
    }

    function injectPickupTopAlert(expiredCount, warningCount) {
        let alertEl = document.getElementById('oms-pickup-top-alert');
        if (expiredCount === 0 && warningCount === 0) {
            if (alertEl) alertEl.remove();
            return;
        }

        const container = document.querySelector('.page-content, .panel, .table-responsive, table')?.parentElement;
        if (!container) return;

        if (!alertEl) {
            alertEl = document.createElement('div');
            alertEl.id = 'oms-pickup-top-alert';
            container.insertBefore(alertEl, container.firstChild);
        }

        let alertColor = 'var(--neon-orange)';
        let alertBg = 'rgba(230, 126, 34, 0.08)';
        let alertText = `⚠️ <b>ATENÇÃO:</b> Existem <b>${warningCount} pedidos</b> aguardando retirada há mais de 6 dias. Convém contatar os clientes.`;
        let isCritical = false;

        if (expiredCount > 0) {
            alertColor = 'var(--neon-red)';
            alertBg = 'rgba(255, 62, 62, 0.1)';
            alertText = `🚨 <b>CRÍTICO:</b> Existem <b>${expiredCount} pedidos aguardando retirada há mais de 11 dias</b>! Alto risco de cancelamento automático (limite de 15 dias). Entre em contato urgente!`;
            isCritical = true;
        }

        alertEl.style.cssText = `
            background: ${alertBg} !important; border: 2.5px solid ${alertColor} !important;
            border-radius: 12px !important; padding: 18px 24px !important; margin: 15px 0 !important;
            font-family: 'Outfit', sans-serif !important; text-align: center !important;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2) !important; transition: all 0.3s ease !important;
            animation: ${isCritical ? 'pulseRedBorder 1.5s infinite ease-in-out' : 'none'} !important;
        `;

        alertEl.innerHTML = `
            <div style="font-size: 15px; font-weight: 900; color: ${alertColor}; margin-bottom: 6px; letter-spacing: 0.5px; text-transform: uppercase;">
                ${isCritical ? '🚨 ALERTA DE CANCELAMENTO DE RETIRADA!' : '⚠️ ALERTA DE RETIRADA PENDENTE'}
            </div>
            <div style="font-size: 13px; color: #ffffff; font-weight: 700;">
                ${alertText}
            </div>
        `;
    }

    // --- FILTROS DE CATEGORIA E BUSCA DA TELA DE RETIRADA ---
    function injectPickupLegend(container) {
        if (document.getElementById('oms-pickup-legend-bar')) return;

        const legendBar = document.createElement('div');
        legendBar.id = 'oms-pickup-legend-bar';
        legendBar.style.cssText = `
            background: rgba(20, 20, 20, 0.95);
            border: 2px dashed rgba(255, 255, 255, 0.1);
            border-radius: 12px; padding: 14px 20px; margin: 15px 0;
            font-family: 'Outfit', sans-serif; box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        `;

        legendBar.innerHTML = `
            <details>
                <summary style="font-size: 11px; font-weight: 900; color: var(--neon-blue); cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;">
                    📘 GUIA RÁPIDO DE OPERAÇÃO DA TELA DE RETIRADA (Clique para expandir)
                </summary>
                <div style="margin-top: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; font-size: 11px; color: rgba(255,255,255,0.7); line-height: 1.45;">
                    <div>
                        <strong style="color:var(--neon-green)">🟢 NO PRAZO (0-5 DIAS):</strong><br>
                        Pacote recém-armazenado. Deixe na gôndola e aguarde a retirada natural pelo cliente.
                    </div>
                    <div>
                        <strong style="color:var(--neon-orange)">⚠️ ATENÇÃO (6-10 DIAS):</strong><br>
                        Clique no botão verde <b>💬 Chamar WhatsApp</b> para enviar um lembrete amigável e facilitar o comparecimento.
                    </div>
                    <div>
                        <strong style="color:var(--neon-red)">🚨 URGENTE (≥11 DIAS):</strong><br>
                        Risco iminente de cancelamento automático. Ligue para o cliente e tente salvar a venda!
                    </div>
                </div>
            </details>
        `;

        container.parentNode.insertBefore(legendBar, container);
    }

    function applyActivePickupFilter() {
        const activeBtn = document.querySelector('.oms-pickup-filter-btn.active');
        if (!activeBtn) return;

        const filterValue = activeBtn.dataset.filter;
        const rows = document.querySelectorAll('table tbody tr');

        rows.forEach(row => {
            if (!row.dataset.omsDays) {
                row.style.display = '';
                return;
            }
            const days = parseInt(row.dataset.omsDays);

            if (filterValue === 'all') {
                row.style.display = '';
            } else if (filterValue === 'urgent') {
                row.style.display = (days >= 11) ? '' : 'none';
            } else if (filterValue === 'warning') {
                row.style.display = (days >= 6 && days < 11) ? '' : 'none';
            } else if (filterValue === 'normal') {
                row.style.display = (days < 6) ? '' : 'none';
            }
        });
    }

    function injectPickupFilters(container) {
        if (document.getElementById('oms-pickup-filter-bar')) return;

        const filterBar = document.createElement('div');
        filterBar.id = 'oms-pickup-filter-bar';
        filterBar.style.cssText = `
            background: rgba(20, 20, 20, 0.95);
            border: 2px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px; padding: 12px 20px; margin: 15px 0;
            font-family: 'Outfit', sans-serif; display: flex; align-items: center;
            justify-content: space-between; gap: 15px; flex-wrap: wrap;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        `;

        filterBar.innerHTML = `
            <div style="font-size: 11px; font-weight: 900; color: rgba(255, 255, 255, 0.6); letter-spacing: 1px; text-transform: uppercase;">
                🔍 Filtrar Lista
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="oms-pickup-filter-btn active" data-filter="all" style="
                    background: rgba(255, 255, 255, 0.2); color: #fff; border: 1px solid rgba(255, 255, 255, 0.5);
                    padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 900; cursor: pointer; transition: all 0.2s;
                    font-family: 'Outfit', sans-serif;
                ">Todos</button>
                <button class="oms-pickup-filter-btn" data-filter="urgent" style="
                    background: rgba(255, 62, 62, 0.05); color: var(--neon-red); border: 1px solid rgba(255, 62, 62, 0.2);
                    padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 900; cursor: pointer; transition: all 0.2s;
                    font-family: 'Outfit', sans-serif;
                ">🚨 Urgente (≥11 dias)</button>
                <button class="oms-pickup-filter-btn" data-filter="warning" style="
                    background: rgba(230, 126, 34, 0.05); color: var(--neon-orange); border: 1px solid rgba(230, 126, 34, 0.2);
                    padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 900; cursor: pointer; transition: all 0.2s;
                    font-family: 'Outfit', sans-serif;
                ">⚠️ Atenção (6-10 dias)</button>
                <button class="oms-pickup-filter-btn" data-filter="normal" style="
                    background: rgba(0, 255, 136, 0.05); color: var(--neon-green); border: 1px solid rgba(0, 255, 136, 0.2);
                    padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 900; cursor: pointer; transition: all 0.2s;
                    font-family: 'Outfit', sans-serif;
                ">✅ No Prazo (0-5 dias)</button>
            </div>
        `;

        container.parentNode.insertBefore(filterBar, container);

        // Adicionar eventos de filtragem nos botões
        const btns = filterBar.querySelectorAll('.oms-pickup-filter-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                btns.forEach(b => {
                    b.style.background = '';
                    b.style.color = '';
                    b.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    b.classList.remove('active');
                });
                btn.classList.add('active');

                // Aplicar estilo de botão ativo sólido e chamativo
                if (btn.dataset.filter === 'all') {
                    btn.style.background = 'rgba(255, 255, 255, 0.2)';
                    btn.style.color = '#ffffff';
                    btn.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                } else if (btn.dataset.filter === 'urgent') {
                    btn.style.background = 'var(--neon-red)';
                    btn.style.color = '#000000';
                    btn.style.borderColor = 'var(--neon-red)';
                } else if (btn.dataset.filter === 'warning') {
                    btn.style.background = 'var(--neon-orange)';
                    btn.style.color = '#000000';
                    btn.style.borderColor = 'var(--neon-orange)';
                } else if (btn.dataset.filter === 'normal') {
                    btn.style.background = 'var(--neon-green)';
                    btn.style.color = '#000000';
                    btn.style.borderColor = 'var(--neon-green)';
                }

                applyActivePickupFilter();
                playCopyBeep();
            });
        });
    }

    // --- DESTAQUE PREMIUM NA LISTA NATIVA DE RETIRADAS ---
    function enhancePickupListPage() {
        if (!window.location.href.includes('/fulfillments/pickup')) return;

        const table = document.querySelector('table');
        if (table && !table.classList.contains('oms-pickup-table')) {
            table.classList.add('oms-pickup-table');
            const panel = table.closest('.panel, .page-content');
            if (panel) panel.classList.add('oms-pickup-panel');
        }

        const rows = document.querySelectorAll('table tbody tr');
        if (rows.length === 0) return;

        // Resilient Date Parser
        function parseResilientDate(text) {
            if (!text) return null;

            // Tenta dd/mm/yyyy hh:mm ou dd/mm/yyyy
            let m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (m) {
                return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10), 12, 0);
            }

            // Tenta dd/mm/yy hh:mm ou dd/mm/yy
            m = text.match(/(\d{2})\/(\d{2})\/(\d{2})/);
            if (m) {
                return new Date(2000 + parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10), 12, 0);
            }

            return null;
        }

        const now = new Date();
        let expiredCount = 0;
        let warningCount = 0;

        rows.forEach(row => {
            const cells = row.cells;
            if (cells.length < 2) return;

            // 1. Busca robusta e persistente do ID do Pedido (Código)
            let orderId = row.dataset.omsOrderId;
            if (!orderId) {
                // Tenta encontrar o padrão padrão com hífen (ex: 1187-293849 ou v35656227rihp-01)
                for (let i = 0; i < cells.length; i++) {
                    const text = cells[i].innerText.trim();
                    const match = text.match(/([a-zA-Z0-9]+-[a-zA-Z0-9]+)/);
                    if (match) {
                        orderId = match[1];
                        break;
                    }
                }

                // Se não encontrar, busca qualquer número longo sequencial (6 a 15 dígitos)
                if (!orderId) {
                    for (let i = 0; i < cells.length; i++) {
                        const text = cells[i].innerText.trim();
                        const match = text.match(/(\d{6,15})/);
                        if (match) {
                            orderId = match[1];
                            break;
                        }
                    }
                }

                // Fallback absoluto
                if (!orderId) {
                    orderId = cells[1]?.innerText.trim().split('\n')[0] || "PEDIDO";
                }

                row.dataset.omsOrderId = orderId;
            }

            // Verificar se os badges visuais já estão presentes na linha
            const hasSlaBadge = row.querySelector('.oms-sla-badge');
            const hasOrderIdBadge = row.querySelector('.oms-copy-id-btn');

            // Evitar reprocessamento caso o badge de SLA e do pedido já estejam criados e injetados
            if (row.dataset.omsProcessedId === orderId && hasSlaBadge && hasOrderIdBadge) {
                // Mas certifique-se de contar para os alertas no topo
                const diffDays = parseInt(row.dataset.omsDays || "0", 10);
                if (diffDays >= 11) {
                    expiredCount++;
                } else if (diffDays >= 6) {
                    warningCount++;
                }
                return;
            }

            // 2. Busca robusta da Data do Pedido
            let orderDate = null;
            for (let i = cells.length - 1; i >= 0; i--) {
                const parsed = parseResilientDate(cells[i].innerText);
                if (parsed) {
                    orderDate = parsed;
                    break;
                }
            }

            // Se falhar a data, assume hoje para não quebrar a exibição
            if (!orderDate) {
                orderDate = new Date();
            }

            const diffTime = Math.abs(now - orderDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            row.dataset.omsDays = diffDays;
            row.dataset.omsProcessedId = orderId;

            if (diffDays >= 11) {
                expiredCount++;
            } else if (diffDays >= 6) {
                warningCount++;
            }

            // Cores e preenchimento sólido de destaque da linha
            let rowBg = '#122218'; // Verde Escuro Floresta Sólido
            let borderColor = 'var(--neon-green)';
            let badgeText = `✅ NO PRAZO: ${diffDays} DIAS`;
            let badgeBg = 'rgba(0, 255, 136, 0.85)'; // Sólido preenchido
            let badgeColor = '#000000'; // Letras pretas em fundo verde brilhante
            let isUrgent = false;

            if (diffDays >= 11) {
                rowBg = '#2a1717'; // Vermelho Tijolo Escuro Sólido
                borderColor = 'var(--neon-red)';
                badgeText = `🚨 URGENTE! CONTATO URGENTE: ${diffDays} DIAS`;
                badgeBg = '#ff3e3e'; // Sólido vermelho
                badgeColor = '#ffffff'; // Letras brancas
                isUrgent = true;
            } else if (diffDays >= 6) {
                rowBg = '#281b10'; // Laranja Bronze Escuro Sólido
                borderColor = 'var(--neon-orange)';
                badgeText = `⚠️ ATENÇÃO: CONTATAR CLIENTE (${diffDays} DIAS)`;
                badgeBg = '#e67e22'; // Sólido laranja
                badgeColor = '#ffffff'; // Letras brancas
            }

            // Aplicar realce às células
            for (let i = 0; i < cells.length; i++) {
                cells[i].style.setProperty('background', rowBg, 'important');
                cells[i].style.setProperty('color', '#ffffff', 'important');
                cells[i].style.setProperty('font-weight', '700', 'important');
                cells[i].style.transition = 'all 0.3s ease';
            }
            cells[0].style.setProperty('box-shadow', `inset 8px 0 0 ${borderColor}`, 'important');
            cells[0].style.setProperty('border-left', `1px solid ${borderColor}`, 'important');

            // A. Criar o Badge de SLA de Retirada (Sólido e Preenchido!)
            const badge = document.createElement('div');
            badge.className = 'oms-sla-badge';
            badge.style.cssText = `
                background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${borderColor};
                padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 900;
                text-align: center; letter-spacing: 0.3px; font-family: 'Outfit', sans-serif;
                box-shadow: 0 4px 10px rgba(0,0,0,0.15); display: inline-block;
                animation: ${isUrgent ? 'pulseRedBorder 1.5s infinite ease-in-out' : 'none'};
            `;
            badge.innerText = badgeText;

            // B. Criar o Badge de Pedido Interativo que copia ao clicar
            const orderIdBadge = document.createElement('button');
            orderIdBadge.className = 'oms-copy-id-btn';
            orderIdBadge.style.cssText = `
                background: rgba(255, 255, 255, 0.12); color: #ffffff !important;
                border: 1px solid rgba(255, 255, 255, 0.35); font-size: 10px;
                font-weight: 900; padding: 4px 8px; border-radius: 6px;
                cursor: pointer; transition: all 0.2s ease;
                font-family: 'Outfit', sans-serif; display: inline-flex; align-items: center;
                gap: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 4px;
            `;
            orderIdBadge.innerHTML = `📦 Pedido: ${orderId}`;

            orderIdBadge.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(orderId).then(() => {
                    playCopyBeep();
                    orderIdBadge.innerHTML = '✅ Copiado!';
                    orderIdBadge.style.borderColor = 'var(--neon-green)';
                    orderIdBadge.style.color = 'var(--neon-green) !important';
                    setTimeout(() => {
                        orderIdBadge.innerHTML = `📦 Pedido: ${orderId}`;
                        orderIdBadge.style.borderColor = 'rgba(255, 255, 255, 0.35)';
                        orderIdBadge.style.color = '#ffffff !important';
                    }, 1500);
                });
            };

            // C. Obter nome do cliente e telefone via AngularJS ou DOM de forma altamente resiliente
            let customerName = "CLIENTE";
            let phone = "";
            let contactDetails = "";

            const angData = getAngularData(row);
            if (angData) {
                if (angData.customerName) {
                    customerName = angData.customerName;
                }
                if (angData.phone) {
                    phone = angData.phone;
                }
            }

            // Fallback para buscar telefone no DOM caso não venha do Angular
            if (!phone) {
                for (let i = 0; i < cells.length; i++) {
                    const text = cells[i].innerText.trim();
                    const phoneMatch = text.match(/\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}/);
                    if (phoneMatch) {
                        phone = phoneMatch[0].replace(/\D/g, '');
                        break;
                    }
                }
            }

            // Fallback para buscar nome do cliente no DOM (célula de telefone/detalhes do cliente)
            let realCustomerCell = null;
            if (phone) {
                // Apenas assume célula do cliente se de fato possuir telefone
                for (let i = 0; i < cells.length; i++) {
                    if (cells[i].innerText.includes(phone)) {
                        realCustomerCell = cells[i];
                        break;
                    }
                }
            }

            if (customerName === "CLIENTE") {
                // Busca nome na primeira célula candidata que não seja data ou ID de pedido
                let candidateCell = realCustomerCell || cells[1] || cells[0];
                if (candidateCell && candidateCell !== cells[1]) {
                    // NÃO limpamos/modificamos cells[1] (descrição) para não quebrar a lista nativa de produtos!
                    if (!candidateCell.dataset.omsOriginalText) {
                        candidateCell.dataset.omsOriginalText = candidateCell.innerText.trim();
                    }
                    const originalText = candidateCell.dataset.omsOriginalText;
                    const textLines = originalText.split('\n').map(l => l.trim()).filter(Boolean);

                    const candidateName = textLines[0];
                    if (candidateName && !candidateName.includes('/') && !candidateName.includes(':') && !candidateName.includes(orderId)) {
                        customerName = candidateName;
                    }
                    contactDetails = textLines.slice(1).filter(line => !line.includes(orderId) && (!line.includes('-') || !/\d+-\d+/.test(line))).join('\n').trim();
                }
            }

            // D. Formatar célula de contato se for uma célula real de cliente (excluindo cells[1] de descrição nativa!)
            if (realCustomerCell && realCustomerCell !== cells[1]) {
                if (!realCustomerCell.dataset.omsOriginalText) {
                    realCustomerCell.dataset.omsOriginalText = realCustomerCell.innerText.trim();
                }
                realCustomerCell.innerHTML = '';
                const containerDiv = document.createElement('div');
                containerDiv.style.cssText = 'display: flex; flex-direction: column; gap: 4px; align-items: flex-start;';

                if (contactDetails) {
                    const detailsEl = document.createElement('div');
                    detailsEl.className = 'oms-customer-details';
                    detailsEl.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.85); line-height: 1.35; font-weight: 700; margin: 2px 0;';
                    detailsEl.innerText = contactDetails;
                    containerDiv.appendChild(detailsEl);
                }

                realCustomerCell.appendChild(containerDiv);
            }

            // E. Encontrar a célula de Marcadores baseando-se no cabeçalho ou fallback
            let marcadoresCell = null;
            try {
                const tableEl = row.closest('table');
                if (tableEl) {
                    const headers = Array.from(tableEl.querySelectorAll('thead th')).map(th => th.innerText.trim().toLowerCase());
                    const idx = headers.indexOf('marcadores');
                    if (idx !== -1) {
                        marcadoresCell = cells[idx];
                    }
                }
            } catch (e) {}

            if (!marcadoresCell) {
                // Fallback para buscar ul.list-tags de primeiro nível (não aninhado em sub-tabelas)
                marcadoresCell = Array.from(cells).find(c => {
                    const ul = c.querySelector('ul.list-tags');
                    return ul && !ul.closest('table table'); // Ignora list-tags dentro de sub-tabelas
                }) || cells[2];
            }

            if (marcadoresCell) {
                if (!marcadoresCell.dataset.omsOriginalHtml) {
                    marcadoresCell.dataset.omsOriginalHtml = marcadoresCell.innerHTML;
                }

                marcadoresCell.innerHTML = '';
                const tagsWrapper = document.createElement('div');
                tagsWrapper.style.cssText = `
                    display: flex; flex-direction: column; gap: 6px; align-items: flex-start;
                `;

                // 1. Nome do Cliente
                const clientNameEl = document.createElement('div');
                clientNameEl.className = 'oms-customer-name-tag';
                clientNameEl.style.cssText = 'font-size: 11px; color: #ffffff; font-weight: 900; font-family: "Outfit", sans-serif; text-transform: uppercase; letter-spacing: 0.3px;';
                clientNameEl.innerHTML = `👤 ${customerName}`;
                tagsWrapper.appendChild(clientNameEl);

                // 2. Número do Pedido Click-to-Copy
                tagsWrapper.appendChild(orderIdBadge);

                // 4. Botão "Ver no IHP"
                const viewIhpBtn = document.createElement('a');
                viewIhpBtn.className = 'oms-view-ihp-btn';
                viewIhpBtn.href = getOrderDetailsUrl(orderId);
                viewIhpBtn.style.cssText = `
                    background: rgba(56, 189, 248, 0.15); color: #38bdf8 !important;
                    border: 1px solid rgba(56, 189, 248, 0.4); font-size: 10px;
                    font-weight: 900; padding: 4px 8px; border-radius: 6px;
                    text-decoration: none; display: inline-flex; align-items: center;
                    gap: 5px; font-family: 'Outfit', sans-serif;
                    transition: all 0.2s ease;
                `;
                viewIhpBtn.innerHTML = `🔍 Ver no IHP`;
                viewIhpBtn.onmouseover = () => {
                    viewIhpBtn.style.background = 'rgba(56, 189, 248, 0.3)';
                    viewIhpBtn.style.boxShadow = '0 0 8px rgba(56, 189, 248, 0.4)';
                };
                viewIhpBtn.onmouseout = () => {
                    viewIhpBtn.style.background = 'rgba(56, 189, 248, 0.15)';
                    viewIhpBtn.style.boxShadow = 'none';
                };
                tagsWrapper.appendChild(viewIhpBtn);

                // 5. Bloco Dinâmico de WhatsApp Templates
                if (phone) {
                    const formattedPhone = phone.startsWith('55') ? phone : '55' + phone;
                    const waContainer = document.createElement('div');
                    waContainer.style.cssText = 'display: flex; gap: 4px; align-items: center; margin-top: 4px; flex-wrap: wrap; max-width: 210px;';

                    const waLabel = document.createElement('span');
                    waLabel.style.cssText = 'font-size: 8px; font-weight: 900; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.5px; display: block; width: 100%; margin-bottom: 2px;';
                    waLabel.innerText = 'Notificar WhatsApp:';
                    waContainer.appendChild(waLabel);

                    const templates = [
                        { name: '💬 Novo', text: `Olá! Seu pedido da Ri Happy está pronto para retirada na loja! Aguardamos sua visita.`, color: '#25d366', border: 'rgba(37,211,102,0.4)' },
                        { name: '⚠️ Lembrete', text: `Olá! Passando para lembrar que seu pedido da Ri Happy está pronto na nossa loja há alguns dias. Evite o cancelamento automático! Aguardamos sua visita.`, color: '#e67e22', border: 'rgba(230,126,34,0.4)' },
                        { name: '🚨 Crítico', text: `Atenção! Seu pedido da Ri Happy está disponível para retirada no último prazo. Para evitar a devolução e cancelamento do pedido, por favor compareça à loja o quanto antes.`, color: '#ff3e3e', border: 'rgba(255,62,62,0.4)' }
                    ];

                    templates.forEach(tpl => {
                        const btn = document.createElement('a');
                        btn.className = 'oms-whatsapp-btn';
                        btn.href = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(tpl.text)}`;
                        btn.target = '_blank';
                        btn.style.cssText = `
                            background: rgba(255,255,255,0.03); color: ${tpl.color} !important; font-weight: 900;
                            padding: 3px 6px; border-radius: 4px; font-size: 9px;
                            text-decoration: none; display: inline-flex; align-items: center;
                            gap: 2px; border: 1px solid ${tpl.border}; font-family: 'Outfit', sans-serif;
                            transition: all 0.2s ease;
                        `;
                        btn.innerText = tpl.name;
                        btn.onmouseover = () => {
                            btn.style.background = tpl.color;
                            btn.style.color = '#000000';
                        };
                        btn.onmouseout = () => {
                            btn.style.background = 'rgba(255,255,255,0.03)';
                            btn.style.color = tpl.color;
                        };
                        waContainer.appendChild(btn);
                    });
                    tagsWrapper.appendChild(waContainer);
                }

                // 6. SLA Badge
                tagsWrapper.appendChild(badge);

                marcadoresCell.appendChild(tagsWrapper);
            }

            row.dataset.omsHighlighted = "true";
        });

        // Injeta o alerta de topo no topo da tabela ou seção de conteúdo de retirada
        injectPickupTopAlert(expiredCount, warningCount);

        // Injeta a barra de filtros logo acima da tabela
        const topAlert = document.getElementById('oms-pickup-top-alert');
        if (topAlert) {
            injectPickupFilters(topAlert);
            injectPickupLegend(topAlert);
        } else {
            const tableWrapper = document.querySelector('.table-responsive') || table;
            if (tableWrapper) {
                injectPickupFilters(tableWrapper);
                injectPickupLegend(tableWrapper);
            }
        }

        // Aplica o filtro ativo para garantir que novos registros respeitem a seleção atual
        applyActivePickupFilter();
    }

    function updateTopStepper(groups) {
        const gridParent = document.querySelector('.oms-grid-parent');
        if (!gridParent) return;

        // Destaque dinâmico do card nativo de despacho (.shipping.step-box)
        const despachoBox = document.querySelector('.shipping.step-box');
        if (despachoBox) {
            const dispatchList = groups['SEND_READY_DELIVERY'] || [];
            if (dispatchList.length > 0) {
                // Piscando em vermelho
                despachoBox.style.setProperty('border', '2.5px solid var(--neon-red)', 'important');
                despachoBox.style.setProperty('animation', 'pulseRedBorder 1.2s infinite ease-in-out', 'important');
                despachoBox.style.setProperty('background', 'rgba(255, 62, 62, 0.08)', 'important');
            } else {
                // Verde sem piscar
                despachoBox.style.setProperty('border', '2px solid var(--neon-green)', 'important');
                despachoBox.style.setProperty('animation', 'none', 'important');
                despachoBox.style.setProperty('background', 'rgba(0, 255, 136, 0.05)', 'important');
            }
        }

        let stepper = document.getElementById('oms-operator-stepper');
        if (!stepper) {
            stepper = document.createElement('div');
            stepper.id = 'oms-operator-stepper';
            gridParent.parentNode.insertBefore(stepper, gridParent);
        }

        const priority = analyzeSystemPriority(groups);

        let stepsHtml = '';
        Object.entries(STAGES_CONFIG).forEach(([stageKey, conf], index) => {
            const list = groups[stageKey] || [];
            const isActive = priority.stage === stageKey;

            const badgeColor = list.length > 0 ? conf.color : 'rgba(255, 255, 255, 0.05)';
            const borderGlow = isActive ? `border-color: ${conf.color} !important; box-shadow: 0 0 15px ${conf.color}aa !important;` : '';

            stepsHtml += `
                <div class="oms-stepper-step ${isActive ? 'active-step' : ''}" style="${borderGlow} --neon-color: ${conf.color}; --neon-color-alpha: ${conf.color}33;" data-step-key="${stageKey}">
                    <span class="oms-stepper-step-num">ETAPA ${index + 1}</span>
                    <span class="oms-stepper-step-label">${conf.icon} ${conf.label}</span>
                    ${list.length > 0 ? `<span class="oms-stepper-step-badge" style="background:${conf.color} !important; box-shadow:0 0 8px ${conf.color}88 !important;">${list.length}</span>` : ''}
                </div>
            `;

            if (index < Object.keys(STAGES_CONFIG).length - 1) {
                stepsHtml += `<span class="oms-stepper-connector">➔</span>`;
            }
        });

        const activeColor = priority.color || 'var(--neon-green)';

        stepper.className = 'oms-stepper-container';
        stepper.innerHTML = `
            <div class="oms-stepper-title">
                <span>🚦 ESTADO DO FLUXO LOGÍSTICO DA LOJA</span>
                <span style="color:${activeColor}; font-weight:900;">FOCO: ${priority.title}</span>
            </div>
            <div class="oms-stepper-steps">
                ${stepsHtml}
            </div>
            <div class="oms-stepper-action-banner" style="--accent-color: ${activeColor}; --accent-color-alpha: ${activeColor}22;">
                <div class="oms-stepper-action-info">
                    <span class="oms-stepper-action-title">🎯 AÇÃO RECOMENDADA</span>
                    <span class="oms-stepper-action-desc">${priority.desc}</span>
                </div>
                ${priority.stage ? `<button class="oms-stepper-action-btn" data-action-stage="${priority.stage}">${priority.actionLabel}</button>` : ''}
            </div>
        `;
    }

    function updateScannerStatusBadge() {
        if (!window.location.href.includes('/selection')) {
            const existing = document.getElementById('oms-scanner-status-badge');
            if (existing) existing.remove();
            return;
        }

        let badge = document.getElementById('oms-scanner-status-badge');
        const scannerInput = document.querySelector('input[placeholder*="barra"], input[placeholder*="Bipe"], input[ng-model*="barcode"], input[name*="barcode"], #barcode-input');

        if (!scannerInput) {
            if (badge) badge.remove();
            return;
        }

        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'oms-scanner-status-badge';
            badge.style.cssText = `
                position: fixed; bottom: 20px; right: 20px; z-index: 99999;
                font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 900;
                padding: 10px 16px; border-radius: 30px; letter-spacing: 0.8px;
                display: flex; align-items: center; gap: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            `;
            document.body.appendChild(badge);
        }

        const isFocused = document.activeElement === scannerInput;
        if (isFocused) {
            badge.style.background = 'rgba(0, 255, 136, 0.95)';
            badge.style.color = '#000000';
            badge.style.border = '2px solid #00ff88';
            badge.style.boxShadow = '0 0 20px rgba(0, 255, 136, 0.4)';
            badge.innerHTML = `<span style="display:inline-block; width:8px; height:8px; background:#000; border-radius:50%; animation: pulseNormalBorder 1s infinite alternate;"></span> LEITOR ATIVO (PRONTO PARA BIPAR)`;
        } else {
            badge.style.background = 'rgba(255, 62, 62, 0.95)';
            badge.style.color = '#ffffff';
            badge.style.border = '2px solid #ff3e3e';
            badge.style.boxShadow = '0 0 20px rgba(255, 62, 62, 0.4)';
            badge.innerHTML = `⚠️ CLIQUE NA TELA PARA REATIVAR O LEITOR`;
        }
    }

    function analyzeSystemPriority(groups) {
        if (!groups) return { title: 'TUDO EM DIA', desc: '', stage: null, color: '#00ff88', actionLabel: 'Dashboard', url: '/' };

        // 1. Faturamento Travado/Falhou
        const invoicingOrders = groups['INVOICING'] || [];
        const invoicingFail = invoicingOrders.some(o => o.statusNativo === 'INVOICING_FAIL');
        const invoicingSlow = invoicingOrders.some(o => {
            const diff = (new Date() - new Date(o.updatedAt || o.createdAt)) / 60000;
            return diff > 10;
        });
        if (invoicingFail) {
            return {
                title: '❌ FATURAMENTO TRAVADO (ERRO FISCAL)',
                desc: 'Há pedidos com falha na emissão da Nota Fiscal. Verifique com a gerência!',
                stage: 'INVOICING',
                color: '#ff3e3e',
                actionLabel: 'Ver Faturamento',
                url: '/'
            };
        }
        if (invoicingSlow) {
            return {
                title: '🧾 FATURAMENTO LENTO (>10 MIN)',
                desc: 'Há pedidos aguardando faturamento há muito tempo. Possível instabilidade fiscal.',
                stage: 'INVOICING',
                color: '#3498db',
                actionLabel: 'Ver Faturamento',
                url: '/'
            };
        }

        // 2. Separação ou Pendentes Críticos
        const pickingOrders = groups['PICKING'] || [];
        const waitingOrders = groups['WAITING'] || [];
        const allPendingColeta = [...pickingOrders, ...waitingOrders];

        let mostUrgentOrder = null;
        let highestUrgency = 0;
        let lowestMinutes = 999;

        allPendingColeta.forEach(o => {
            const dev = parseDeliveryInfo(o);
            const sla = getSLAInfo(o.createdAt, dev.isExpress);
            if (sla.urgency > highestUrgency || (sla.urgency === highestUrgency && sla.minutes < lowestMinutes)) {
                highestUrgency = sla.urgency;
                lowestMinutes = sla.minutes;
                mostUrgentOrder = o;
            }
        });

        if (highestUrgency >= 2 && mostUrgentOrder) {
            const dev = parseDeliveryInfo(mostUrgentOrder);
            const stage = mostUrgentOrder.statusNativo === 'PICKING' ? 'PICKING' : 'WAITING';
            return {
                title: highestUrgency === 3 ? '🔥 SLA CRÍTICO DE SEPARAÇÃO!' : '⚠️ PRAZO APERTADO DE SEPARAÇÃO',
                desc: `Pedido #${mostUrgentOrder.id} (${dev.label}) vence em ${lowestMinutes} min!`,
                stage: stage,
                color: highestUrgency === 3 ? '#ff3e3e' : '#e67e22',
                actionLabel: stage === 'PICKING' ? 'Ir para Separação' : 'Ver Pendentes',
                url: stage === 'PICKING' ? '/selection' : '/'
            };
        }

        // 3. Despacho Atrasado
        const shippingOrders = groups['SEND_READY_DELIVERY'] || [];
        const shippingSlow = shippingOrders.some(o => {
            const diff = (new Date() - new Date(o.updatedAt || o.createdAt)) / 60000;
            return diff > 60;
        });
        if (shippingSlow && shippingOrders.length > 0) {
            return {
                title: '🚚 EXPEDIÇÃO EM ROTA LENTA',
                desc: `Existem ${shippingOrders.length} volumes prontos aguardando lista de despacho!`,
                stage: 'SEND_READY_DELIVERY',
                color: '#9b59b6',
                actionLabel: 'Gerar Despacho',
                url: '/'
            };
        }

        // 4. Checked/Conferido Atrasado (Falta Embalar)
        const checkedOrders = groups['CHECKED'] || [];
        const checkedSlow = checkedOrders.some(o => {
            const diff = (new Date() - new Date(o.updatedAt || o.createdAt)) / 60000;
            return diff > 15;
        });
        if (checkedSlow && checkedOrders.length > 0) {
            return {
                title: '📦 PENDENTE EMBALAGEM / ETIQUETA',
                desc: `Existem ${checkedOrders.length} pedidos conferidos aguardando embalagem há mais de 15 minutos.`,
                stage: 'CHECKED',
                color: '#e67e22',
                actionLabel: 'Abrir Preparação',
                url: '/'
            };
        }

        // 5. Pedidos Novos Pendentes
        if (waitingOrders.length > 0) {
            return {
                title: '📥 NOVOS PEDIDOS PENDENTES',
                desc: `Há ${waitingOrders.length} novos pedidos pendentes. Imprima a lista e colete os itens!`,
                stage: 'WAITING',
                color: '#00ff88',
                actionLabel: 'Ver Pendentes',
                url: '/'
            };
        }

        // 6. Retirada Crítica (Expirada / Último Dia)
        const pickupOrders = groups['SEND_READY_PICKUP'] || [];
        let expiredPickupCount = 0;
        let warningPickupCount = 0;

        pickupOrders.forEach(o => {
            const readyDate = new Date(o.updatedAt || o.createdAt);
            const diffDays = (new Date() - readyDate) / (1000 * 60 * 60 * 24);
            if (diffDays >= 11) expiredPickupCount++;
            else if (diffDays >= 6) warningPickupCount++;
        });

        if (expiredPickupCount > 0) {
            return {
                title: '🚨 RETIRADA COM ALTO RISCO DE CANCELAMENTO',
                desc: `Há ${expiredPickupCount} pedidos aguardando retirada há mais de 11 dias! Contate urgente.`,
                stage: 'SEND_READY_PICKUP',
                color: '#ff3e3e',
                actionLabel: 'Chamar Clientes',
                url: '/fulfillments/pickup'
            };
        }

        if (warningPickupCount > 0) {
            return {
                title: '⚠️ RETIRADAS PENDENTES HÁ MAIS DE 6 DIAS',
                desc: `Existem ${warningPickupCount} sacolas aguardando retirada há mais de 6 dias. Contate os clientes!`,
                stage: 'SEND_READY_PICKUP',
                color: '#e67e22',
                actionLabel: 'Ver Retiradas',
                url: '/fulfillments/pickup'
            };
        }

        if (pickupOrders.length > 0) {
            return {
                title: '🏪 RETIRADAS DISPONÍVEIS',
                desc: `Existem ${pickupOrders.length} sacolas prontas para serem retiradas pelos clientes na loja.`,
                stage: 'SEND_READY_PICKUP',
                color: '#ff3e3e',
                actionLabel: 'Ver Retiradas',
                url: '/fulfillments/pickup'
            };
        }

        // 7. Tudo limpo
        return {
            title: '🎉 OPERAÇÃO IMPECÁVEL E EM DIA!',
            desc: 'Todas as filas estão zeradas ou faturadas no prazo. Excelente trabalho!',
            stage: null,
            color: '#00ff88',
            actionLabel: 'Ver Dashboard',
            url: '/'
        };
    }

    function handleRouting() {
        // Sincroniza estado da folha de estilo e do drawer lateral em tempo real (sempre ativado)
        const styleEl = document.getElementById('oms-premium-global-stylesheet');
        if (styleEl) {
            styleEl.disabled = false;
        }
        const drawerEl = document.getElementById('oms-premium-side-drawer');
        if (drawerEl) {
            drawerEl.style.display = 'block';
        }

        const url = window.location.href;
        if (url.includes('/orders/') && url.includes('/fulfillments/')) {
            document.body.classList.add('oms-order-page-active');
            injectOrderPageAlert();
        } else {
            document.body.classList.remove('oms-order-page-active');
        }
        if (url.includes('/fulfillments/pickup')) {
            enhancePickupListPage();
        }
        if (url.includes('/selection')) {
            if (localStorage.getItem('oms-selection-stepper-enabled') === 'false') {
                localStorage.setItem('oms-selection-stepper-enabled', 'true');
            }
            enhanceSelectionPage();
        }
        updateScannerStatusBadge();
    }

    function highlightActiveSelectionStage() {
        const headerContainer = document.querySelector('#accordions');
        if (!headerContainer) return;

        const titleEl = headerContainer.querySelector('h1');
        if (!titleEl) return;

        // Separar texto do título original para evitar destruição de referências
        let titleTextSpan = document.getElementById('oms-selection-title-text');
        if (!titleTextSpan) {
            const originalText = titleEl.innerText.trim();
            titleEl.innerHTML = '';
            titleTextSpan = document.createElement('span');
            titleTextSpan.id = 'oms-selection-title-text';
            titleTextSpan.innerText = originalText || 'Seleção';
            titleEl.appendChild(titleTextSpan);
        }

        // Garantir que o botão antigo de alternância de layout seja removido
        const oldToggleBtn = document.getElementById('oms-layout-toggle-btn');
        if (oldToggleBtn) {
            oldToggleBtn.remove();
        }

        // Definir as seções
        const sections = [
            {
                id: 'pickingList',
                title: '1. SEPARAÇÃO',
                selector: '[data-target="#pickingList"]',
                badgeSelector: '[data-target="#pickingList"] .badge',
                color: 'var(--neon-blue)',
                desc: 'Coletar e bipe de produtos',
                icon: '📥',
                instruction: '📥 <b>SEPARAÇÃO ATIVA:</b> Selecione um pedido na lista abaixo ou bipe o código de barras para iniciar a separação física.'
            },
            {
                id: 'billingCheckingList',
                title: '2. FATURAMENTO',
                selector: '[data-target="#billingCheckingList"]',
                badgeSelector: '[data-target="#billingCheckingList"] .badge',
                color: 'var(--neon-orange)',
                desc: 'Verificar NF-e e checkout',
                icon: '🧾',
                instruction: '🧾 <b>FATURAMENTO ATIVO:</b> Realize a emissão fiscal dos pedidos prontos e resolva eventuais pendências de notas.'
            },
            {
                id: 'billedList',
                title: '3. PREPARAR ENTREGA',
                selector: '[data-target="#billedList"]',
                badgeSelector: '[data-target="#billedList"] .badge',
                color: 'var(--neon-green)',
                desc: 'Embalar e colar etiquetas',
                icon: '📦',
                instruction: '📦 <b>PREPARAÇÃO ATIVA:</b> Embale os produtos, imprima as etiquetas de envio e prepare as sacolas para retirada/despacho.'
            }
        ];

        // --- MODO PREMIUM SEMPRE ATIVADO ---
        titleTextSpan.innerText = '🎯 Central de Separação & Faturamento';
        titleTextSpan.style.setProperty('font-size', '20px', 'important');
        titleTextSpan.style.setProperty('font-weight', '900', 'important');
        titleTextSpan.style.setProperty('color', '#1e293b', 'important');

        // Atualizar contadores e estado de expansão
        sections.forEach(s => {
            const badgeEl = document.querySelector(s.badgeSelector);
            s.count = badgeEl ? parseInt(badgeEl.innerText.trim(), 10) || 0 : 0;

            const headerEl = document.querySelector(s.selector);
            s.isExpanded = headerEl ? (headerEl.getAttribute('aria-expanded') === 'true' || !headerEl.classList.contains('collapsed')) : false;

            // Estilizar cabeçalhos
            if (headerEl) {
                headerEl.style.setProperty('transition', 'all 0.3s ease', 'important');
                headerEl.style.setProperty('border-radius', '10px', 'important');
                headerEl.style.setProperty('padding', '14px 20px', 'important');
                headerEl.style.setProperty('margin-bottom', '8px', 'important');
                headerEl.style.setProperty('border', s.isExpanded ? `2px solid ${s.color}` : '1px solid rgba(0, 0, 0, 0.08)', 'important');
                headerEl.style.setProperty('background', s.isExpanded ? 'linear-gradient(135deg, #111827 0%, #1f2937 100%)' : '#f8fafc', 'important');

                const titleTextEl = headerEl.querySelector('h2');
                if (titleTextEl) {
                    titleTextEl.style.setProperty('margin', '0', 'important');
                    titleTextEl.style.setProperty('font-size', '14px', 'important');
                    titleTextEl.style.setProperty('font-weight', '900', 'important');
                    titleTextEl.style.setProperty('color', s.isExpanded ? '#ffffff' : '#334155', 'important');
                }

                const nativeBadge = headerEl.querySelector('.badge');
                if (nativeBadge) {
                    nativeBadge.style.setProperty('background', s.count > 0 ? s.color : 'rgba(0, 0, 0, 0.06)', 'important');
                    nativeBadge.style.setProperty('color', s.count > 0 ? '#000000' : '#475569', 'important');
                    nativeBadge.style.setProperty('font-weight', '900', 'important');
                    nativeBadge.style.setProperty('font-size', '11px', 'important');
                    nativeBadge.style.setProperty('padding', '4px 8px', 'important');
                    nativeBadge.style.setProperty('box-shadow', s.count > 0 ? `0 0 10px ${s.color}` : 'none', 'important');
                }
            }
        });

        // Injetar ou atualizar o Stepper de Controle do Topo
        let topStepper = document.getElementById('oms-selection-top-stepper');
        if (!topStepper) {
            topStepper = document.createElement('div');
            topStepper.id = 'oms-selection-top-stepper';
            headerContainer.insertBefore(topStepper, titleEl.nextSibling);
        }

        if (topStepper) {
            topStepper.style.cssText = `
                display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;
                margin: 15px 0 25px 0; font-family: 'Outfit', sans-serif;
            `;

            topStepper.innerHTML = sections.map((s, index) => {
                const bg = s.isExpanded ? `linear-gradient(135deg, #111827 0%, #1f2937 100%)` : `#f8fafc`;
                const border = s.isExpanded ? `2px solid ${s.color}` : `1px solid rgba(0, 0, 0, 0.08)`;
                const textTitleColor = s.isExpanded ? '#ffffff' : '#334155';
                const textDescColor = s.isExpanded ? 'rgba(255, 255, 255, 0.6)' : '#64748b';
                const glow = s.isExpanded ? `0 4px 15px rgba(0, 0, 0, 0.15)` : `none`;

                return `
                    <div class="oms-stepper-tab" data-stage-id="${s.id}" style="
                        background: ${bg}; border: ${border}; box-shadow: ${glow};
                        padding: 12px 16px; border-radius: 12px; cursor: pointer;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        display: flex; flex-direction: column; justify-content: space-between;
                        position: relative; overflow: hidden; transform: ${s.isExpanded ? 'scale(1.02)' : 'scale(1)'};
                    ">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                            <div>
                                <span style="font-size: 8px; font-weight: 900; color: ${s.color}; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 2px;">Etapa ${index + 1}</span>
                                <span style="font-size: 13px; font-weight: 900; color: ${textTitleColor};">${s.icon} ${s.title.split('. ')[1]}</span>
                            </div>
                            <span style="
                                background: ${s.count > 0 ? s.color : 'rgba(0, 0, 0, 0.06)'};
                                color: ${s.count > 0 ? '#000000' : '#475569'};
                                font-size: 10px; font-weight: 900; padding: 3px 8px; border-radius: 20px;
                                box-shadow: ${s.count > 0 ? `0 0 8px ${s.color}` : 'none'};
                            ">
                                ${s.count} Pedido${s.count !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div style="font-size: 10px; color: ${textDescColor}; font-weight: 700; line-height: 1.3;">
                            ${s.desc}
                        </div>
                        ${s.isExpanded ? `<div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background: ${s.color}; box-shadow: 0 0 10px ${s.color};"></div>` : ''}
                    </div>
                `;
            }).join('');

            topStepper.querySelectorAll('.oms-stepper-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    const stageId = tab.dataset.stageId;
                    const section = sections.find(s => s.id === stageId);
                    if (section) {
                        const headerEl = document.querySelector(section.selector);
                        if (headerEl) {
                            headerEl.click();
                            playCopyBeep();
                            setTimeout(highlightActiveSelectionStage, 350);
                        }
                    }
                });
            });
        }

        // Injetar ou atualizar o guia operacional
        const activeSection = sections.find(s => s.isExpanded);
        if (activeSection) {
            let guideBanner = document.getElementById('oms-selection-guide-banner');
            if (!guideBanner) {
                guideBanner = document.createElement('div');
                guideBanner.id = 'oms-selection-guide-banner';
                topStepper.parentNode.insertBefore(guideBanner, topStepper.nextSibling);
            }

            guideBanner.style.cssText = `
                background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
                border: 2px solid ${activeSection.color};
                border-radius: 12px; padding: 14px 18px; margin: 0 0 20px 0;
                font-family: 'Outfit', sans-serif; box-shadow: 0 8px 20px rgba(0,0,0,0.15);
                color: #ffffff; animation: pulseGlowBorder 2s infinite ease-in-out;
                transition: all 0.3s ease;
            `;

            guideBanner.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 15px;">
                    <div>
                        <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.4); font-weight: 900; margin-bottom: 2px;">Direcionamento Operacional</div>
                        <div style="font-size: 12px; font-weight: 700; color: #ffffff; line-height: 1.45;">
                            ${activeSection.instruction}
                        </div>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 5px 10px; border-radius: 6px; text-align: center; min-width: 120px;">
                        <span style="font-size: 8px; font-weight: 900; display: block; color: rgba(255,255,255,0.5); margin-bottom: 1px;">ETAPA ATUAL</span>
                        <span style="font-size: 10px; font-weight: 900; color: ${activeSection.color}; letter-spacing: 0.5px;">🎯 ${activeSection.title.split('. ')[1]}</span>
                    </div>
                </div>
            `;
        } else {
            const guideBanner = document.getElementById('oms-selection-guide-banner');
            if (guideBanner) guideBanner.remove();
        }
    }

    function enhanceSelectionPage() {
        // Encontra e destaca as abas de etapas ativas com design premium
        highlightActiveSelectionStage();

        const rows = document.querySelectorAll('table tbody tr');
        if (rows.length === 0) return;

        const now = new Date();
        let expiredCount = 0;
        let warningCount = 0;

        rows.forEach(row => {
            const cells = row.cells;
            if (cells.length < 3) return;

            let rowId = cells[0].innerText.trim() + '-' + cells[1].innerText.trim();

            let orderDate = null;
            cells.forEach(cell => {
                const text = cell.innerText.trim();
                const match = text.match(/(\d{2})\/(\d{2})\/(\d{2,4})\s*(\d{2}):(\d{2})/);
                if (match) {
                    const d = parseInt(match[1], 10);
                    const m = parseInt(match[2], 10) - 1;
                    const y = match[3].length === 2 ? 2000 + parseInt(match[3], 10) : parseInt(match[3], 10);
                    const hh = parseInt(match[4], 10);
                    const mm = parseInt(match[5], 10);
                    orderDate = new Date(y, m, d, hh, mm);
                }
            });

            if (orderDate) {
                const limitDate = new Date(orderDate.getTime() + (50 * 60 * 1000)); // Limite de 50 minutos
                const diffMs = limitDate - now;
                if (diffMs <= 0) {
                    expiredCount++;
                } else if (diffMs < 30 * 60 * 1000) {
                    warningCount++;
                }
            }

            if (row.dataset.omsSelectionProcessed === rowId) {
                updateRowCountdown(row);
                return;
            }
            row.dataset.omsSelectionProcessed = rowId;

            let carrierText = '';
            cells.forEach(cell => {
                const text = cell.innerText.trim();
                if (text.toLowerCase().includes('retirada') || text.toLowerCase().includes('uber') || text.toLowerCase().includes('sedex') || text.toLowerCase().includes('entrega')) {
                    carrierText = text;
                }
            });

            const isUber = carrierText.toLowerCase().includes('uber');

            if (isUber) {
                for (let i = 0; i < cells.length; i++) {
                    cells[i].style.setProperty('background', 'rgba(255, 62, 62, 0.08)', 'important');
                    cells[i].style.setProperty('color', '#ffffff', 'important');
                }
                cells[0].style.setProperty('box-shadow', 'inset 8px 0 0 #ff3e3e', 'important');
                cells[0].style.setProperty('border-left', '1px solid #ff3e3e', 'important');

                const idCell = cells[0];
                if (idCell && !idCell.querySelector('.oms-uber-badge')) {
                    const badge = document.createElement('span');
                    badge.className = 'oms-uber-badge';
                    badge.style.cssText = `
                        background: #ff3e3e; color: #fff; font-size: 9px; font-weight: 900;
                        padding: 2px 6px; border-radius: 4px; margin-left: 8px;
                        box-shadow: 0 0 8px rgba(255,62,62,0.4); display: inline-block;
                        vertical-align: middle; font-family: 'Outfit', sans-serif;
                    `;
                    badge.innerText = '⚡ UBER';
                    idCell.appendChild(badge);
                }
            }

            if (orderDate) {
                row.dataset.omsOrderTime = orderDate.getTime();

                let statusCell = cells[cells.length - 1];
                if (statusCell) {
                    let timerBadge = statusCell.querySelector('.oms-sla-timer-badge');
                    if (!timerBadge) {
                        timerBadge = document.createElement('div');
                        timerBadge.className = 'oms-sla-timer-badge';
                        timerBadge.style.cssText = `
                            margin-top: 5px; font-size: 10px; font-weight: 900;
                            padding: 4px 8px; border-radius: 6px; display: inline-block;
                            font-family: 'Outfit', sans-serif; letter-spacing: 0.3px;
                            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
                        `;
                        statusCell.appendChild(timerBadge);
                    }
                }
                updateRowCountdown(row);
            }
        });

        // Injeta o alerta de topo no topo da tabela ou seção de conteúdo de separação
        injectSelectionTopAlert(expiredCount, warningCount);

        // Autofocus Lock no Campo de Entrada do Scanner
        const scannerInput = document.querySelector('input[placeholder*="barra"], input[placeholder*="Bipe"], input[ng-model*="barcode"], input[name*="barcode"], #barcode-input');
        if (scannerInput && !scannerInput.dataset.omsFocused) {
            scannerInput.dataset.omsFocused = "true";

            scannerInput.style.border = '2px solid rgba(0, 255, 136, 0.4)';
            scannerInput.style.boxShadow = '0 0 10px rgba(0, 255, 136, 0.1)';

            scannerInput.addEventListener('focus', updateScannerStatusBadge);
            scannerInput.addEventListener('blur', () => {
                updateScannerStatusBadge();
                setTimeout(() => {
                    const activeEl = document.activeElement;
                    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.closest('.modal-content'))) {
                        return;
                    }
                    scannerInput.focus();
                }, 150);
            });

            scannerInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    playSuccessBeep();
                    showScreenFlash(true);
                }
            });
        }

        // Monitor de Erros Globais do Angular para Bip de Erro (Buzz)
        const errorNotifier = document.querySelector('.alert-danger, .toast-error, .notification-error, [class*="error-message"], .alert-danger-box');
        if (errorNotifier && !errorNotifier.dataset.omsBuzzTriggered) {
            errorNotifier.dataset.omsBuzzTriggered = "true";
            playErrorBuzz();
            showScreenFlash(false);
            setTimeout(() => {
                if (errorNotifier) errorNotifier.dataset.omsBuzzTriggered = "";
            }, 5000);
        }
    }

    function updateRowCountdown(row) {
        const timeVal = row.dataset.omsOrderTime;
        if (!timeVal) return;

        const orderDate = new Date(parseInt(timeVal));
        const now = new Date();

        const limitDate = new Date(orderDate.getTime() + (50 * 60 * 1000)); // Limite de 50 minutos para separação
        const diffMs = limitDate - now;
        const absDiff = Math.abs(diffMs);
        const mins = Math.floor(absDiff / 60000);

        const timerBadge = row.querySelector('.oms-sla-timer-badge');
        if (!timerBadge) return;

        if (diffMs > 0) {
            if (mins >= 30) {
                timerBadge.style.background = 'rgba(0, 255, 136, 0.15)';
                timerBadge.style.color = '#00ff88';
                timerBadge.style.border = '1px solid rgba(0, 255, 136, 0.3)';
                timerBadge.innerText = `⏱️ FALTAM ${mins} MIN`;
            } else {
                timerBadge.style.background = 'rgba(230, 126, 34, 0.15)';
                timerBadge.style.color = '#e67e22';
                timerBadge.style.border = '1px solid rgba(230, 126, 34, 0.3)';
                timerBadge.innerText = `⚠️ RESTAM ${mins} MIN`;
            }
        } else {
            timerBadge.style.background = 'rgba(255, 62, 62, 0.15)';
            timerBadge.style.color = '#ff3e3e';
            timerBadge.style.border = '1px solid rgba(255, 62, 62, 0.3)';
            timerBadge.innerText = `🚨 VENCIDO HÁ ${mins} MIN`;

            if (!timerBadge.classList.contains('oms-pulse-red')) {
                timerBadge.style.animation = 'pulseRedBorder 1.5s infinite ease-in-out';
            }
        }
    }

    // --- SISTEMA GLOBAL DE DELEGAÇÃO DE EVENTOS DE CLIQUE ---
    document.addEventListener('click', (e) => {
        // 1. Clique nos checkboxes da lista (ou em qualquer lugar da linha do checklist)
        const checklistItem = e.target.closest('.oms-checklist-item');
        if (checklistItem) {
            e.stopPropagation();
            const checkbox = checklistItem.querySelector('.oms-checklist-checkbox');
            if (checkbox) {
                const key = checkbox.dataset.checkboxKey;
                checklistState[key] = !checklistState[key];
                localStorage.setItem('oms_checklist_state', JSON.stringify(checklistState));

                checkbox.classList.toggle('checked');
                checkbox.innerText = checklistState[key] ? '✓' : '';
                const textEl = checkbox.nextElementSibling;
                if (textEl) {
                    textEl.style.textDecoration = checklistState[key] ? 'line-through' : 'none';
                    textEl.style.opacity = checklistState[key] ? '0.5' : '1';
                }
                playCopyBeep();
            }
            return;
        }

        // 2. Clique nos botões de ação das etapas (checklist)
        const actionBtn = e.target.closest('.oms-checklist-btn');
        if (actionBtn) {
            e.stopPropagation();
            const stageKey = actionBtn.dataset.actionStage;
            triggerStageAction(stageKey);
            return;
        }

        // 3. Clique nos botões de ação do stepper
        const stepperBtn = e.target.closest('.oms-stepper-action-btn');
        if (stepperBtn) {
            e.stopPropagation();
            const stageKey = stepperBtn.dataset.actionStage;
            triggerStageAction(stageKey);
            return;
        }

        // 4. Clique nos botões de ação dos passos do stepper
        const stepperStep = e.target.closest('.oms-stepper-step');
        if (stepperStep) {
            e.stopPropagation();
            const stageKey = stepperStep.dataset.stepKey;
            triggerStageAction(stageKey);
            return;
        }

        // 5. Clique no botão de prioridade do Drawer
        const drawerBtn = e.target.closest('.oms-drawer-priority-btn');
        if (drawerBtn) {
            e.stopPropagation();
            const priority = analyzeSystemPriority(lastGroupsData);
            if (priority.stage) {
                triggerStageAction(priority.stage);
            }
            return;
        }
    });

    // --- LÓGICA DE DETECÇÃO DE INATIVIDADE (MODO ECONOMIA) ---
    let lastActivityTime = Date.now();
    let isUserIdle = false;
    const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutos
    let lastIdleCheckTime = 0;

    function resetActivity() {
        lastActivityTime = Date.now();
        if (isUserIdle) {
            isUserIdle = false;
            console.log("[OMS Premium] Operador ativo detectado! Restaurando atualização em tempo real (3s).");
            const badge = document.getElementById('oms-scanner-status-badge');
            if (badge) {
                badge.style.opacity = '1';
                badge.innerHTML = '🟢 MONITOR PREMIUM ATIVO';
            }
            check();
        }
    }

    window.addEventListener('mousemove', resetActivity);
    window.addEventListener('keydown', resetActivity);
    window.addEventListener('click', resetActivity);
    window.addEventListener('scroll', resetActivity);

    function runCheckTick() {
        const now = Date.now();
        if (now - lastActivityTime > IDLE_TIMEOUT) {
            if (!isUserIdle) {
                isUserIdle = true;
                console.log("[OMS Premium] Operador ausente há 10+ min. Entrando em Modo Econômico (15s).");
                const badge = document.getElementById('oms-scanner-status-badge');
                if (badge) {
                    badge.style.opacity = '0.6';
                    badge.innerHTML = '🌙 MODO ECONÔMICO (AUSENTE)';
                }
            }
            if (now - lastIdleCheckTime >= 15000) {
                lastIdleCheckTime = now;
                check();
            }
        } else {
            lastIdleCheckTime = now;
            check();
        }
    }

    // --- WORKER DE THROTTLING DE SEGUNDO PLANO ---
    const workerBlob = new Blob([`
        setInterval(() => postMessage('tick'), ${CHECK_INTERVAL});
    `], { type: 'application/javascript' });

    try {
        const worker = new Worker(URL.createObjectURL(workerBlob));
        worker.onmessage = (e) => { if (e.data === 'tick') runCheckTick(); };
    } catch (e) {
        console.warn("Worker falhou, usando setInterval padrão local.");
        setInterval(runCheckTick, CHECK_INTERVAL);
    }

    // Inicialização da primeira verificação
    setTimeout(check, 1000);
    setInterval(handleRouting, 1500);

})();




