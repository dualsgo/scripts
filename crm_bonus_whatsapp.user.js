// ==UserScript==
// @name         CRM Bônus - Alertas WhatsApp
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Adiciona botão de WhatsApp no modal do cliente com mensagem personalizada de cashback.
// @author       Antigravity
// @match        https://www.crmbonus.com/loja/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    //  CONFIGURAÇÕES — Edite apenas esta seção
    // ============================================================

    // Textos enviados via WhatsApp
    // Variáveis disponíveis: {nome}, {valor}, {validade}
    const MSG_BONUS_ATIVO = `🎉 *Seu cashback já está disponível!*

Olá, {nome}! Seu benefício de cashback de *{valor}* da compra realizada aqui na Ri Happy Carioca Shop já foi liberado e pode ser utilizado em sua próxima compra.

⚠️ *Importante:*
• O cashback é válido por 30 dias após a compra;

• O benefício deve ser utilizado em produtos não promocionais aqui na Loja da Ri Happy Carioca Shop.

Aproveite seu saldo e venha nos visitar! 💛`;

    const MSG_BONUS_EXPIRANDO = `⏰ *Seu cashback está prestes a expirar!*

Olá, {nome}! Identificamos que seu benefício de cashback de *{valor}* da compra realizada aqui na Ri Happy Carioca Shop expira nos próximos dias.

Aproveite seu saldo antes do prazo finalizar e utilize em sua próxima compra.

⚠️ *Importante:*
• O cashback deve ser utilizado em produtos não promocionados aqui na Loja da Ri Happy Carioca Shop;

• Após o vencimento, o benefício será expirado automaticamente.

Esperamos sua visita! ☀️`;

    // Quantos dias antes do vencimento mostrar o botão laranja
    const DIAS_ALERTA_EXPIR = 7;

    // ============================================================
    //  UTILITÁRIOS
    // ============================================================

    function parseDate(str) {
        const p = str.trim().split('/');
        if (p.length === 3) return new Date(+p[2], +p[1] - 1, +p[0]);
        return null;
    }

    function daysUntil(date) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return Math.floor((date - now) / 86400000);
    }

    function cleanPhone(raw) {
        let n = raw.replace(/\D/g, '');
        if (!n.startsWith('55') && n.length >= 10) n = '55' + n;
        return n;
    }

    // ============================================================
    //  BOTÃO DO WHATSAPP
    // ============================================================

    function createButton(phone, msg, type) {
        const a = document.createElement('a');
        a.href = `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(msg)}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.id = 'wa_modal_btn';

        Object.assign(a.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '10px 20px',
            margin: '16px auto 4px auto',
            maxWidth: '240px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '700',
            fontFamily: 'sans-serif',
            color: '#fff',
            textDecoration: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            transition: 'opacity 0.2s',
            backgroundColor: type === 'ativo' ? '#25D366' : '#FF9800',
        });

        a.innerHTML = type === 'ativo'
            ? '📲 Enviar WhatsApp — Bônus Ativo'
            : '⚠️ Enviar WhatsApp — A Expirar';

        a.addEventListener('mouseenter', () => a.style.opacity = '0.85');
        a.addEventListener('mouseleave', () => a.style.opacity = '1');

        return a;
    }

    // ============================================================
    //  LÓGICA DO MODAL
    // ============================================================

    let lastPhone = null;

    function processModal() {
        const nameEl = document.getElementById('name_cli_modal');
        const phoneEl = document.getElementById('cel_cli_modal');
        const balanceEl = document.getElementById('saldo_cli_modal');
        const validEl = document.getElementById('validade_cli_modal');

        if (!nameEl || !phoneEl || !balanceEl || !validEl) return;

        const name = nameEl.innerText.trim();
        const phone = phoneEl.innerText.trim();
        const balance = balanceEl.innerText.trim();
        const validDateStr = validEl.innerText.trim();

        if (!name || !phone || !balance || !validDateStr) return;

        // Só refaz o botão se mudou de cliente
        if (phone === lastPhone && document.getElementById('wa_modal_btn')) return;
        lastPhone = phone;

        // Remove botão anterior se existir
        const existing = document.getElementById('wa_modal_btn');
        if (existing) existing.remove();

        const expireDate = parseDate(validDateStr);
        if (!expireDate) return;

        const daysLeft = daysUntil(expireDate);
        if (daysLeft < 0) return; // bônus já expirou, não exibe botão

        const type = daysLeft <= DIAS_ALERTA_EXPIR ? 'expirando' : 'ativo';
        const template = type === 'ativo' ? MSG_BONUS_ATIVO : MSG_BONUS_EXPIRANDO;

        const formattedBalance = `R$ ${balance}`;
        const msg = template
            .replace('{nome}', name)
            .replace('{valor}', formattedBalance)
            .replace('{validade}', validDateStr);

        const btn = createButton(phone, msg, type);

        // Injeta logo após os botões "Exportar" e "Visualizar" existentes
        const modalBody = document.querySelector('.modal-body.text-center');
        if (modalBody) modalBody.appendChild(btn);
    }

    // ============================================================
    //  OBSERVER COM DEBOUNCE
    // ============================================================

    let debounceTimer = null;

    function onMutation() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (document.getElementById('name_cli_modal')) {
                processModal();
            }
        }, 120);
    }

    function init() {
        const body = document.body || document.querySelector('body');
        if (!body) return;

        const observer = new MutationObserver(onMutation);
        observer.observe(body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }

})();
