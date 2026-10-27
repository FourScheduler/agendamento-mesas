package br.com.foursys.agendamento_mesas.reservas;

import static org.assertj.core.api.Assertions.*;
import br.com.foursys.agendamento_mesas.service.DataReservaValidator;
import br.com.foursys.agendamento_mesas.web.DadosInvalidosException;
import java.time.*;
import org.junit.jupiter.api.Test;

class DataReservaValidatorTests {
    @Test
    void hojeEJanelaSaoCalculadosNoFusoDeSaoPaulo() {
        // Em UTC já é terça; em São Paulo ainda é segunda-feira.
        var relogio = Clock.fixed(Instant.parse("2026-10-27T01:30:00Z"), ZoneId.of("America/Sao_Paulo"));
        var validator = new DataReservaValidator(relogio);
        assertThatCode(() -> validator.validar(LocalDate.of(2026, 10, 26))).doesNotThrowAnyException();
        assertThatCode(() -> validator.validar(LocalDate.of(2026, 11, 10))).doesNotThrowAnyException();
        assertThatThrownBy(() -> validator.validar(LocalDate.of(2026, 11, 11)))
                .isInstanceOf(DadosInvalidosException.class).hasMessageContaining("15 dias");
    }
}
