package br.com.foursys.agendamento_mesas.autenticacao;

import static br.com.foursys.agendamento_mesas.controller.MicrosoftSsoController.INICIO;
import static br.com.foursys.agendamento_mesas.controller.MicrosoftSsoController.RETORNO;
import static br.com.foursys.agendamento_mesas.controller.MicrosoftSsoController.SESSAO;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.foursys.agendamento_mesas.controller.MicrosoftSsoController;
import br.com.foursys.agendamento_mesas.enums.PerfilUsuario;
import br.com.foursys.agendamento_mesas.model.Usuario;
import br.com.foursys.agendamento_mesas.port.out.UsuarioRepositoryPort;
import com.jayway.jsonpath.JsonPath;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

@ActiveProfiles("test")
@SpringBootTest(properties = {
    "app.microsoft.enabled=true",
    "app.microsoft.tenant-id=8f3cafe0-bbf4-49a1-b476-76d5e343c5bc",
    "app.microsoft.client-id=4edb4f76-737e-46c4-a9b6-1b69eb4fec5f",
    "app.microsoft.client-secret=segredo-de-teste"
})
@AutoConfigureMockMvc
@Transactional
class MicrosoftSsoTests {

    private static final String TENANT = "8f3cafe0-bbf4-49a1-b476-76d5e343c5bc";
    private static final String OBJECT_ID = "3d54525b-ea1c-4afa-93fe-ac7771ca3c5d";
    private static final String EMAIL = "microsoft@exemplo.com";

    @Autowired private MockMvc mvc;
    @Autowired private MicrosoftSsoController controlador;
    @Autowired private UsuarioRepositoryPort usuarios;

    @Test
    void iniciaNoTenantConfiguradoComPkceEExigeOEstadoDaMesmaSessao() throws Exception {
        var inicio = mvc.perform(get(INICIO)).andExpect(status().isFound()).andReturn();
        var location = URI.create(inicio.getResponse().getHeader(HttpHeaders.LOCATION));
        assertThat(location.getHost()).isEqualTo("login.microsoftonline.com");
        assertThat(location.getPath()).isEqualTo("/" + TENANT + "/oauth2/v2.0/authorize");
        var parametros = UriComponentsBuilder.fromUriString("?" + location.getQuery()).build().getQueryParams();
        assertThat(parametros.getFirst("redirect_uri")).isEqualTo("http://localhost:4201" + RETORNO);
        assertThat(parametros.getFirst("response_type")).isEqualTo("code");
        assertThat(parametros.getFirst("code_challenge_method")).isEqualTo("S256");
        assertThat(parametros.getFirst("nonce")).isNotBlank();
        String estado = parametros.getFirst("state");
        assertThat(estado).isNotBlank();

        mvc.perform(get(RETORNO).param("error", "access_denied").param("state", estado))
            .andExpect(status().isSeeOther())
            .andExpect(header().string(HttpHeaders.LOCATION, "/login?microsoft=falha"));
        mvc.perform(get(RETORNO).param("error", "access_denied").param("state", estado)
                .session((MockHttpSession) inicio.getRequest().getSession(false)))
            .andExpect(status().isSeeOther())
            .andExpect(header().string(HttpHeaders.LOCATION, "/login?microsoft=cancelado"));
    }

    @Test
    void vinculoEmiteTokenDoCadastroInternoUmaUnicaVez() throws Exception {
        Usuario usuario = criarUsuario(true, true);
        MockHttpSession sessao = simularIdentidadeValidada(TENANT);
        assertThat(sessao.getMaxInactiveInterval()).isEqualTo(60);

        mvc.perform(get("/api/auth/perfil").session(sessao)).andExpect(status().isUnauthorized());
        var troca = mvc.perform(post(SESSAO).session(sessao).contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
            .andExpect(jsonPath("$.usuario.id").value(usuario.getId()))
            .andExpect(jsonPath("$.usuario.perfil").value("ADMIN"))
            .andReturn();

        String token = JsonPath.read(troca.getResponse().getContentAsString(), "$.token");
        mvc.perform(get("/api/auth/perfil").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(usuario.getId()));
        mvc.perform(post(SESSAO).session(sessao).contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void emailCoincidenteNaoSubstituiVinculo() throws Exception {
        criarUsuario(true, false);
        mvc.perform(post(SESSAO).session(simularIdentidadeValidada(TENANT))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isForbidden());
    }

    @Test
    void vinculoInativoNaoAutentica() throws Exception {
        criarUsuario(false, true);
        mvc.perform(post(SESSAO).session(simularIdentidadeValidada(TENANT))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isForbidden());
    }

    private Usuario criarUsuario(boolean ativo, boolean vinculado) {
        Usuario usuario = new Usuario("Usuário interno", EMAIL, "hash-de-teste", PerfilUsuario.ADMIN, ativo);
        if (vinculado) {
            usuario.setMicrosoftTenantId(TENANT);
            usuario.setMicrosoftObjectId(OBJECT_ID);
        }
        return usuarios.salvar(usuario);
    }

    private MockHttpSession simularIdentidadeValidada(String tenant) {
        Instant agora = Instant.now();
        var token = new OidcIdToken("id-token-de-teste", agora, agora.plusSeconds(600),
            Map.of("sub", "subject", "tid", tenant, "oid", OBJECT_ID, "email", EMAIL));
        var oidc = new DefaultOidcUser(List.of(), token);
        var auth = UsernamePasswordAuthenticationToken.authenticated(oidc, null, List.of());
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();
        controlador.concluir(request, response, auth, TENANT);
        assertThat(response.getHeader(HttpHeaders.LOCATION)).isEqualTo("/login?microsoft=sucesso");
        return (MockHttpSession) request.getSession(false);
    }
}
