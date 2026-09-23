> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Obter recibo

> Retorna as informações necessárias para a construção do recibo da solicitação de entrega. A entrega deve pertencer a bandeira e ter seu status como finalizada (F).

Em `dados_solicitacao`, o campo `valor` traz o valor já líquido, com o desconto do cupom aplicado, e `valor_original` traz o valor bruto da entrega, antes do desconto. Sem cupom aplicado, os dois campos são iguais.



## OpenAPI

````yaml pages/v2/openapi-entregas.json GET /entregas/{id}/recibo
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
  /entregas/{id}/recibo:
    get:
      summary: Obter recibo
      description: >-
        Retorna as informações necessárias para a construção do recibo da
        solicitação de entrega. A entrega deve pertencer a bandeira e ter seu
        status como finalizada (F).


        Em `dados_solicitacao`, o campo `valor` traz o valor já líquido, com o
        desconto do cupom aplicado, e `valor_original` traz o valor bruto da
        entrega, antes do desconto. Sem cupom aplicado, os dois campos são
        iguais.
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
                  id_mch: '5642'
                  condutor:
                    nome: Glen Little
                    telefone: (099) 99999-9999
                    modelo: dolorem
                    placa: AAA-9999
                  dados_solicitacao:
                    valor: '739.67'
                    valor_original: '739.67'
                    duracao: '8'
                    distancia: '4.05'
                    tarifa: explicabo
                    id_categoria: '407'
                    categoria: qui
                    descricao_categoria: ut
                    desconto: 0
                    tipo_pagamento: D
                  empresa:
                    empresa_id: '893'
                    nome: Schmidt, Hudson and Schowalter
                    cpf: 999.999.999-99
                  partida:
                    endereco: Rua Evandro Câmara, 717
                    bairro: Centro
                    cidade: Montes Claros
                    estado: Minas Gerais
                    data_hora: '2023-01-02T10:28:28Z'
                  desejado:
                    endereco: null
                    bairro: null
                    cidade: null
                    estado: null
                    data_hora: '2023-01-02T10:35:22Z'
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