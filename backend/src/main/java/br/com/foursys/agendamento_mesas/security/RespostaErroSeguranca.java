package br.com.foursys.agendamento_mesas.security;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.MediaType;

/**
 * Escreve o corpo de erro padrão da API (formato simplificado de RFC 9457)
 * para as respostas de segurança, que acontecem fora do MVC.
 */
final class RespostaErroSeguranca {

    private RespostaErroSeguranca() {
    }

    static void escrever(HttpServletResponse response, int status, String title, String detail, String instance)
            throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        String corpo = "{\"type\":\"about:blank\",\"title\":\"%s\",\"status\":%d,\"detail\":\"%s\",\"instance\":\"%s\"}"
                .formatted(title, status, detail, instance);
        response.getWriter().write(corpo);
    }
}
