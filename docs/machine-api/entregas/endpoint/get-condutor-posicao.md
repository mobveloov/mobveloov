> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Obter posição do entregador

> Retorna a latitude e longitude do condutor de uma entrega naquele instante. Caso a entrega ainda estiver na fase de despacho (status distribuindo, pendente ou aguardando aceite) ou já estiver sido finalizada/cancelada (status não atendida, cancelada ou finalizada), o retorno será latitude e longitude null.



## OpenAPI

````yaml pages/v2/openapi-entregas.json GET /entregas/{id}/condutor/posicao
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
  /entregas/{id}/condutor/posicao:
    get:
      summary: Obter posição do entregador
      description: >-
        Retorna a latitude e longitude do condutor de uma entrega naquele
        instante. Caso a entrega ainda estiver na fase de despacho (status
        distribuindo, pendente ou aguardando aceite) ou já estiver sido
        finalizada/cancelada (status não atendida, cancelada ou finalizada), o
        retorno será latitude e longitude null.
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
                  lat_condutor: '10.0297'
                  lng_condutor: '30.9392'
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