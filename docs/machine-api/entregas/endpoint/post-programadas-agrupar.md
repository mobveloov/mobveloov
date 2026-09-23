> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Agrupar entregas programadas

> Agrupa uma ou mais entregas programadas na entrega agrupadora em andamento informada em `{id}`. Opcionalmente, também é possível agrupar entregas em andamento (`solicitacoes_agrupadas`). A empresa, a categoria, o tipo de pagamento e o retorno são obtidos automaticamente da entrega agrupadora. A estimativa da corrida e a ordenação das paradas também são calculadas pelo servidor.



## OpenAPI

````yaml pages/v2/openapi-entregas.json POST /entregas/{id}/agrupar/programadas
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
  /entregas/{id}/agrupar/programadas:
    post:
      summary: Agrupar entregas programadas a solicitações em andamento
      description: >-
        Agrupa uma ou mais entregas programadas na entrega agrupadora em
        andamento informada em `{id}`. Opcionalmente, também é possível agrupar
        entregas em andamento (`solicitacoes_agrupadas`). A empresa, a
        categoria, o tipo de pagamento e o retorno são obtidos automaticamente
        da entrega agrupadora. A estimativa da corrida e a ordenação das paradas
        também são calculadas pelo servidor.
      parameters:
        - name: id
          in: path
          required: true
          description: >-
            ID da entrega agrupadora (entrega em andamento que receberá o
            agrupamento)
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                programadas_agrupadas:
                  type: array
                  description: >-
                    Lista dos IDs das entregas programadas que serão agrupadas
                    na agrupadora
                  items:
                    type: integer
                    description: ID da entrega programada a ser agrupada
                solicitacoes_agrupadas:
                  type: array
                  description: >-
                    Lista opcional dos IDs das entregas em andamento que também
                    serão agrupadas na agrupadora
                  items:
                    type: integer
                    description: ID da entrega a ser agrupada
              required:
                - programadas_agrupadas
            example:
              programadas_agrupadas:
                - 123
              solicitacoes_agrupadas:
                - 1234
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                message: Solicitações agrupadas com sucesso!
        '400':
          description: >-
            Requisição inválida — erro de validação do payload ou regra de
            negócio violada
          content:
            application/json:
              schema:
                type: object
              examples:
                campos_obrigatorios:
                  summary: Campos obrigatórios ausentes
                  value:
                    success: false
                    errors:
                      - code: 2
                        message: '''programadas_agrupadas'': Preenchimento obrigatório'
                tipo_invalido:
                  summary: Identificador não numérico
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''solicitacao_agrupadora'': Deve ser numérico.'
                lista_vazia:
                  summary: Lista de entregas vazia
                  value:
                    success: false
                    errors:
                      - code: 2
                        message: >-
                          'programadas_agrupadas': Deve conter ao menos 1
                          item(ns).
                limite_excedido:
                  summary: Limite de paradas da entrega excedido
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          Uma solicitação pode conter no máximo 10 paradas. Sua
                          solicitação contém 12. Reduza o número de paradas para
                          prosseguir.
                em_juncao_automatica:
                  summary: Programada em uso pela junção automática
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          A solicitação que você tentou alterar está sendo
                          utilizada no processo de junção automática e será
                          liberada em instantes. Você será redirecionado para a
                          tela inicial.
                agrupada_automaticamente:
                  summary: Programada já agrupada automaticamente
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          A solicitação que você tentou alterar foi agrupada
                          automaticamente e nenhuma alteração pode ser feita.
                          Você será redirecionado para a tela inicial.
        '401':
          description: Não autorizado — bandeira não identificada na requisição
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: Você não está autorizado a acessar este recurso.
        '404':
          description: Entrega agrupadora não encontrada na bandeira
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: Solicitação não encontrada
        '409':
          description: Conflito — o agrupamento não possui o mínimo de pedidos necessário
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: Não tem no mínimo 2 pedidos
        '422':
          description: Entidade não processável — regra de negócio do agrupamento violada
          content:
            application/json:
              schema:
                type: object
              examples:
                empresa_divergente:
                  summary: Entregas de empresas diferentes
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          Não é possível agrupar entregas de empresas
                          diferentes. Verifique se todas as solicitações
                          pertencem à mesma empresa da entrega agrupadora.
                falha_estimativa:
                  summary: Falha ao calcular a estimativa da corrida
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: Não foi possível calcular a estimativa.
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