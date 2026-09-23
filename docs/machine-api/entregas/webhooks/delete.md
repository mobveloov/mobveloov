> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Deletar webhook

> Permite deletar um webhook.



## OpenAPI

````yaml pages/v2/openapi-entregas.json DELETE /webhooks/{id}
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
    delete:
      summary: Deletar webhook
      description: Permite deletar um webhook.
      parameters:
        - name: id
          in: path
          required: true
          description: ID do webhook a ser deletado
          schema:
            type: string
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                message: Webhook deletado com sucesso
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