package br.com.foursys.agendamento_mesas.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;

/**
 * Responde 403 no corpo padrão da API quando o perfil não autoriza a rota.
 */
public class AcessoNegadoTratador implements AccessDeniedHandler {

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
            AccessDeniedException accessDeniedException) throws IOException {
        RespostaErroSeguranca.escrever(response, HttpServletResponse.SC_FORBIDDEN, "Acesso negado",
                "Acesso restrito a administradores.", request.getRequestURI());
    }
}
