> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Obter status

> Permite obter o status de uma solicitação de entrega pelo seu Id. Os possíveis retornos de status são: D - Distribuindo, G - Aguardando aceite, A - Aceita, S - Em espera, E - Em andamento, F - Finalizada, N - Não atendida, C - Cancelada, P - Pendente.



## OpenAPI

````yaml pages/v2/openapi-entregas.json GET /entregas/{id}/status
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
  /entregas/{id}/status:
    get:
      summary: Obter status
      description: >-
        Permite obter o status de uma solicitação de entrega pelo seu Id. Os
        possíveis retornos de status são: D - Distribuindo, G - Aguardando
        aceite, A - Aceita, S - Em espera, E - Em andamento, F - Finalizada, N -
        Não atendida, C - Cancelada, P - Pendente.
      parameters:
        - name: id
          in: path
          required: true
          description: id da solicitação de entrega
          schema:
            type: integer
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  status: A
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