> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Atualizar dinâmica por área

> Atualiza o cadastro da dinâmica associada a uma área específica. Todos os campos são opcionais, mas ao menos um deve ser informado. Como a área é imutável após criada, alterar `nome` cria internamente uma NOVA área — a resposta pode trazer um `id` diferente do informado na URL, que deve ser usado nas próximas requisições sobre essa área.



## OpenAPI

````yaml pages/v2/openapi-corridas.json PATCH /dinamicas/area/{id}
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
  /dinamicas/area/{id}:
    patch:
      summary: Atualizar dinâmica por área
      description: >-
        Atualiza o cadastro da dinâmica associada a uma área específica. Todos
        os campos são opcionais, mas ao menos um deve ser informado. Como a área
        é imutável após criada, alterar `nome` cria internamente uma NOVA área —
        a resposta pode trazer um `id` diferente do informado na URL, que deve
        ser usado nas próximas requisições sobre essa área.
      parameters:
        - name: id
          in: path
          required: true
          description: Identificador da área cuja dinâmica será atualizada.
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              description: Ao menos um dos campos abaixo deve ser informado.
              properties:
                nome:
                  type: string
                  description: Novo nome da área.
                fator:
                  type: number
                  description: >-
                    Novo valor do fator aplicado pela dinâmica (numérico). O
                    significado depende de `tipo_calculo`: com `M`, é o
                    multiplicador aplicado ao preço da corrida (entre 1.1 e 5);
                    com `F`, é o valor fixo em R$ somado ao preço da corrida
                    (entre 0.5 e 99.9).
                tipo_calculo:
                  type: string
                  description: >-
                    Forma de cálculo do fator: `F` — Valor adicional, soma um
                    valor fixo em R$ ao preço da corrida; `M` — Fator
                    multiplicador, multiplica o preço da corrida pelo fator
                    informado.
                  enum:
                    - F
                    - M
                tipo_fator:
                  type: string
                  description: >-
                    Momento em que o fator é aplicado: `P` — Partida, aplicado
                    na origem/embarque da corrida; `R` — Parada, aplicado no
                    destino/parada da corrida.
                  enum:
                    - P
                    - R
                ativo:
                  description: >-
                    Indica se a dinâmica da área ficará ativa ou inativa. Também
                    aceita `1` e `0`.
                  oneOf:
                    - type: boolean
                    - type: integer
                      enum:
                        - 0
                        - 1
            example:
              nome: Área Central
              fator: 1.8
              tipo_calculo: M
              tipo_fator: P
              ativo: true
      responses:
        '200':
          description: Dinâmica atualizada com sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                data:
                  id: 10
                  nome: Área Central
                  fator: 1.8
                  tipo_calculo: M
                  tipo_fator: P
                  ativo: true
        '400':
          description: Erro de validação
          content:
            application/json:
              schema:
                type: object
              examples:
                nenhum_campo_informado:
                  summary: Nenhum campo informado
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          Informe ao menos um dos campos: 'nome', 'fator',
                          'tipo_calculo', 'tipo_fator' ou 'ativo'
                fator_invalido:
                  summary: Campo fator inválido
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: O campo 'fator' deve ser numérico
                fator_fora_do_limite:
                  summary: Fator fora do limite permitido
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: O campo 'fator' está fora do limite permitido
                fator_obrigatorio_na_troca_tipo_calculo:
                  summary: Fator obrigatório ao trocar o tipo de cálculo
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: >-
                          O campo 'fator' é obrigatório ao alterar o
                          'tipo_calculo'
                booleano_invalido:
                  summary: Campo ativo inválido
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''ativo'': Deve ser um valor booleano (true ou false).'
                json_malformado:
                  summary: JSON malformado
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: JSON_INVALIDO
        '404':
          description: Dinâmica não encontrada
          content:
            application/json:
              schema:
                type: object
              example:
                success: false
                errors:
                  - code: 0
                    message: Dinâmica não encontrada.
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