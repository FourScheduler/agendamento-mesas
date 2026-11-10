package br.com.foursys.agendamento_mesas.reservas;

import static org.assertj.core.api.Assertions.assertThat;
import br.com.foursys.agendamento_mesas.enums.*;
import br.com.foursys.agendamento_mesas.model.*;
import br.com.foursys.agendamento_mesas.port.out.*;
import br.com.foursys.agendamento_mesas.config.RetencaoReservasJob;
import java.time.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "app.reservas.retencao.habilitada=true")
@ActiveProfiles("test")
@Import(ReservaApiTests.RelogioTeste.class)
class RetencaoReservasTests {
    @Autowired ReservaRepositoryPort reservas;
    @Autowired UsuarioRepositoryPort usuarios;
    @Autowired MesaRepositoryPort mesas;
    @Autowired RetencaoReservasJob retencao;

    @Test @Transactional
    void removeSomenteCanceladasComQuinzeDiasSemApagarVinculosOuInventarDataLegada() {
        reservas.deletarTodos(); mesas.deletarTodos(); usuarios.deletarTodos();
        var usuario = usuarios.salvar(new Usuario("Retenção", "retencao@teste.com", "hash", PerfilUsuario.USUARIO, true));
        var mesa = mesas.salvar(new Mesa(null, "RET", "TESTE", TipoMesa.LIVRE, true, "TESTE", 0, 0, null));
        var limite = LocalDateTime.of(2026, 10, 11, 9, 0);
        var expirada = reserva(mesa, usuario, StatusReserva.CANCELADA, limite);
        var recente = reserva(mesa, usuario, StatusReserva.CANCELADA, limite.plusSeconds(1));
        var legada = reserva(mesa, usuario, StatusReserva.CANCELADA, null);
        var ativa = reserva(mesa, usuario, StatusReserva.CONFIRMADA, limite.minusDays(20));
        retencao.limparCanceladas();
        assertThat(reservas.buscarPorId(expirada.getId())).isEmpty();
        for (var preservada : java.util.List.of(recente, legada, ativa)) assertThat(reservas.buscarPorId(preservada.getId())).isPresent();
        assertThat(usuarios.buscarPorId(usuario.getId())).isPresent();
        assertThat(mesas.buscarPorId(mesa.getId())).isPresent();
        retencao.limparCanceladas();
        assertThat(reservas.buscarPorId(expirada.getId())).isEmpty();
    }
    private Reserva reserva(Mesa mesa, Usuario usuario, StatusReserva status, LocalDateTime cancelada) {
        var reserva = new Reserva(mesa, usuario, LocalDate.of(2026, 9, 1), status);
        reserva.setCanceladaEm(cancelada);
        return reservas.salvarESincronizar(reserva);
    }
}
