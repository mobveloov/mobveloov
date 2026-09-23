# Machine API v2 - Documentacao Local

Documentacao completa da Machine API v2 baixada de https://docs.machine.global

## Estrutura

### Corridas (referencia/)
- `introducao.md` - Base URL, autenticacao, codigos de status e limites da API
- `corridas/` - Endpoints de corridas (criar, cancelar, consultar, detalhes, status, estimativas, posicao do condutor, recibo, etc)
- `condutores/` - Endpoints de condutores (motoristas)
- `configuracoes/` - Configuracoes da central (categorias, areas geograficas, etc)
- `clientes/` - Endpoints de clientes/passageiros
- `cupons/` - Endpoints de cupons de desconto
- `dinamicas/` - Dinamicas de precos (areas de precificacao dinamica)
- `empresas/` - Endpoints de empresas/organizacoes
- `engajamento/` - Endpoints de engajamento (permissoes)
- `mensagens/` - Envio de mensagens para condutores e empresas
- `notificacao/` - Notificacoes push e in-app
- `webhooks/` - Configuracao e gerenciamento de webhooks

### Entregas (entregas/)
- `introducao.md` - Introducao ao modulo de entregas
- `endpoint/` - Endpoints de entregas (criar, cancelar, consultar, detalhes, etc)
- `condutores/` - Endpoints de condutores de entrega
- `configuracoes/` - Configuracoes de entrega
- `consumidores/` - Endpoints de consumidores
- `dinamicas/` - Dinamicas de precos de entrega
- `empresas/` - Endpoints de empresas de entrega
- `mensagens/` - Mensagens para condutores e empresas
- `webhooks/` - Webhooks de entrega

## Endpoints mais usados no projeto

### Criar corrida
`POST /api/v2/integracao/corridas` - ver `referencia/corridas/post-criar.md`

### Estimar corrida
`POST /api/v2/integracao/corridas/estimativas` - ver `referencia/corridas/post-estimativas.md`

### Consultar status
`GET /api/v2/integracao/corridas/{id}/status` - ver `referencia/corridas/get-status.md`

### Consultar detalhes
`GET /api/v2/integracao/corridas/{id}/detalhes` - ver `referencia/corridas/get-detalhes.md`

### Cancelar corrida
`POST /api/v2/integracao/corridas/{id}/cancelar` - ver `referencia/corridas/post-cancelar.md`

### Posicao do condutor
`GET /api/v2/integracao/corridas/{id}/posicao-condutor` - ver `referencia/corridas/get-posicao-condutor.md`

### Webhooks
`referencia/webhooks/sobre.md` - Sobre webhooks
`referencia/webhooks/post.md` - Configurar webhook
