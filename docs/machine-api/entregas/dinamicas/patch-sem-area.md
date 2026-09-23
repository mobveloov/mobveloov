> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Ativar/Desativar dinâmica sem área

> Ativa ou desativa a dinâmica sem área.



## OpenAPI

````yaml pages/v2/openapi-entregas.json PATCH /dinamicas/sem-area
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
  /dinamicas/sem-area:
    patch:
      summary: Ativar/Desativar dinâmica sem área
      description: Ativa ou desativa a dinâmica sem área.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - ativo
              properties:
                ativo:
                  description: >-
                    Indica se a dinâmica sem área ficará ativa ou inativa.
                    Também aceita `1` e `0`.
                  oneOf:
                    - type: boolean
                    - type: integer
                      enum:
                        - 0
                        - 1
            example:
              ativo: false
      responses:
        '200':
          description: Dinâmica sem área atualizada com sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                message: Dinâmica sem área atualizada com sucesso.
        '400':
          description: Erro de validação
          content:
            application/json:
              schema:
                type: object
              examples:
                campo_obrigatorio:
                  summary: Campo ativo ausente
                  value:
                    success: false
                    errors:
                      - code: 2
                        message: '''ativo'': Preenchimento obrigatório'
                booleano_invalido:
                  summary: Campo ativo inválido
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''ativo'': Deve ser um valor booleano (true ou false).'
                nenhuma_alteracao:
                  summary: Nenhuma alteração detectada
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: Nenhuma alteração detectada.
                erro_interno:
                  summary: Erro interno
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          Ocorreu um erro interno no servidor. Por favor, tente
                          novamente mais tarde.
                json_malformado:
                  summary: JSON malformado
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: JSON_INVALIDO
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