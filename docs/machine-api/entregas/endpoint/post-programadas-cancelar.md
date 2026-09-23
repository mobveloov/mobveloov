> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Cancelar entrega programada

> Cancela (mudando para status C), a solicitação programada informada. A solicitação não pode estar com o status aguardando (A).



## OpenAPI

````yaml pages/v2/openapi-entregas.json POST /entregas/programadas/{id}/cancelar
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
  /entregas/programadas/{id}/cancelar:
    post:
      summary: Cancelar entrega programada
      description: >-
        Cancela (mudando para status C), a solicitação programada informada. A
        solicitação não pode estar com o status aguardando (A).
      parameters:
        - name: id
          in: path
          required: true
          description: id da solicitação de entrega programada
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
                  id_mch_programada: 5642
                  mensagem: Programada cancelada com sucesso
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