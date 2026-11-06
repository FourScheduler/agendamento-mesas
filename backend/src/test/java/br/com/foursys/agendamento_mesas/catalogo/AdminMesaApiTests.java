package br.com.foursys.agendamento_mesas.catalogo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.dto.response.MesaResponse;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.port.out.MesaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.UsuarioRepositoryPort;
import br.com.foursys.agendamento_mesas.security.JwtService;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@ActiveProfiles("test")
@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:admin_mesas;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
    "spring.flyway.locations=classpath:db/migration,classpath:db/seed"
})
@AutoConfigureMockMvc
@Transactional
class AdminMesaApiTests {

    @Autowired MockMvc mvc;
    @Autowired MesaRepositoryPort mesas;
    @Autowired UsuarioRepositoryPort usuarios;
    @Autowired JwtService jwt;

    @Test
    void administradorPodeFixarDesfixarInativarEAtivarMesa() throws Exception {
        var admin = usuarios.buscarPorEmail("bianca.rodrigues@foursys.com.br").orElseThrow();
        var responsavel = usuarios.buscarPorEmail("hudson.silva@foursys.com.br").orElseThrow();
        Mesa mesa = mesas.buscarPorCodigo("044").orElseThrow();
        String token = "Bearer " + jwt.gerarToken(admin);

        mvc.perform(patch("/api/admin/mesas/{id}/fixar", mesa.getId())
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"usuarioId\":" + responsavel.getId() + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tipo").value("FIXA"))
            .andExpect(jsonPath("$.responsavel.id").value(responsavel.getId()))
            .andExpect(jsonPath("$.responsavel.email").value(responsavel.getEmail()));

        mvc.perform(get("/api/mesas")
                        .header("Authorization", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[43].responsavel.id").value(responsavel.getId()));

        mvc.perform(patch("/api/admin/mesas/{id}/desfixar", mesa.getId())
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tipo").value("LIVRE"))
            .andExpect(jsonPath("$.responsavel").doesNotExist());

        mvc.perform(patch("/api/admin/mesas/{id}/ativacao", mesa.getId())
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ativa\":false}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ativa").value(false));

        mvc.perform(patch("/api/admin/mesas/{id}/ativacao", mesa.getId())
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ativa\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ativa").value(true));
    }

    @ParameterizedTest
    @ValueSource(strings = {"fixar", "desfixar", "responsavel", "tipo", "ativacao"})
    void operacoesDeMesaExigemPerfilAdministrador(String operacao) throws Exception {
        var usuario = usuarios.buscarPorEmail("hudson.silva@foursys.com.br").orElseThrow();
        Mesa mesa = mesas.buscarPorCodigo("044").orElseThrow();
        var anterior = MesaResponse.de(mesa);

        verificarErro(mvc.perform(patch("/api/admin/mesas/{id}/{operacao}", mesa.getId(), operacao)
                        .header("Authorization", "Bearer " + jwt.gerarToken(usuario))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoValido(operacao))), 403, caminho(mesa.getId(), operacao),
                "Acesso restrito a administradores.");
        verificarMesaPreservada(anterior);
    }

    @ParameterizedTest
    @ValueSource(strings = {"fixar", "desfixar", "responsavel", "tipo", "ativacao"})
    void operacoesExigemTokenValidoAntesDeLerCorpo(String operacao) throws Exception {
        var anterior = MesaResponse.de(mesas.buscarPorCodigo("044").orElseThrow());
        for (String token : new String[] {"", "Bearer invalido"}) {
            verificarErro(mvc.perform(patch(caminho(anterior.id(), operacao))
                    .header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON).content("{")),
                401, caminho(anterior.id(), operacao), "Token ausente, inválido ou expirado.");
        }
        verificarMesaPreservada(anterior);
    }

    @ParameterizedTest
    @ValueSource(strings = {"fixar", "desfixar", "responsavel", "tipo", "ativacao"})
    void mesaInexistenteRetorna404(String operacao) throws Exception {
        var anterior = MesaResponse.de(mesas.buscarPorCodigo("044").orElseThrow());
        verificarErro(executar(Long.MAX_VALUE, operacao, corpoValido(operacao)), 404,
            caminho(Long.MAX_VALUE, operacao), "Mesa " + Long.MAX_VALUE + " não encontrada.");
        verificarMesaPreservada(anterior);
    }

    @ParameterizedTest
    @ValueSource(strings = {"fixar", "desfixar", "responsavel", "tipo", "ativacao"})
    void idMalformadoRetorna400(String operacao) throws Exception {
        var anterior = MesaResponse.de(mesas.buscarPorCodigo("044").orElseThrow());
        verificarErro(executar("abc", operacao, corpoValido(operacao)), 400,
            caminho("abc", operacao), "Campo 'id' deve ser um inteiro.");
        verificarMesaPreservada(anterior);
    }

    @ParameterizedTest
    @MethodSource("entradasInvalidas")
    void entradaInvalidaPreservaMesa(String operacao, String corpo, String detalhe) throws Exception {
        var anterior = MesaResponse.de(mesas.buscarPorCodigo("044").orElseThrow());
        verificarErro(executar(anterior.id(), operacao, corpo), 400, caminho(anterior.id(), operacao), detalhe);
        verificarMesaPreservada(anterior);
    }

    static Stream<Arguments> entradasInvalidas() {
        return Stream.of(
            Arguments.of("fixar", "{}", "Campo 'usuarioId' deve ser um inteiro positivo."),
            Arguments.of("fixar", "{\"usuarioId\":null}", "Campo 'usuarioId' deve ser um inteiro positivo."),
            Arguments.of("fixar", "{\"usuarioId\":0}", "Campo 'usuarioId' deve ser um inteiro positivo."),
            Arguments.of("fixar", "{\"usuarioId\":-1}", "Campo 'usuarioId' deve ser um inteiro positivo."),
            Arguments.of("fixar", "{\"usuarioId\":\"abc\"}", "Campo 'usuarioId' deve ser um inteiro positivo."),
            Arguments.of("responsavel", "{}", "Campo 'usuarioId' deve ser um inteiro positivo."),
            Arguments.of("responsavel", "{\"usuarioId\":null}", "Campo 'usuarioId' deve ser um inteiro positivo."),
            Arguments.of("responsavel", "{\"usuarioId\":0}", "Campo 'usuarioId' deve ser um inteiro positivo."),
            Arguments.of("responsavel", "{\"usuarioId\":-1}", "Campo 'usuarioId' deve ser um inteiro positivo."),
            Arguments.of("responsavel", "{\"usuarioId\":{}}", "Campo 'usuarioId' deve ser um inteiro positivo."),
            Arguments.of("tipo", "{}", "Campo 'tipo' é obrigatório."),
            Arguments.of("tipo", "{\"tipo\":null}", "Campo 'tipo' é obrigatório."),
            Arguments.of("tipo", "{\"tipo\":\"INVALIDO\"}", "Campo 'tipo' deve ser FIXA ou LIVRE."),
            Arguments.of("tipo", "{\"tipo\":{}}", "Campo 'tipo' deve ser FIXA ou LIVRE."),
            Arguments.of("ativacao", "{}", "Campo 'ativa' é obrigatório."),
            Arguments.of("ativacao", "{\"ativa\":null}", "Campo 'ativa' é obrigatório."),
            Arguments.of("ativacao", "{\"ativa\":\"INVALIDO\"}", "Campo 'ativa' deve ser true ou false."),
            Arguments.of("ativacao", "{\"ativa\":[]}", "Campo 'ativa' deve ser true ou false.")
        );
    }

    @ParameterizedTest
    @ValueSource(strings = {"fixar", "responsavel", "tipo", "ativacao"})
    void corpoAusenteOuMalformadoTemMensagemGeral(String operacao) throws Exception {
        var anterior = MesaResponse.de(mesas.buscarPorCodigo("044").orElseThrow());
        for (String corpo : new String[] {"", "null", "{", "[]"}) {
            verificarErro(executar(anterior.id(), operacao, corpo), 400, caminho(anterior.id(), operacao),
                "Corpo JSON ausente ou inválido. Verifique os campos e os tipos dos valores enviados.");
            verificarMesaPreservada(anterior);
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"fixar", "responsavel"})
    void usuarioInexistenteOuInativoRetorna404SemAlterarMesa(String operacao) throws Exception {
        Mesa mesa = mesas.buscarPorCodigo("044").orElseThrow();
        if (operacao.equals("responsavel")) mesa.setTipo(TipoMesa.FIXA);
        var inativo = usuarios.buscarPorEmail("hudson.silva@foursys.com.br").orElseThrow();
        inativo.setAtivo(false);
        usuarios.salvar(inativo);
        var anterior = MesaResponse.de(mesa);
        verificarErro(executar(mesa.getId(), operacao, "{\"usuarioId\":" + Long.MAX_VALUE + "}"),
            404, caminho(mesa.getId(), operacao), "Usuário não encontrado.");
        verificarMesaPreservada(anterior);
        verificarErro(executar(mesa.getId(), operacao, "{\"usuarioId\":" + inativo.getId() + "}"),
            404, caminho(mesa.getId(), operacao), "Usuário ativo não encontrado.");
        verificarMesaPreservada(anterior);
    }

    @ParameterizedTest
    @ValueSource(strings = {"fixar", "desfixar", "responsavel", "tipo", "ativacao"})
    void conflitoDeCadaOperacaoPreservaDados(String operacao) throws Exception {
        Mesa mesa = mesas.buscarPorCodigo("044").orElseThrow();
        var usuario = usuarios.buscarPorEmail("hudson.silva@foursys.com.br").orElseThrow();
        String detalhe = switch (operacao) {
            case "fixar", "ativacao" -> {
                mesa.setTipo(TipoMesa.FIXA);
                mesa.setResponsavel(usuario);
                mesa.setOcupante(usuario.getNome());
                yield operacao.equals("fixar") ? "Mesa 044 já está fixa."
                    : "Mesa 044 possui um responsável vinculado. Remova o vínculo antes de inativá-la.";
            }
            case "desfixar" -> "Mesa 044 não está fixa.";
            case "responsavel" -> "Somente mesas fixas podem ter responsável.";
            case "tipo" -> {
                mesa.setAtiva(false);
                yield "Mesa 044 está inativa. Ative a mesa antes de fixá-la ou atribuir um responsável.";
            }
            default -> throw new IllegalArgumentException(operacao);
        };
        mesas.salvar(mesa);
        var anterior = MesaResponse.de(mesa);
        verificarErro(executar(mesa.getId(), operacao, corpoValido(operacao)), 409,
            caminho(mesa.getId(), operacao), detalhe);
        verificarMesaPreservada(anterior);
    }

    @Test
    void trocaDeResponsavelETipoPreservamFormatoDaResposta() throws Exception {
        var mesa = mesas.buscarPorCodigo("044").orElseThrow();
        mesa.setTipo(TipoMesa.FIXA);
        mesas.salvar(mesa);
        var usuario = usuarios.buscarPorEmail("hudson.silva@foursys.com.br").orElseThrow();
        executar(mesa.getId(), "responsavel", corpoValido("responsavel"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(mesa.getId()))
            .andExpect(jsonPath("$.codigo").value("044"))
            .andExpect(jsonPath("$.tipo").value("FIXA"))
            .andExpect(jsonPath("$.ativa").value(true))
            .andExpect(jsonPath("$.responsavel.id").value(usuario.getId()))
            .andExpect(jsonPath("$.responsavel.nome").value(usuario.getNome()))
            .andExpect(jsonPath("$.responsavel.email").value(usuario.getEmail()))
            .andExpect(jsonPath("$.responsavel.senha").doesNotExist())
            .andExpect(jsonPath("$.referenciaVisual.planta").value(mesa.getPlanta()))
            .andExpect(jsonPath("$.referenciaVisual.x").value(mesa.getPosicaoX()))
            .andExpect(jsonPath("$.referenciaVisual.y").value(mesa.getPosicaoY()));
        executar(mesa.getId(), "tipo", "{\"tipo\":\"LIVRE\"}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tipo").value("LIVRE"))
            .andExpect(jsonPath("$.responsavel").doesNotExist())
            .andExpect(jsonPath("$.ativa").value(true));
    }

    @Test
    void erroDeEntradaDeReservasMantemContratoExistente() throws Exception {
        var admin = usuarios.buscarPorEmail("bianca.rodrigues@foursys.com.br").orElseThrow();
        verificarErro(mvc.perform(post("/api/reservas")
                .header("Authorization", "Bearer " + jwt.gerarToken(admin))
                .contentType(MediaType.APPLICATION_JSON).content("{\"mesaId\":{}}")),
            400, "/api/reservas",
            "Verifique os campos obrigatórios e os formatos: mesaId inteiro e data yyyy-MM-dd.");
    }

    private ResultActions executar(Object id, String operacao, String corpo) throws Exception {
        var admin = usuarios.buscarPorEmail("bianca.rodrigues@foursys.com.br").orElseThrow();
        return mvc.perform(patch(caminho(id, operacao))
            .header("Authorization", "Bearer " + jwt.gerarToken(admin))
            .contentType(MediaType.APPLICATION_JSON).content(corpo));
    }

    private String corpoValido(String operacao) {
        return switch (operacao) {
            case "fixar", "responsavel" -> "{\"usuarioId\":"
                + usuarios.buscarPorEmail("hudson.silva@foursys.com.br").orElseThrow().getId() + "}";
            case "tipo" -> "{\"tipo\":\"FIXA\"}";
            case "ativacao" -> "{\"ativa\":false}";
            default -> "";
        };
    }

    private String caminho(Object id, String operacao) {
        return "/api/admin/mesas/" + id + "/" + operacao;
    }

    private void verificarErro(ResultActions resultado, int status, String caminho, String detalhe) throws Exception {
        // O serializador de ProblemDetail omite o type padrão; a segurança o escreve explicitamente.
        if (status == 401 || status == 403) {
            resultado.andExpect(jsonPath("$.type").value("about:blank"));
        }
        resultado.andExpect(status().is(status))
            .andExpect(jsonPath("$.title").isNotEmpty())
            .andExpect(jsonPath("$.status").value(status))
            .andExpect(jsonPath("$.detail").value(detalhe))
            .andExpect(jsonPath("$.instance").value(caminho));
    }

    private void verificarMesaPreservada(MesaResponse anterior) {
        assertThat(MesaResponse.de(mesas.buscarPorId(anterior.id()).orElseThrow())).isEqualTo(anterior);
    }
}
