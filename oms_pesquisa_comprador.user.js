// ==UserScript==
// @name         Pesquisa Rápida de Comprador - Linx OMS
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Widget flutuante para pesquisar rapidamente o comprador de qualquer pedido (inclusive finalizados).
// @author       Antigravity
// @match        https://*.linxoms.com.br/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // 1. Usar GM_addStyle para burlar bloqueios de segurança (CSP) do navegador/site
    GM_addStyle(`
        #oms-search-widget {
            position: fixed !important;
            bottom: 30px !important;
            right: 30px !important;
            background: #ffffff !important;
            border: 3px solid #00d2ff !important;
            border-radius: 12px !important;
            padding: 15px !important;
            box-shadow: 0 15px 35px rgba(0,0,0,0.5) !important;
            z-index: 2147483647 !important;
            font-family: Arial, sans-serif !important;
            width: 320px !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
            color: #333 !important;
        }
        #oms-search-widget * {
            box-sizing: border-box !important;
        }
        #oms-search-widget h3 {
            margin: 0 !important;
            font-size: 16px !important;
            color: #0056b3 !important;
            text-align: center !important;
            line-height: 1.2 !important;
        }
        .oms-input-group {
            display: flex !important;
            flex-direction: column !important;
            gap: 4px !important;
        }
        .oms-input-group label {
            font-size: 12px !important;
            font-weight: bold !important;
            color: #555 !important;
        }
        .oms-input-group input {
            padding: 8px !important;
            border: 1px solid #ccc !important;
            border-radius: 6px !important;
            font-size: 14px !important;
            width: 100% !important;
            color: #000 !important;
            background: #fff !important;
        }
        #oms-search-btn {
            background: #00d2ff !important;
            color: #fff !important;
            border: none !important;
            padding: 10px !important;
            border-radius: 6px !important;
            font-size: 15px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            transition: background 0.3s !important;
            margin-top: 5px !important;
            width: 100% !important;
        }
        #oms-search-btn:hover {
            background: #00a8cc !important;
        }
        #oms-search-result {
            font-size: 14px !important;
            font-weight: bold !important;
            background: #f4f4f4 !important;
            padding: 10px !important;
            border-radius: 6px !important;
            text-align: center !important;
            min-height: 40px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex-direction: column !important;
            gap: 5px !important;
            word-break: break-word !important;
            color: #333 !important;
        }
        .loading-msg { color: #888 !important; }
        .success-msg { color: #28a745 !important; }
        .error-msg { color: #dc3545 !important; }
    `);

    // 2. Cria o HTML do widget em memória
    const widget = document.createElement('div');
    widget.id = 'oms-search-widget';
    widget.innerHTML = `
        <h3>🔎 Pesquisar Comprador</h3>
        <div class="oms-input-group">
            <label>Loja ID</label>
            <input type="text" id="oms-search-store" value="1058" placeholder="Ex: 1058" autocomplete="off">
        </div>
        <div class="oms-input-group">
            <label>Número do Pedido</label>
            <input type="text" id="oms-search-input" placeholder="Ex: 12345678" autocomplete="off">
        </div>
        <button id="oms-search-btn">Buscar Comprador</button>
        <div id="oms-search-result">Aguardando pesquisa...</div>
    `;

    // 3. Função de injeção segura que aguarda o carregamento do body
    function injectWidget() {
        if (!document.body) return; // Aguarda o Body existir
        
        if (!document.getElementById('oms-search-widget')) {
            document.body.appendChild(widget);
            
            // Re-vincular eventos após injetar
            const btn = document.getElementById('oms-search-btn');
            const input = document.getElementById('oms-search-input');
            const storeInput = document.getElementById('oms-search-store');
            
            if (btn && input && storeInput) {
                btn.onclick = searchOrder;
                input.onkeypress = (e) => { if (e.key === 'Enter') searchOrder(); };
                storeInput.onkeypress = (e) => { if (e.key === 'Enter') searchOrder(); };
            }
        }
    }
    
    // Inicia o processo de injeção em loop para garantir contra apagamentos do SPA
    function startInjectionLoop() {
        injectWidget();
        setInterval(injectWidget, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startInjectionLoop);
    } else {
        startInjectionLoop();
    }

    // 4. Função de busca protegida com suporte a fetch da própria página
    async function searchOrder() {
        const input = document.getElementById('oms-search-input');
        const storeInput = document.getElementById('oms-search-store');
        const result = document.getElementById('oms-search-result');
        
        const orderId = input.value.trim();
        const storeId = storeInput.value.trim(); 
        
        if (!orderId) {
            result.className = 'error-msg';
            result.innerHTML = 'Por favor, digite um número de pedido.';
            return;
        }

        result.className = 'loading-msg';
        result.innerHTML = 'Buscando... ⏳';

        try {
            const baseUrl = 'https://instore.linxoms.com.br/api/proxy/order-ms/clients/rihappy/fulfillments';
            
            let res, data;
            
            // 1. Tentar busca DIRETA pelo ID exato (Isso bypassa os filtros padrões do Linx que escondem pedidos finalizados/antigos)
            try {
                res = await fetch(`${baseUrl}/${orderId}?includes[]=order`);
                if (res.ok) {
                    const directData = await res.json();
                    if (directData && directData.id) {
                        data = { data: [directData] };
                    }
                }
            } catch(e) { }
            
            // 2. Filtro 1: Usando locationId (Loja) e o ID do pedido
            if ((!data || !data.data || data.data.length === 0) && storeId) {
                const filters = `?filterGroups[0][filters][0][property]=locationId&filterGroups[0][filters][0][condition]=eq&filterGroups[0][filters][0][value]=${storeId}` +
                                `&filterGroups[0][filters][1][property]=id&filterGroups[0][filters][1][condition]=like&filterGroups[0][filters][1][value]=${orderId}` +
                                `&includes[]=order&pageSize=10`;
                res = await fetch(encodeURI(baseUrl + filters));
                data = await res.json();
                
                // Se não achou com 'id', tenta com 'order.id'
                if (!data || !data.data || data.data.length === 0) {
                     const filtersOrder = `?filterGroups[0][filters][0][property]=locationId&filterGroups[0][filters][0][condition]=eq&filterGroups[0][filters][0][value]=${storeId}` +
                                          `&filterGroups[0][filters][1][property]=order.id&filterGroups[0][filters][1][condition]=like&filterGroups[0][filters][1][value]=${orderId}` +
                                          `&includes[]=order&pageSize=10`;
                     res = await fetch(encodeURI(baseUrl + filtersOrder));
                     data = await res.json();
                }
            }

            // 3. Filtro 2: Busca Global (sem a loja) caso falhe ou loja não informada
            if (!data || !data.data || data.data.length === 0) {
                 const filterNoStore = `?filterGroups[0][filters][0][property]=id&filterGroups[0][filters][0][condition]=like&filterGroups[0][filters][0][value]=${orderId}&includes[]=order&pageSize=10`;
                 res = await fetch(encodeURI(baseUrl + filterNoStore));
                 data = await res.json();
            }
            
            if (!data || !data.data || data.data.length === 0) {
                 const filterNoStoreOrder = `?filterGroups[0][filters][0][property]=order.id&filterGroups[0][filters][0][condition]=like&filterGroups[0][filters][0][value]=${orderId}&includes[]=order&pageSize=10`;
                 res = await fetch(encodeURI(baseUrl + filterNoStoreOrder));
                 data = await res.json();
            }

            if (data && data.data && data.data.length > 0) {
                // Pegar o primeiro resultado
                const o = data.data[0];
                
                const customerName = (o.customer && o.customer.fullName) || 
                                     (o.order && o.order.customer && o.order.customer.fullName) || 
                                     (o.shippingData && o.shippingData.address && o.shippingData.address.receiverName);

                const statusLabel = o.status || o.fulfillmentStatus || 'Desconhecido';
                const lojaEncontrada = o.locationId || '---';

                if (customerName) {
                    result.className = 'success-msg';
                    result.innerHTML = `👤 <b>Comprador:</b><br>${customerName}<br><hr style="width:100%; border:0; border-top:1px solid #ccc; margin:5px 0;">Loja: ${lojaEncontrada} | Status: ${statusLabel}`;
                } else {
                    result.className = 'error-msg';
                    result.innerHTML = `Pedido encontrado na Loja ${lojaEncontrada} (Status: ${statusLabel}), mas nome do comprador está oculto ou não existe.`;
                }
            } else {
                result.className = 'error-msg';
                result.innerHTML = '❌ Pedido não encontrado.<br><span style="font-size:12px; font-weight:normal;">Verifique o número e o ID da Loja.</span>';
            }

        } catch (err) {
            console.error('Erro na pesquisa OMS:', err);
            result.className = 'error-msg';
            result.innerHTML = '⚠️ Erro de comunicação com o servidor Linx.';
        }
    }

})();
