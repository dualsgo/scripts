# Mapeamento - OMS (Página de Detalhes do Pedido - Pronto para Envio)

## 1. Estrutura e Objetivo
- **Controlador Base:** `fulfillmentViewController`.
- **Status:** `<span class="order-status send_ready">Pronto para envio</span>`
- Ocorre imediatamente após o operador validar o volume no Modal de "Preparar Entrega".

## 2. Mudança Visual e Ações
Neste momento, o botão principal azul some. As ações passam a residir no dropdown "Outras ações":
- `actionManager.showCustomTemplate('shipmentTag', fulfillment)` -> Imprime Etiqueta.
- `actionManager.showInvoicePdf(fulfillment)` -> Imprime Nota Fiscal.

## 3. A Ilusão de Conclusão (O Gargalo Comprovado)
Ao chegar nesta tela (ou após imprimir pelo modal), o sistema não faz nenhum alerta para o usuário ir até a aba de **Lista de Despacho**. O status fica parado em `send_ready`, o que, na visão da loja, significa que a caixa está pronta, mas o sistema de logística não será acionado.

## 4. Próximo Passo
Aguardando o DOM da página de "Lista de Despacho" (menu `Envio e retirada -> Lista de despacho`) para mapear o gatilho final. A ideia de injetar o aviso no modal anterior ou um botão flutuante nesta tela nos levará diretamente para lá.
