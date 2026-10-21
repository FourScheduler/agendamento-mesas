package br.com.foursys.agendamento_mesas;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AgendamentoMesasApplicationTests {

    @Test
    void contextLoadsWithoutExternalServices() {
        // Verifica a inicialização do servidor sem banco, credenciais ou serviços externos.
    }
}
