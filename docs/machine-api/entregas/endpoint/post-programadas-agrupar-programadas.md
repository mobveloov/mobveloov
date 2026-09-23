> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Agrupar programadas em uma programada

> Agrupa uma ou mais entregas programadas na entrega programada agrupadora informada em `{id}`. A agrupadora **preserva o seu identificador** e passa a conter as paradas de todas as programadas; as programadas informadas no corpo passam para a situação `agrupado`. A empresa, a categoria, o tipo de pagamento, o retorno e a data/hora do disparo são obtidos automaticamente da programada agrupadora. A estimativa da corrida e a ordenação das paradas são calculadas pelo servidor — consulte o valor recalculado em `GET /entregas/programadas/{id}`.

Todas as programadas precisam estar aguardando disparo, pertencer à mesma empresa, partir do mesmo ponto de coleta e estar a mais de 60 segundos do disparo.



## OpenAPI

````yaml pages/v2/openapi-entregas.json POST /entregas/programadas/{id}/agrupar
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
  /entregas/programadas/{id}/agrupar:
    post:
      summary: Agrupar entregas programadas em uma programada
      description: >-
        Agrupa uma ou mais entregas programadas na entrega programada agrupadora
        informada em `{id}`. A agrupadora **preserva o seu identificador** e
        passa a conter as paradas de todas as programadas; as programadas
        informadas no corpo passam para a situação `agrupado`. A empresa, a
        categoria, o tipo de pagamento, o retorno e a data/hora do disparo são
        obtidos automaticamente da programada agrupadora. A estimativa da
        corrida e a ordenação das paradas são calculadas pelo servidor —
        consulte o valor recalculado em `GET /entregas/programadas/{id}`.


        Todas as programadas precisam estar aguardando disparo, pertencer à
        mesma empresa, partir do mesmo ponto de coleta e estar a mais de 60
        segundos do disparo.
      parameters:
        - name: id
          in: path
          required: true
          description: >-
            ID da entrega programada agrupadora (a que receberá o agrupamento e
            mantém o seu identificador)
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
                    na programada agrupadora. Informar a própria agrupadora
                    nesta lista é inócuo: o identificador é descartado.
                  items:
                    type: integer
                    description: ID da entrega programada a ser agrupada
              required:
                - programadas_agrupadas
            example:
              programadas_agrupadas:
                - 456
                - 789
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
                lista_vazia:
                  summary: Lista de programadas vazia
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
                falha_gravacao:
                  summary: Falha ao gravar a programada agrupada
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: Não foi possível salvar a solicitação.
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
          description: >-
            Programada agrupadora ou alguma das programadas informadas não
            encontrada na bandeira
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: Programada não encontrada
        '406':
          description: >-
            Situação não aceitável — alguma programada não está aguardando
            disparo
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: >-
                      A programada não está em uma situação aceitável para o
                      agrupamento
        '409':
          description: >-
            Conflito — agrupamento concorrente em andamento ou mínimo de pedidos
            não atingido
          content:
            application/json:
              schema:
                type: object
              examples:
                agrupamento_em_andamento:
                  summary: Já existe um agrupamento em andamento para esta programada
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          Já existe um agrupamento em andamento para esta
                          solicitação
                minimo_pedidos:
                  summary: Mínimo de pedidos não atingido
                  value:
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
                  summary: Programadas de empresas diferentes
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          Não é possível agrupar entregas de empresas
                          diferentes. Verifique se todas as solicitações
                          pertencem à mesma empresa da entrega agrupadora.
                coleta_distinta:
                  summary: Pontos de coleta diferentes
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          Pedidos com endereços de coleta distintos não podem
                          ser agrupados.
                disparo_curto:
                  summary: Programada muito próxima do disparo
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          Pedidos com menos de 60 segundos para o disparo não
                          podem ser agrupados.
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