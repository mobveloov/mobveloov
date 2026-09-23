> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Enviar notificação push para um condutor

> Envia notificação push para um único condutor identificado pelo `condutor_id`.

O condutor precisa pertencer à bandeira da chave de API (ou a uma de suas filiais) e ter aplicativo com token de notificação registrado; caso contrário o retorno é `404`.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /notificacoes/condutor/push/individual
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
  /notificacoes/condutor/push/individual:
    post:
      summary: Enviar notificação push para um condutor
      description: >-
        Envia notificação push para um único condutor identificado pelo
        `condutor_id`.


        O condutor precisa pertencer à bandeira da chave de API (ou a uma de
        suas filiais) e ter aplicativo com token de notificação registrado; caso
        contrário o retorno é `404`.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - condutor_id
                - mensagem
              properties:
                condutor_id:
                  type: integer
                  description: >-
                    Identificador do condutor que receberá a notificação. Deve
                    ser numérico.
                titulo:
                  type: string
                  description: Título da notificação.
                  maxLength: 40
                mensagem:
                  type: string
                  description: Mensagem da notificação.
                  maxLength: 255
            example:
              condutor_id: 123
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
                    href: api/v2/integracao/notificacoes/condutor/push/individual
                    metodo: post
                  - rel: enviar-push-condutores
                    href: api/v2/integracao/notificacoes/condutor/push
                    metodo: post
        '400':
          description: Erro de validação
          content:
            application/json:
              schema:
                type: object
              examples:
                condutor_id_obrigatorio:
                  summary: Campo condutor_id ausente
                  value:
                    success: false
                    errors:
                      - code: 2
                        message: '''condutor_id'': Preenchimento obrigatório'
                condutor_invalido:
                  summary: condutor_id não é numérico
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''condutor_id'': Deve ser numérico.'
                mensagem_obrigatoria:
                  summary: Campo mensagem ausente
                  value:
                    success: false
                    errors:
                      - code: 2
                        message: '''mensagem'': Preenchimento obrigatório'
                titulo_muito_longo:
                  summary: Título acima do limite de caracteres
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''titulo'': Deve ter no máximo 40 caracteres.'
        '404':
          description: >-
            O condutor informado não possui token de notificação registrado na
            bandeira da chave de API
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