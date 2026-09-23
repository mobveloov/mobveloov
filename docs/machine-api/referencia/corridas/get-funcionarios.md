> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Listar funcionários da empresa

> Lista funcionários por empresa ou por centro de custo.



## OpenAPI

````yaml pages/v2/openapi-corridas.json GET /corridas/empresas/funcionarios
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
  /corridas/empresas/funcionarios:
    get:
      summary: Listar funcionários da empresa
      description: Lista funcionários por empresa ou por centro de custo.
      parameters:
        - name: empresa_id
          in: query
          description: >-
            Obrigatório quando `centro_custo_id` não for informado.
            Identificador da empresa.
          schema:
            type: integer
        - name: centro_custo_id
          in: query
          description: >-
            Opcional. Centro de custo para filtro; quando informado, pode
            dispensar `empresa_id`.
          schema:
            type: integer
        - name: pagina
          in: query
          description: Opcional. Página da listagem.
          schema:
            type: integer
        - name: limite
          in: query
          description: Opcional. Quantidade de registros por página.
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
                data:
                  - nome: João Pedro
                    email: jaopedro@exemplo.com
                    centro_custo_id: '1'
                    centro_custo_nome: Administrativo
                    empresa_id: '1'
                    empresa_nome: EcoCups
                    limite_mensal: '400.00'
                    saldo: '0.00'
                  - nome: Maria Vitória
                    email: mariavitoria@exemplo.com
                    centro_custo_id: '1'
                    centro_custo_nome: Administrativo
                    empresa_id: '1'
                    empresa_nome: EcoCups
                    limite_mensal: null
                    saldo: '0.00'
                  - nome: Ronaldo da Silva
                    email: ronaldosilva@exemplo.com
                    centro_custo_id: '1'
                    centro_custo_nome: Administrativo
                    empresa_id: '1'
                    empresa_nome: EcoCups
                    limite_mensal: null
                    saldo: '0.00'
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