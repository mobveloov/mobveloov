> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Editar endereço

> Atualiza um endereço do consumidor. Apenas os campos enviados são alterados (cobre editar o endereço completo ou apenas o complemento). Requer Api-Key (bandeira) + autenticação HTTP Basic do gestor da empresa; uso obrigatório de HTTPS.



## OpenAPI

````yaml pages/v2/openapi-entregas.json PATCH /consumidores/{id}/enderecos/{enderecoId}
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
  /consumidores/{id}/enderecos/{enderecoId}:
    patch:
      summary: Editar endereço
      description: >-
        Atualiza um endereço do consumidor. Apenas os campos enviados são
        alterados (cobre editar o endereço completo ou apenas o complemento).
        Requer Api-Key (bandeira) + autenticação HTTP Basic do gestor da
        empresa; uso obrigatório de HTTPS.
      parameters:
        - name: id
          in: path
          required: true
          description: ID do consumidor
          schema:
            type: integer
        - name: enderecoId
          in: path
          required: true
          description: ID do endereço
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                endereco:
                  type: string
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
                latitude:
                  type: number
                longitude:
                  type: number
                place_id:
                  type: string
                  description: Identificador do Google Places, usado para deduplicação.
            example:
              complemento: Apto 31
        description: >-
          Atualização parcial: envie ao menos um campo para atualizar; apenas os
          campos enviados são alterados.
      responses:
        '200':
          description: Atualizado
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                data:
                  atualizado: true
        '400':
          description: Nenhum campo para atualizar
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: Informe ao menos um campo para atualizar.
        '403':
          description: Endereço de outro consumidor
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: Dados inválidos.
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
                    message: Endereço não encontrado.
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