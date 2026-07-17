# Mapeamento - OMS (Página de Detalhes do Pedido - Aguardando Orçamento)

## 1. Estrutura da Página e Controladores
- **Controlador Base:** `fulfillmentViewController`.
- **Status Atualizado:** Após clicar em Faturar, o pedido muda para `<span class="order-status billing">Aguardando orçamento</span>`. O container principal adota a classe `.fulfillment-status-billing`.
- **Timeline:** A timeline registra o passo de "Conferido" e "Aguardando orçamento".

## 2. A Dinâmica Desta Etapa
Nesta etapa, o OMS retirou o controle do operador da loja e assumiu o comando para fazer o processamento sistêmico: emitir a Nota Fiscal junto ao ERP e a SEFAZ.

**Do ponto de vista da nossa automação/monitor:**
1. O Monitor deve ficar em "estado de observação". Ele sabe que o script já apertou "Faturar" no passo anterior.
2. O script vai monitorar o DOM, aguardando essa tag `<span class="order-status billing">Aguardando orçamento</span>` sumir e dar lugar ao status **Faturado / Preparar Entrega**.
3. Se essa etapa demorar mais do que o comum (ou retornar uma mensagem de erro SEFAZ na tela), o Monitor pode emitir um **Alerta Visual** (uma borda vermelha pulsante na tela, por exemplo) para que o gerente saiba que *"O pedido XXXX travou no SEFAZ"*, permitindo ação rápida (como um reprocessamento).

## 3. Próximo Gatilho
Assim que a SEFAZ liberar e a página mudar de "Aguardando Orçamento" para "Faturado", nosso Monitor irá interceptar a classe nova e engatilhar a etapa seguinte (que nós já mapeamos lá no diretório `05-selecao-page` – a seleção e clique no botão *Preparar* para imprimir a Etiqueta de Transporte e inserir na **Lista de Despacho**).
