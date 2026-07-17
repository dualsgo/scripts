# Mapeamento - OMS (Lista de Despacho)

## 1. Estrutura e Objetivo
- **Caminho:** `/rihappy/fulfillments/shipping` (Menu: Envio e retirada -> Lista de despacho).
- **Controlador Base:** `fulfillmentShippingController`.
- **Objetivo:** Agrupar todos os pedidos "Pronto para envio" (`send_ready`) e gerar o documento oficial (PLP) que é entregue à transportadora.

## 2. O Fluxo de Ações
Quando o usuário (que não esqueceu) entra nesta tela, ele realiza o seguinte fluxo:
1. Clica no botão **Criar lista de envio** (`ng-click="showTransporterModal(fulfillments)"`).
2. O modal `modal-transporter.html` abre para selecionar a transportadora (`carrierSelected`). Ele clica em **Próximo** (`showShippingCreateList(carrierSelected)`).
3. O modal `modal-confirmation.html` abre para confirmar a quantidade de pedidos. Ele clica em **Confirmar lista** (`createPackingList(fulfillments, close)`).

## 3. A Solução para os 25% de Atraso
Como mapeamos anteriormente, o usuário costuma abandonar o processo logo após imprimir a etiqueta na tela do pedido. 
A automação fará o seguinte:
- Quando interceptar o sucesso da "Bipagem" (0101) na tela anterior, injetará um Alerta Visual e um redirecionamento forçado para `/rihappy/fulfillments/shipping`.
- Opcionalmente (ou no futuro), podemos fazer o script executar `createPackingList(fulfillments)` de forma transparente, bypassando os modais. No escopo atual, garantir que o usuário **veja** e clique nesse botão (ou que o robô faça isso ao carregar a página) eliminará o erro humano de esquecimento.

## 4. Status de Mapeamento
**CONCLUÍDO.** Todo o pipeline logístico do OMS (Pendentes -> Separação -> Faturamento -> Preparar Entrega -> Lista de Despacho) foi extraído, analisado e documentado.
O próximo passo é escrever o código da extensão (Tampermonkey/Chrome Extension) baseada neste mapa.
