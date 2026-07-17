// ==UserScript==
// @name         Linx OMS - Automação & Cupom WhatsApp
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Cria botão personalizado para Declaração com Cupom e Link do WhatsApp
// @author       You
// @match        https://*.linxoms.com.br/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- LÓGICA DE WHATSAPP ---
    function cleanPhoneNumber(phoneStr) {
        return phoneStr.replace(/\D/g, '');
    }

    function processPhones() {
        const tableDetails = document.querySelectorAll('.table-details');
        
        tableDetails.forEach(container => {
            const h5 = container.querySelector('h5');
            if (h5 && h5.textContent.trim() === 'Telefones') {
                const ddElements = container.querySelectorAll('dd.ng-binding');
                
                ddElements.forEach(dd => {
                    if (dd.getAttribute('data-wp-injected') === 'true' && dd.querySelector('.whatsapp-link')) return;

                    const textNode = Array.from(dd.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 5);
                    
                    if (textNode) {
                        const originalText = textNode.textContent.trim();
                        const cleanNumber = cleanPhoneNumber(originalText);
                        
                        const wpLink = document.createElement('a');
                        wpLink.href = `https://wa.me/${cleanNumber}`;
                        wpLink.target = '_blank';
                        wpLink.className = 'whatsapp-link';
                        wpLink.style.cssText = 'color: #25D366; font-weight: bold; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;';
                        
                        wpLink.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" style="width: 16px; height: 16px; fill: currentColor;">
                                <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157.1zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
                            </svg>
                            ${originalText}
                        `;
                        
                        textNode.replaceWith(wpLink);
                        dd.setAttribute('data-wp-injected', 'true');
                    }
                });
            }
        });
    }

    // --- LÓGICA DO NOVO BOTÃO E DECLARAÇÃO ---
    function getOrderNumber() {
        const titleH2 = document.querySelector('.fulfillment-details-title h2');
        if (titleH2 && titleH2.textContent.trim().length > 5) {
            return titleH2.textContent.trim().toUpperCase();
        }
        return 'N/A';
    }

    function extractOrderData() {
        // Encontrar Nome e CPF
        let customerName = '';
        let customerCpf = '';
        const dlElements = document.querySelectorAll('.table-details dl');
        dlElements.forEach(dl => {
            const children = dl.children;
            for (let i = 0; i < children.length; i++) {
                if (children[i].tagName === 'DT' && children[i].textContent.includes('Nome:')) {
                    customerName = children[i+1] ? children[i+1].textContent.trim() : '';
                }
                if (children[i].tagName === 'DT' && children[i].textContent.includes('CPF:')) {
                    customerCpf = children[i+1] ? children[i+1].textContent.trim() : '';
                }
            }
        });

        // Encontrar Itens (Garante que só pega a tabela principal, ignorando a tabela oculta de quebra 'table-rupture')
        let items = [];
        const rows = document.querySelectorAll('table.order-products-table-products:not(.table-rupture) tbody tr:not(.sku-not-found)');
        rows.forEach(tr => {
            const cols = tr.querySelectorAll('td');
            if (cols.length >= 6) {
                // O nome normalmente fica dentro de <td class="order-products-column-details"><p>
                const productTitleNode = tr.querySelector('.order-products-column-details p');
                const title = productTitleNode ? productTitleNode.textContent.trim() : '';
                
                // QTD costuma ter class 'order-products-column-quantity'
                const qtyNode = tr.querySelector('.order-products-column-quantity');
                let qty = qtyNode ? qtyNode.textContent.trim().replace(/\D/g, '') : '1';
                if (!qty) qty = '1';

                // EAN/SKU (varremos as colunas achando a que contém apenas números grandes, normalmente SKU ou EAN)
                let sku = '';
                for(let i=3; i<cols.length; i++) {
                    const txt = cols[i].textContent.trim();
                    if (/^\d{7,13}$/.test(txt)) {
                        sku = txt;
                        break;
                    }
                }

                if (title) {
                    items.push({ title, qty, sku });
                }
            }
        });

        // Encontrar a loja
        const storeNode = document.querySelector('.dropdown.location .txt');
        let storeName = 'RI HAPPY';
        if (storeNode) {
            const parts = storeNode.textContent.split('-');
            if (parts.length > 1) {
                storeName = parts[1].trim();
            }
        }

        return {
            orderNumber: getOrderNumber(),
            customerName,
            customerCpf,
            storeName,
            items
        };
    }

    function generateCustomPrint() {
        const data = extractOrderData();
        if (data.orderNumber === 'N/A') {
            alert('Não foi possível identificar o número do pedido ainda. Aguarde a tela carregar.');
            return;
        }

        // Tabela de itens em HTML (para bobina térmica)
        let itemsHtml = '';
        if (data.items.length === 0) {
            itemsHtml = '<tr><td colspan="3" style="text-align:center; padding: 10px;">Nenhum item</td></tr>';
        } else {
            data.items.forEach(item => {
                // Simplifica a descrição para caber na bobina
                const shortTitle = item.title.length > 30 ? item.title.substring(0, 30) + '...' : item.title;
                itemsHtml += `
                    <tr>
                        <td style="padding: 5px; border-bottom: 1px dashed #000; vertical-align: middle; text-align: center;">${item.qty}</td>
                        <td style="padding: 5px; border-bottom: 1px dashed #000; vertical-align: middle; text-align: center; font-size: 10px;">${item.sku}</td>
                        <td style="padding: 5px; border-bottom: 1px dashed #000; vertical-align: middle; text-align: center; font-size: 11px;">${shortTitle}</td>
                    </tr>
                `;
            });
        }

        // HTML Completo para Impressora Térmica (80mm)
        const html = `
            <html>
                <head>
                    <title>Declaração de Entrega - ${data.orderNumber}</title>
                    <link href="https://fonts.googleapis.com/css?family=Libre+Barcode+39&display=swap" rel="stylesheet">
                    <style>
                        body { 
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                            color: #000; 
                            padding: 0; 
                            margin: 0; 
                            line-height: 1.2; 
                        }
                        
                        /* Largura idêntica ao RECEIPT_WIDTH_PX = 302 do projeto Eventos */
                        .print-container {
                            width: 302px;
                            margin: 0 auto;
                            padding: 16px;
                        }

                        /* Estilo Eventos/Retira em Loja - PRETO E BRANCO */
                        .discount-banner {
                            border: none;
                            text-align: center;
                            padding: 0px;
                            margin-bottom: 20px;
                        }
                        .eventos-header {
                            font-size: 14px;
                            font-weight: bold;
                            text-transform: uppercase;
                            letter-spacing: -0.5px;
                            margin-bottom: 15px;
                        }
                        .eventos-subtitle {
                            font-size: 14px;
                            font-weight: bold;
                            text-transform: uppercase;
                            letter-spacing: 2px;
                            margin-bottom: 5px;
                        }
                        .eventos-value-container {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                        }
                        .eventos-value-10 {
                            font-size: 110px;
                            font-weight: bold;
                            line-height: 1;
                            letter-spacing: -3px;
                        }
                        .eventos-value-off {
                            font-size: 36px;
                            font-weight: bold;
                            text-transform: uppercase;
                            letter-spacing: 0.2em;
                            margin-top: -15px;
                        }
                        .eventos-terms {
                            font-size: 12px;
                            font-weight: bold;
                            text-transform: uppercase;
                            margin-top: 15px;
                            line-height: 1.2;
                        }
                        .eventos-terms-italic {
                            font-size: 11px;
                            font-weight: bold;
                            font-style: italic;
                            text-transform: uppercase;
                            margin-top: 10px;
                        }
                        .eventos-control {
                            font-size: 16px;
                            font-weight: bold;
                            text-transform: uppercase;
                            letter-spacing: -1px;
                            margin-top: 15px;
                            padding: 10px 0;
                        }
                        .eventos-footer-msg {
                            font-size: 9px;
                            font-weight: bold;
                            text-transform: uppercase;
                            margin-top: 15px;
                        }
                        
                        /* Dados da Entrega */
                        .section-title { 
                            font-size: 14px; 
                            font-weight: bold; 
                            border-bottom: 1px dashed #000; 
                            margin-top: 15px;
                            margin-bottom: 10px; 
                            padding-bottom: 3px; 
                            text-align: center;
                        }
                        .formal-text {
                            font-size: 10px;
                            text-align: center;
                            margin-bottom: 10px;
                            line-height: 1.3;
                        }
                        .info-block { font-size: 12px; margin-bottom: 15px; text-align: center; }
                        .info-block div { margin-bottom: 3px; }
                        
                        /* Itens */
                        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
                        .items-table th { border-bottom: 2px solid #000; padding: 5px; text-align: center; font-size: 10px; vertical-align: middle;}
                        
                        /* Assinaturas (empilhadas para bobina) */
                        .signature-section {
                            margin-top: 30px;
                        }
                        .signature-box {
                            width: 100%;
                            border-top: 1px solid #000;
                            text-align: center;
                            padding-top: 5px;
                            font-size: 12px;
                            font-weight: bold;
                            margin-bottom: 40px;
                        }

                        /* Rodapé com Código de Barras */
                        .barcode-footer {
                            text-align: center;
                            margin-top: 20px;
                            padding-top: 20px;
                            border-top: 1px dashed #000;
                            page-break-inside: avoid;
                        }
                        .print-barcode {
                            font-family: 'Libre Barcode 39', cursive;
                            font-size: 50px; /* Reduzido para caber na bobina */
                            line-height: 1;
                        }
                        .print-order-text {
                            font-family: monospace;
                            font-size: 14px;
                            font-weight: bold;
                        }
                        
                        @media print {
                            @page {
                                size: 80mm 297mm; /* Define largura de bobina para a pré-visualização */
                                margin: 0;
                            }
                            body { background: white; margin: 0; padding: 0; }
                            .print-container { margin: 0; padding: 10px 5px; width: 100%; max-width: 300px; }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-container">
                        <div class="discount-banner">
                            <div class="eventos-header">RI HAPPY - \${data.storeName.toUpperCase() || 'LOJA'}</div>
                            
                            <div class="eventos-subtitle">VOCÊ GANHOU!</div>
                            
                            <div class="eventos-value-container">
                                <span class="eventos-value-10">10%</span>
                                <span class="eventos-value-off">OFF</span>
                            </div>
                            
                            <div class="eventos-terms">
                                <div>Válido para compra adicional</div>
                                <div>NA RETIRADA DO SEU PEDIDO</div>
                                <div class="eventos-terms-italic">Aproveite para completar a brincadeira!</div>
                            </div>

                            <div class="eventos-control">
                                ADICIONAL: ( ) SIM ( ) NÃO
                            </div>

                            <div class="eventos-footer-msg">
                                Consulte um de nossos atendentes.
                            </div>
                        </div>

                        <div style="border-top: 2px dashed #000; margin: 20px 0;"></div>

                        <div class="section-title">DECLARAÇÃO DE ENTREGA</div>
                        
                        <div class="formal-text">
                            Declaro que recebi os produtos listados abaixo em perfeitas condições, referentes ao pedido mencionado, conferidos no ato da entrega.
                        </div>

                        <div class="info-block">
                            <div><strong>Pedido:</strong> ${data.orderNumber}</div>
                            <div><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</div>
                            <div><strong>Cliente:</strong> ${data.customerName || 'Não Informado'}</div>
                            <div><strong>CPF:</strong> ${data.customerCpf || 'Não Informado'}</div>
                        </div>

                        <div class="section-title">ITENS DO PEDIDO</div>
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th style="width: 20px;">QTD</th>
                                    <th style="width: 70px;">SKU</th>
                                    <th>PRODUTO</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                        </table>

                        <div class="signature-section">
                            <br><br>
                            <div class="signature-box">Assinatura do Cliente</div>
                            
                            <br><br>
                            <div class="signature-box">Data de Retirada</div>
                            
                            <br><br>
                            <div class="signature-box">Assinatura do Funcionário</div>
                        </div>

                        <div class="barcode-footer">
                            <div class="print-barcode">*${data.orderNumber}*</div>
                            <div class="print-order-text">${data.orderNumber}</div>
                        </div>
                    </div>

                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `;

        // Cria iframe invisível se não existir
        let iframe = document.getElementById('custom-print-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'custom-print-iframe';
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);
        }

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();
    }

    function injectCustomButton() {
        if (document.getElementById('btn-custom-print')) return;
        
        // Pode ser ao lado do título ou dentro de 'fulfillment-buttons-control'
        const buttonsContainer = document.querySelector('.fulfillment-buttons-control > div') || document.querySelector('.fulfillment-buttons-control');
        const titleDiv = document.querySelector('.fulfillment-details-title');

        if (buttonsContainer || titleDiv) {
            const btn = document.createElement('button');
            btn.id = 'btn-custom-print';
            btn.className = 'btn btn-primary';
            btn.style.marginLeft = '15px';
            btn.style.backgroundColor = '#612D87'; // Roxo da Ri Happy
            btn.style.borderColor = '#612D87';
            btn.innerHTML = '<span class="glyphicon glyphicon-print"></span> Declaração + Cupom';
            btn.onclick = generateCustomPrint;

            if (buttonsContainer) {
                buttonsContainer.appendChild(btn);
            } else if (titleDiv) {
                // Fallback: adiciona ao lado do título
                titleDiv.appendChild(btn);
            }
        }
    }

    // Inicia verificação periódica
    setInterval(() => {
        // Só injeta se estivermos numa URL de entrega (fulfillments)
        if (window.location.pathname.includes('/fulfillments/')) {
            processPhones();
            injectCustomButton();
        }
    }, 1000);

})();
