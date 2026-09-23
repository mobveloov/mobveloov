> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Consultar recibo da corrida

> Consulta o recibo de uma corrida.

Em `dados_solicitacao`, o campo `valor` traz o valor já líquido, com o desconto do cupom aplicado, e `valor_original` traz o valor bruto da corrida, antes do desconto. Sem cupom aplicado, os dois campos são iguais.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /corridas/{id}/recibo
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
  /corridas/{id}/recibo:
    get:
      summary: Consultar recibo da corrida
      description: >-
        Consulta o recibo de uma corrida.


        Em `dados_solicitacao`, o campo `valor` traz o valor já líquido, com o
        desconto do cupom aplicado, e `valor_original` traz o valor bruto da
        corrida, antes do desconto. Sem cupom aplicado, os dois campos são
        iguais.
      parameters:
        - name: id
          in: path
          required: true
          description: Identificador interno da corrida.
          schema:
            type: integer
            example: 1948853
      responses:
        '200':
          description: Sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                data:
                  id_mch: '100003661'
                  condutor:
                    nome: Pedro João
                    telefone: (021) 99883-3505
                    modelo: FORD
                    placa: ABC-1234
                  dados_solicitacao:
                    valor: '4.00'
                    valor_original: '4.00'
                    duracao: '0'
                    distancia: '0.001'
                    tarifa: Tarifa padrão
                    id_categoria: '71'
                    categoria: Comum
                    descricao_categoria: Viagens curtas-médias
                    desconto: '0.00'
                    tipo_pagamento: D
                  partida:
                    endereco: R. Prof. Eurico Rabelo
                    bairro: Maracanã
                    cidade: Rio de Janeiro
                    estado: RJ
                    data_hora: '2021-05-12T09:13:42Z'
                  desejado:
                    endereco: Praça Mauá, 1
                    bairro: Centro
                    cidade: Rio de Janeiro
                    estado: RJ
                    data_hora: '2021-05-12T09:14:09Z'
                  cliente:
                    cliente_id: '1'
                    nome: Marcio
                    cpf: null
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