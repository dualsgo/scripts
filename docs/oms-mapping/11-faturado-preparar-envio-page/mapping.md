# Mapeamento - OMS (Página de Detalhes do Pedido - Faturado e Preparar para Envio)

## 1. Estrutura e Objetivo
- **Controlador Base:** `fulfillmentViewController`.
- **Status:** `<span class="order-status billed">Faturado</span>`
- O ciclo SEFAZ encerrou com sucesso (Venda Registrada -> Aguardando Emissão -> Emissão Confirmada -> Faturado).

## 2. O Gargalo e o Botão Identificado
O usuário capturou exatamente o momento de "Faturado", onde o sistema habilita o botão para o operador dar a confirmação final antes da lista de despacho:

```html
<button class="btn btn-primary" 
        ng-click="actionManager.showVolumesCheckingModal(fulfillment || null)">
  <span class="glyphicon glyphicon-log-out"></span> Preparar para envio
</button>
```

**O Problema (Os 25% de atraso):**
- A equipe visualiza ou deixa a tela aberta e esquece de clicar neste botão, ou então esquece de ir na lista que agrupa esses pedidos.
- Observação Importante: Há uma validação de *Tracking Number* embutida. Se a transportadora (via API) demorar para devolver o tracking number (código de rastreio), o botão fica desabilitado (`ng-disabled`). O tooltip alerta: "Ops! O tracking number desse pedido ainda não foi gerado. Tente novamente em alguns minutos!".

## 3. Estratégia de Automação para o Script
Nosso script monitor fará o seguinte:
1. Detecta o status "Faturado" (`billed`).
2. Verifica se a função `showManager.showVolumesCheckingModalButton.disabled(fulfillment)` retorna `false` (ou seja, se o tracking já existe e o botão está clicável).
3. Estando liberado, o script dispara `actionManager.showVolumesCheckingModal(fulfillment)` **automaticamente** sem o operador precisar encostar no mouse.

**Próximo Passo:**
Para fechar o pacote completo de automação, ainda precisamos mapear a tela final de "Lista de Despacho" (Envio e retirada -> Lista de despacho), onde o agrupamento das entregas faturadas acontece para gerar o documento da transportadora.
