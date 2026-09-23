> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Cadastrar webhook

> Permite cadastrar um webhook, sendo possível cadastrar até 5 webhooks por tipo. O webhook do tipo mensagem é limitado a 1 cadastro.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /webhooks
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
    post:
      summary: Cadastrar webhook
      description: >-
        Permite cadastrar um webhook, sendo possível cadastrar até 5 webhooks
        por tipo. O webhook do tipo mensagem é limitado a 1 cadastro.
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                tipo:
                  type: string
                  description: >-
                    Indica o tipo de webhook. Valores aceitos: posicao, status
                    ou mensagens
                  enum:
                    - posicao
                    - status
                    - mensagens
                url:
                  type: string
                  description: Indica a URL que receberá o evento
                responsavel:
                  type: string
                  description: >-
                    Obrigatório se o usuário autenticado não for de "empresa".
                    Define quem é o responsável pelo evento. Valores aceitos:
                    solicitante ou corrida. IMPORTANTE: para usuários "empresa",
                    a responsabilidade será definida automaticamente.
              required:
                - tipo
                - url
                - responsavel
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                message: Webhook criado com sucesso
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