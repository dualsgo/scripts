# Mapeamento - OMS (Página de Pendentes)

## 1. Estrutura da Página e Controladores
- **Controlador Base:** `fulfillmentsController`
- **Tabela Principal:** A listagem dos pedidos pendentes é renderizada dentro da `<table class="table table-bordered table-striped waiting-fulfillments">`.
- **Renderização da Lista:** As linhas utilizam `ng-repeat="item in $ctrl._gen.data.list"` e iteram sobre os objetos de `fulfillment`.

## 2. Seletores e Elementos Chave para o Monitor

| Elemento | Seletor CSS / Atributo | Ação / Utilidade para Automação |
|---|---|---|
| **Botão "Atualizações"** | `.btn.load-new-orders` | Quando visível (sem `.ng-hide`), indica que novos pedidos chegaram no back-end. Podemos injetar um script que clica nele automaticamente para manter a tela sempre atualizada. |
| **Linha do Pedido (Tr)** | `tr.ng-scope` dentro de `tbody` | Podemos contar as linhas para saber o volume exato na tela. |
| **Alerta de Vencimento** | `.expiring-fulfillment` ou `.expired-fulfillment` (nas `<td>`) | Ótimo gatilho para o Monitor destacar visualmente (piscar em vermelho) as linhas de pedidos atrasados ou quase atrasados. |
| **Código do Pedido** | `.table-order-id span` | Permite extrair o número do pedido (ex: `v35944613rihp-01`) para exibir no monitor ou registrar log. |
| **Tipo de Frete** | `.shipping-type` | Indica se é "Retirada em loja", "Eu Entrego", etc. Útil se precisarmos priorizar algum tipo específico (ex: Frete Expressa). |
| **Checkbox do Pedido** | `input[type="checkbox"][ng-model="fulfillment.isSelected"]` | Usado para selecionar um pedido específico na tela. |
| **Checkbox Selecionar Todos** | `input#selectedAll` | Permite marcar todos os pedidos de uma vez. |

## 3. Botões de Ação e Automação

Existem dois caminhos possíveis para automatizar a ida do pedido para Separação/Despacho:

1. **Ação Individual (Botão OK)**
   Cada linha possui um botão de "Separar Entrega":
   ```html
   <button class="btn btn-default btn-sm" uib-tooltip="Separar Entrega" ng-click="$ctrl.callAction(button.name, fulfillment)">
     <span class="glyphicon glyphicon-ok"></span>
   </button>
   ```
   *Pode ser clicado via script (DOM click) para processar uma por vez.*

2. **Ação em Lote (Botão Separar Principal)**
   No topo, há um botão para processar todos os selecionados:
   ```html
   <button id="defaultPrintSeparation" class="btn btn-primary btn-separation" ng-click="pickFulfillment(fulfillments)">Separar</button>
   ```
   *Para automação em lote, o script poderia clicar em `#selectedAll` e depois em `#defaultPrintSeparation` (ou nas opções do dropdown como `#separateByOrder`).*

## 4. Estratégia de Injeção
- **Monitor Passivo:** Um observador (MutationObserver) na `table.waiting-fulfillments tbody`. Quando surgir a classe `.expired-fulfillment`, adicionamos um som e uma animação CSS `pulse` na linha.
- **Automação Ativa:** Um `setInterval` (ou observer na notificação `.load-new-orders`) que clica no botão de novas atualizações. Se um pedido expresso ("Receba em até 2 dias") cair na tela, o bot pode automaticamente marcá-lo e clicar em "Separar Entrega" imediatamente.
