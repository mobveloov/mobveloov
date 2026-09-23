> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Editar webhook de engajamento

> Editar um webhook de engajamento a partir de seu ID. Regras importantes:
- Os Headers são limitados a 1000 chaves;
- Pode-se editar a URL ou Headers;
- Não é possível editar um webhook com mesma URL de outro já existente;
- Envio de eventos do webhook é alterado em até 5 minutos após edição.



## OpenAPI

````yaml pages/v2/openapi-corridas.json PUT /engajamento/{id}
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
    put:
      summary: Editar webhook de engajamento
      description: |-
        Editar um webhook de engajamento a partir de seu ID. Regras importantes:
        - Os Headers são limitados a 1000 chaves;
        - Pode-se editar a URL ou Headers;
        - Não é possível editar um webhook com mesma URL de outro já existente;
        - Envio de eventos do webhook é alterado em até 5 minutos após edição.
      parameters:
        - name: id
          in: path
          required: true
          description: Id do webhook
          schema:
            type: integer
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                url:
                  type: string
                  description: URL Para envio dos eventos (Opcional)
                headers:
                  type: object
                  description: >-
                    Headers utilizados no envio à URL (Opcional). Limite máximo
                    de 1000 chaves.
                  maxProperties: 1000
                  additionalProperties:
                    type: string
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                message: Webhook de engajamento atualizado com sucesso.
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