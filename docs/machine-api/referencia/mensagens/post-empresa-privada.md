> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Enviar mensagem privada para empresa

> Envia uma mensagem privada para uma empresa específica. A empresa deve estar ativa (`status = 'A'`) na bandeira e possuir um usuário com permissão de receber mensagens.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /mensagens/empresa/{id}
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
  /mensagens/empresa/{id}:
    post:
      summary: Enviar mensagem privada para empresa
      description: >-
        Envia uma mensagem privada para uma empresa específica. A empresa deve
        estar ativa (`status = 'A'`) na bandeira e possuir um usuário com
        permissão de receber mensagens.
      parameters:
        - name: id
          in: path
          required: true
          description: ID da empresa destinatária. Deve ser numérico.
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
                  example: Como está o andamento das corridas?
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
                empresa_inexistente:
                  summary: Empresa não encontrada ou inativa
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: Empresa não está ativa ou não possui cadastro.
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