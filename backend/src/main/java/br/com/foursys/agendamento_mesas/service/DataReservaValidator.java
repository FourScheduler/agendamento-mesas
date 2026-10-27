package br.com.foursys.agendamento_mesas.service;

import br.com.foursys.agendamento_mesas.web.DadosInvalidosException;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import org.springframework.stereotype.Component;

@Component
public class DataReservaValidator {
    private final Clock relogio;

    public DataReservaValidator(Clock relogio) {
        this.relogio = relogio;
    }

    public void validar(LocalDate data) {
        if (data == null) {
            throw new DadosInvalidosException("Campo 'data' é obrigatório.");
        }
        LocalDate hoje = LocalDate.now(relogio);
        if (data.isBefore(hoje)) {
            throw new DadosInvalidosException("Data deve ser hoje ou futura.");
        }
        if (data.isAfter(hoje.plusDays(15))) {
            throw new DadosInvalidosException("Data deve estar em até 15 dias a partir de hoje.");
        }
        if (data.getDayOfWeek() == DayOfWeek.SATURDAY || data.getDayOfWeek() == DayOfWeek.SUNDAY) {
            throw new DadosInvalidosException("Reservas são permitidas apenas de segunda a sexta.");
        }
    }
}
