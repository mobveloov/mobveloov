> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Deletar webhook de engajamento

> Deleta um webhook de engajamento a partir de seu ID. Regras importantes:
- Envio de eventos do webhook removido para em até 5 minutos após deleção.



## OpenAPI

````yaml pages/v2/openapi-corridas.json DELETE /engajamento/{id}
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
  /engajamento/{id}:
    delete:
      summary: Deletar webhook de engajamento
      description: >-
        Deleta um webhook de engajamento a partir de seu ID. Regras importantes:

        - Envio de eventos do webhook removido para em até 5 minutos após
        deleção.
      parameters:
        - name: id
          in: path
          required: true
          description: Id do webhook
          schema:
            type: integer
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                message: Webhook de engajamento excluído com sucesso.
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