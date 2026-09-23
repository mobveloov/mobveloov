> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Criar webhook de engajamento

> Cria um webhook de engajamento a partir de uma URL. Regras importantes:
- Os Headers são opcionais e limitados a 10 chaves;
- Não é possível criar 2 webhooks com a mesma URL.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /engajamento
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
  /engajamento:
    post:
      summary: Criar webhook de engajamento
      description: |-
        Cria um webhook de engajamento a partir de uma URL. Regras importantes:
        - Os Headers são opcionais e limitados a 10 chaves;
        - Não é possível criar 2 webhooks com a mesma URL.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - url
              properties:
                url:
                  type: string
                  description: URL Para envio dos eventos
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
                message: Webhook de engajamento criado com sucesso.
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