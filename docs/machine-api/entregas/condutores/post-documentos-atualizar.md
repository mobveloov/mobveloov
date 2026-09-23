> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Atualizar documento do condutor

> Atualiza um documento específico do condutor com upload de arquivo.



## OpenAPI

````yaml pages/v2/openapi-entregas.json POST /condutores/{id}/documentos/atualizar
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
  /condutores/{id}/documentos/atualizar:
    post:
      summary: Atualizar documento do condutor
      description: Atualiza um documento específico do condutor com upload de arquivo.
      parameters:
        - name: id
          in: path
          required: true
          description: Identificador numérico do condutor.
          schema:
            type: integer
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required:
                - tipo
                - foto
              properties:
                tipo:
                  type: string
                  description: Tipo do documento a ser atualizado.
                foto:
                  type: string
                  format: binary
                  description: Arquivo do documento enviado por `multipart/form-data`.
      responses:
        '200':
          description: Documento atualizado com sucesso
          content:
            application/json:
              example:
                success: true
                message: Foto alterada com sucesso
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