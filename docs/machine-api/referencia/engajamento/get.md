> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Listar webhooks de engajamento

> Lista webhooks de engajamento cadastrados e bandeiras sem webhook vinculado. Regras importantes:
1. Bandeiras apenas do mesmo grupo;
2. Apenas Bandeiras ativas são retornadas na lista de bandeiras sem webhook vinculado.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /engajamento
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
  /engajamento:
    get:
      summary: Listar webhooks de engajamento
      description: >-
        Lista webhooks de engajamento cadastrados e bandeiras sem webhook
        vinculado. Regras importantes:

        1. Bandeiras apenas do mesmo grupo;

        2. Apenas Bandeiras ativas são retornadas na lista de bandeiras sem
        webhook vinculado.
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  data:
                    webhooks:
                      - id: 20
                        headers: null
                        url: https://webhook-teste.exemplo.com/engajamento-v2
                        bandeiras: []
                    bandeiras_sem_webhook:
                      - id: 8
                        nome: Cooperativa Exemplo
                      - id: 913
                        nome: Bandeira Exemplo
                      - id: 921
                        nome: Cooperativa Filial
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