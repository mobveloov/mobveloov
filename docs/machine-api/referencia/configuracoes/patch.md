> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Atualizar configurações

> Permite alterar as configurações da sua central.



## OpenAPI

````yaml pages/v2/openapi-corridas.json PATCH /configuracoes
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
  /configuracoes:
    patch:
      summary: Atualizar configurações
      description: Permite alterar as configurações da sua central.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                permitir_solicitacao_espera:
                  type: boolean
                  description: >-
                    Opcional. Indica se deve habilitar as solicitações em
                    espera. Use `true` para habilitar e `false` para
                    desabilitar.
                distancia_km_solicitacao_espera:
                  type: number
                  format: float
                  minimum: 0.25
                  maximum: 10
                  description: >-
                    Opcional. Distância em quilômetros entre o ponto atual do
                    condutor e o destino informado de finalização da corrida
                    para que o condutor receba uma solicitação em espera. Aceita
                    valores entre `0.25` e `10.0`.
                limite_cancelamentos_permitidos:
                  type: integer
                  minimum: 0
                  description: >-
                    Opcional. Quantidade limite de cancelamentos permitidos pelo
                    condutor. A configuração `Habilita a punição por
                    cancelamentos` deve estar habilitada.
            example:
              permitir_solicitacao_espera: true
              distancia_km_solicitacao_espera: 0.25
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                message: Central modificada com sucesso.
        '400':
          description: Erro de validação
          content:
            application/json:
              schema:
                type: object
              examples:
                body_vazio:
                  summary: Body vazio
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''body'': Informe ao menos um campo para atualização.'
                booleano_invalido:
                  summary: Booleano inválido
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          'permitir_solicitacao_espera': Deve ser um valor
                          booleano (true ou false).
                distancia_fora_intervalo:
                  summary: Distância fora do intervalo
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          'distancia_km_solicitacao_espera': Deve estar entre
                          0.25 e 10.0.
                limite_invalido:
                  summary: Limite inválido
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          'limite_cancelamentos_permitidos': Deve ser um inteiro
                          maior ou igual a 0.
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