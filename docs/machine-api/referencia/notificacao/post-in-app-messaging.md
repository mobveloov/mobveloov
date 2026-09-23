> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Enviar notificação in-app

> Envia notificação via in-app messaging para uma lista de passageiros.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /notificacoes/in-app-messaging
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
  /notificacoes/in-app-messaging:
    post:
      summary: Enviar notificação in-app
      description: Envia notificação via in-app messaging para uma lista de passageiros.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - passageiros
                - titulo
                - body
              properties:
                passageiros:
                  type: array
                  description: >-
                    Lista de passageiros que receberão a notificação. Deve
                    conter ao menos um item e todos os itens devem ser
                    numéricos. Limite máximo de 1000 itens.
                  minItems: 1
                  maxItems: 1000
                  items:
                    type: integer
                titulo:
                  type: string
                  description: Obrigatório. Título da notificação.
                  maxLength: 40
                body:
                  type: string
                  description: Conteúdo principal da notificação.
                  maxLength: 255
                url_imagem:
                  type: string
                  description: URL de imagem da notificação.
                solicitacao_id:
                  type: integer
                  description: >-
                    Identificador da solicitação vinculada. Deve ser numérico
                    quando informado.
                titulo_botao_redirecionamento:
                  type: string
                  description: Título do botão de redirecionamento.
                  maxLength: 20
                link_redirecionamento:
                  type: string
                  description: Link de redirecionamento do botão.
            example:
              passageiros:
                - 123
                - 456
              titulo: Motorista a caminho
              body: Acompanhe a solicitação pelo aplicativo.
              url_imagem: https://cdn.exemplo.com/notificacoes/motorista.png
              solicitacao_id: 98765
              titulo_botao_redirecionamento: Acompanhar
              link_redirecionamento: app://solicitacoes/98765
      responses:
        '200':
          description: Notificação enviada com sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                data:
                  status: OK
                message: Notificação enviada com sucesso.
        '400':
          description: Erro de validação
          content:
            application/json:
              schema:
                type: object
              examples:
                titulo_obrigatorio:
                  summary: Campo titulo ausente
                  value:
                    success: false
                    errors:
                      - field: titulo
                        message: Campo obrigatório.
                body_obrigatorio:
                  summary: Campo body ausente
                  value:
                    success: false
                    errors:
                      - field: body
                        message: Campo obrigatório.
                link_obrigatorio:
                  summary: Link de redirecionamento ausente
                  value:
                    success: false
                    errors:
                      - field: link_redirecionamento
                        message: Campo obrigatório.
                solicitacao_id_invalido:
                  summary: Solicitação com valor não numérico
                  value:
                    success: false
                    errors:
                      - field: solicitacao_id
                        message: Deve ser numérico.
                passageiros_vazio:
                  summary: Lista de passageiros vazia
                  value:
                    success: false
                    errors:
                      - field: passageiros
                        message: Informe ao menos um passageiro.
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