> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Cancelar entrega

> Cancela a solicitação de entrega, modificando seu status para `C`. A solicitação não pode ter sido finalizada, cancelada ou não atendida anteriormente.



## OpenAPI

````yaml pages/v2/openapi-entregas.json POST /entregas/{id}/cancelar
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
  /entregas/{id}/cancelar:
    post:
      summary: Cancelar entrega
      description: >-
        Cancela a solicitação de entrega, modificando seu status para `C`. A
        solicitação não pode ter sido finalizada, cancelada ou não atendida
        anteriormente.
      parameters:
        - name: id
          in: path
          required: true
          description: ID da solicitação de entrega
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                motivo_id:
                  type: integer
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                message: Entrega cancelada com sucesso
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