package br.com.foursys.agendamento_mesas.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;

/**
 * Responde 401 no corpo padrão da API quando falta token ou ele é inválido.
 */
public class EntradaNaoAutenticado implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException authException) throws IOException {
        RespostaErroSeguranca.escrever(response, HttpServletResponse.SC_UNAUTHORIZED, "Não autenticado",
                "Token ausente, inválido ou expirado.", request.getRequestURI());
    }
}
