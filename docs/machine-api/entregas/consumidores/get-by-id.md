> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Consultar consumidor

> Retorna um consumidor da empresa do gestor, com seus endereços. Requer Api-Key (bandeira) + autenticação HTTP Basic do gestor da empresa; uso obrigatório de HTTPS.



## OpenAPI

````yaml pages/v2/openapi-entregas.json GET /consumidores/{id}
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
  /consumidores/{id}:
    get:
      summary: Consultar consumidor
      description: >-
        Retorna um consumidor da empresa do gestor, com seus endereços. Requer
        Api-Key (bandeira) + autenticação HTTP Basic do gestor da empresa; uso
        obrigatório de HTTPS.
      parameters:
        - name: id
          in: path
          required: true
          description: ID do consumidor
          schema:
            type: integer
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
                  id: 1
                  nome: Maria
                  telefone: '+5544999999999'
                  enderecos:
                    - id: 8
                      endereco: Av. Brasil, 1000
                      complemento: Sala 2
                      bairro: Centro
                      cidade: Maringá
                      estado: PR
                      cep: '87010000'
                      latitude: -23.425
                      longitude: -51.938
        '404':
          description: Não encontrado
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: Consumidor não encontrado.
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