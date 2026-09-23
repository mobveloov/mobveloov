> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Cancelar corrida programada

> Cancela uma corrida programada.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /corridas/programadas/{id}/cancelar
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
  /corridas/programadas/{id}/cancelar:
    post:
      summary: Cancelar corrida programada
      description: Cancela uma corrida programada.
      parameters:
        - name: id
          in: path
          required: true
          description: Identificador interno da corrida programada.
          schema:
            type: integer
      responses:
        '200':
          description: Corrida programada cancelada com sucesso
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