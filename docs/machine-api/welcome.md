> ## Documentation Index
> Fetch the complete documentation index at: https://docs.machine.global/llms.txt
> Use this file to discover all available pages before exploring further.

# Bem-vindo

<div
  style={{ 
position: "relative",
textAlign: "center", 
padding: "120px 24px",
backgroundImage: "linear-gradient(rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0.85)), url('https://mintcdn.com/machine-1192d0e5/UxewOZG4CrvLE6mx/images/gaudium-terra.webp?fit=max&auto=format&n=UxewOZG4CrvLE6mx&q=85&s=fe5e2007041e8511012ea0564b86d5c9')",
backgroundSize: "cover",
backgroundPosition: "center",
borderRadius: "24px",
display: "flex",
flexDirection: "column",
alignItems: "center",
justifyContent: "center",
margin: "20px 0 48px",
border: "1px solid rgba(255, 255, 255, 0.1)",
boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
}}
>
  <h1
    style={{ 
fontSize: "48px", 
fontWeight: "800", 
marginBottom: "24px", 
color: "#fff",
letterSpacing: "-0.02em",
textShadow: "0 2px 10px rgba(0,0,0,0.5)"
}}
  >
    API de Integração v2
  </h1>

  <p
    style={{
maxWidth: "700px",
color: "rgba(255, 255, 255, 0.95)",
fontSize: "20px",
lineHeight: "1.6",
fontWeight: "400",
textShadow: "0 1px 4px rgba(0,0,0,0.3)"
}}
  >
    Integre seu sistema com a plataforma Machine de maneira simples, segura e eficaz.
    Este guia contém tudo o que você precisa para começar sua jornada conosco.
  </p>
</div>

<div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 20px" }}>
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "28px", marginBottom: "56px" }}>
    <a href="/pages/v2/referencia/introducao" style={{ textDecoration: "none" }}>
      <div className="home-cta home-cta-corridas">
        <span className="home-cta-icon">
          <Icon icon="car-side" size={30} color="#0e9fe0" />
        </span>

        <span className="home-cta-text">
          <span>Documentação de Corridas</span>
          <small>Transporte de passageiros</small>
        </span>

        <svg className="home-cta-arrow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
    </a>

    <a href="/pages/v2/entregas/introducao" style={{ textDecoration: "none" }}>
      <div className="home-cta home-cta-entregas">
        <span className="home-cta-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />

            <path d="M3.27 6.96 12 12.01l8.73-5.05" />

            <path d="M12 22.08V12" />

            <path d="M7.5 4.21l9 5.19" />
          </svg>
        </span>

        <span className="home-cta-text">
          <span>Documentação de Entregas</span>
          <small>Envio de pacotes</small>
        </span>

        <svg className="home-cta-arrow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
    </a>
  </div>

  <CardGroup cols={2}>
    <Card title="Quem Somos" icon="building" iconType="duotone">
      A **Machine** é um produto **Gaudium**, projetado para fornecer tecnologia que permite a operação eficiente e segura
      das centrais de mobilidade urbana e entregas. Fornecemos as ferramentas para que condutores realizem serviços com excelência.
    </Card>

    <Card title="Evolução Constante" icon="arrow-trend-up" iconType="duotone">
      Nossa plataforma está em constante evolução. Recomendamos acompanhar nossos **informes** e o **changelog** para se manter atualizado sobre as novas funcionalidades e melhorias na integração.
    </Card>
  </CardGroup>

  <div style={{ marginTop: "64px" }}>
    <h2 style={{ fontSize: "32px", fontWeight: "700", marginBottom: "24px", color: "var(--tw-prose-headings)" }}>
      HATEOAS na v2
    </h2>

    <p style={{ fontSize: "17px", opacity: 0.8, marginBottom: "20px", lineHeight: "1.6" }}>
      HATEOAS é um padrão em que o próprio retorno da API guia você pelos endpoints relacionados ao recurso consultado.
      Com esses links, seu sistema consegue identificar quais próximas ações estão disponíveis sem consultar a documentação
      a cada etapa do fluxo. Na v2, esses links ficam no objeto <code>\_\_links</code>.
    </p>

    <Card title="Estrutura do objeto __links" icon="link" iconType="duotone">
      Cada chave dentro de <code>\_\_links</code> representa uma ação disponível.
      O valor da chave informa o endpoint e o método HTTP que devem ser usados para executar essa ação.

      ```json theme={null}
      {
        "__links": {
          "self": {
            "href": "api/v2/integracao/dinamicas/area",
            "metodo": "get"
          },
          "visualizar-dinamica-sem-area": {
            "href": "api/v2/integracao/dinamicas/sem-area",
            "metodo": "get"
          },
          "atualizar-dinamica-sem-area": {
            "href": "api/v2/integracao/dinamicas/sem-area",
            "metodo": "patch"
          },
          "atualizar-dinamica-area": {
            "href": "api/v2/integracao/dinamicas/area/{id}",
            "metodo": "patch"
          }
        }
      }
      ```
    </Card>

    <div style={{ marginTop: "24px" }}>
      <ul>
        <li><code>\_\_links</code>: objeto que agrupa os links HATEOAS retornados pela API.</li>
        <li><code>self</code>: link para consultar o próprio recurso retornado na resposta.</li>
        <li><code>href</code>: caminho do endpoint que deve ser chamado.</li>
        <li><code>metodo</code>: método HTTP aceito pelo endpoint, como <code>get</code>, <code>post</code> ou <code>patch</code>.</li>
        <li>Demais chaves, como <code>atualizar-dinamica-area</code>: ações relacionadas ao recurso atual.</li>
      </ul>
    </div>

    <h3 style={{ fontSize: "24px", fontWeight: "700", marginTop: "32px", marginBottom: "16px", color: "var(--tw-prose-headings)" }}>
      Como usar
    </h3>

    <p style={{ fontSize: "17px", opacity: 0.8, marginBottom: "20px", lineHeight: "1.6" }}>
      Primeiro chame um endpoint que retorna HATEOAS. Depois escolha uma ação em <code>\_\_links</code> e faça a próxima
      requisição usando o <code>href</code> e o <code>metodo</code> da resposta.
    </p>

    <CodeGroup>
      ```php PHP theme={null}
      $baseUrl = 'https://api.taximachine.com.br';
      $apiKey = 'sua-api-key';

      $ch = curl_init("$baseUrl/api/v2/integracao/dinamicas/area");
      curl_setopt_array($ch, [
          CURLOPT_RETURNTRANSFER => true,
          CURLOPT_HTTPHEADER => [
              "api-key: $apiKey",
              'Content-Type: application/json'
          ],
      ]);

      $dinamicas = json_decode(curl_exec($ch), true);
      curl_close($ch);

      $acaoAtualizar = $dinamicas['__links']['atualizar-dinamica-area'];
      $href = str_replace('{id}', $dinamicas['data'][0]['id'], $acaoAtualizar['href']);

      $ch = curl_init("$baseUrl/$href");
      curl_setopt_array($ch, [
          CURLOPT_CUSTOMREQUEST => strtoupper($acaoAtualizar['metodo']),
          CURLOPT_RETURNTRANSFER => true,
          CURLOPT_HTTPHEADER => [
              "api-key: $apiKey",
              'Content-Type: application/json'
          ],
          CURLOPT_POSTFIELDS => json_encode([
              'valor' => 2.5
          ]),
      ]);

      $dinamicaAtualizada = json_decode(curl_exec($ch), true);
      curl_close($ch);
      ```

      ```java Java theme={null}
      import java.net.URI;
      import java.net.http.HttpClient;
      import java.net.http.HttpRequest;
      import java.net.http.HttpResponse.BodyHandlers;
      import java.net.http.HttpRequest.BodyPublishers;
      import com.fasterxml.jackson.databind.JsonNode;
      import com.fasterxml.jackson.databind.ObjectMapper;

      String baseUrl = "https://api.taximachine.com.br";
      String apiKey = "sua-api-key";

      HttpClient client = HttpClient.newHttpClient();
      ObjectMapper mapper = new ObjectMapper();

      HttpRequest consulta = HttpRequest.newBuilder()
          .uri(URI.create(baseUrl + "/api/v2/integracao/dinamicas/area"))
          .header("api-key", apiKey)
          .header("Content-Type", "application/json")
          .GET()
          .build();

      JsonNode dinamicas = mapper.readTree(client.send(consulta, BodyHandlers.ofString()).body());
      JsonNode acaoAtualizar = dinamicas.path("__links").path("atualizar-dinamica-area");
      String href = acaoAtualizar.path("href").asText()
          .replace("{id}", dinamicas.path("data").get(0).path("id").asText());

      HttpRequest atualizacao = HttpRequest.newBuilder()
          .uri(URI.create(baseUrl + "/" + href))
          .header("api-key", apiKey)
          .header("Content-Type", "application/json")
          .method(acaoAtualizar.path("metodo").asText().toUpperCase(), BodyPublishers.ofString("""
              {"valor": 2.5}
          """))
          .build();

      JsonNode dinamicaAtualizada = mapper.readTree(client.send(atualizacao, BodyHandlers.ofString()).body());
      ```

      ```go Go theme={null}
      baseURL := "https://api.taximachine.com.br"
      apiKey := "sua-api-key"

      client := &http.Client{}

      consulta, _ := http.NewRequest("GET", baseURL+"/api/v2/integracao/dinamicas/area", nil)
      consulta.Header.Set("api-key", apiKey)
      consulta.Header.Set("Content-Type", "application/json")

      resposta, _ := client.Do(consulta)
      defer resposta.Body.Close()

      var dinamicas map[string]any
      json.NewDecoder(resposta.Body).Decode(&dinamicas)

      links := dinamicas["__links"].(map[string]any)
      acaoAtualizar := links["atualizar-dinamica-area"].(map[string]any)
      data := dinamicas["data"].([]any)
      primeiraDinamica := data[0].(map[string]any)

      href := strings.Replace(
          acaoAtualizar["href"].(string),
          "{id}",
          fmt.Sprint(primeiraDinamica["id"]),
          1,
      )

      body := strings.NewReader(`{"valor": 2.5}`)
      atualizacao, _ := http.NewRequest(
          strings.ToUpper(acaoAtualizar["metodo"].(string)),
          baseURL+"/"+href,
          body,
      )
      atualizacao.Header.Set("api-key", apiKey)
      atualizacao.Header.Set("Content-Type", "application/json")

      respostaAtualizacao, _ := client.Do(atualizacao)
      defer respostaAtualizacao.Body.Close()

      var dinamicaAtualizada map[string]any
      json.NewDecoder(respostaAtualizacao.Body).Decode(&dinamicaAtualizada)
      ```

      ```ruby Ruby theme={null}
      base_url = 'https://api.taximachine.com.br'
      api_key = 'sua-api-key'

      uri = URI("#{base_url}/api/v2/integracao/dinamicas/area")
      consulta = Net::HTTP::Get.new(uri)
      consulta['api-key'] = api_key
      consulta['Content-Type'] = 'application/json'

      resposta = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
        http.request(consulta)
      end

      dinamicas = JSON.parse(resposta.body)
      acao_atualizar = dinamicas['__links']['atualizar-dinamica-area']
      href = acao_atualizar['href'].sub('{id}', dinamicas['data'][0]['id'].to_s)

      uri = URI("#{base_url}/#{href}")
      atualizacao = Net::HTTP.const_get(acao_atualizar['metodo'].capitalize).new(uri)
      atualizacao['api-key'] = api_key
      atualizacao['Content-Type'] = 'application/json'
      atualizacao.body = { valor: 2.5 }.to_json

      resposta_atualizacao = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
        http.request(atualizacao)
      end

      dinamica_atualizada = JSON.parse(resposta_atualizacao.body)
      ```

      ```javascript JavaScript theme={null}
      const baseUrl = 'https://api.taximachine.com.br';
      const apiKey = 'sua-api-key';

      const resposta = await fetch(`${baseUrl}/api/v2/integracao/dinamicas/area`, {
        method: 'GET',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      const dinamicas = await resposta.json();
      const acaoAtualizar = dinamicas.__links['atualizar-dinamica-area'];
      const href = acaoAtualizar.href.replace('{id}', dinamicas.data[0].id);

      const atualizacao = await fetch(`${baseUrl}/${href}`, {
        method: acaoAtualizar.metodo.toUpperCase(),
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          valor: 2.5
        })
      });

      const dinamicaAtualizada = await atualizacao.json();
      ```

      ```python Python theme={null}
      import requests

      base_url = 'https://api.taximachine.com.br'
      api_key = 'sua-api-key'

      headers = {
          'api-key': api_key,
          'Content-Type': 'application/json'
      }

      resposta = requests.get(
          f'{base_url}/api/v2/integracao/dinamicas/area',
          headers=headers
      )

      dinamicas = resposta.json()
      acao_atualizar = dinamicas['__links']['atualizar-dinamica-area']
      href = acao_atualizar['href'].replace('{id}', str(dinamicas['data'][0]['id']))

      atualizacao = requests.request(
          acao_atualizar['metodo'].upper(),
          f'{base_url}/{href}',
          headers=headers,
          json={
              'valor': 2.5
          }
      )

      dinamica_atualizada = atualizacao.json()
      ```
    </CodeGroup>

    <h3 style={{ fontSize: "24px", fontWeight: "700", marginTop: "40px", marginBottom: "16px", color: "var(--tw-prose-headings)" }}>
      Endpoints com HATEOAS
    </h3>

    <style>
      {`
                  .hateoas-endpoints-table td {
                    padding: 18px 16px;
                    vertical-align: top;
                  }
                `}
    </style>

    <table className="hateoas-endpoints-table" style={{ borderCollapse: "separate", borderSpacing: "0 28px" }}>
      <thead>
        <tr>
          <th>Recurso</th>
          <th>Endpoints</th>
        </tr>
      </thead>

      <tbody>
        <tr>
          <td>Corridas</td>
          <td><code>POST /api/v2/integracao/corridas/consultar</code><br /><code>POST /api/v2/integracao/corridas/</code></td>
        </tr>

        <tr>
          <td>Corridas programadas</td>
          <td><code>GET /api/v2/integracao/corridas/programadas</code><br /><code>POST /api/v2/integracao/corridas/programadas</code></td>
        </tr>

        <tr>
          <td>Entregas</td>
          <td><code>POST /api/v2/integracao/entregas/consultar</code><br /><code>POST /api/v2/integracao/entregas</code></td>
        </tr>

        <tr>
          <td>Entregas programadas</td>
          <td><code>GET /api/v2/integracao/entregas/programadas</code><br /><code>POST /api/v2/integracao/entregas/programadas</code></td>
        </tr>

        <tr>
          <td>Créditos da empresa em entregas</td>
          <td><code>GET /api/v2/integracao/entregas/empresas/creditos/saldo</code><br /><code>POST /api/v2/integracao/entregas/empresas/creditos/recargas</code><br /><code>POST /api/v2/integracao/entregas/empresas/creditos/saques</code></td>
        </tr>

        <tr>
          <td>Clientes</td>
          <td><code>GET /api/v2/integracao/clientes</code></td>
        </tr>

        <tr>
          <td>Condutores</td>
          <td><code>GET /api/v2/integracao/condutores</code></td>
        </tr>

        <tr>
          <td>Créditos de condutores</td>
          <td><code>POST /api/v2/integracao/condutores/creditos/saldo/consultar</code><br /><code>POST /api/v2/integracao/condutores/creditos/recargas</code><br /><code>POST /api/v2/integracao/condutores/creditos/saques</code></td>
        </tr>

        <tr>
          <td>Empresas</td>
          <td><code>GET /api/v2/integracao/empresas</code><br /><code>POST /api/v2/integracao/empresas</code></td>
        </tr>

        <tr>
          <td>Dinâmicas</td>
          <td><code>GET /api/v2/integracao/dinamicas/area</code><br /><code>GET /api/v2/integracao/dinamicas/sem-area</code></td>
        </tr>

        <tr>
          <td>Mensagens</td>
          <td><code>POST /api/v2/integracao/mensagens/condutor/broadcast</code><br /><code>POST /api/v2/integracao/mensagens/condutor/\{id}</code><br /><code>POST /api/v2/integracao/mensagens/empresa/broadcast</code><br /><code>POST /api/v2/integracao/mensagens/empresa/\{id}</code></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div
    style={{ 
marginTop: "80px", 
padding: "64px 32px", 
borderRadius: "32px", 
background: "linear-gradient(135deg, rgba(22, 163, 74, 0.1) 0%, rgba(22, 163, 74, 0.02) 100%)",
border: "1px solid rgba(22, 163, 74, 0.2)", 
textAlign: "center",
marginBottom: "80px"
}}
  >
    <h2 style={{ fontSize: "32px", fontWeight: "800", marginBottom: "16px" }}>Primeiros passos</h2>

    <p style={{ fontSize: "19px", opacity: 0.8, marginBottom: "40px", maxWidth: "600px", margin: "0 auto 40px" }}>
      Explore a tab <a href="/pages/v2/referencia/introducao" style={{ color: "#16A34A", textDecoration: "underline", fontWeight: "700" }}>"Referência"</a> para obter mais informações sobre como se conectar à API e testar os endpoints.
    </p>

    <div style={{ fontWeight: "600", fontSize: "22px", color: "#16A34A" }}>
      Pronto! Agora você está preparado para explorar a nossa integração para que, juntos, possamos crescer ainda mais.
    </div>
  </div>
</div>
