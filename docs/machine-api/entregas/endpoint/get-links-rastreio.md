> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Obter links de rastreio

> Permite obter os links de rastreio para todos os pedidos de uma solicitação de entrega. Também gera o código de confirmação do pedido quando a configuração da central "Solicitar código de confirmação de entrega dos pedidos" estiver ativa.



## OpenAPI

````yaml pages/v2/openapi-entregas.json GET /entregas/{id}/links-rastreio
openapi: 3.1.0
info:
  title: API de Integração
  description: API de Integração v2 - Entregas
  license:
    name: MIT
  version: 2.0.0
servers:
  - url: https://api-vendas.taximachine.com.br/api/v2/integracao
  - url: https://api.taximachine.com.br/api/v2/integracao
security:
  - basicAuth: []
    ApiKeyAuth: []
paths:
  /entregas/{id}/links-rastreio:
    get:
      summary: Obter links de rastreio
      description: >-
        Permite obter os links de rastreio para todos os pedidos de uma
        solicitação de entrega. Também gera o código de confirmação do pedido
        quando a configuração da central "Solicitar código de confirmação de
        entrega dos pedidos" estiver ativa.
      parameters:
        - name: id
          in: path
          required: true
          description: id da solicitação de entrega
          schema:
            type: integer
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  - parada_id: '46868'
                    link_rastreio: https://link-rastreio/pedido/rastreio/fd15b167
                    codigo_confirmacao: 3622
                  - parada_id: '46869'
                    link_rastreio: https://link-rastreio/pedido/rastreio/2372c587
                    codigo_confirmacao: 2335
                  - parada_id: '46870'
                    link_rastreio: https://link-rastreio/pedido/rastreio/577e0a2f
                    codigo_confirmacao: 1056
components:
  securitySchemes:
    basicAuth:
      type: http
      scheme: basic
    ApiKeyAuth:
      type: apiKey
      in: header
      name: api-key
      description: Obrigatório. Sua chave API.

````