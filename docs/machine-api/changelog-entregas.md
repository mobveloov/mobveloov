> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Entregas

> Histórico de alterações e novidades da API de Entregas v2

export const Entry = ({date, label, labelColor = "#16A34A", children}) => <div style={{
  display: "flex",
  gap: "32px",
  marginBottom: "56px",
  position: "relative"
}}>
    <div style={{
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  minWidth: "140px",
  paddingTop: "4px"
}}>
      <div style={{
  fontSize: "13px",
  fontWeight: "600",
  color: "var(--tw-prose-body)",
  opacity: 0.55,
  whiteSpace: "nowrap",
  letterSpacing: "0.02em"
}}>{date}</div>
      {label && <div style={{
  marginTop: "8px",
  padding: "3px 10px",
  borderRadius: "20px",
  background: `${labelColor}22`,
  border: `1px solid ${labelColor}55`,
  color: labelColor,
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.06em",
  textTransform: "uppercase"
}}>{label}</div>}
    </div>

    <div style={{
  width: "2px",
  background: "rgba(22, 163, 74, 0.15)",
  borderRadius: "2px",
  flexShrink: 0,
  position: "relative"
}}>
      <div style={{
  position: "absolute",
  top: "6px",
  left: "50%",
  transform: "translateX(-50%)",
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  background: "#16A34A",
  border: "2px solid var(--tw-prose-bg, #fff)",
  boxShadow: "0 0 0 2px #16A34A44"
}} />
    </div>

    <div style={{
  flex: 1,
  paddingBottom: "8px"
}}>
      {children}
    </div>
  </div>;

export const ChangeSection = ({type, children}) => {
  const config = {
    added: {
      label: "Adicionado",
      bg: "#16A34A14",
      border: "#16A34A44",
      dot: "#16A34A"
    },
    changed: {
      label: "Alterado",
      bg: "#f59e0b14",
      border: "#f59e0b44",
      dot: "#f59e0b"
    },
    fixed: {
      label: "Corrigido",
      bg: "#3b82f614",
      border: "#3b82f644",
      dot: "#3b82f6"
    },
    removed: {
      label: "Removido",
      bg: "#ef444414",
      border: "#ef444444",
      dot: "#ef4444"
    }
  };
  const c = config[type] ?? config.added;
  return <div style={{
    marginBottom: "16px",
    padding: "16px 20px",
    borderRadius: "12px",
    background: c.bg,
    border: `1px solid ${c.border}`
  }}>
      <div style={{
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "10px"
  }}>
        <div style={{
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: c.dot,
    flexShrink: 0
  }} />
        <span style={{
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: c.dot
  }}>{c.label}</span>
      </div>
      <div style={{
    fontSize: "14px",
    lineHeight: "1.65"
  }}>
        {children}
      </div>
    </div>;
};

export const ParamBadge = ({name}) => <code style={{
  background: "rgba(22, 163, 74, 0.12)",
  border: "1px solid rgba(22, 163, 74, 0.25)",
  color: "#16A34A",
  borderRadius: "6px",
  padding: "1px 6px",
  fontSize: "13px",
  fontWeight: "600"
}}>{name}</code>;

export const EndpointBadge = ({method, path, href}) => <a href={href} style={{
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  padding: "6px 12px",
  marginBottom: "16px",
  fontFamily: "monospace",
  fontSize: "13px",
  textDecoration: "none",
  cursor: href ? "pointer" : "default",
  transition: "border-color 0.15s, background 0.15s"
}} onMouseEnter={e => {
  if (href) {
    e.currentTarget.style.borderColor = "rgba(22,163,74,0.5)";
    e.currentTarget.style.background = "rgba(22,163,74,0.06)";
  }
}} onMouseLeave={e => {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
}}>
    <span style={{
  background: method === "GET" ? "#3b82f6" : method === "POST" ? "#16A34A" : method === "DELETE" ? "#ef4444" : method === "PUT" ? "#f59e0b" : method === "PATCH" ? "#8b5cf6" : "#6b7280",
  color: "#fff",
  borderRadius: "4px",
  padding: "1px 7px",
  fontWeight: "700",
  fontSize: "11px",
  letterSpacing: "0.05em"
}}>{method}</span>
    <span style={{
  opacity: 0.8
}}>{path}</span>
  </a>;

<div style={{ maxWidth: "860px", margin: "0 auto", padding: "40px 20px 80px" }}>
  <div style={{ marginBottom: "56px" }}>
    <div style={{ fontSize: "40px", fontWeight: "800", marginBottom: "12px", letterSpacing: "-0.02em" }}>Entregas</div>

    <p style={{ fontSize: "17px", opacity: 0.65, lineHeight: "1.6" }}>
      Acompanhe todas as novidades, melhorias e alterações nos endpoints de Entregas da API v2.
    </p>
  </div>

  <Entry date="22 set 2026" label="Melhoria" labelColor="#16A34A">
    <h2 id="valor-original-recibo" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Valor da entrega antes do desconto do cupom
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      O recibo da entrega passou a informar também o valor bruto, antes do desconto do cupom, ao
      lado do valor já líquido que era retornado. Sem cupom aplicado, os dois valores são iguais.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/entregas/{id}/recibo" href="/pages/v2/entregas/endpoint/get-recibo" />

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="valor_original" /> — dentro de <ParamBadge name="dados_solicitacao" />, traz o valor bruto da entrega, antes do desconto do cupom. O campo <ParamBadge name="valor" /> continua trazendo o valor já líquido.</li>
      </ul>
    </ChangeSection>
  </Entry>

  <Entry date="17 set 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="url-confirmacao" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Confirmação do código de entrega pelo seu sistema
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Agora a parada aceita uma URL do seu sistema para validar o código de confirmação. Serve para
      quem recebe o pedido em outra plataforma (um PDV integrado ao iFood, por exemplo) e não tem
      como enviar o código na abertura da entrega — o condutor informa os 4 dígitos no app e nós
      perguntamos ao seu sistema se conferem.
    </p>

    <EndpointBadge method="POST" path="/api/v2/integracao/entregas" href="/pages/v2/entregas/endpoint/post" />

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="paradas[].url_confirmacao" /> — opcional. Ao informá-la, o app passa a pedir o código ao condutor e, na confirmação, chamamos a URL com <code>POST</code> e corpo JSON contendo <code>codigo\_confirmacao</code>, <code>solicitacao\_id</code>, <code>solicitacao\_parada\_id</code> e <code>id\_externo</code>. Responda <code>2xx</code> para confirmar a entrega e <code>4xx</code> para recusar o código.</li>
        <li>Com a URL informada, o <code>codigo\_confirmacao</code> da parada deixa de ser necessário — quem valida o código é o seu sistema, não nós.</li>
      </ul>
    </ChangeSection>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="POST" path="/api/v2/integracao/entregas/programadas" href="/pages/v2/entregas/endpoint/post-programadas" />

      <ChangeSection type="added">
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li><ParamBadge name="paradas[].url_confirmacao" /> — mesmo comportamento da criação de entrega. A URL é preservada no disparo da programada.</li>
        </ul>
      </ChangeSection>
    </div>

    <ChangeSection type="changed">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li>O <code>codigo\_confirmacao</code> agora está documentado como um código de <strong>4 dígitos</strong> (de <code>0001</code> a <code>9999</code>).</li>
        <li>O <strong>“prosseguir sem código”</strong> da plataforma, antes restrito a pedidos do iFood, passa a atender também as entregas abertas com <code>url\_confirmacao</code> — nos detalhes da solicitação e na gestão de pedidos.</li>
      </ul>
    </ChangeSection>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Requisitos da URL:</strong> <code>https</code> obrigatório, no máximo 500 caracteres e endereço público — fora disso a entrega é recusada com <code>400 URL\_CONFIRMACAO\_INVALIDA</code> (código 142). O tempo limite é de 10 segundos. Se o seu sistema estiver indisponível, a entrega <strong>não</strong> é confirmada: a central ou a empresa libera a finalização pelo cadeado. A URL pode carregar o seu próprio token e não é retornada nas consultas da entrega. Aceita apenas na criação; a edição não altera a URL.
    </div>
  </Entry>

  <Entry date="8 set 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="info-antes-aceite-entregas" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Informação para o condutor antes do aceite da entrega
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      A abertura de entrega passa a aceitar <ParamBadge name="info_antes_aceite" />, um texto que o
      condutor vê na tela de aceite, antes de decidir se pega a entrega. O campo já existia em
      corridas e agora tem o mesmo comportamento em entregas.
    </p>

    <EndpointBadge method="POST" path="/api/v2/integracao/entregas" href="/pages/v2/entregas/endpoint/post" />

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="POST" path="/api/v2/integracao/entregas/programadas" href="/pages/v2/entregas/endpoint/post-programadas" />
    </div>

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="info_antes_aceite" /> — texto opcional exibido ao condutor antes do aceite.</li>
      </ul>
    </ChangeSection>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota:</strong> o campo é opcional e não altera nenhum comportamento existente. Textos com mais de 70 caracteres são truncados, não recusados. Não confunda com <ParamBadge name="observacao_parada" />, que continua sendo por parada e só aparece para o condutor depois do aceite.
    </div>
  </Entry>

  <Entry date="4 set 2026" label="Melhoria" labelColor="#16A34A">
    <h2 id="webhook-posicao-lote" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Novo formato do Webhook de Posição
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      O Webhook de Posição passou a entregar as posições dos condutores em lote, a cada 10 segundos, em um envelope com o array <ParamBadge name="data" />. O contrato completo está em <a href="/pages/v2/entregas/webhooks/sobre">Webhooks > Sobre</a>.
    </p>

    <ChangeSection type="changed">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li>O corpo da requisição virou um envelope <ParamBadge name="event_id" /> / <ParamBadge name="datetime" /> / <ParamBadge name="data" />, com até 500 posições por envio. Uma janela com mais posições é dividida em várias requisições, cada uma com o seu próprio <ParamBadge name="event_id" />.</li>
        <li>As coordenadas passaram a ser enviadas dentro do objeto <ParamBadge name="coordinates" />, com <ParamBadge name="latitude" /> e <ParamBadge name="longitude" /> sempre juntas e com 6 casas decimais.</li>
        <li>Cada par condutor/solicitação aparece no máximo uma vez por janela, sempre com a leitura mais recente.</li>
        <li>Não há reenvio: se a URL cadastrada responder erro, o lote não é reentregue — a janela seguinte já traz uma posição mais nova. Leituras com mais de 15 segundos não são entregues.</li>
      </ul>
    </ChangeSection>

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="timestamp" /> — momento em que a posição foi gerada pelo condutor, em milissegundos desde 1970-01-01 UTC. É distinto do <ParamBadge name="datetime" /> do envelope, que marca o envio do lote.</li>
        <li><ParamBadge name="enterprise_id" /> — identificador da empresa, presente apenas quando o webhook é cadastrado com o responsável <code>empresa</code>.</li>
      </ul>
    </ChangeSection>

    <ChangeSection type="removed">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="links" /> — o objeto com as URLs de solicitação, condutor e empresa não é mais enviado.</li>
        <li><ParamBadge name="latitude" /> e <ParamBadge name="longitude" /> na raiz do item, substituídas pelo objeto <ParamBadge name="coordinates" />.</li>
      </ul>
    </ChangeSection>
  </Entry>

  <Entry date="3 set 2026" label="Melhoria" labelColor="#16A34A">
    <h2 id="patch-area-vertices-dinamica" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Atualização de área e vértices da dinâmica
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      O endpoint de atualização da dinâmica por área agora aceita outros campos além de <ParamBadge name="ativo" />, e um novo endpoint permite substituir os vértices do polígono de uma área.
    </p>

    <EndpointBadge method="PATCH" path="/api/v2/integracao/dinamicas/area/{id}" href="/pages/v2/entregas/dinamicas/endpoint/patch-area" />

    <ChangeSection type="changed">
      <p style={{ marginBottom: "10px" }}>Novos campos opcionais no corpo da requisição (ao menos um deve ser informado):</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="nome" /> — novo nome da área.</li>
        <li><ParamBadge name="fator" /> — novo valor do fator aplicado pela dinâmica.</li>
        <li><ParamBadge name="tipo_calculo" /> — forma de cálculo do fator: <code>F</code> (valor adicional, soma um valor fixo em R\$) ou <code>M</code> (fator multiplicador, multiplica o preço da entrega).</li>
        <li><ParamBadge name="tipo_fator" /> — momento de aplicação do fator: <code>P</code> (partida, na origem/coleta) ou <code>R</code> (parada, no destino).</li>
        <li><ParamBadge name="ativo" /> — comportamento inalterado, ativa ou desativa a dinâmica da área.</li>
      </ul>
    </ChangeSection>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="PATCH" path="/api/v2/integracao/dinamicas/area/{id}/vertices" href="/pages/v2/entregas/dinamicas/endpoint/patch-vertices" />
    </div>

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Novo endpoint para substituir todos os vértices do polígono de uma área, a partir de um objeto GeoJSON <code>Polygon</code> (RFC 7946) com um único anel de coordenadas.</p>
    </ChangeSection>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota:</strong> a área é imutável depois de criada — alterar a geometria (endpoint de vértices) ou o <ParamBadge name="nome" /> (endpoint de área) cria internamente uma NOVA área, copiando os demais atributos da original. Em ambos os casos a resposta pode trazer um <code>id</code> de área diferente do informado na URL, que deve ser usado nas próximas requisições sobre essa área.
    </div>
  </Entry>

  <Entry date="20 ago 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="agrupar-programadas-em-programada" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Agrupamento de entregas programadas entre si
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Agora é possível agrupar entregas programadas em outra entrega programada. Antes o agrupamento
      só era possível quando a entrega agrupadora estava em andamento — programadas só podiam ser
      agrupadas a uma entrega já despachada.
    </p>

    <EndpointBadge method="POST" path="/api/v2/integracao/entregas/programadas/{id}/agrupar" href="/pages/v2/entregas/endpoint/post-programadas-agrupar-programadas" />

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>A programada informada em <code>{"{id}"}</code> é a agrupadora: ela <strong>mantém o seu identificador</strong> e passa a conter as paradas de todas as programadas do corpo, que assumem a situação <code>agrupado</code>.</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="programadas_agrupadas" /> — lista dos IDs das programadas a agrupar. É o único campo do corpo.</li>
        <li>Empresa, categoria, tipo de pagamento, retorno e data/hora do disparo são obtidos da programada agrupadora.</li>
        <li>A estimativa da corrida e a ordenação das paradas são calculadas pelo servidor, com otimização de rota.</li>
        <li>A resposta segue o contrato dos outros endpoints de agrupamento. O valor recalculado sai em <code>GET /entregas/programadas/{"{id}"}</code>.</li>
      </ul>
    </ChangeSection>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Requisitos:</strong> todas as programadas precisam estar aguardando disparo, pertencer à mesma empresa, partir do mesmo ponto de coleta e estar a mais de 60 segundos do disparo. Programadas em uso pela junção automática não podem ser agrupadas.
    </div>
  </Entry>

  <Entry date="13 ago 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="exigir-codigo-confirmacao" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Exigir o código de confirmação de entrega pela API
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Agora é possível exigir, por solicitação, que o condutor informe o código de confirmação
      para concluir a entrega — mesmo quando o cadastro da empresa não torna o código obrigatório.
    </p>

    <EndpointBadge method="POST" path="/api/v2/integracao/entregas" href="/pages/v2/entregas/endpoint/post" />

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="exigir_codigo_confirmacao" /> — opcional. Envie <code>true</code> para tornar o código obrigatório nesta solicitação, independente das configurações do cadastro da empresa (ou da central); omitir o campo ou enviar <code>false</code> mantém o que está configurado. Com <code>true</code>, o <code>codigo\_confirmacao</code> passa a ser obrigatório em todas as paradas.</li>
      </ul>
    </ChangeSection>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="POST" path="/api/v2/integracao/entregas/programadas" href="/pages/v2/entregas/endpoint/post-programadas" />

      <ChangeSection type="added">
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li><ParamBadge name="exigir_codigo_confirmacao" /> — mesmo comportamento da criação de entrega. Quando <code>true</code>, a exigência é aplicada à solicitação gerada no disparo da programada.</li>
        </ul>
      </ChangeSection>
    </div>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota:</strong> o parâmetro é absoluto sobre as duas configurações do cadastro da empresa — vale mesmo com <em>Solicitar código de confirmação de entrega dos pedidos</em> e <em>Tornar os códigos de confirmação de entrega obrigatórios</em> desabilitadas. Ele só soma exigência: nunca dispensa a que já está configurada. Em contrapartida, o <code>codigo\_confirmacao</code> de cada parada passa a ser obrigatório — sem ele o condutor não teria o que informar para concluir a entrega, e a solicitação é recusada com <code>400 CODIGO\_CONFIRMACAO\_OBRIGATORIO</code> (código 136). Pedidos do iFood continuam exigindo o código independente do valor enviado, por ser regra da própria integração. A exigência criada pelo parâmetro não é removível depois: o <em>prosseguir sem código</em> da plataforma atende só pedidos do iFood, e a edição da entrega não altera o parâmetro. O código fica visível no painel da empresa, no link de acompanhamento e em <code>GET /entregas/{id}/links-rastreio</code>.
    </div>
  </Entry>

  <Entry date="13 ago 2026" label="Melhoria" labelColor="#16A34A">
    <h2 id="detalhes-entregas-programadas" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Detalhes da solicitação e das entregas na consulta de programadas
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      A consulta de entregas programadas passa a devolver categoria, valor, observação, endereço de
      coleta e a lista completa de paradas com os dados de cada pedido — antes era necessário
      consultar outro endpoint para saber qualquer um desses dados.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/entregas/programadas" href="/pages/v2/entregas/endpoint/get-programadas" />

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="GET" path="/api/v2/integracao/entregas/programadas/{id}" href="/pages/v2/entregas/endpoint/get-programadas-by-id" />
    </div>

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Campos novos na resposta dos dois endpoints:</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="categoria" /> — <code>id</code> e <code>nome</code> da categoria da solicitação.</li>
        <li><ParamBadge name="valor" /> — <code>estimado</code> (estimativa no momento da criação) e <code>prefixado</code> (valor fechado, quando houver).</li>
        <li><ParamBadge name="observacao" /> — observação da solicitação.</li>
        <li><ParamBadge name="coleta" /> — endereço de coleta completo: <code>endereco</code>, <code>complemento</code>, <code>referencia</code>, <code>bairro</code>, <code>cidade</code>, <code>estado</code>, <code>lat</code> e <code>lng</code>.</li>
        <li><ParamBadge name="paradas" /> — lista de paradas na ordem da entrega, cada uma com <code>id</code>, <code>ordem</code>, endereço completo, <code>numero\_pedido</code>, <code>nome\_cliente</code>, <code>telefone\_cliente</code> e <code>observacao</code>.</li>
      </ul>
    </ChangeSection>

    <ChangeSection type="changed">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li>A consulta por id passa a devolver <ParamBadge name="id_mch_programada" />, que antes só aparecia na listagem.</li>
      </ul>
    </ChangeSection>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota:</strong> os campos são apenas adicionados — nenhum campo existente mudou de nome, tipo ou posição. O destino de cada entrega fica na respectiva parada, por isso a resposta não traz um endereço de destino da solicitação.
    </div>
  </Entry>

  <Entry date="10 ago 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="limite-webhooks-por-tipo" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Aumento do limite de webhooks por tipo
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Limite de cadastro de webhooks atualizado: até 5 webhooks por tipo. O webhook do tipo mensagem é limitado a 1 cadastro.
    </p>

    <EndpointBadge method="POST" path="/api/v2/integracao/webhooks" href="/pages/v2/entregas/webhooks/endpoint/post" />

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <li>Aumentou o limite de webhooks cadastrados para até 5 webhooks por tipo.</li>
        <li>O webhook do tipo mensagem é limitado a 1 cadastro.</li>
      </ul>
    </ChangeSection>
  </Entry>

  <Entry date="16 jul 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="consultar-status-webhook" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Consulta de status de entrega do webhook
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Novo endpoint para verificar se um webhook está entregando eventos normalmente ou se foi
      bloqueado por falhas de entrega, com detalhes do bloqueio e da próxima tentativa de reenvio.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/webhooks/{id}/status" href="/pages/v2/entregas/webhooks/endpoint/get-status" />

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Campos retornados na consulta:</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="situacao" /> — <code>ativo</code>, <code>bloqueado\_temporariamente</code> (falhas consecutivas de entrega) ou <code>bloqueado\_definitivamente</code> (tentativas de reenvio esgotadas).</li>
        <li><ParamBadge name="bloqueio_temporario" /> — estado do bloqueio temporário: <code>ativo</code>, <code>falhas\_consecutivas</code>, <code>desde</code> e <code>proxima\_tentativa</code> (datas em ISO-8601, UTC).</li>
        <li><ParamBadge name="bloqueio_definitivo" /> — estado do bloqueio definitivo: <code>ativo</code> e <code>desde</code>.</li>
      </ul>
    </ChangeSection>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota:</strong> durante um bloqueio temporário as entregas ficam suspensas até <code>proxima\_tentativa</code>. No bloqueio definitivo os eventos deixam de ser entregues ao webhook.
    </div>
  </Entry>

  <Entry date="14 jul 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="foto-condutor" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Foto do condutor na consulta por ID
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      O endpoint de consulta de condutor por ID agora retorna a foto de rosto cadastrada,
      permitindo exibi-la na interface do integrador.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/condutores/{id}" href="/pages/v2/entregas/condutores/endpoint/get-by-id" />

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="foto_url" /> — link temporário (presigned, expira em 30 minutos) da foto de rosto do condutor. <code>null</code> quando não há foto cadastrada.</li>
      </ul>
    </ChangeSection>
  </Entry>

  <Entry date="30 jun 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="editar-entrega" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Editar paradas de uma entrega em andamento ou programada
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Dois novos endpoints permitem substituir a lista de paradas de uma entrega já criada,
      tanto para solicitações ativas quanto para programadas ainda não disparadas.
    </p>

    <EndpointBadge method="PUT" path="/api/v2/integracao/entregas/{id}" href="/pages/v2/entregas/endpoint/put-by-id" />

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="paradas" /> — lista completa das paradas desejadas (substituição total). A ordem define a sequência de entrega. Obrigatório.</li>
        <li><ParamBadge name="com_retorno" /> — define se a entrega tem retorno ao ponto de partida. Se omitido, preserva o valor atual.</li>
      </ul>
    </ChangeSection>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="PUT" path="/api/v2/integracao/entregas/programadas/{id}" href="/pages/v2/entregas/endpoint/put-programadas-by-id" />

      <ChangeSection type="added">
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li><ParamBadge name="paradas" /> — lista completa das paradas desejadas (substituição total). Obrigatório.</li>
          <li><ParamBadge name="data" /> — data do disparo no formato <code>DD/MM/AAAA</code>. Obrigatório.</li>
          <li><ParamBadge name="hora" /> — hora do disparo no formato <code>HH:MM</code>. Obrigatório.</li>
          <li><ParamBadge name="forma_pagamento" /> — forma de pagamento da entrega. Obrigatório.</li>
        </ul>
      </ChangeSection>
    </div>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Substituição total:</strong> ambos os endpoints substituem toda a lista de paradas — não é um patch parcial. Inclua todas as paradas desejadas na requisição, inclusive as que devem ser mantidas.
    </div>
  </Entry>

  <Entry date="30 jun 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="excluir-entrega" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Excluir entrega de uma solicitação
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Novos endpoints permitem remover uma entrega individual de solicitações ativas e programadas
      sem cancelar toda a solicitação.
    </p>

    <EndpointBadge method="DELETE" path="/api/v2/integracao/entregas/{id}/paradas/{parada_id}" href="/pages/v2/entregas/endpoint/delete-entrega-by-id" />

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li>Remove uma entrega de solicitação ativa pelo ID da solicitação e da entrega.</li>
      </ul>
    </ChangeSection>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="DELETE" path="/api/v2/integracao/entregas/programadas/{id}/paradas/{parada_id}" href="/pages/v2/entregas/endpoint/delete-entrega-programada-by-id" />

      <ChangeSection type="added">
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li>Remove uma entrega de solicitação programada pelo ID da solicitação e da entrega.</li>
        </ul>
      </ChangeSection>
    </div>
  </Entry>

  <Entry date="25 jun 2026" label="Novo" labelColor="#3b82f6">
    <h2 id="crud-consumidores" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      CRUD de Consumidores e Endereços
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Quatro endpoints para gerenciar consumidores da empresa e quatro para gerenciar seus endereços salvos,
      permitindo criar, consultar, editar e excluir diretamente pela API.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/consumidores" href="/pages/v2/entregas/consumidores/endpoint/get" />

    <EndpointBadge method="POST" path="/api/v2/integracao/consumidores" href="/pages/v2/entregas/consumidores/endpoint/post" />

    <EndpointBadge method="GET" path="/api/v2/integracao/consumidores/{id}" href="/pages/v2/entregas/consumidores/endpoint/get-by-id" />

    <EndpointBadge method="PATCH" path="/api/v2/integracao/consumidores/{id}" href="/pages/v2/entregas/consumidores/endpoint/patch-by-id" />

    <ChangeSection type="added">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li>Listagem paginada de consumidores da empresa (<ParamBadge name="limite" /> e <ParamBadge name="pagina" />).</li>
        <li>Criação de consumidor com <ParamBadge name="telefone" /> em formato E.164 (ex: <code>+5544999999999</code>).</li>
        <li>Consulta individual retorna o consumidor com seus endereços.</li>
        <li>Edição do nome do consumidor via PATCH.</li>
      </ul>
    </ChangeSection>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="GET" path="/api/v2/integracao/consumidores/{id}/enderecos" href="/pages/v2/entregas/consumidores/endpoint/enderecos-get" />

      <EndpointBadge method="POST" path="/api/v2/integracao/consumidores/{id}/enderecos" href="/pages/v2/entregas/consumidores/endpoint/enderecos-post" />

      <EndpointBadge method="PATCH" path="/api/v2/integracao/consumidores/{id}/enderecos/{enderecoId}" href="/pages/v2/entregas/consumidores/endpoint/enderecos-patch" />

      <EndpointBadge method="DELETE" path="/api/v2/integracao/consumidores/{id}/enderecos/{enderecoId}" href="/pages/v2/entregas/consumidores/endpoint/enderecos-delete" />

      <ChangeSection type="added">
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li>Listagem dos endereços salvos de um consumidor.</li>
          <li>Criação de endereço com deduplicação automática por <ParamBadge name="place_id" /> (Google Places).</li>
          <li>Edição parcial de endereço via PATCH (apenas os campos enviados são alterados).</li>
          <li>Exclusão de endereço.</li>
        </ul>
      </ChangeSection>
    </div>
  </Entry>

  <Entry date="25 jun 2026" label="Melhoria" labelColor="#16A34A">
    <h2 id="filtros-busca-clientes-condutores" style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
      Novos filtros de busca em Clientes e Condutores
    </h2>

    <p style={{ fontSize: "15px", opacity: 0.7, marginBottom: "20px", lineHeight: "1.6" }}>
      Os endpoints de listagem foram expandidos com filtros de busca direta por CPF, e-mail,
      telefone e nome, eliminando a necessidade de conhecer o ID do registro para localizá-lo.
    </p>

    <EndpointBadge method="GET" path="/api/v2/integracao/clientes" href="/pages/v2/referencia/clientes/endpoint/get" />

    <ChangeSection type="added">
      <p style={{ marginBottom: "10px" }}>Novos parâmetros de query disponíveis:</p>

      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <li><ParamBadge name="cpf" /> — correspondência exata, com ou sem máscara (ex: <code>064.181.699-56</code> ou <code>06418169956</code>). Ignora <code>status\_cliente</code> e paginação.</li>
        <li><ParamBadge name="email" /> — correspondência exata. Ignora <code>status\_cliente</code> e paginação.</li>
        <li><ParamBadge name="telefone" /> — aceita com ou sem DDI e prefixo <code>+</code>; DDI inferido pelo país da bandeira, fallback Brasil (<code>55</code>). Ignora <code>status\_cliente</code> e paginação.</li>
        <li><ParamBadge name="nome" /> — busca parcial, mínimo 3 caracteres. Ignora <code>status\_cliente</code>, mas mantém paginação.</li>
      </ul>
    </ChangeSection>

    <ChangeSection type="changed">
      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <li><ParamBadge name="status_cliente" />, <ParamBadge name="limite" /> e <ParamBadge name="pagina" /> agora documentam explicitamente quando são ignorados na presença de filtros diretos.</li>
      </ul>
    </ChangeSection>

    <div style={{ marginTop: "24px" }}>
      <EndpointBadge method="GET" path="/api/v2/integracao/condutores" href="/pages/v2/referencia/condutores/endpoint/get" />

      <ChangeSection type="added">
        <p style={{ marginBottom: "10px" }}>Novos parâmetros de query disponíveis:</p>

        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li><ParamBadge name="email" /> — correspondência exata. Ignora <code>status\_condutor</code> e paginação.</li>
          <li><ParamBadge name="nome" /> — busca parcial, mínimo 3 caracteres. Ignora <code>status\_condutor</code>, mas mantém paginação.</li>
        </ul>
      </ChangeSection>

      <ChangeSection type="changed">
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li><ParamBadge name="cpf" /> passou a aceitar apenas correspondência exata com ou sem máscara (busca parcial por inteiro removida). Ignora <code>status\_condutor</code> e paginação.</li>
          <li><ParamBadge name="telefone" /> expandido: agora documenta comportamento de DDI e prefixo <code>+</code>, alinhado ao endpoint de clientes.</li>
          <li><ParamBadge name="status_condutor" />, <ParamBadge name="limite" /> e <ParamBadge name="pagina" /> agora documentam explicitamente quando são ignorados.</li>
        </ul>
      </ChangeSection>
    </div>

    <div
      style={{
  marginTop: "20px",
  padding: "14px 18px",
  borderRadius: "10px",
  background: "rgba(59, 130, 246, 0.08)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  fontSize: "13px",
  lineHeight: "1.6",
}}
    >
      <strong>Nota sobre prioridade de filtros:</strong> filtros diretos (<code>id</code>, <code>cpf</code>, <code>email</code> ou <code>telefone</code>) suprimem status e paginação automaticamente. O filtro <code>nome</code> mantém a paginação, mas ignora o status.
    </div>
  </Entry>
</div>
