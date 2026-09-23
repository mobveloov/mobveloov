> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Enviar notificação push para condutores

> Envia notificação push para uma lista de condutores.

Só recebem a notificação os condutores da bandeira da chave de API (ou de suas filiais) que tenham aplicativo com token de notificação registrado. Condutores inexistentes, de outra bandeira ou sem token são ignorados sem erro — o retorno é `404` apenas quando nenhum dos condutores informados pode ser notificado.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /notificacoes/condutor/push
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
  /notificacoes/condutor/push:
    post:
      summary: Enviar notificação push para condutores
      description: >-
        Envia notificação push para uma lista de condutores.


        Só recebem a notificação os condutores da bandeira da chave de API (ou
        de suas filiais) que tenham aplicativo com token de notificação
        registrado. Condutores inexistentes, de outra bandeira ou sem token são
        ignorados sem erro — o retorno é `404` apenas quando nenhum dos
        condutores informados pode ser notificado.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - condutores
                - mensagem
              properties:
                condutores:
                  type: array
                  description: >-
                    Lista de condutores que receberão a notificação. Deve conter
                    ao menos um item e todos os itens devem ser numéricos. IDs
                    repetidos são considerados uma única vez. Limite máximo de
                    1000 itens.
                  minItems: 1
                  maxItems: 1000
                  items:
                    type: integer
                titulo:
                  type: string
                  description: Título da notificação.
                  maxLength: 40
                mensagem:
                  type: string
                  description: Mensagem da notificação.
                  maxLength: 255
            example:
              condutores:
                - 123
                - 456
                - 789
              titulo: Aviso da central
              mensagem: Nova regra de escala a partir de segunda.
      responses:
        '200':
          description: Notificação enviada com sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                message: Push enviado com sucesso
                __links:
                  - rel: self
                    href: api/v2/integracao/notificacoes/condutor/push
                    metodo: post
                  - rel: enviar-push-condutor-individual
                    href: api/v2/integracao/notificacoes/condutor/push/individual
                    metodo: post
        '400':
          description: Erro de validação
          content:
            application/json:
              schema:
                type: object
              examples:
                condutores_obrigatorio:
                  summary: Lista de condutores ausente
                  value:
                    success: false
                    errors:
                      - code: 2
                        message: '''condutores'': Preenchimento obrigatório'
                condutores_vazio:
                  summary: Lista de condutores vazia
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''condutores'': Informe ao menos um condutor.'
                condutor_invalido:
                  summary: Item da lista não é numérico
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''condutores.1'': Deve ser numérico.'
                mensagem_obrigatoria:
                  summary: Campo mensagem ausente
                  value:
                    success: false
                    errors:
                      - code: 2
                        message: '''mensagem'': Preenchimento obrigatório'
                mensagem_muito_longa:
                  summary: Mensagem acima do limite de caracteres
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''mensagem'': Deve ter no máximo 255 caracteres.'
        '404':
          description: >-
            Nenhum dos condutores informados possui token de notificação
            registrado na bandeira da chave de API
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: Nenhum token FCM encontrado para os condutores informados
        '503':
          description: >-
            Envio indisponível no momento: projeto de notificação do aplicativo
            do condutor não resolvido, envio desativado por configuração ou fila
            de notificações inacessível
          content:
            application/json:
              schema:
                type: object
              examples:
                projeto_nao_resolvido:
                  summary: >-
                    Projeto de notificação do aplicativo do condutor não
                    resolvido
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          Não foi possível resolver o projeto Firebase do
                          aplicativo do condutor
                envio_desativado:
                  summary: Envio de notificações temporariamente desativado
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: Envio de notificações temporariamente desativado
                fila_indisponivel:
                  summary: Fila de notificações indisponível
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: Não foi possível enfileirar as notificações
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