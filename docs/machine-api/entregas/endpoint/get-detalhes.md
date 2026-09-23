> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Obter detalhes da entrega

> Obter detalhes da entrega



## OpenAPI

````yaml pages/v2/openapi-entregas.json GET /entregas/{id}/detalhes
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
  /entregas/{id}/detalhes:
    get:
      summary: Obter detalhes da entrega
      description: Obter detalhes da entrega
      parameters:
        - name: id
          in: path
          required: true
          description: ID da solicitação de entrega
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
                  request_id: int
                  external_id: string
                  full_code: ENUM
                  short_code: string(2)
                  requested_at: ISO8601
                  manager: string
                  route_key: string
                  return_trip: bool
                  category: string
                  driver:
                    id: int
                    name: string
                    phone: string
                    cpf: string
                    vtr: string
                    vehicle_plate: string
                    vehicle_model: string
                  enterprise:
                    id: int
                    name: string
                  progress:
                    accepted_at: ISO8601
                    accept_lat: float
                    accept_lng: float
                    accept_eta_seconds: int
                    accept_eta_km: float
                    accept_duration_minutes: int
                    accept_distance_km: float
                    estimated_distance_km: float
                    estimated_duration_minutes: int
                    estimated_value: decimal
                    pickup_arrival: ISO8601
                    arrival_at_surroundings: ISO8601
                    start_trip: ISO8601
                    pending_at: ISO8601
                  finished:
                    finished_at: ISO8601
                    finalized_distance_km: float
                    traveled_distance_km: float
                    stopped_time_virtual_taximeter: int
                    final_value: float
                    coupon_value: float
                    address:
                      address: string
                      neighborhood: string
                      city: string
                      state: string
                      latitude: float
                      longitude: float
                  cancellation:
                    - cancelled_at: ISO8601
                      cancelled_reason: string
                      cancelled_by: string
                      cancelled_by_name: string
                  stops:
                    - order: int
                      status: string
                      notes: string
                      client:
                        name: string
                        phone: string
                      address:
                        address: string
                        complement: string
                        reference: string
                        neighborhood: string
                        city: string
                        state: string
                        latitude: float
                        longitude: float
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