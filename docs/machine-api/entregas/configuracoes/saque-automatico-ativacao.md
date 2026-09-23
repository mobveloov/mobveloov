> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Ativar ou desativar saque automático

> Ativa ou desativa o saque automático da integração autenticada.



## OpenAPI

````yaml pages/v2/openapi-entregas.json POST /configuracoes/saque-automatico/ativacao
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
  /configuracoes/saque-automatico/ativacao:
    post:
      summary: Ativar ou desativar saque automático
      description: Ativa ou desativa o saque automático da integração autenticada.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - ativar
              additionalProperties: false
              properties:
                ativar:
                  type: boolean
                  description: >-
                    Obrigatório. Informe `true` para ativar o saque automático
                    ou `false` para desativar.
            examples:
              ativar:
                summary: Ativar saque automático
                value:
                  ativar: true
              desativar:
                summary: Desativar saque automático
                value:
                  ativar: false
      responses:
        '200':
          description: Saque automático atualizado com sucesso
          content:
            application/json:
              schema:
                type: object
              examples:
                ativado:
                  summary: Saque automático ativado
                  value:
                    success: true
                    data:
                      ativar: true
                    message: Saque automático ativado.
                desativado:
                  summary: Saque automático desativado
                  value:
                    success: true
                    data:
                      ativar: false
                    message: Saque automático desativado.
        '400':
          description: Erro de validação
          content:
            application/json:
              schema:
                type: object
              examples:
                campo_obrigatorio:
                  summary: Campo ativar ausente
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''ativar'': Preenchimento obrigatório.'
                tipo_invalido_string:
                  summary: Campo ativar enviado como string
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''ativar'': Deve ser um booleano.'
                tipo_invalido_inteiro:
                  summary: Campo ativar enviado como inteiro
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''ativar'': Deve ser um booleano.'
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