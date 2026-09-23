> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Cancelar corrida

> Cancela uma corrida existente pelo motivo informado.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /corridas/{id}/cancelar
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
  /corridas/{id}/cancelar:
    post:
      summary: Cancelar corrida
      description: Cancela uma corrida existente pelo motivo informado.
      parameters:
        - name: id
          in: path
          required: true
          description: Identificador interno da corrida.
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - motivo_id
              properties:
                motivo_id:
                  type: integer
                  description: Motivo de cancelamento.
            example:
              motivo_id: 3
      responses:
        '200':
          description: Corrida cancelada com sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                message: Corrida cancelada com sucesso
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