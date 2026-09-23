> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Consultar corrida

> Consulta uma corrida específica pelo identificador interno da corrida.

O campo `valor_corrida` traz o valor já líquido, com o desconto do cupom aplicado, e `valor_corrida_integral` traz o valor bruto da corrida, antes do desconto. Sem cupom aplicado, os dois campos são iguais.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /corridas/{id}
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
  /corridas/{id}:
    get:
      summary: Consultar corrida
      description: >-
        Consulta uma corrida específica pelo identificador interno da corrida.


        O campo `valor_corrida` traz o valor já líquido, com o desconto do cupom
        aplicado, e `valor_corrida_integral` traz o valor bruto da corrida,
        antes do desconto. Sem cupom aplicado, os dois campos são iguais.
      parameters:
        - name: id
          in: path
          required: true
          description: Identificador interno da corrida.
          schema:
            type: integer
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                response:
                  id: '100018001'
                  data_hora_solicitacao: '2024-05-02 08:53:42'
                  data_hora_chegada_local: null
                  status_solicitacao: 'N'
                  cliente_id: '83605'
                  nome_passageiro: Rogério Barreto
                  empresa_id: null
                  bandeira_chamada_id: '8'
                  data_hora_aceite: null
                  data_hora_finalizacao: null
                  data_hora_cancelamento: null
                  data_hora_pendencia: '2024-05-02 08:53:49'
                  distancia_coleta_km: null
                  valor_corrida: '7.00'
                  valor_corrida_integral: '10.00'
                  condutor_especificado: false
                  com_retorno: false
                  condutor_id: ''
                  nome_condutor: ''
                  telefone_condutor: ''
                  veiculo: ''
                  placa_veiculo: ''
                  cor_veiculo: null
                  duracao_corrida: '0'
                  distancia_percorrida_km: '0'
                  taxas_cancelamento: null
                  partida:
                    endereco: Rua Altaneira
                    complemento: null
                    referencia: null
                    bairro: Campo Grande
                    cidade: Rio de Janeiro
                    estado: RJ
                    lat: '-22.8743056'
                    lng: '-43.5626744'
                  paradas:
                    - id: '358'
                      endereco: Praia do Arpoador
                      complemento: ''
                      bairro: Arpoador
                      cidade: Rio de Janeiro
                      uf: RJ
                      lat: '-22.988420900610592'
                      lng: '-43.1934916318077'
                      ordem: 0
                      numero_pedido: '2'
                  link_acompanhamento_solicitacao: >-
                    https://link-acompanhamento-exemplo/solicitacao/acompanhar/OTU2MzE0ODIyOTM1MQ==
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