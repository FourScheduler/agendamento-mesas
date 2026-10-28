package br.com.foursys.agendamento_mesas.autenticacao;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.foursys.agendamento_mesas.enums.PerfilUsuario;
import br.com.foursys.agendamento_mesas.model.Usuario;
import br.com.foursys.agendamento_mesas.port.out.ReservaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.UsuarioRepositoryPort;
import br.com.foursys.agendamento_mesas.security.JwtService;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Testes do contrato de autenticação: login, perfil, proteção de rotas,
 * provisionamento admin e identidade resolvida pelo token.
 */
@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class AutenticacaoMvpTests {

    private static final String SENHA = "senha1234";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UsuarioRepositoryPort usuarioRepository;

    @Autowired
    private ReservaRepositoryPort reservaRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Usuario admin;
    private Usuario maria;
    private Usuario inativo;

    @BeforeEach
    void preparar() {
        reservaRepository.deletarTodos();
        usuarioRepository.deletarTodos();
        admin = usuarioRepository
                .salvar(new Usuario("Ana Admin", "admin@exemplo.com", passwordEncoder.encode(SENHA), PerfilUsuario.ADMIN,
                        true));
        maria = usuarioRepository.salvar(
                new Usuario("Maria Souza", "maria.souza@exemplo.com", passwordEncoder.encode(SENHA),
                        PerfilUsuario.USUARIO, true));
        inativo = usuarioRepository.salvar(
                new Usuario("Paulo Inativo", "paulo.inativo@exemplo.com", passwordEncoder.encode(SENHA),
                        PerfilUsuario.USUARIO, false));
    }

    @Test
    void loginValidoRetornaTokenEUsuario() throws Exception {
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(corpoLogin("maria.souza@exemplo.com", SENHA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tipo").value("Bearer"))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.usuario.id").value(maria.getId()))
                .andExpect(jsonPath("$.usuario.nome").value("Maria Souza"))
                .andExpect(jsonPath("$.usuario.email").value("maria.souza@exemplo.com"))
                .andExpect(jsonPath("$.usuario.perfil").value("USUARIO"));
    }

    @Test
    void loginComSenhaErradaRetorna401() throws Exception {
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(corpoLogin("maria.souza@exemplo.com", "senha-errada")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Credenciais inválidas."));
    }

    @Test
    void loginComEmailInexistenteRetornaMesmoErroQueSenhaErrada() throws Exception {
        String corpoSenhaErrada = executarLogin("maria.souza@exemplo.com", "senha-errada");
        String corpoEmailInexistente = executarLogin("naoexiste@exemplo.com", SENHA);

        assertThat(corpoSenhaErrada).isEqualTo(corpoEmailInexistente);
    }

    @Test
    void loginDeUsuarioInativoRetorna401() throws Exception {
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(corpoLogin("paulo.inativo@exemplo.com", SENHA)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Usuário inativo."));
    }

    @Test
    void loginSemEmailRetorna400() throws Exception {
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"senha\":\"" + SENHA + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Campo 'email' é obrigatório."));
    }

    @Test
    void rotaProtegidaSemTokenRetorna401() throws Exception {
        mockMvc.perform(get("/api/auth/perfil"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenExpiradoRetorna401() throws Exception {
        // Expiração além do desvio de relógio de 60 s aceito pelo validador padrão.
        String expirado = jwtService.gerarToken(maria, Duration.ofMinutes(-10));

        mockMvc.perform(get("/api/auth/perfil").header("Authorization", "Bearer " + expirado))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenComAssinaturaInvalidaRetorna401() throws Exception {
        mockMvc.perform(get("/api/auth/perfil").header("Authorization", "Bearer token.invalido.aqui"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void usuarioDesativadoAposLoginComTokenValidoRetorna401() throws Exception {
        String token = autenticar("maria.souza@exemplo.com");
        desativar(maria);

        mockMvc.perform(get("/api/auth/perfil").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void perfilRetornaDadosDoUsuarioDoToken() throws Exception {
        String token = autenticar("maria.souza@exemplo.com");

        mockMvc.perform(get("/api/auth/perfil").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(maria.getId()))
                .andExpect(jsonPath("$.nome").value("Maria Souza"))
                .andExpect(jsonPath("$.email").value("maria.souza@exemplo.com"))
                .andExpect(jsonPath("$.perfil").value("USUARIO"));
    }

    @Test
    void identidadeVemDoTokenEIgnoraParametroManipulado() throws Exception {
        String token = autenticar("maria.souza@exemplo.com");

        // Tentativa de se passar por outro usuário via query param não muda a identidade.
        mockMvc.perform(get("/api/auth/perfil").param("usuarioId", String.valueOf(admin.getId()))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(maria.getId()));
    }

    @Test
    void loginIgnoraCamposManipuladosNoBody() throws Exception {
        String corpo = "{\"email\":\"maria.souza@exemplo.com\",\"senha\":\"" + SENHA + "\",\"id\":999,"
                + "\"usuarioId\":" + admin.getId() + "}";
        MvcResult resultado = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(corpo))
                .andExpect(status().isOk())
                .andReturn();

        String token = tokenDe(resultado);
        mockMvc.perform(get("/api/auth/perfil").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.id").value(maria.getId()));
    }

    @Test
    void usuarioComumNaoAcessaRotaAdminRetorna403() throws Exception {
        String token = autenticar("maria.souza@exemplo.com");

        mockMvc.perform(post("/api/admin/usuarios").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Novo\",\"email\":\"novo@exemplo.com\",\"senha\":\"" + SENHA + "\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    void adminCriaUsuarioComSenhaEmHash() throws Exception {
        String token = autenticar("admin@exemplo.com");

        mockMvc.perform(post("/api/admin/usuarios").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Carlos Lima\",\"email\":\"carlos.lima@exemplo.com\",\"senha\":\"" + SENHA
                                + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.nome").value("Carlos Lima"))
                .andExpect(jsonPath("$.email").value("carlos.lima@exemplo.com"))
                .andExpect(jsonPath("$.perfil").value("USUARIO"))
                .andExpect(jsonPath("$.ativo").value(true))
                .andExpect(jsonPath("$.senha").doesNotExist());

        Usuario criado = usuarioRepository.buscarPorEmail("carlos.lima@exemplo.com").orElseThrow();
        assertThat(criado.getSenhaHash()).isNotEqualTo(SENHA).startsWith("$2");
        assertThat(passwordEncoder.matches(SENHA, criado.getSenhaHash())).isTrue();
    }

    @Test
    void adminCriaUsuarioComPerfilAdmin() throws Exception {
        String token = autenticar("admin@exemplo.com");

        mockMvc.perform(post("/api/admin/usuarios").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Gestor\",\"email\":\"gestor@exemplo.com\",\"senha\":\"" + SENHA
                                + "\",\"perfil\":\"ADMIN\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.perfil").value("ADMIN"));
    }

    @Test
    void criacaoComEmailJaCadastradoRetorna409() throws Exception {
        String token = autenticar("admin@exemplo.com");

        mockMvc.perform(post("/api/admin/usuarios").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Duplicado\",\"email\":\"maria.souza@exemplo.com\",\"senha\":\"" + SENHA
                                + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("E-mail já cadastrado."));
    }

    @Test
    void criacaoComSenhaCurtaRetorna400() throws Exception {
        String token = autenticar("admin@exemplo.com");

        mockMvc.perform(post("/api/admin/usuarios").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Curta\",\"email\":\"curta@exemplo.com\",\"senha\":\"12345\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("A senha deve ter pelo menos 6 caracteres."));
    }

    @Test
    void criacaoIgnoraIdManipuladoNoBody() throws Exception {
        String token = autenticar("admin@exemplo.com");

        MvcResult resultado = mockMvc.perform(post("/api/admin/usuarios").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":999,\"nome\":\"Sem Id\",\"email\":\"semdid@exemplo.com\",\"senha\":\"" + SENHA
                                + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andReturn();

        Integer idCriado = JsonPath.read(resultado.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id");
        assertThat(idCriado).isNotEqualTo(999);
    }

    @Test
    void credenciaisENaoAparecemNosLogs(CapturedOutput output) throws Exception {
        String token = autenticar("maria.souza@exemplo.com");
        mockMvc.perform(get("/api/auth/perfil").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(corpoLogin("maria.souza@exemplo.com", "senha-errada")))
                .andExpect(status().isUnauthorized());

        assertThat(output.getOut()).doesNotContain(SENHA).doesNotContain(token);
        assertThat(output.getErr()).doesNotContain(SENHA).doesNotContain(token);
    }

    private String autenticar(String email) throws Exception {
        MvcResult resultado = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(corpoLogin(email, SENHA)))
                .andExpect(status().isOk())
                .andReturn();
        return tokenDe(resultado);
    }

    private String tokenDe(MvcResult resultado) throws Exception {
        String corpo = resultado.getResponse().getContentAsString(StandardCharsets.UTF_8);
        return JsonPath.read(corpo, "$.token");
    }

    private String executarLogin(String email, String senha) throws Exception {
        MvcResult resultado = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(corpoLogin(email, senha)))
                .andExpect(status().isUnauthorized())
                .andReturn();
        return resultado.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private void desativar(Usuario usuario) {
        jdbcTemplate.update("UPDATE usuarios SET ativo = FALSE WHERE id = ?", usuario.getId());
    }

    private String corpoLogin(String email, String senha) {
        return "{\"email\":\"" + email + "\",\"senha\":\"" + senha + "\"}";
    }
}
