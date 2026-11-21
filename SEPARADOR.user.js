// ==UserScript==
// @name         SEPARADOR - Linx OMS Retirada em Loja
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Atua exclusivamente na tela de detalhes de pedidos de Retirada: oculta Confirmar Retirada, adiciona botão WhatsApp Web com mensagem automática e gera Declaração de Entrega (Cupom 10% + código de barras CPF) e Etiqueta de Retirada (código de barras Pedido) para impressora térmica Epson TM-T20X.
// @author       Antigravity AI
// @match        https://instore.linxoms.com.br/*
// @match        *://*.linxoms.com.br/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================================
    // CONFIGURAÇÕES RÁPIDAS
    // =========================================================================
    const CONFIG = {
        // true = remove sufixo "-01" no código de barras da etiqueta (ex: v37065695rihp)
        // false = mantém número completo exibido na tela (ex: v37065695rihp-01)
        STRIP_FULFILLMENT_SUFFIX: false,

        // Template da mensagem automática do WhatsApp Web
        // Placeholders suportados: {NOME}, {NOME_COMPLETO}, {PEDIDO}, {LOJA}
        WHATSAPP_MESSAGE_TEMPLATE: [
            'Olá, *{NOME}*! 👋',
            '',
            '✔️ *SEU PEDIDO {PEDIDO} ESTÁ PRONTO PARA RETIRADA NA RI HAPPY!*',
            '',
            '🎁 *Você ganhou 10% de desconto* para usar em uma nova compra na nossa loja física *no momento da retirada do seu pedido.*',
            '',
            '⚠️ *Outra pessoa vai retirar por você?*',
            'Em caso de retirada por terceiro, envie previamente a autorização preenchida e assinada junto com o documento de identidade para este WhatsApp.',
            '',
            '📱 *Faça a autorização online:*',
            'https://autorizacaoretirada.vercel.app/',
            '',
            '📄 Ou imprima e preencha:',
            'https://rihappy.vteximg.com.br/arquivos/termo-de-autoriza%C3%A7%C3%A3o-de-terceiro-rihappy-v2.pdf',
            '',
            '💬 Em caso de dúvidas, é só nos avisar por aqui!'
        ].join('\n')
    };

    // =========================================================================
    // 1. BLOQUEIO IMEDIATO VIA CSS DO BOTÃO "CONFIRMAR RETIRADA" (ZERO FLICKER)
    // =========================================================================
    function injectGlobalStyles() {
        if (document.getElementById('separador-oms-styles')) return;
        const style = document.createElement('style');
        style.id = 'separador-oms-styles';
        style.textContent = `
            /* Oculta completamente o botão de Confirmar Retirada por segurança operacional */
            button.btn-delivered-pickup,
            button[ng-click*="showPickupDocumentModal"] {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
                width: 0 !important;
                height: 0 !important;
                overflow: hidden !important;
                position: absolute !important;
                left: -9999px !important;
            }

            /* Botão de WhatsApp integrado na barra de ações */
            .btn-separador-whatsapp {
                background-color: #25D366 !important;
                border-color: #1DA851 !important;
                color: #ffffff !important;
                font-weight: 700 !important;
                display: inline-flex !important;
                align-items: center !important;
                gap: 7px !important;
                margin-right: 8px !important;
                transition: background-color 0.15s ease, transform 0.1s ease !important;
            }
            .btn-separador-whatsapp:hover,
            .btn-separador-whatsapp:focus {
                background-color: #1EBE5D !important;
                border-color: #169C49 !important;
                color: #ffffff !important;
                text-decoration: none !important;
            }
            .btn-separador-whatsapp:active {
                transform: scale(0.98);
            }
            .separador-phone-wa-link {
                color: #128C7E !important;
                font-weight: 700 !important;
                text-decoration: none !important;
                display: inline-flex !important;
                align-items: center !important;
                gap: 5px !important;
            }
            .separador-phone-wa-link:hover {
                color: #25D366 !important;
                text-decoration: underline !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    // =========================================================================
    // 2. GERADOR NATIVO DE CÓDIGO DE BARRAS CODE 128B (SVG VETORIAL PURO)
    //    100% escaneável em impressoras térmicas 203 DPI (Epson TM-T20X)
    // =========================================================================
    const CODE128_PATTERNS = [
        '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
        '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
        '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
        '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
        '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
        '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
        '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
        '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
        '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
        '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
        '114131','311141','411131','211412','211214','211232','2331112'
    ];

    function generateCode128BSvg(rawText, options = {}) {
        const text = String(rawText || '').trim();
        if (!text) return '';

        const height = options.height || 58;
        const quietZoneModules = options.quietZone || 10;

        // Filtra apenas caracteres imprimíveis ASCII 32..126 suportados pelo Code 128B
        const cleanChars = [];
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            if (code >= 32 && code <= 126) {
                cleanChars.push(code - 32);
            }
        }
        if (cleanChars.length === 0) return '';

        // Start Code B (104) + dados + checksum + Stop (106)
        const START_B = 104;
        const STOP = 106;
        let checksum = START_B;
        const sequence = [START_B];

        cleanChars.forEach((val, idx) => {
            sequence.push(val);
            checksum += val * (idx + 1);
        });
        sequence.push(checksum % 103);
        sequence.push(STOP);

        // Converte sequência de larguras em retângulos SVG
        let x = quietZoneModules;
        const rects = [];
        sequence.forEach((symbolIndex) => {
            const pattern = CODE128_PATTERNS[symbolIndex];
            for (let i = 0; i < pattern.length; i++) {
                const w = parseInt(pattern[i], 10);
                const isBar = (i % 2 === 0);
                if (isBar) {
                    rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}" fill="#000000"/>`);
                }
                x += w;
            }
        });

        const totalModules = x + quietZoneModules;

        return `
            <svg xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 0 ${totalModules} ${height}"
                 width="100%"
                 height="${height}"
                 preserveAspectRatio="none"
                 shape-rendering="crispEdges"
                 style="display:block; margin:0 auto; background:#ffffff; max-width:100%;">
                <rect x="0" y="0" width="${totalModules}" height="${height}" fill="#ffffff"/>
                ${rects.join('')}
            </svg>
        `;
    }

    // =========================================================================
    // 3. DETECÇÃO DE TELA E EXTRAÇÃO DE DADOS DO PEDIDO DE RETIRADA
    // =========================================================================
    function isOrderFulfillmentRoute() {
        return /\/orders\/[^/]+\/fulfillments\/[^/]+/i.test(window.location.pathname);
    }

    function isPickupOrderPage() {
        if (!isOrderFulfillmentRoute()) return false;

        // Sinais inequívocos de pedido de retirada no DOM do Linx OMS
        if (document.querySelector('.fulfillment-status-pickup_ready')) return true;
        if (document.querySelector('button.btn-delivered-pickup')) return true;
        if (document.querySelector('a[ng-click*="printPickupTagFulfillment"]')) return true;
        if (document.querySelector('a[ng-click*="printPickupDocument"]')) return true;

        // Verifica o campo "Tipo:" em DADOS DA ENTREGA
        const dts = document.querySelectorAll('.order-details dt');
        for (const dt of dts) {
            if (dt.textContent && dt.textContent.toLowerCase().includes('tipo:')) {
                const dd = dt.nextElementSibling;
                if (dd && dd.textContent && dd.textContent.toLowerCase().includes('retirada')) {
                    return true;
                }
            }
        }
        return false;
    }

    function toTitleCase(str) {
        return String(str || '')
            .trim()
            .toLowerCase()
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    function normalizeBrazilPhone(raw) {
        let digits = String(raw || '').replace(/\D/g, '');
        if (!digits) return '';
        if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
            digits = '55' + digits;
        }
        return digits;
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function extractOrderData() {
        const orderH2 = document.querySelector('.fulfillment-details-title h2');
        const orderNumber = orderH2 ? orderH2.textContent.trim() : '';

        let customerName = '';
        let customerCpf = '';
        let pickupDeadline = '';
        let purchaseDate = '';

        // Varre todos os pares <dt>/<dd> do resumo do pedido
        const dlElements = document.querySelectorAll('.table-details dl');
        dlElements.forEach(dl => {
            const children = Array.from(dl.children);
            for (let i = 0; i < children.length; i++) {
                const el = children[i];
                if (el.tagName !== 'DT') continue;
                const label = el.textContent.trim().toLowerCase();
                const dd = children[i + 1];
                if (!dd || dd.tagName !== 'DD') continue;
                const val = dd.textContent.trim();

                if (label.startsWith('nome:') && val) {
                    customerName = val;
                } else if (label.startsWith('cpf:') && val) {
                    customerCpf = val;
                } else if (label.includes('prazo de retirada') && val) {
                    pickupDeadline = val;
                } else if (label.startsWith('compra:') && val) {
                    purchaseDate = val;
                }
            }
        });

        // Captura telefone principal do cliente (priorizando ng-repeat getFormattedPhones)
        let customerPhoneRaw = '';
        const phoneRepeatEl = document.querySelector('dd[ng-repeat*="getFormattedPhones"]');
        if (phoneRepeatEl && phoneRepeatEl.textContent.trim()) {
            customerPhoneRaw = phoneRepeatEl.textContent.trim();
        } else {
            const containers = document.querySelectorAll('.table-details');
            for (const c of containers) {
                const h5 = c.querySelector('h5');
                if (h5 && h5.textContent.trim().toLowerCase().includes('telefones')) {
                    const firstDd = c.querySelector('dd');
                    if (firstDd && firstDd.textContent.trim()) {
                        customerPhoneRaw = firstDd.textContent.trim();
                        break;
                    }
                }
            }
        }

        // Captura nome/código da loja no cabeçalho do Linx OMS
        let storeLabel = 'RI HAPPY';
        const storeBtn = document.querySelector('.dropdown.location .txt, .location .txt, header button[title*="LOJA" i], header .store-name');
        if (storeBtn && storeBtn.textContent.trim()) {
            const rawStore = storeBtn.textContent.trim().replace(/\s+/g, ' ');
            storeLabel = rawStore.toUpperCase().includes('RI HAPPY') || rawStore.toUpperCase().includes('PB KIDS')
                ? rawStore.toUpperCase()
                : `RI HAPPY - ${rawStore.toUpperCase()}`;
        }

        // Captura itens da tabela principal (ignorando tabela oculta de quebra)
        const items = [];
        const rows = document.querySelectorAll('table.order-products-table-products:not(.table-rupture) tbody tr:not(.sku-not-found)');
        rows.forEach(tr => {
            const cols = tr.querySelectorAll('td');
            if (cols.length < 6) return;

            const titleNode = tr.querySelector('.order-products-column-details p');
            const title = titleNode ? titleNode.textContent.trim() : '';

            const qtyNode = tr.querySelector('.order-products-column-quantity');
            let qty = '1';
            if (qtyNode) {
                const rawQty = qtyNode.textContent.trim();
                // Formato "1/1" -> pega quantidade do pedido (ou conferida)
                const parts = rawQty.split('/');
                qty = (parts[1] || parts[0] || '1').replace(/\D/g, '') || '1';
            }

            let sku = '';
            let ean = '';
            for (let i = 3; i < cols.length; i++) {
                const txt = cols[i].textContent.trim();
                if (!sku && /^\d{5,9}$/.test(txt)) {
                    sku = txt;
                } else if (!ean && /^\d{10,14}$/.test(txt)) {
                    ean = txt;
                }
            }

            if (title) {
                items.push({ title, qty, sku: sku || ean || '-', ean });
            }
        });

        // Quantidade de volumes exibida na página
        const volEl = document.querySelector('.print-volume .volume-qty');
        const volumesCount = volEl ? (volEl.textContent.trim() || '1') : '1';

        const firstName = customerName ? toTitleCase(customerName.split(/\s+/)[0]) : 'Cliente';
        const fullNameFormatted = customerName ? toTitleCase(customerName) : 'Cliente';
        const cleanCpf = customerCpf.replace(/\D/g, '');
        const cleanPhone = normalizeBrazilPhone(customerPhoneRaw);

        return {
            orderNumber,
            customerName,
            firstName,
            fullNameFormatted,
            customerCpf,
            cleanCpf,
            customerPhoneRaw,
            cleanPhone,
            pickupDeadline,
            purchaseDate,
            storeLabel,
            items,
            volumesCount
        };
    }

    // =========================================================================
    // 4. WHATSAPP WEB COM MENSAGEM AUTOMÁTICA + PLACEHOLDERS
    // =========================================================================
    function buildWhatsAppUrl(data, overridePhoneRaw) {
        const phone = normalizeBrazilPhone(overridePhoneRaw || data.customerPhoneRaw);
        if (!phone) return null;

        const message = CONFIG.WHATSAPP_MESSAGE_TEMPLATE
            .replace(/\{NOME\}/g, data.firstName)
            .replace(/\{NOME_COMPLETO\}/g, data.fullNameFormatted)
            .replace(/\{PEDIDO\}/g, data.orderNumber || '')
            .replace(/\{LOJA\}/g, data.storeLabel || 'RI HAPPY');

        return `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    }

    const WHATSAPP_SVG_ICON = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" style="width:15px;height:15px;fill:currentColor;flex-shrink:0;">
            <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157.1zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
        </svg>
    `;

    function injectWhatsAppControls() {
        const data = extractOrderData();
        if (!data.cleanPhone) return;

        // 1. Botão principal na barra de ações superior (no lugar do "Confirmar retirada")
        const actionsContainer = document.querySelector('.fulfillment-buttons-control');
        if (actionsContainer && !actionsContainer.querySelector('#separador-btn-whatsapp')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = 'separador-btn-whatsapp';
            btn.className = 'btn btn-separador-whatsapp';
            btn.title = 'Abrir conversa no WhatsApp Web com mensagem automática de retirada';
            btn.innerHTML = `${WHATSAPP_SVG_ICON}<span>Enviar WhatsApp</span>`;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const freshData = extractOrderData();
                const url = buildWhatsAppUrl(freshData);
                if (!url) {
                    alert('Telefone do cliente não encontrado neste pedido.');
                    return;
                }
                window.open(url, '_blank', 'noopener');
            });

            // Insere antes do dropdown "Outras ações"
            const otherActions = actionsContainer.querySelector('#buttons-other-actions');
            if (otherActions && otherActions.parentNode === actionsContainer) {
                actionsContainer.insertBefore(btn, otherActions);
            } else {
                actionsContainer.prepend(btn);
            }
        }

        // 2. Transforma os telefones do cliente na seção TELEFONES em links diretos pro WhatsApp Web
        const phoneNodes = document.querySelectorAll('dd[ng-repeat*="getFormattedPhones"]');
        phoneNodes.forEach(dd => {
            if (dd.getAttribute('data-separador-wa') === 'true' && dd.querySelector('.separador-phone-wa-link')) return;
            const rawText = dd.textContent.trim();
            const clean = normalizeBrazilPhone(rawText);
            if (!clean) return;

            const link = document.createElement('a');
            link.href = '#';
            link.className = 'separador-phone-wa-link';
            link.title = 'Abrir WhatsApp Web com mensagem pronta';
            link.innerHTML = `${WHATSAPP_SVG_ICON}<span>${escapeHtml(rawText)}</span>`;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const freshData = extractOrderData();
                const url = buildWhatsAppUrl(freshData, rawText);
                if (url) window.open(url, '_blank', 'noopener');
            });

            dd.textContent = '';
            dd.appendChild(link);
            dd.setAttribute('data-separador-wa', 'true');
        });
    }

    // =========================================================================
    // 5. IMPRESSÃO TÉRMICA (EPSON TM-T20X — 80mm / 90mm)
    // =========================================================================
    function printThermalHtml(htmlDoc) {
        let iframe = document.getElementById('separador-thermal-print-iframe');
        if (iframe) iframe.remove();

        iframe = document.createElement('iframe');
        iframe.id = 'separador-thermal-print-iframe';
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(htmlDoc);
        doc.close();

        // Imprime após renderização garantida (SVG vetorial já está pronto na hora, sem depender de fontes externas)
        setTimeout(() => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (e) {
                console.error('[SEPARADOR] Erro ao acionar impressão térmica:', e);
            }
        }, 250);
    }

    // 5A. DECLARAÇÃO DE ENTREGA (Cabeçalho Cupom 10% OFF + Assinaturas + Código de Barras do CPF)
    function printDeclaracaoEntrega() {
        const data = extractOrderData();
        if (!data.orderNumber) {
            alert('Aguarde os dados do pedido terminarem de carregar antes de imprimir.');
            return;
        }

        const itemsRowsHtml = data.items.length === 0
            ? '<tr><td colspan="3" style="text-align:center;padding:8px;">Nenhum item listado</td></tr>'
            : data.items.map(it => {
                const shortTitle = it.title.length > 34 ? it.title.slice(0, 34) + '...' : it.title;
                return `
                    <tr>
                        <td style="text-align:center;font-weight:700;padding:4px 2px;border-bottom:1px dashed #000;">${escapeHtml(it.qty)}</td>
                        <td style="text-align:center;font-family:monospace;font-size:10px;padding:4px 2px;border-bottom:1px dashed #000;">${escapeHtml(it.sku)}</td>
                        <td style="text-align:left;font-size:10px;padding:4px 3px;border-bottom:1px dashed #000;">${escapeHtml(shortTitle)}</td>
                    </tr>
                `;
            }).join('');

        const cpfForBarcode = data.cleanCpf || '00000000000';
        const cpfBarcodeSvg = generateCode128BSvg(cpfForBarcode, { height: 56, quietZone: 10 });

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Declaração de Entrega - ${escapeHtml(data.orderNumber)}</title>
    <style>
        @page {
            size: 80mm auto;
            margin: 0;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            line-height: 1.25;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .receipt {
            width: 302px;
            max-width: 100%;
            margin: 0 auto;
            padding: 12px 10px 18px 10px;
            background: #ffffff;
            color: #000000;
        }
        /* Cabeçalho Cupom 10% OFF (fiel ao layout de referência) */
        .coupon-header {
            text-align: center;
            padding-bottom: 12px;
        }
        .coupon-store {
            font-size: 13px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: -0.3px;
            margin: 0 0 12px 0;
        }
        .coupon-won {
            font-size: 14px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin: 0 0 4px 0;
        }
        .coupon-10 {
            display: block;
            font-size: 104px;
            font-weight: 900;
            line-height: 0.92;
            letter-spacing: -4px;
        }
        .coupon-off {
            display: block;
            font-size: 34px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            margin-top: -6px;
        }
        .coupon-terms {
            margin-top: 10px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            line-height: 1.3;
        }
        .coupon-italic {
            margin-top: 7px;
            font-size: 10.5px;
            font-weight: 800;
            font-style: italic;
            text-transform: uppercase;
        }
        .coupon-adicional {
            margin-top: 12px;
            padding: 6px 0;
            font-size: 15px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -0.4px;
        }
        .coupon-note {
            margin-top: 8px;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .cut-line {
            border-top: 2px dashed #000000;
            margin: 14px 0;
        }
        /* Declaração */
        .section-title {
            font-size: 13px;
            font-weight: 800;
            text-align: center;
            text-transform: uppercase;
            border-bottom: 1.5px solid #000000;
            padding-bottom: 3px;
            margin: 10px 0 8px 0;
        }
        .formal-text {
            font-size: 10px;
            text-align: center;
            margin-bottom: 10px;
        }
        .info-grid {
            font-size: 11.5px;
            margin-bottom: 10px;
        }
        .info-grid div {
            margin-bottom: 3px;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
        }
        .items-table th {
            font-size: 10px;
            font-weight: 800;
            border-bottom: 1.5px solid #000000;
            padding: 4px 2px;
            text-align: center;
        }
        /* Assinaturas */
        .sig-block {
            margin-top: 26px;
        }
        .sig-line {
            border-top: 1px solid #000000;
            text-align: center;
            padding-top: 4px;
            font-size: 11px;
            font-weight: 700;
            margin-bottom: 30px;
        }
        /* Rodapé Código de Barras do CPF */
        .barcode-block {
            text-align: center;
            border-top: 1.5px dashed #000000;
            padding-top: 12px;
            margin-top: 6px;
            page-break-inside: avoid;
        }
        .barcode-caption {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 6px;
        }
        .barcode-wrap {
            width: 92%;
            margin: 0 auto;
        }
        .barcode-human {
            font-family: 'Courier New', Courier, monospace;
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 2px;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="coupon-header">
            <div class="coupon-store">${escapeHtml(data.storeLabel)}</div>
            <div class="coupon-won">VOCÊ GANHOU!</div>
            <span class="coupon-10">10%</span>
            <span class="coupon-off">OFF</span>
            <div class="coupon-terms">
                <div>Válido para compra adicional</div>
                <div>NA RETIRADA DO SEU PEDIDO</div>
                <div class="coupon-italic">Aproveite para completar a brincadeira!</div>
            </div>
            <div class="coupon-adicional">ADICIONAL: ( ) SIM &nbsp; ( ) NÃO</div>
            <div class="coupon-note">Consulte um de nossos atendentes.</div>
        </div>

        <div class="cut-line"></div>

        <div class="section-title">DECLARAÇÃO DE ENTREGA</div>
        <div class="formal-text">
            Declaro que recebi os produtos listados abaixo em perfeitas condições, referentes ao pedido informado, conferidos no ato da retirada em loja.
        </div>

        <div class="info-grid">
            <div><strong>Pedido:</strong> ${escapeHtml(data.orderNumber)}</div>
            <div><strong>Data Impressão:</strong> ${new Date().toLocaleDateString('pt-BR')}</div>
            <div><strong>Cliente:</strong> ${escapeHtml(data.customerName || 'Não informado')}</div>
            <div><strong>CPF:</strong> ${escapeHtml(data.customerCpf || 'Não informado')}</div>
        </div>

        <div class="section-title">ITENS DO PEDIDO</div>
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width:28px;">QTD</th>
                    <th style="width:66px;">SKU</th>
                    <th style="text-align:left;">PRODUTO</th>
                </tr>
            </thead>
            <tbody>
                ${itemsRowsHtml}
            </tbody>
        </table>

        <div class="sig-block">
            <div class="sig-line">Assinatura do Cliente / Retirante</div>
            <div class="sig-line">Nome Legível / Documento (se terceiro)</div>
            <div class="sig-line">Data de Retirada: ____/____/________</div>
            <div class="sig-line" style="margin-bottom:14px;">Assinatura do Colaborador</div>
        </div>

        <div class="barcode-block">
            <div class="barcode-caption">CPF DO COMPRADOR</div>
            <div class="barcode-wrap">${cpfBarcodeSvg}</div>
            <div class="barcode-human">${escapeHtml(cpfForBarcode)}</div>
        </div>
    </div>
</body>
</html>`;

        printThermalHtml(html);
    }

    // 5B. ETIQUETA DE RETIRADA (Código de Barras do Número do Pedido — 100% escaneável)
    function printEtiquetaRetirada() {
        const data = extractOrderData();
        if (!data.orderNumber) {
            alert('Aguarde os dados do pedido terminarem de carregar antes de imprimir.');
            return;
        }

        const barcodeOrderValue = CONFIG.STRIP_FULFILLMENT_SUFFIX
            ? data.orderNumber.replace(/-\d+$/, '')
            : data.orderNumber;

        const orderBarcodeSvg = generateCode128BSvg(barcodeOrderValue, { height: 68, quietZone: 10 });
        const totalUnits = data.items.reduce((sum, it) => sum + (parseInt(it.qty, 10) || 1), 0) || 1;

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Etiqueta de Retirada - ${escapeHtml(data.orderNumber)}</title>
    <style>
        @page {
            size: 80mm auto;
            margin: 0;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            line-height: 1.25;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .tag {
            width: 302px;
            max-width: 100%;
            margin: 0 auto;
            padding: 10px 8px 14px 8px;
            background: #ffffff;
            color: #000000;
            border: 2px solid #000000;
        }
        .tag-banner {
            background: #000000;
            color: #ffffff;
            text-align: center;
            font-size: 16px;
            font-weight: 900;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            padding: 6px 4px;
            margin-bottom: 8px;
        }
        .tag-store {
            text-align: center;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .tag-order-box {
            text-align: center;
            border-top: 1.5px dashed #000000;
            border-bottom: 1.5px dashed #000000;
            padding: 8px 4px;
            margin-bottom: 8px;
        }
        .tag-label {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }
        .tag-order-num {
            font-family: 'Courier New', Courier, monospace;
            font-size: 20px;
            font-weight: 900;
            margin-top: 2px;
            word-break: break-all;
        }
        .tag-customer {
            text-align: center;
            margin-bottom: 8px;
        }
        .tag-customer-name {
            font-size: 15px;
            font-weight: 900;
            text-transform: uppercase;
            margin-top: 2px;
        }
        .tag-meta {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            font-weight: 700;
            border-top: 1px solid #000000;
            border-bottom: 1px solid #000000;
            padding: 5px 4px;
            margin-bottom: 10px;
        }
        .tag-barcode-wrap {
            text-align: center;
            padding: 4px 0 2px 0;
        }
        .tag-barcode-svg {
            width: 96%;
            margin: 0 auto;
        }
        .tag-barcode-human {
            font-family: 'Courier New', Courier, monospace;
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 1px;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="tag">
        <div class="tag-banner">RETIRA EM LOJA</div>
        <div class="tag-store">${escapeHtml(data.storeLabel)}</div>

        <div class="tag-order-box">
            <div class="tag-label">NÚMERO DO PEDIDO</div>
            <div class="tag-order-num">${escapeHtml(data.orderNumber)}</div>
        </div>

        <div class="tag-customer">
            <div class="tag-label">CLIENTE</div>
            <div class="tag-customer-name">${escapeHtml(data.customerName || 'NÃO INFORMADO')}</div>
            ${data.customerCpf ? `<div style="font-size:11px;font-weight:700;margin-top:2px;">CPF: ${escapeHtml(data.customerCpf)}</div>` : ''}
        </div>

        <div class="tag-meta">
            <span>VOL: ${escapeHtml(data.volumesCount)} | UN: ${totalUnits}</span>
            <span>${data.pickupDeadline ? 'ATÉ ' + escapeHtml(data.pickupDeadline) : new Date().toLocaleDateString('pt-BR')}</span>
        </div>

        <div class="tag-barcode-wrap">
            <div class="tag-barcode-svg">${orderBarcodeSvg}</div>
            <div class="tag-barcode-human">${escapeHtml(barcodeOrderValue)}</div>
        </div>
    </div>
</body>
</html>`;

        printThermalHtml(html);
    }

    // =========================================================================
    // 6. INTERCEPTAÇÃO DOS ITENS DE IMPRESSÃO NO DROPDOWN "OUTRAS AÇÕES"
    // =========================================================================
    function closeOtherActionsDropdown() {
        const dropdownParent = document.querySelector('#buttons-other-actions')?.closest('.btn-group, .dropdown');
        if (dropdownParent) dropdownParent.classList.remove('open');
    }

    function hookDropdownPrintActions() {
        const menu = document.getElementById('buttons-other-actions-content');
        if (!menu) return;

        // 1. Etiqueta de retirada
        const tagLink = menu.querySelector('a[ng-click*="printPickupTagFulfillment"]');
        if (tagLink && tagLink.getAttribute('data-separador-hooked') !== 'true') {
            tagLink.setAttribute('data-separador-hooked', 'true');
            tagLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                e.stopPropagation();
                closeOtherActionsDropdown();
                printEtiquetaRetirada();
            }, true);
        }

        // 2. Declaração de entrega
        const docLink = menu.querySelector('a[ng-click*="printPickupDocument"]');
        if (docLink && docLink.getAttribute('data-separador-hooked') !== 'true') {
            docLink.setAttribute('data-separador-hooked', 'true');
            docLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                e.stopPropagation();
                closeOtherActionsDropdown();
                printDeclaracaoEntrega();
            }, true);
        }
    }

    // =========================================================================
    // 7. ORQUESTRADOR SPA (MutationObserver COM DEBOUNCE)
    // =========================================================================
    function hideConfirmPickupButton() {
        const buttons = document.querySelectorAll('button.btn-delivered-pickup, button[ng-click*="showPickupDocumentModal"]');
        buttons.forEach(btn => {
            btn.style.setProperty('display', 'none', 'important');
            btn.disabled = true;
        });
    }

    function applySeparadorEnhancements() {
        if (!isPickupOrderPage()) return;

        hideConfirmPickupButton();
        injectWhatsAppControls();
        hookDropdownPrintActions();
    }

    let debounceTimer = null;
    function scheduleApply() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(applySeparadorEnhancements, 200);
    }

    function init() {
        injectGlobalStyles();

        const observer = new MutationObserver(() => {
            if (isOrderFulfillmentRoute()) {
                scheduleApply();
            }
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });

        window.addEventListener('popstate', scheduleApply);
        window.addEventListener('hashchange', scheduleApply);
        scheduleApply();

        console.log('[SEPARADOR] Script de Retirada em Loja inicializado.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
