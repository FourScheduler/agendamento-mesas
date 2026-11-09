package br.com.foursys.agendamento_mesas.config;

import br.com.foursys.agendamento_mesas.port.out.ReservaRepositoryPort;
import java.time.Clock;
import java.time.LocalDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "app.reservas.retencao.habilitada", havingValue = "true")
public class RetencaoReservasJob {
    private static final Logger LOG = LoggerFactory.getLogger(RetencaoReservasJob.class);
    private final ReservaRepositoryPort reservas;
    private final Clock relogio;

    public RetencaoReservasJob(ReservaRepositoryPort reservas, Clock relogio) {
        this.reservas = reservas;
        this.relogio = relogio;
    }

    @Scheduled(cron = "${app.reservas.retencao.cron:0 0 3 * * *}", zone = "America/Sao_Paulo")
    public void limparCanceladas() {
        LocalDateTime limite = LocalDateTime.now(relogio).minusDays(15);
        int lote;
        long excluidas = 0;
        do {
            lote = reservas.excluirCanceladasAte(limite, 500);
            excluidas += lote;
        } while (lote == 500);
        LOG.info("Retenção de reservas canceladas: {} registros excluídos.", excluidas);
    }
}
