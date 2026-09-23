> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Criar cupom

> Cria um novo cupom de desconto vinculado a um gerador de cupom.



## OpenAPI

````yaml pages/v2/openapi-corridas.json POST /cupons
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
  /cupons:
    post:
      summary: Criar cupom
      description: Cria um novo cupom de desconto vinculado a um gerador de cupom.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - gerador_cupom_id
                - data_hora_inicio
                - data_hora_final
                - limite_de_uso
                - tipo_desconto
                - desconto
                - tipos_pagamentos
              properties:
                gerador_cupom_id:
                  type: integer
                  description: >-
                    ID do gerador de cupom ao qual o cupom será vinculado.
                    Obtenha os geradores disponíveis em `GET /cupons/geradores`.
                codigo:
                  type: string
                  description: >-
                    Código do cupom que o passageiro utilizará. Obrigatório se
                    `codigo_pattern` não for informado.
                  example: DESCONTO10
                codigo_pattern:
                  type: string
                  description: >-
                    Padrão para geração automática de códigos de cupom.
                    Obrigatório se `codigo` não for informado.
                  example: DESCONTO10
                data_hora_inicio:
                  type: string
                  format: date-time
                  description: >-
                    Data e hora de início da validade do cupom em formato ISO
                    8601
                  example: '2026-05-01T00:00:00Z'
                data_hora_final:
                  type: string
                  format: date-time
                  description: >-
                    Data e hora de término da validade do cupom em formato ISO
                    8601
                  example: '2026-06-01T23:59:59Z'
                limite_de_uso:
                  type: string
                  description: Define a regra de limite de utilização do cupom.
                  enum:
                    - sem_limite
                    - apenas_uma_vez
                    - apenas_primeira_corrida
                    - ate_n_vezes_por_passageiro
                limite_de_uso_individual:
                  type: integer
                  description: >-
                    Número máximo de vezes que cada passageiro pode usar o
                    cupom. **Obrigatório** quando `limite_de_uso` é
                    `ate_n_vezes_por_passageiro`.
                  example: 3
                tipo_desconto:
                  type: string
                  description: >-
                    Tipo de desconto como percentual (percentual) ou valor fixo
                    (valor_fixo).
                  enum:
                    - percentual
                    - valor_fixo
                  example: percentual
                desconto:
                  type: string
                  description: >-
                    Valor do desconto. Para `valor_fixo`, use o valor monetário
                    (ex: `"10.00"`). Para `porcentagem`, use o percentual (ex:
                    `"15"`).
                  example: '10.00'
                tipos_pagamentos:
                  type: array
                  description: >-
                    Lista de formas de pagamento aceitas pelo cupom. Tipos de
                    pagamento em que o cupom irá se aplicar separados por
                    vírgula, valores aceitos: Dinheiro (D), Débito (máquina)
                    (B), Crédito máquina (C), eTicket (T), Voucher (V), Pix (X),
                    Picpay (P), Whatsapp (H), Cartão via app (A), Faturado (F),
                    Pix via app (I) e Carteira de Créditos (R).
                  items:
                    type: string
                    enum:
                      - D
                      - B
                      - C
                      - T
                      - V
                      - X
                      - P
                      - H
                      - A
                      - F
                      - I
                      - R
                  example:
                    - D
                    - B
                cliente_ids:
                  type: array
                  description: >-
                    Opcional. Lista de ids dos clientes que poderão usar o cupom
                    criado.
                  items:
                    type: integer
                  example:
                    - 83983
                    - 83992
                    - 83959
                area_id:
                  type: integer
                  description: Opcional. Indica a área a qual o cupom será restrito.
                  example: 239
                local_aplicacao:
                  type: string
                  description: >-
                    Opcional. Indica se a restrição de area_id se aplica ao
                    local de partida (P) ou de destino (D) da corrida. Só é
                    considerado quando area_id é enviado; padrão P.
                  enum:
                    - P
                    - D
                  example: D
            examples:
              cupom_valor_fixo:
                summary: Cupom com tipo de desconto inteiro e uso ilimitado
                value:
                  gerador_cupom_id: 1
                  codigo: DESCONTO10
                  data_hora_inicio: '2026-05-01T00:00:00Z'
                  data_hora_final: '2026-06-01T23:59:59Z'
                  limite_de_uso: sem_limite
                  desconto: '10.00'
                  tipos_pagamentos:
                    - D
                  cliente_ids:
                    - 83983
                    - 83992
                    - 83959
                  area_id: 239
                  local_aplicacao: D
              cupom_porcentagem_individual:
                summary: Cupom com percentual e limite individual
                value:
                  gerador_cupom_id: 1
                  codigo: DESCONTOINDIV
                  data_hora_inicio: '2026-05-01T00:00:00Z'
                  data_hora_final: '2026-06-01T23:59:59Z'
                  limite_de_uso: ate_n_vezes_por_passageiro
                  limite_de_uso_individual: 3
                  tipo_desconto: percentual
                  desconto: '15'
                  tipos_pagamentos:
                    - C
                    - B
                  cliente_ids:
                    - 83983
                    - 83992
                    - 83959
                  area_id: 239
      responses:
        '200':
          description: Cupom criado com sucesso
          content:
            application/json:
              schema:
                type: object
              example:
                success: true
                data:
                  id: 42
                  codigo: DESCONTO10
                  gerador_cupom_id: 1
                  data_hora_inicio: '2026-05-01T00:00:00Z'
                  data_hora_final: '2026-06-01T23:59:59Z'
                  limite_de_uso: sem_limite
                  desconto: '10.00'
                  tipos_pagamentos:
                    - D
                message: Cupom criado com sucesso.
        '400':
          description: Erro de validação
          content:
            application/json:
              schema:
                type: object
              examples:
                campos_obrigatorios:
                  summary: Campos obrigatórios ausentes
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''gerador_cupom_id'': Preenchimento obrigatório.'
                      - code: 0
                        message: '''data_hora_inicio'': Preenchimento obrigatório.'
                      - code: 0
                        message: '''data_hora_final'': Preenchimento obrigatório.'
                      - code: 0
                        message: '''limite_de_uso'': Preenchimento obrigatório.'
                      - code: 0
                        message: '''tipo_desconto'': Preenchimento obrigatório.'
                      - code: 0
                        message: '''desconto'': Preenchimento obrigatório.'
                      - code: 0
                        message: '''tipos_pagamentos'': Preenchimento obrigatório.'
                      - code: 0
                        message: '''codigo'': Informe ''codigo'' ou ''codigo_pattern''.'
                tipo_invalido:
                  summary: Tipos de dados inválidos
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: '''gerador_cupom_id'': Deve ser numérico.'
                json_invalido:
                  summary: JSON malformado
                  value:
                    success: false
                    errors:
                      - code: 0
                        message: JSON inválido.
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