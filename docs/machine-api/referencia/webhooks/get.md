> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Listar webhooks

> Permite visualizar os webhooks cadastrados.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /webhooks
openapi: 3.1.0
info:
  title: API de Integração
  description: API de Integração v2 - Corridas
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
  /webhooks:
    get:
      summary: Listar webhooks
      description: Permite visualizar os webhooks cadastrados.
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                data:
                  webhooks:
                    - id: '5'
                      tipo: posicao
                      responsavel: corrida
                      url: https://teste-2.com
                    - id: '6'
                      tipo: posicao
                      responsavel: solicitante
                      url: https://url-de-teste-2.com
                  quantidade_webhooks: 2
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