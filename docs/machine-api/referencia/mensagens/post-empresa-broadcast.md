> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Enviar mensagem no chat central de empresa

> Envia uma mensagem no chat central de empresas da bandeira. A mensagem será visível no chat geral de empresas no painel da central.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /mensagens/empresa/broadcast
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
  /mensagens/empresa/broadcast:
    post:
      summary: Enviar mensagem no chat central de empresa
      description: >-
        Envia uma mensagem no chat central de empresas da bandeira. A mensagem
        será visível no chat geral de empresas no painel da central.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - mensagem
              properties:
                mensagem:
                  type: string
                  description: >-
                    Conteúdo da mensagem a ser enviada. Máximo de 10.000
                    caracteres.
                  maxLength: 10000
                  example: Cupom DESCONTO10 liberado.
      responses:
        '200':
          description: Mensagem enviada com sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                message: Mensagem enviada com sucesso.
        '400':
          description: Erro de validação
          content:
            application/json:
              schema:
                type: object
              examples:
                campo_obrigatorio:
                  summary: Campo mensagem ausente
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''mensagem'': Preenchimento obrigatório.'
                tipo_invalido:
                  summary: Campo mensagem não é string
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''mensagem'': Deve ser uma string.'
                tamanho_excedido:
                  summary: Mensagem excede 10.000 caracteres
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          'mensagem': Excede o limite máximo de 10000
                          caracteres.
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