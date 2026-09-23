> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Obter clientes

> Quando acionada, são retornados todos os clientes da central conforme os parâmetros informados.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /clientes
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
  /clientes:
    get:
      summary: Obter clientes
      description: >-
        Quando acionada, são retornados todos os clientes da central conforme os
        parâmetros informados.
      parameters:
        - name: id
          in: query
          description: >-
            ID do cliente de que se deseja saber informações, caso seja
            informado, os demais parâmetros serão ignorados. Caso não seja
            informado, retornará todos os clientes conforme os limites
            informados. O limite padrão é 20 e o máximo é 100.
          schema:
            type: integer
        - name: status_cliente
          in: query
          description: |-
            Filtra os clientes pelo status:

            A: Ativo
            I: Inativo
            S: Suspenso
            G: Aguardando ativação
          schema:
            type: string
            enum:
              - A
              - I
              - S
              - G
        - name: limite
          in: query
          description: >-
            Quantidade de clientes retornados. O limite padrão é 20 e o máximo é
            100.
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: pagina
          in: query
          description: Qual início da contagem para o limite. O padrão é 1.
          schema:
            type: integer
            default: 1
        - name: ultimo_acesso_apos
          in: query
          description: >-
            Filtra clientes com último acesso ao app a partir desta data
            (inclusive). Formato ISO-8601 UTC. É um filtro de segmento: preserva
            a paginação e é combinável com `status_cliente`. Exclui clientes com
            último acesso nulo — para buscar quem nunca acessou o app, use
            `nunca_acessou`.
          schema:
            type: string
            format: date-time
        - name: ultimo_acesso_antes_de
          in: query
          description: >-
            Filtra clientes com último acesso ao app antes desta data
            (exclusive). Formato ISO-8601 UTC. É um filtro de segmento: preserva
            a paginação e é combinável com `status_cliente`. Exclui clientes com
            último acesso nulo — para buscar quem nunca acessou o app, use
            `nunca_acessou`.
          schema:
            type: string
            format: date-time
        - name: nunca_acessou
          in: query
          description: >-
            Quando `true` ou `1`, retorna somente os clientes que nunca
            acessaram o app (último acesso nulo).
          schema:
            type: boolean
      responses:
        '200':
          description: Sucesso
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