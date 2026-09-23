> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Criar endereço

> Cria um endereço para um consumidor da empresa do gestor. Endereços duplicados (mesmo place_id) ou a menos de 5 metros de um já cadastrado são rejeitados. Requer Api-Key (bandeira) + autenticação HTTP Basic do gestor da empresa; uso obrigatório de HTTPS.



## OpenAPI

````yaml pages/v2/openapi-entregas.json POST /consumidores/{id}/enderecos
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
  /consumidores/{id}/enderecos:
    post:
      summary: Criar endereço
      description: >-
        Cria um endereço para um consumidor da empresa do gestor. Endereços
        duplicados (mesmo place_id) ou a menos de 5 metros de um já cadastrado
        são rejeitados. Requer Api-Key (bandeira) + autenticação HTTP Basic do
        gestor da empresa; uso obrigatório de HTTPS.
      parameters:
        - name: id
          in: path
          required: true
          description: ID do consumidor
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - endereco
                - latitude
                - longitude
              properties:
                endereco:
                  type: string
                latitude:
                  type: number
                longitude:
                  type: number
                complemento:
                  type: string
                bairro:
                  type: string
                cidade:
                  type: string
                estado:
                  type: string
                cep:
                  type: string
                place_id:
                  type: string
                  description: Identificador do Google Places, usado para deduplicação.
            example:
              endereco: Av. Brasil, 1000
              complemento: Sala 2
              bairro: Centro
              cidade: Maringá
              estado: PR
              cep: '87010000'
              latitude: -23.425
              longitude: -51.938
              place_id: ChIJ...
      responses:
        '201':
          description: Criado
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                data:
                  criado: true
        '400':
          description: Erro de validação
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: '''latitude'': Preenchimento obrigatório'
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
        '409':
          description: Conflito
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: >-
                      Endereço já cadastrado ou muito próximo de um endereço
                      existente.
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