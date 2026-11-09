package br.com.foursys.agendamento_mesas.config;

import static org.mockito.Mockito.*;

import br.com.foursys.agendamento_mesas.port.out.ReservaRepositoryPort;
import java.time.*;
import org.junit.jupiter.api.Test;

class RetencaoReservasJobTests {
    @Test
    void processaLotesSeparadosComMesmoLimiteAteEsgotarPendencias() {
        var reservas = mock(ReservaRepositoryPort.class);
        var clock = Clock.fixed(Instant.parse("2026-10-26T12:00:00Z"), ZoneId.of("America/Sao_Paulo"));
        var limite = LocalDateTime.of(2026, 10, 11, 9, 0);
        when(reservas.excluirCanceladasAte(limite, 500)).thenReturn(500, 500, 2);
        new RetencaoReservasJob(reservas, clock).limparCanceladas();
        verify(reservas, times(3)).excluirCanceladasAte(limite, 500);
        verifyNoMoreInteractions(reservas);
    }
}
