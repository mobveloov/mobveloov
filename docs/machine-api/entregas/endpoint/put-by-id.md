> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Editar entrega em andamento

> Edita as paradas de uma entrega em andamento. Requer que a bandeira tenha a funcionalidade de edição de pedidos em andamento habilitada. Quando acionado por uma empresa, respeita a configuração `permitir_editar_pedidos_andamento` da empresa. A lista de `paradas` representa o conjunto completo desejado (substituição total).

Requer autenticação HTTP Basic do gestor da empresa.



## OpenAPI

````yaml pages/v2/openapi-entregas.json PUT /entregas/{id}
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
  /entregas/{id}:
    put:
      summary: Editar entrega em andamento
      description: >-
        Edita as paradas de uma entrega em andamento. Requer que a bandeira
        tenha a funcionalidade de edição de pedidos em andamento habilitada.
        Quando acionado por uma empresa, respeita a configuração
        `permitir_editar_pedidos_andamento` da empresa. A lista de `paradas`
        representa o conjunto completo desejado (substituição total).


        Requer autenticação HTTP Basic do gestor da empresa.
      parameters:
        - name: id
          in: path
          required: true
          description: id da solicitação de entrega em andamento
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            example:
              com_retorno: false
              paradas:
                - endereco_parada: Av. Paulista, 1000
                  bairro_parada: Bela Vista
                  cidade_parada: São Paulo
                  estado_parada: SP
                  lat_parada: '-23.5631'
                  lng_parada: '-46.6544'
                  nome_cliente_parada: João Silva
                  telefone_cliente_parada: (11) 99999-0001
                  observacao_parada: Portaria B
                  referencia_parada: Próximo ao metrô
                  codigo_confirmacao: '1234'
                  pedido_id: 456
                  id_externo: EXT-001
            schema:
              type: object
              required:
                - paradas
              properties:
                com_retorno:
                  type: boolean
                  description: >-
                    Define se a entrega tem retorno ao ponto de partida. Se
                    omitido, preserva o valor atual.
                paradas:
                  type: array
                  description: >-
                    Lista completa de paradas desejadas (substituição total). A
                    ordem define a sequência de entrega.
                  items:
                    type: object
                    required:
                      - endereco_parada
                      - bairro_parada
                    properties:
                      pedido_id:
                        type: integer
                        description: >-
                          Id do pedido existente a preservar. Omitir para nova
                          parada.
                      endereco_parada:
                        type: string
                      bairro_parada:
                        type: string
                      complemento_parada:
                        type: string
                      cidade_parada:
                        type: string
                      estado_parada:
                        type: string
                      referencia_parada:
                        type: string
                      lat_parada:
                        type: string
                      lng_parada:
                        type: string
                      nome_cliente_parada:
                        type: string
                      telefone_cliente_parada:
                        type: string
                      observacao_parada:
                        type: string
                      codigo_confirmacao:
                        type: string
                        description: >-
                          Código de confirmação da entrega, com **4 dígitos**
                          (de `0001` a `9999`), informado pelo condutor no app
                          no momento da entrega. Se a entrega foi criada com
                          `url_confirmacao`, quem valida o código é o seu
                          sistema e este campo é ignorado — a URL não é alterada
                          por este endpoint.
                      id_externo:
                        type: string
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              example:
                success: true
                data:
                  id: 123
                message: Solicitação alterada com sucesso!
        '400':
          description: Requisição inválida
          content:
            application/json:
              example:
                success: false
                errors:
                  - code: 0
                    message: Descrição do erro
        '401':
          description: Não autorizado
          content:
            application/json:
              example:
                success: false
                errors:
                  - code: 0
                    message: Usuário e/ou senhas inválidos.
        '404':
          description: Não encontrado
          content:
            application/json:
              example:
                success: false
                errors:
                  - code: 0
                    message: Solicitação não encontrada.
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