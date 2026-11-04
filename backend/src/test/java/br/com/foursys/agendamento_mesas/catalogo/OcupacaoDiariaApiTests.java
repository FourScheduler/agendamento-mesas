package br.com.foursys.agendamento_mesas.catalogo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.foursys.agendamento_mesas.enums.PerfilUsuario;
import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.model.Reserva;
import br.com.foursys.agendamento_mesas.model.Usuario;
import br.com.foursys.agendamento_mesas.port.out.MesaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.ReservaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.UsuarioRepositoryPort;
import br.com.foursys.agendamento_mesas.reservas.ReservaApiTests;
import br.com.foursys.agendamento_mesas.security.JwtService;
import jakarta.persistence.EntityManagerFactory;
import java.time.LocalDate;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
@Import(ReservaApiTests.RelogioTeste.class)
public class OcupacaoDiariaApiTests {
    private static final LocalDate HOJE = LocalDate.of(2026, 10, 26);
    @Autowired MockMvc mvc;
    @Autowired MesaRepositoryPort mesas;
    @Autowired ReservaRepositoryPort reservas;
    @Autowired UsuarioRepositoryPort usuarios;
    @Autowired JwtService jwt;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManagerFactory entityManagerFactory;
    Usuario admin;
    Usuario maria;
    Usuario joao;
    Mesa primeira;
    Mesa segunda;

    @BeforeEach
    void preparar() {
        limpar();
        admin = usuarios.salvar(new Usuario("Admin", "admin@teste.com", "hash", PerfilUsuario.ADMIN, true));
        maria = usuarios.salvar(new Usuario("Maria", "maria@teste.com", "hash", PerfilUsuario.USUARIO, true));
        joao = usuarios.salvar(new Usuario("João", "joao@teste.com", "hash", PerfilUsuario.USUARIO, true));
        primeira = mesas.salvar(new Mesa(null, "044", "DEMO", TipoMesa.LIVRE, true, "DEMO", 0, 0, "Rótulo permanente"));
        segunda = mesas.salvar(new Mesa(null, "053", "DEMO", TipoMesa.LIVRE, true, "DEMO", 200, 0, null));
    }

    @AfterEach
    void limpar() {
        reservas.deletarTodos();
        mesas.deletarTodos();
        usuarios.deletarTodos();
    }

    @Test
    void criacaoRetornaSolicitanteComoOcupanteDoDiaSemModificarMesa() throws Exception {
        // O administrador faz a reserva para Maria: o ocupante deve ser Maria, não Admin.
        mvc.perform(post("/api/reservas").header("Authorization", bearer(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mesaId\":" + primeira.getId() + ",\"data\":\"" + HOJE
                    + "\",\"solicitanteId\":" + maria.getId() + "}"))
            .andExpect(status().isCreated());

        consultar(HOJE, "044")
            .andExpect(jsonPath("$[0].ocupada").value(true))
            .andExpect(jsonPath("$[0].ocupanteNaData.id").value(maria.getId()))
            .andExpect(jsonPath("$[0].ocupanteNaData.nome").value("Maria"))
            .andExpect(jsonPath("$[0].ocupanteNaData.email").value("maria@teste.com"))
            .andExpect(jsonPath("$[0].ocupanteNaData.senhaHash").doesNotExist())
            .andExpect(jsonPath("$[0].ocupanteNaData.senha").doesNotExist())
            .andExpect(jsonPath("$[0].ocupante").value("Rótulo permanente"))
            .andExpect(jsonPath("$[0].responsavel").doesNotExist());

        assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().getOcupante()).isEqualTo("Rótulo permanente");
        assertThat(reservas.buscarTodos()).singleElement()
            .satisfies(r -> assertThat(r.getUsuario().getId()).isEqualTo(maria.getId()));
        mvc.perform(get("/api/mesas").param("termo", "044").header("Authorization", bearer(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].ocupante").value("Rótulo permanente"))
            .andExpect(jsonPath("$[0].ocupanteNaData").doesNotExist());
    }

    @Test
    void mesmaMesaPodeExibirUsuariosDiferentesEmDatasDiferentes() throws Exception {
        reservar(primeira, maria, HOJE);
        reservar(primeira, joao, HOJE.plusDays(1));

        consultar(HOJE, "044").andExpect(jsonPath("$[0].ocupanteNaData.id").value(maria.getId()));
        consultar(HOJE.plusDays(1), "044").andExpect(jsonPath("$[0].ocupanteNaData.id").value(joao.getId()));
        consultar(HOJE.plusDays(2), "044")
            .andExpect(jsonPath("$[0].ocupada").value(false))
            .andExpect(jsonPath("$[0].ocupanteNaData").value(org.hamcrest.Matchers.nullValue()));
        assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().getOcupante()).isEqualTo("Rótulo permanente");
    }

    @Test
    void cancelamentoRemoveSomenteOcupacaoDaData() throws Exception {
        reservar(primeira, maria, HOJE);
        var reserva = reservas.buscarTodos().getFirst();
        consultar(HOJE, "044").andExpect(jsonPath("$[0].ocupanteNaData.id").value(maria.getId()));

        mvc.perform(patch("/api/reservas/{id}/cancelamento", reserva.getId()).header("Authorization", bearer(maria)))
            .andExpect(status().isOk());

        consultar(HOJE, "044")
            .andExpect(jsonPath("$[0].ocupada").value(false))
            .andExpect(jsonPath("$[0].ocupanteNaData").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$[0].ocupante").value("Rótulo permanente"));
        assertThat(mesas.buscarPorId(primeira.getId()).orElseThrow().getTipo()).isEqualTo(TipoMesa.LIVRE);
    }

    @Test
    void pendenteLegadaTambemIdentificaUsuarioQueBloqueiaAData() throws Exception {
        reservas.salvarESincronizar(new Reserva(primeira, maria, HOJE, StatusReserva.PENDENTE));
        consultar(HOJE, "044")
            .andExpect(jsonPath("$[0].ocupada").value(true))
            .andExpect(jsonPath("$[0].ocupanteNaData.id").value(maria.getId()));
    }

    @Test
    void desativacaoDoUsuarioNaoApagaIdentidadeDaReservaExistente() throws Exception {
        reservar(primeira, maria, HOJE);
        jdbc.update("UPDATE usuarios SET ativo = FALSE WHERE id = ?", maria.getId());

        consultar(HOJE, "044")
            .andExpect(jsonPath("$[0].ocupada").value(true))
            .andExpect(jsonPath("$[0].ocupanteNaData.id").value(maria.getId()))
            .andExpect(jsonPath("$[0].ocupanteNaData.nome").value("Maria"));
    }

    @Test
    void ocupanteDaReservaNaoSubstituiResponsavelFixoMesmoEmMesaLegadaInativa() throws Exception {
        reservar(primeira, maria, HOJE);
        // Estado legado: configuração administrativa independente da reserva já existente.
        primeira.setTipo(TipoMesa.FIXA);
        primeira.setAtiva(false);
        primeira.setResponsavel(joao);
        mesas.salvarESincronizar(primeira);

        consultar(HOJE, "044")
            .andExpect(jsonPath("$[0].tipo").value("FIXA"))
            .andExpect(jsonPath("$[0].ativa").value(false))
            .andExpect(jsonPath("$[0].responsavel.id").value(joao.getId()))
            .andExpect(jsonPath("$[0].ocupanteNaData.id").value(maria.getId()))
            .andExpect(jsonPath("$[0].ocupante").value("Rótulo permanente"));

        var preservada = mesas.buscarPorId(primeira.getId()).orElseThrow();
        assertThat(preservada.getTipo()).isEqualTo(TipoMesa.FIXA);
        assertThat(preservada.isAtiva()).isFalse();
        assertThat(preservada.getResponsavel().getId()).isEqualTo(joao.getId());
    }

    @Test
    void semDataUsaHojeEmSaoPauloEConsultaExigeAutenticacaoEDataIso() throws Exception {
        reservar(primeira, maria, HOJE);
        reservar(primeira, joao, HOJE.plusDays(1));

        mvc.perform(get("/api/mesas/com-ocupacao").param("termo", "044").header("Authorization", bearer(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].ocupanteNaData.id").value(maria.getId()));
        mvc.perform(get("/api/mesas/com-ocupacao").param("data", HOJE.toString()))
            .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/mesas/com-ocupacao").param("data", "26-10-2026").header("Authorization", bearer(admin)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void filtroDeCodigoEResultadoVazioPreservamContrato() throws Exception {
        reservar(primeira, maria, HOJE);
        reservar(segunda, joao, HOJE);

        consultar(HOJE, "Mesa 044")
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].id").value(primeira.getId()))
            .andExpect(jsonPath("$[0].ocupanteNaData.id").value(maria.getId()));
        consultar(HOJE, "999999").andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void consultaHistoricaEFuturaNaoAplicaJanelaDeCriacao() throws Exception {
        var passada = HOJE.minusDays(7);
        var futura = HOJE.plusDays(20);
        reservas.salvarESincronizar(new Reserva(primeira, maria, passada, StatusReserva.CONFIRMADA));
        reservas.salvarESincronizar(new Reserva(primeira, joao, futura, StatusReserva.CONFIRMADA));

        consultar(passada, "044").andExpect(jsonPath("$[0].ocupanteNaData.id").value(maria.getId()));
        consultar(futura, "044").andExpect(jsonPath("$[0].ocupanteNaData.id").value(joao.getId()));
        consultar(HOJE, "044").andExpect(jsonPath("$[0].ocupanteNaData").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void duplicidadeLegadaUsaMaiorIdSemAlterarReservas() throws Exception {
        reservas.salvarESincronizar(new Reserva(primeira, maria, HOJE, StatusReserva.CONFIRMADA));
        reservas.salvarESincronizar(new Reserva(primeira, joao, HOJE, StatusReserva.PENDENTE));

        consultar(HOJE, "044").andExpect(jsonPath("$[0].ocupanteNaData.id").value(joao.getId()));
        assertThat(reservas.contar()).isEqualTo(2);
    }

    @Test
    void consultaDeOcupacoesEmLoteNaoCresceUmaConsultaPorMesa() throws Exception {
        reservar(primeira, maria, HOJE);
        var stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        boolean habilitadasAntes = stats.isStatisticsEnabled();
        try {
            stats.setStatisticsEnabled(true);
            stats.clear();
            consultar(HOJE, null).andExpect(jsonPath("$.length()").value(2));
            long consultasAntes = stats.getPrepareStatementCount();

            for (int i = 100; i < 120; i++) {
                mesas.salvar(new Mesa(null, String.valueOf(i), "DEMO", TipoMesa.LIVRE, true, "DEMO", 0, 0, null));
            }
            stats.clear();
            consultar(HOJE, null).andExpect(jsonPath("$.length()").value(22));
            assertThat(stats.getPrepareStatementCount()).isEqualTo(consultasAntes);
        } finally {
            stats.setStatisticsEnabled(habilitadasAntes);
        }
    }

    void reservar(Mesa mesa, Usuario usuario, LocalDate data) throws Exception {
        mvc.perform(post("/api/reservas").header("Authorization", bearer(usuario))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mesaId\":" + mesa.getId() + ",\"data\":\"" + data + "\"}"))
            .andExpect(status().isCreated());
    }

    ResultActions consultar(LocalDate data, String termo) throws Exception {
        var request = get("/api/mesas/com-ocupacao").param("data", data.toString()).header("Authorization", bearer(admin));
        if (termo != null) request.param("termo", termo);
        return mvc.perform(request).andExpect(status().isOk());
    }

    String bearer(Usuario usuario) {
        return "Bearer " + jwt.gerarToken(usuario);
    }
}
