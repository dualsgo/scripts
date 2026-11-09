# Contexto & Diretrizes do Projeto Scripts Linx OMS & Automação de Loja

## 📌 Visão Geral do Repositório
Este repositório consiste em um conjunto de **Userscripts (Tampermonkey/Greasemonkey)**, **Webapps**, e **Ferramentas de Automação Node.js** projetados para otimizar as operações de loja de varejo (Ri Happy / PBKIDS) integradas com o sistema **Linx OMS**, **iFood**, **CRM Bonus** e **WhatsApp Web**.

---

## 🛠️ Módulos e Estrutura Principal

### 1. 🖥️ Monitores & Painéis OMS (Tampermonkey Userscripts)
- **`MASTER_MONITOR_OMNI.user.js` / `MASTER_SCRIPT.user.js`**:
  - Script consolidado unificado que reúne todos os recursos de monitoramento OMNI em um único arquivo: Painel TV Fullscreen, Sirenes, Monitor PC Separação/Despacho, SLA 7 Dias Retirada com WhatsApp, Coletor iFood e Coletor Rappi.
- **`build_monitor_omni.js`**:
  - Compilador Node.js (`npm run build:monitor`) que consolida todos os módulos de monitoramento OMNI no arquivo final.
- **`oms_monitor.js` / `oms_monitor_apoio_chrome.user.js` / `oms_monitor_apoio_firefox.user.js`**:
  - Módulos individuais do monitor operacional em tempo real com suporte a modo **TV / Hands-free**.
- **`oms_monitor_mobile.user.js` & `oms_monitor_pc_separacao.user.js`**:
  - Adaptações de layout do monitor para dispositivos móveis e terminais de separação em PC.
- **`rihappy_monitor_separacao.user.js`**:
  - Painel visual focado no fluxo de separação e controle de retirada de mercadorias da loja Ri Happy.

### 2. ⚡ Automação OMS & Integração WhatsApp
- **`oms-automation.user.js`**:
  - Automação de navegação, relatórios de separação, atalhos de bipagem e fluxo de separadores.
- **`whatsapp_linx.user.js`**:
  - Botão integrado no OMS para envio direto de mensagens via WhatsApp Web.
  - Gerador automático de **Declaração de Entrega (PDF/Print)** com dados do cliente e do pedido.
- **`build_master.js` & `MASTER_SCRIPT.user.js`**:
  - Script Node.js (`build_master.js`) que compila e unifica os módulos `oms-automation.user.js` e `whatsapp_linx.user.js` no arquivo final `MASTER_SCRIPT.user.js`.

### 3. 🛵 Integração de Canais Externos
- **`ifood_monitor.user.js`**:
  - Monitor do Portal/Gestor iFood. Coleta pedidos pendentes de aceite e armazena em `GM_setValue('ifoodPendingOrders')`, alertando no painel OMS em tempo real.
- **`crm_bonus_whatsapp.user.js` & diretório `CRM/`**:
  - Ferramentas de automação para o CRM Bonus (Ri Happy Carioca Shop) e envio de cashback via WhatsApp.

### 4. 📊 Aplicações Web Secundárias & Utilitários
- **`ATUPRECO/`**: App web em Vite para leitura de relatórios (`RelatorioCircularAlteracaoPreco.xls`) e atualização rápida de preços.
- **`Dash de ações/`**: Dashboard em HTML/CSS/JS para acompanhamento de planos de ação e metas da loja.
- **`Defeitos/` (`defect-auditor`)**: Sistema e planilha para auditoria e controle de produtos defeituosos.
- **`Flash/`**: Interface rápida em HTML/CSS para métricas de vendas flash.
- **`docs/oms-mapping/`**: Mapeamento estruturado das 14 páginas/telas do sistema Linx OMS (01-home-page até 14-lista-de-despacho-page).

---

## ⚙️ Padrões Tecnológicos & Boas Práticas
1. **JavaScript Vanilla / ES6+**: Tampermonkey Userscripts focados em performance DOM e baixíssima latência.
2. **Armazenamento Local Tampermonkey**: Uso de `GM_setValue` e `GM_getValue` para comunicação entre guias (ex: iFood Portal <-> Linx OMS).
3. **Compilação de Scripts**: Sempre atualizar os módulos individuais (`oms-automation.user.js`, `whatsapp_linx.user.js`) e, quando necessário, rodar `node build_master.js` para atualizar `MASTER_SCRIPT.user.js`.
4. **Resiliência de Seletores DOM**: O Linx OMS altera periodicamente classes ou IDs. As consultas ao DOM devem priorizar `aria-label`, seletores hierárquicos ou buscas por texto para evitar quebra.
5. **Estética Neon / TV Display**: O design do monitor OMS utiliza gradientes vibrantes, fontes em alto contraste e efeitos pulsares/neon para facilitar visualização em telas de TV à distância na loja.
