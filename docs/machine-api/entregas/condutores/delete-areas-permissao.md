> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Desvincular área de permissão do condutor

> Desvincula um condutor de uma área de permissão.



## OpenAPI

````yaml pages/v2/openapi-entregas.json DELETE /condutores/{id}/areas-permissao
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
  /condutores/{id}/areas-permissao:
    delete:
      summary: Desvincular área de permissão do condutor
      description: Desvincula um condutor de uma área de permissão.
      parameters:
        - name: id
          in: path
          required: true
          description: Identificador numérico do condutor.
          schema:
            type: integer
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                message: Condutor atualizado com sucesso
        '404':
          description: Condutor não encontrado
          content:
            application/json:
              example:
                success: false
                errors:
                  - code: 56
                    message: Condutor não encontrado.
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