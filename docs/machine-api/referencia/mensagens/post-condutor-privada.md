> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Enviar mensagem privada para condutor

> Envia uma mensagem privada para um condutor específico. A mensagem pode ser enviada para condutores com os seguintes status:

- Ativo
- Aguardando ativação
  - Em análise
  - Fila de espera
- Suspenso
- Rejeitado

Não é possível enviar mensagem para condutores inativos ou deletados.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /mensagens/condutor/{id}
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
  /mensagens/condutor/{id}:
    post:
      summary: Enviar mensagem privada para condutor
      description: >-
        Envia uma mensagem privada para um condutor específico. A mensagem pode
        ser enviada para condutores com os seguintes status:


        - Ativo

        - Aguardando ativação
          - Em análise
          - Fila de espera
        - Suspenso

        - Rejeitado


        Não é possível enviar mensagem para condutores inativos ou deletados.
      parameters:
        - name: id
          in: path
          required: true
          description: ID do condutor destinatário. Deve ser numérico.
          schema:
            type: integer
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
                  example: Bom dia, está indo ao local de partida?
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
                condutor_inexistente:
                  summary: Condutor não encontrado ou inativo
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: Destinatário não é ativo ou não possui cadastro.
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