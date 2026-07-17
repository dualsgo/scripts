# Mapeamento - OMS (Página de Detalhes do Pedido - Conferido / Faturar)

## 1. Estrutura da Página e Controladores
- **Controlador Base:** `fulfillmentViewController`.
- **Status Atualizado:** Após acionar o fechamento de volume na etapa de separação, a página muda para o status `<span class="order-status checked">Conferido</span>`.
- **Comportamento dos Itens:** As linhas da tabela de produtos recebem a classe `.product-checked` e a quantidade muda de `0/3` para `3/3`.

## 2. Seletores e Elementos Chave para Automação (Faturamento)

| Elemento | Seletor CSS / Atributo | Ação / Utilidade para Automação |
|---|---|---|
| **Botão Faturar** | `button[ng-click="actionManager.billingFulfillments(fulfillment)"]` | Como você observou, este é o botão alvo. Ao ser clicado, envia os dados para gerar a nota (Sefaz) e empurra o pedido para a etapa final ("Preparar Entrega"). |

## 3. Planejamento da Automação

**O Pedido do Usuário:** *"Nessa etapa, depois de separar, aparece o botão faturar. Se ele fosse automático, também aceleraria."*

**Como vamos resolver isso via Script / Monitor:**
Podemos criar um gatilho de transição perfeita e ininterrupta:
1. Na aba de "Separação", nosso script força o preenchimento massivo do código de barras (já mapeado anteriormente).
2. O script aciona `increaseVolumes()` ("Fechar volume").
3. Imediatamente após fechar o volume, o Angular atualiza o status para **Conferido** e exibe o botão Faturar.
4. O script do Monitor ficará "escutando" esse estado. Assim que o DOM mostrar a classe `.checked` e o botão `actionManager.billingFulfillments(fulfillment)` ficar visível, **o script engatilhará o `.click()` dele automaticamente.**

**Benefício Real:**
O operador da loja não precisa mais "Bipar item a item -> clicar em Fechar Volume -> Esperar carregar -> Clicar em Faturar". A automação fará do "Separação" direto para a "Fila do Sefaz" num único piscar de olhos. Isso conectará incrivelmente com a nossa última automação que limpa a tela de "Preparar Entrega" (Sefaz ok -> Lista de Despacho automática). 

Em essência, a esteira rodará sozinha da Separação até a Prateleira de Coleta!
