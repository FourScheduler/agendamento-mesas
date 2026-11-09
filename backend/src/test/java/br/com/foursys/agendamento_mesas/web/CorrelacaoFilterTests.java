package br.com.foursys.agendamento_mesas.web;

import static org.assertj.core.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class CorrelacaoFilterTests {
    @Test
    void propagaSomenteUuidValidoELimpaMdcMesmoComFalha() throws Exception {
        String chave = UUID.randomUUID().toString();
        var request = new MockHttpServletRequest();
        request.addHeader("X-Correlation-ID", chave);
        var response = new MockHttpServletResponse();
        new CorrelacaoFilter().doFilter(request, response, (req, res) ->
            assertThat(MDC.get("correlationId")).isEqualTo(chave));
        assertThat(response.getHeader("X-Correlation-ID")).isEqualTo(chave);
        assertThat(MDC.get("correlationId")).isNull();

        var invalido = new MockHttpServletRequest();
        invalido.addHeader("X-Correlation-ID", "------------------------------------");
        var gerado = new MockHttpServletResponse();
        assertThatThrownBy(() -> new CorrelacaoFilter().doFilter(invalido, gerado, (req, res) -> {
            throw new jakarta.servlet.ServletException("Falha de teste");
        })).isInstanceOf(jakarta.servlet.ServletException.class);
        assertThat(UUID.fromString(gerado.getHeader("X-Correlation-ID"))).isNotNull();
        assertThat(MDC.get("correlationId")).isNull();
    }
}
