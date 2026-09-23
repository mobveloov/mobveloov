> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Excluir entrega

> Exclui uma entrega de uma solicitação ativa. Não é permitido excluir quando a solicitação estiver cancelada, finalizada ou não atendida, nem quando restar apenas uma entrega na solicitação.



## OpenAPI

````yaml pages/v2/openapi-entregas.json DELETE /entregas/{id}/paradas/{parada_id}
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
  /entregas/{id}/paradas/{parada_id}:
    delete:
      summary: Excluir entrega
      description: >-
        Exclui uma entrega de uma solicitação ativa. Não é permitido excluir
        quando a solicitação estiver cancelada, finalizada ou não atendida, nem
        quando restar apenas uma entrega na solicitação.
      parameters:
        - name: id
          in: path
          required: true
          description: Id da solicitação.
          schema:
            type: integer
        - name: parada_id
          in: path
          required: true
          description: Id da entrega a ser excluída.
          schema:
            type: integer
      responses:
        '200':
          description: >-
            Sucesso. O campo `estimativa` reflete os novos valores calculados
            com base nas entregas restantes. Pode ser `null` caso o serviço de
            rotas esteja indisponível.
          content:
            application/json:
              example:
                success: true
                data:
                  status: OK
                  estimativa:
                    estimativa_km: 5.42
                    estimativa_tempo_minutos: 18
                    estimativa_valor: '23.50'
                message: Entrega excluída com sucesso.
        '400':
          description: Requisição inválida
          content:
            application/json:
              examples:
                status_invalido:
                  summary: Status inválido para exclusão
                  value:
                    success: false
                    errors:
                      - code: 135
                        message: Status inválido para exclusão.
                unica_entrega:
                  summary: Última entrega da solicitação
                  value:
                    success: false
                    errors:
                      - code: 33
                        message: >-
                          Não é possível excluir a última entrega da
                          solicitação.
        '404':
          description: Não encontrado
          content:
            application/json:
              example:
                success: false
                errors:
                  - code: 136
                    message: Entrega não encontrada.
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