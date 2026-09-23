> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Excluir endereço

> Exclui um endereço do consumidor da empresa do gestor. Requer Api-Key (bandeira) + autenticação HTTP Basic do gestor da empresa; uso obrigatório de HTTPS.



## OpenAPI

````yaml pages/v2/openapi-entregas.json DELETE /consumidores/{id}/enderecos/{enderecoId}
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
    delete:
      summary: Excluir endereço
      description: >-
        Exclui um endereço do consumidor da empresa do gestor. Requer Api-Key
        (bandeira) + autenticação HTTP Basic do gestor da empresa; uso
        obrigatório de HTTPS.
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
      responses:
        '200':
          description: Excluído
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                data:
                  excluido: true
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