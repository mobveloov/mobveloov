> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Adicionar/Editar permissões de uma bandeira

> Adiciona bandeira à um webhook e define as permissões dessa bandeira. Regras importantes:
- Recebe um objeto bandeira com cada bandeira_id e eventos que a bandeira deve receber;
- Impede inclusão de bandeiras já atreladas a outros webhooks;
- Envio de eventos do webhook é alterado em até 5 minutos após a edição.



## OpenAPI

````yaml pages/v2/openapi-corridas.json PUT /engajamento/{id}/permissoes
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
  /engajamento/{id}/permissoes:
    put:
      summary: Adicionar/Editar permissões de uma bandeira
      description: >-
        Adiciona bandeira à um webhook e define as permissões dessa bandeira.
        Regras importantes:

        - Recebe um objeto bandeira com cada bandeira_id e eventos que a
        bandeira deve receber;

        - Impede inclusão de bandeiras já atreladas a outros webhooks;

        - Envio de eventos do webhook é alterado em até 5 minutos após a edição.
      parameters:
        - name: id
          in: path
          required: true
          description: Id do webhook
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                bandeira:
                  type: object
                  properties:
                    bandeira_id:
                      type: integer
                    eventos:
                      type: array
                      description: Lista de eventos. Limite máximo de 1000 itens.
                      maxItems: 1000
                      items:
                        type: string
            example:
              bandeira:
                bandeira_id: 144
                eventos:
                  - cadastro_passageiro_app
                  - estimativa_passageiro_app
                  - solicitacao_passageiro_app_abertura
                  - solicitacao_passageiro_app_finalizada
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                message: Permissões de engajamento criadas com sucesso.
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