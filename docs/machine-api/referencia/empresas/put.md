> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Atualizar empresa

> Esse endpoint permite a atualização de dados da empresa (status ou número de contrato), sendo necessário informar o id da empresa que se deseja atualizar.



## OpenAPI

````yaml pages/v2/openapi-corridas.json PUT /empresas/{id}
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
  /empresas/{id}:
    put:
      summary: Atualizar empresa
      description: >-
        Esse endpoint permite a atualização de dados da empresa (status ou
        número de contrato), sendo necessário informar o id da empresa que se
        deseja atualizar.
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                status_empresa:
                  type: string
                  enum:
                    - A
                    - S
                    - G
                  description: A - Ativo, S - Suspenso, G - Aguardando Ativação
                numero_contrato:
                  type: integer
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                message: Empresa atualizada com sucesso
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