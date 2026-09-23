> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Enviar notificação in-app para um condutor

> Envia notificação via in-app messaging para um único condutor identificado pelo `condutor_id`.

A mensagem é exibida como um modal dentro do aplicativo do condutor, com título, conteúdo, imagem opcional e um botão de redirecionamento opcional. Mensagem recebida com o aplicativo fechado fica guardada e aparece na próxima abertura; enquanto o condutor não a fechar, ela volta a aparecer a cada troca de tela.

O condutor precisa pertencer à bandeira da chave de API (ou a uma de suas filiais) e ter aplicativo com token de notificação registrado; caso contrário o retorno é `404`.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /notificacoes/condutor/in-app-messaging/individual
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
  /notificacoes/condutor/in-app-messaging/individual:
    post:
      summary: Enviar notificação in-app para um condutor
      description: >-
        Envia notificação via in-app messaging para um único condutor
        identificado pelo `condutor_id`.


        A mensagem é exibida como um modal dentro do aplicativo do condutor, com
        título, conteúdo, imagem opcional e um botão de redirecionamento
        opcional. Mensagem recebida com o aplicativo fechado fica guardada e
        aparece na próxima abertura; enquanto o condutor não a fechar, ela volta
        a aparecer a cada troca de tela.


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
                - titulo
                - body
              properties:
                condutor_id:
                  type: integer
                  description: >-
                    Identificador do condutor que receberá a notificação. Deve
                    ser numérico.
                titulo:
                  type: string
                  description: Título exibido no topo da mensagem.
                  maxLength: 40
                body:
                  type: string
                  description: Conteúdo principal da mensagem.
                  maxLength: 255
                url_imagem:
                  type: string
                  format: uri
                  description: >-
                    URL da imagem exibida no topo da mensagem. Deve ser uma URL
                    válida. Quando omitida, ou quando a imagem não puder ser
                    carregada, o aplicativo exibe a logo da central no lugar.
                  maxLength: 2048
                solicitacao_id:
                  type: integer
                  description: >-
                    Identificador da corrida vinculada à mensagem. Deve ser
                    numérico quando informado. Quando presente, o aplicativo só
                    exibe a mensagem se a corrida for a corrida em andamento do
                    condutor.
                titulo_botao_redirecionamento:
                  type: string
                  description: >-
                    Texto do botão de redirecionamento. Obrigatório quando
                    `link_redirecionamento` for informado; o botão só aparece
                    quando os dois campos vêm preenchidos.
                  maxLength: 20
                link_redirecionamento:
                  type: string
                  format: uri
                  description: >-
                    URL aberta ao tocar no botão de redirecionamento. Deve ser
                    uma URL válida. Obrigatório quando
                    `titulo_botao_redirecionamento` for informado.
                  maxLength: 2048
            example:
              condutor_id: 123
              titulo: Bônus de fim de semana
              body: Complete 10 corridas até domingo e ganhe R$ 50 de bônus.
              url_imagem: https://cdn.exemplo.com/campanhas/bonus-fim-de-semana.png
              titulo_botao_redirecionamento: Ver regras
              link_redirecionamento: https://central.exemplo.com/campanhas/bonus
      responses:
        '200':
          description: Notificação enviada com sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                message: In-App Messaging enviado com sucesso
                __links:
                  - rel: self
                    href: >-
                      api/v2/integracao/notificacoes/condutor/in-app-messaging/individual
                    metodo: post
                  - rel: enviar-push-condutores
                    href: api/v2/integracao/notificacoes/condutor/push
                    metodo: post
                  - rel: enviar-push-condutor-individual
                    href: api/v2/integracao/notificacoes/condutor/push/individual
                    metodo: post
                  - rel: enviar-in-app-messaging-condutores
                    href: api/v2/integracao/notificacoes/condutor/in-app-messaging
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
                titulo_obrigatorio:
                  summary: Campo titulo ausente
                  value:
                    success: false
                    errors:
                      - code: 2
                        message: '''titulo'': Preenchimento obrigatório'
                titulo_muito_longo:
                  summary: Título acima do limite de caracteres
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''titulo'': Deve ter no máximo 40 caracteres.'
                body_obrigatorio:
                  summary: Campo body ausente
                  value:
                    success: false
                    errors:
                      - code: 2
                        message: '''body'': Preenchimento obrigatório'
                body_muito_longo:
                  summary: Conteúdo acima do limite de caracteres
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''body'': Deve ter no máximo 255 caracteres.'
                botao_sem_link:
                  summary: Título do botão informado sem o link
                  value:
                    success: false
                    errors:
                      - code: 2
                        message: '''link_redirecionamento'': Preenchimento obrigatório'
                url_imagem_invalida:
                  summary: URL da imagem inválida
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''url_imagem'': URL inválida.'
                solicitacao_id_invalido:
                  summary: Solicitação com valor não numérico
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''solicitacao_id'': Deve ser numérico.'
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