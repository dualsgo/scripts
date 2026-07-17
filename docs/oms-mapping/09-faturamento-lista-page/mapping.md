# Mapeamento - OMS (Aba Faturamento na página de Seleção)

## 1. Estrutura e Objetivo
Esta é a visão `grid-fulfillments-billing-checking-list` dentro da página `/selection`. 
Ela exibe todos os pedidos que estão transitando da conferência física para o Sefaz. 

**Aqui é onde mora o problema de estabilidade relatado (Travamento SEFAZ).**
O sistema disponibiliza os seguintes status mapeados no `<select>`:
- `checked` (Conferido)
- `REGISTERED_SALE` (Venda Registrada)
- `INVOICING` (Aguardando Emissão Fiscal)
- `INVOICING_FAIL` (Falha no registro do Emissor Fiscal) -> **O GRANDE VILÃO!**
- `TAXING` (Aguardando GNRE)
- `BILLING` (Aguardando orçamento)

## 2. Ações de Retentativa (Fallbacks)
A interface prevê botões de retentativa manual caso o pedido fique "preso":
- `uib-tooltip="Solicitar Emissão do Orçamento"`
- `uib-tooltip="Reenviar para Faturamento"` (ícone de refresh)
Ambos disparam `$ctrl.callAction(button.name, fulfillment)`.

## 3. Estratégia de Automação e Monitoramento (Tratamento de Erros SEFAZ)

**Como nosso Monitor vai resolver isso:**
1. O nosso script que injetaremos no OMS criará uma rotina "invisível" que verifica a lista de faturamento em segundo plano.
2. Se ele detectar qualquer pedido com a classe `INVOICING_FAIL` (Falha no registro) ou pedidos "presos" em `BILLING` há mais de 10 minutos (podemos capturar o timestamp na coluna "updated-at"), ele fará duas coisas:
   - **A)** Emitirá um alerta visual/sonoro na tela do gerente (pois o gerente precisa saber que a Sefaz está instável).
   - **B)** (Opcional, se desejado) Ele pode engatilhar um auto-restart disparando o botão "Reenviar para Faturamento" automaticamente após X minutos, ou até mesmo fazer uma seleção em massa via caixa de seleção (`fulfillment.isSelected`) e apertar o botão global "Faturar" no topo.

Isso previne que a equipe esqueça os pedidos na tela de Faturamento e tome susto com atrasos horas depois. Tudo ficará visível e/ou automatizado!
