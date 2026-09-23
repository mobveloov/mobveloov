> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Obter cliente

> Retorna os detalhes de um cliente específico através do seu ID.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /clientes/{id}
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
  /clientes/{id}:
    get:
      summary: Obter cliente
      description: Retorna os detalhes de um cliente específico através do seu ID.
      parameters:
        - name: id
          in: path
          required: true
          description: ID do cliente
          schema:
            type: string
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                data:
                  - id: '1'
                    nome: Exemplo
                    email: exemplo@email.com.br
                    telefone: (11) 97772-3133
                    status_cliente: A
                    cpf: null
                    foto_url: >-
                      https://s3.amazonaws.com/exemplo-bucket/fotos/cliente-1.jpg?X-Amz-Expires=...
                    token_atualizado_em: '2026-08-20T13:45:00Z'
                    ultimo_acesso_em: '2026-08-19T22:10:00Z'
        '404':
          description: Not Found
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - Cliente não encontrado.
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