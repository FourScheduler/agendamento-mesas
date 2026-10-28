package br.com.foursys.agendamento_mesas.catalogo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import br.com.foursys.agendamento_mesas.port.out.MesaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.ReservaRepositoryPort;
import br.com.foursys.agendamento_mesas.port.out.UsuarioRepositoryPort;
import com.jayway.jsonpath.JsonPath;
import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.model.Reserva;
import br.com.foursys.agendamento_mesas.security.JwtService;
import br.com.foursys.agendamento_mesas.service.MesaService;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@ActiveProfiles("test")
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:catalogo;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "spring.flyway.locations=classpath:db/migration,classpath:db/seed"})
@AutoConfigureMockMvc
@Transactional
class CatalogoMesasTests {
    @Autowired MockMvc mvc;
    @Autowired MesaRepositoryPort repository;
    @Autowired MesaService service;
    @Autowired UsuarioRepositoryPort usuarios;
    @Autowired ReservaRepositoryPort reservas;
    @Autowired JwtService jwt;

    @Test
    void catalogoAutenticadoIncluiInativaEReferenciaVisualSemDisponibilidadeGlobal() throws Exception {
        String token = jwt.gerarToken(usuarios.buscarPorEmail("maria.souza@exemplo.com").orElseThrow());
        String resposta = mvc.perform(get("/api/mesas").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(115))
                .andExpect(jsonPath("$[4].codigo").value("005"))
                .andExpect(jsonPath("$[4].ativa").value(false))
                .andExpect(jsonPath("$[43].id").value(44))
                .andExpect(jsonPath("$[43].codigo").value("044"))
                .andExpect(jsonPath("$[43].regiao").value("TAMBORÉ"))
                .andExpect(jsonPath("$[43].tipo").value("LIVRE"))
                .andExpect(jsonPath("$[43].referenciaVisual.planta").value("TAMBORÉ"))
                .andExpect(jsonPath("$[43].referenciaVisual.x").value(590))
                .andExpect(jsonPath("$[43].referenciaVisual.y").value(1108))
                .andExpect(jsonPath("$[43].disponivel").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        assertThat(mvc.perform(get("/api/mesas").header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString()).isEqualTo(resposta);
    }

    @Test
    void catalogoExigeAutenticacao() throws Exception {
        mvc.perform(get("/api/mesas")).andExpect(status().isUnauthorized());
    }

    @Test
    void disponibilidadeExigeAutenticacao() throws Exception {
        mvc.perform(get("/api/mesas/disponiveis").param("data", LocalDate.now().plusDays(1).toString()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void disponibilidadeExigeDataEmFormatoIso() throws Exception {
        String token = jwt.gerarToken(usuarios.buscarPorEmail("maria.souza@exemplo.com").orElseThrow());

        mvc.perform(get("/api/mesas/disponiveis").header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/mesas/disponiveis")
                        .param("data", "28-10-2026")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void disponibilidadeBloqueiaPendentesEConfirmadasIgnoraCanceladasEMapeiaCatalogo() throws Exception {
        LocalDate data = LocalDate.now(java.time.ZoneId.of("America/Sao_Paulo"))
                .with(java.time.temporal.TemporalAdjusters.nextOrSame(java.time.DayOfWeek.MONDAY));
        var usuario = usuarios.buscarPorEmail("maria.souza@exemplo.com").orElseThrow();
        Mesa pendente = repository.salvar(new Mesa(null, "901", "DEMO", TipoMesa.LIVRE, true, "DEMO", 10, 20));
        Mesa confirmada = repository.salvar(new Mesa(null, "902", "DEMO", TipoMesa.LIVRE, true, "DEMO", 30, 40));
        Mesa cancelada = repository.salvar(new Mesa(null, "903", "DEMO", TipoMesa.LIVRE, true, "DEMO", 50, 60));
        Mesa outraData = repository.salvar(new Mesa(null, "904", "DEMO", TipoMesa.LIVRE, true, "DEMO", 70, 80));
        repository.salvar(new Mesa(null, "905", "DEMO", TipoMesa.FIXA, true, "DEMO", 90, 100));
        repository.salvar(new Mesa(null, "906", "DEMO", TipoMesa.LIVRE, false, "DEMO", 110, 120));

        reservas.salvar(new Reserva(pendente, usuario, data, StatusReserva.PENDENTE));
        reservas.salvar(new Reserva(confirmada, usuario, data, StatusReserva.CONFIRMADA));
        Reserva reservaCancelada = new Reserva(cancelada, usuario, data, StatusReserva.CANCELADA);
        reservaCancelada.setCanceladaEm(LocalDateTime.now());
        reservas.salvar(reservaCancelada);
        reservas.salvar(new Reserva(outraData, usuario, data.plusDays(1), StatusReserva.CONFIRMADA));
        reservas.sincronizar();

        String token = jwt.gerarToken(usuario);
        String resposta = mvc.perform(get("/api/mesas/disponiveis")
                        .param("data", data.toString())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Map<String, Object>> mesasDisponiveis = JsonPath.read(resposta, "$");
        List<Object> codigos = mesasDisponiveis.stream().map(mesa -> mesa.get("codigo")).toList();

        assertThat(codigos)
                .doesNotContain("901", "902", "905", "906")
                .contains("903", "904");
        assertThat(mesasDisponiveis).allSatisfy(mesa ->
                assertThat(mesa).doesNotContainKey("solicitante"));
        assertThat(mesasDisponiveis).anySatisfy(mesa -> {
            assertThat(mesa.get("codigo")).isEqualTo("903");
            assertThat(mesa.get("id")).isEqualTo(cancelada.getId().intValue());
            assertThat(mesa.get("regiao")).isEqualTo("DEMO");
            assertThat(mesa.get("tipo")).isEqualTo("LIVRE");
            assertThat(mesa.get("ativa")).isEqualTo(true);
            Map<?, ?> referenciaVisual = (Map<?, ?>) mesa.get("referenciaVisual");
            assertThat(referenciaVisual.get("planta")).isEqualTo("DEMO");
            assertThat(referenciaVisual.get("x")).isEqualTo(50);
            assertThat(referenciaVisual.get("y")).isEqualTo(60);
        });
    }

    @Test
    void elegibilidadeRecusaInativaMesmoQuandoLivreEFixaENaoEncontrada() {
        Mesa inativa = repository.salvar(new Mesa(null, "999", "DEMO", TipoMesa.LIVRE, false, "DEMO", 0, 0));
        assertThatThrownBy(() -> service.obterParaReserva(inativa.getId()))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        erro -> assertThat(erro.getStatusCode()).isEqualTo(HttpStatus.CONFLICT))
                .hasMessageContaining("inativa");
        assertThatThrownBy(() -> service.obterParaReserva(repository.buscarPorCodigo("001").orElseThrow().getId()))
                .hasMessageContaining("fixa");
        assertThatThrownBy(() -> service.obterParaReserva(-1L))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        erro -> assertThat(erro.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThat(service.obterParaReserva(repository.buscarPorCodigo("044").orElseThrow().getId()).getCodigo())
                .isEqualTo("044");
    }

    @Test
    void cargaReproduzCatalogoCompletoEmDoisBancosVaziosSemReaplicar() {
        java.util.List<java.util.Map<String, Object>> anterior = null;
        for (String nome : java.util.List.of("seed_a", "seed_b")) {
            var ds = new DriverManagerDataSource("jdbc:h2:mem:" + nome + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
            var flyway = Flyway.configure().dataSource(ds)
                    .locations("classpath:db/migration", "classpath:db/seed").load();
            flyway.migrate();
            var jdbc = new JdbcTemplate(ds);
            var catalogo = jdbc.queryForList("SELECT * FROM mesas ORDER BY codigo");
            assertThat(catalogo).hasSize(115);
            if (anterior != null) assertThat(catalogo).isEqualTo(anterior);
            anterior = catalogo;
            assertThat(flyway.migrate().migrationsExecuted).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM mesas WHERE ativa = FALSE", Integer.class)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM reservas", Integer.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM (SELECT planta, posicao_x, posicao_y FROM mesas GROUP BY planta, posicao_x, posicao_y) p", Integer.class)).isEqualTo(115);
        }
    }

    @Test
    void plantaTemDoisBlocosSemSobreposicaoDeMesasOuEntrada() {
        var catalogo = service.listar();
        assertThat(catalogo).hasSize(115);
        assertThat(catalogo.stream().filter(m -> m.referenciaVisual().x() < 800).count()).isEqualTo(72);
        assertThat(catalogo.stream().filter(m -> m.referenciaVisual().x() >= 800).count()).isEqualTo(43);
        for (int i = 0; i < catalogo.size(); i++) {
            var a = catalogo.get(i).referenciaVisual();
            assertThat(a.x()).isBetween(24, 1402);
            assertThat(a.y()).isBetween(24, 1857);
            // Entrada: x=836, y=656, largura=745, altura=341.
            assertThat(a.x() < 1581 && a.x() + 180 > 836 && a.y() < 997 && a.y() + 92 > 656)
                    .as("Mesa %s fora da entrada", catalogo.get(i).codigo()).isFalse();
            for (int j = i + 1; j < catalogo.size(); j++) {
                var b = catalogo.get(j).referenciaVisual();
                assertThat(a.x() < b.x() + 180 && a.x() + 180 > b.x()
                        && a.y() < b.y() + 92 && a.y() + 92 > b.y())
                        .as("Mesas %s e %s sem sobreposição", catalogo.get(i).codigo(), catalogo.get(j).codigo())
                        .isFalse();
            }
        }
    }
}
