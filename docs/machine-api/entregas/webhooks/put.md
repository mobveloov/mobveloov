> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Atualizar webhook

> Permite atualizar a url de um webhook. É possível uma central atualizar o webhook de uma empresa cadastrada em sua operação.



## OpenAPI

````yaml pages/v2/openapi-entregas.json PUT /webhooks/{id}
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
  /webhooks/{id}:
    put:
      summary: Atualizar webhook
      description: >-
        Permite atualizar a url de um webhook. É possível uma central atualizar
        o webhook de uma empresa cadastrada em sua operação.
      parameters:
        - name: id
          in: path
          required: true
          description: ID do webhook a ser atualizado
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                url:
                  type: string
                  description: Indica a URL que receberá o evento
              required:
                - url
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                message: Webhook atualizado com sucesso
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