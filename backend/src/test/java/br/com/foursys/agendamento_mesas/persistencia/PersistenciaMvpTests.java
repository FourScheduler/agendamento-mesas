package br.com.foursys.agendamento_mesas.persistencia;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.foursys.agendamento_mesas.model.Mesa;
import br.com.foursys.agendamento_mesas.enums.PerfilUsuario;
import br.com.foursys.agendamento_mesas.model.Reserva;
import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import br.com.foursys.agendamento_mesas.enums.TipoMesa;
import br.com.foursys.agendamento_mesas.model.Usuario;
import br.com.foursys.agendamento_mesas.repository.MesaRepository;
import br.com.foursys.agendamento_mesas.repository.ReservaRepository;
import br.com.foursys.agendamento_mesas.repository.UsuarioRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * CenÃ¡rios da issue de modelo persistente: migrations em banco vazio e reaplicaÃ§Ã£o,
 * reserva persistida com o usuÃ¡rio que a criou, e-mail/cÃ³digo duplicado e FKs invÃ¡lidas.
 */
@ActiveProfiles("test")
@SpringBootTest
class PersistenciaMvpTests {

    private static final LocalDate DATA = LocalDate.of(2026, 10, 28);

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private MesaRepository mesaRepository;

    @Autowired
    private ReservaRepository reservaRepository;

    @Autowired
    private org.flywaydb.core.Flyway flyway;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private jakarta.persistence.EntityManager entityManager;

    @BeforeEach
    void limparBanco() {
        // Ordem respeita as FKs: reservas dependem de mesas e usuarios.
        reservaRepository.deleteAll();
        mesaRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void migracoesAplicamEmBancoVazioENaoReaplicamNemApagamDados() {
        usuarioRepository.save(new Usuario("Teste", "migracao@exemplo.com", "hash", PerfilUsuario.USUARIO, true));

        MigrateResult resultado = flyway.migrate();

        // ReaplicaÃ§Ã£o Ã© no-op: nada Ã© recriado nem apagado.
        assertThat(resultado.migrationsExecuted).isZero();
        assertThat(usuarioRepository.count()).isEqualTo(1);
        // Estrutura completa existe (tabelas acessÃ­veis pelos repositories).
        assertThat(mesaRepository.count()).isZero();
        assertThat(reservaRepository.count()).isZero();
    }

    @Test
    @Transactional
    void reservaPersisteComVinculoParaUsuarioEMesa() {
        Usuario usuario = usuarioRepository.save(
                new Usuario("Maria Souza", "maria@exemplo.com", "hash", PerfilUsuario.USUARIO, true));
        Mesa mesa = mesaRepository.save(
                new Mesa("001", "TAMBORÉ", TipoMesa.LIVRE, true, "TAMBORÉ", 100, 80));

        Reserva salva = reservaRepository.saveAndFlush(
                new Reserva(mesa, usuario, DATA, StatusReserva.PENDENTE));
        entityManager.clear(); // Recarrega do banco para forÃ§ar a recuperaÃ§Ã£o dos vÃ­nculos.

        Reserva recuperada = reservaRepository.findById(salva.getId()).orElseThrow();
        assertThat(recuperada.getUsuario().getId()).isEqualTo(usuario.getId());
        assertThat(recuperada.getUsuario().getEmail()).isEqualTo("maria@exemplo.com");
        assertThat(recuperada.getMesa().getCodigo()).isEqualTo("001");
        assertThat(recuperada.getData()).isEqualTo(DATA);
        assertThat(recuperada.getStatus()).isEqualTo(StatusReserva.PENDENTE);
        assertThat(recuperada.getCriadaEm()).isNotNull();
    }

    @Test
    void senhaEArmazenadaComoHashBcrypt() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String hash = encoder.encode("senha1234");
        usuarioRepository.save(new Usuario("Maria Souza", "bcrypt@exemplo.com", hash, PerfilUsuario.USUARIO, true));

        String persistido = usuarioRepository.findByEmail("bcrypt@exemplo.com").orElseThrow().getSenhaHash();

        assertThat(persistido).isNotEqualTo("senha1234").doesNotContain("senha1234");
        assertThat(encoder.matches("senha1234", persistido)).isTrue();
    }

    @Test
    void emailDuplicadoERejeitado() {
        usuarioRepository.save(new Usuario("A", "duplicado@exemplo.com", "hash", PerfilUsuario.USUARIO, true));
        Usuario segundo = new Usuario("B", "duplicado@exemplo.com", "hash", PerfilUsuario.USUARIO, true);

        assertThatThrownBy(() -> usuarioRepository.saveAndFlush(segundo))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void codigoDeMesaDuplicadoERejeitado() {
        mesaRepository.save(new Mesa("001", "TAMBORÉ", TipoMesa.LIVRE, true, "TAMBORÉ", 100, 80));
        Mesa duplicada = new Mesa("001", "TAMBORÉ", TipoMesa.FIXA, true, "TAMBORÉ", 180, 80);

        assertThatThrownBy(() -> mesaRepository.saveAndFlush(duplicada))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void fkInvalidasSaoRejeitadas() {
        Mesa mesa = mesaRepository.save(new Mesa("002", "TAMBORÉ", TipoMesa.LIVRE, true, "TAMBORÉ", 100, 140));
        Usuario usuario = usuarioRepository.save(
                new Usuario("Joao Pereira", "joao@exemplo.com", "hash", PerfilUsuario.USUARIO, true));

        // usuario_id inexistente
        assertThatThrownBy(() -> jdbcTemplate.update(
                "INSERT INTO reservas (mesa_id, usuario_id, data, status, criada_em) VALUES (?, ?, ?, ?, ?)",
                mesa.getId(), 999999L, DATA, "PENDENTE", LocalDateTime.now()))
                .isInstanceOf(DataIntegrityViolationException.class);

        // mesa_id inexistente
        assertThatThrownBy(() -> jdbcTemplate.update(
                "INSERT INTO reservas (mesa_id, usuario_id, data, status, criada_em) VALUES (?, ?, ?, ?, ?)",
                999999L, usuario.getId(), DATA, "PENDENTE", LocalDateTime.now()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @Transactional
    void disponibilidadeTrataStatusCorretamente() {
        Usuario usuario = usuarioRepository.save(
                new Usuario("Maria Souza", "disponibilidade@exemplo.com", "hash", PerfilUsuario.USUARIO, true));
        Mesa mesa = mesaRepository.save(
                new Mesa("003", "TAMBORÉ", TipoMesa.LIVRE, true, "TAMBORÉ", 260, 80));
        Reserva reserva = reservaRepository.saveAndFlush(
                new Reserva(mesa, usuario, DATA, StatusReserva.PENDENTE));

        assertThat(reservaRepository.mesaOcupadaNaData(mesa.getId(), DATA, ReservaRepository.BLOQUEIA_MESA)).isTrue();
        assertThat(reservaRepository.usuarioTemReservaNaData(usuario.getId(), DATA, ReservaRepository.BLOQUEIA_MESA))
                .isTrue();

        // Cancelamento libera a mesa e a data do usuÃ¡rio.
        reserva.setStatus(StatusReserva.CANCELADA);
        reserva.setCanceladaEm(LocalDateTime.now());
        reservaRepository.flush();

        assertThat(reservaRepository.mesaOcupadaNaData(mesa.getId(), DATA, ReservaRepository.BLOQUEIA_MESA)).isFalse();
        assertThat(reservaRepository.usuarioTemReservaNaData(usuario.getId(), DATA, ReservaRepository.BLOQUEIA_MESA))
                .isFalse();

        // O vÃ­nculo histÃ³rico com o solicitante permanece apÃ³s o cancelamento.
        assertThat(reservaRepository.findById(reserva.getId()).orElseThrow().getUsuario().getId())
                .isEqualTo(usuario.getId());
    }
}

