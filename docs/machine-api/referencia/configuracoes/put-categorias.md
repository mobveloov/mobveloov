> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Atualizar categoria

> Permite atualizar os dados de uma categoria da central.



## OpenAPI

````yaml pages/v2/openapi-corridas.json PUT /configuracoes/categorias/{id}
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
  /configuracoes/categorias/{id}:
    put:
      summary: Atualizar categoria
      description: Permite atualizar os dados de uma categoria da central.
      parameters:
        - name: id
          in: path
          required: true
          description: Id da categoria
          schema:
            type: integer
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                exibir_no_app:
                  type: boolean
                  description: >-
                    Indica se a categoria deve ser exibida no app. Se true,
                    exibe a categoria no aplicativo. Se false, a categoria deixa
                    de ser exibida no aplicativo.
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                message: Categoria modificada com sucesso!
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