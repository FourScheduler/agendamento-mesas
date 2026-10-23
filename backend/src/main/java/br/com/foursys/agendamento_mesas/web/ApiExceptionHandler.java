package br.com.foursys.agendamento_mesas.web;

import br.com.foursys.agendamento_mesas.exceptions.CredenciaisInvalidasException;
import br.com.foursys.agendamento_mesas.exceptions.UsuarioInativoException;
import br.com.foursys.agendamento_mesas.exceptions.EmailJaCadastradoException;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Converte exceções de negócio no corpo de erro padrão da API (RFC 9457
 * simplificado), igual ao usado pelas respostas 401/403 da segurança.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(DadosInvalidosException.class)
    public ProblemDetail dadosInvalidos(DadosInvalidosException e, HttpServletRequest request) {
        return problema(HttpStatus.BAD_REQUEST, "Dados inválidos", e.getMessage(), request);
    }

    @ExceptionHandler(CredenciaisInvalidasException.class)
    public ProblemDetail credenciaisInvalidas(CredenciaisInvalidasException e, HttpServletRequest request) {
        return problema(HttpStatus.UNAUTHORIZED, "Credenciais inválidas", e.getMessage(), request);
    }

    @ExceptionHandler(UsuarioInativoException.class)
    public ProblemDetail usuarioInativo(UsuarioInativoException e, HttpServletRequest request) {
        return problema(HttpStatus.UNAUTHORIZED, "Usuário inativo", e.getMessage(), request);
    }

    @ExceptionHandler(EmailJaCadastradoException.class)
    public ProblemDetail emailJaCadastrado(EmailJaCadastradoException e, HttpServletRequest request) {
        return problema(HttpStatus.CONFLICT, "E-mail já cadastrado", e.getMessage(), request);
    }

    private ProblemDetail problema(HttpStatus status, String title, String detail, HttpServletRequest request) {
        ProblemDetail problema = ProblemDetail.forStatusAndDetail(status, detail);
        problema.setTitle(title);
        if (request.getRequestURI() != null) {
            problema.setInstance(URI.create(request.getRequestURI()));
        }
        return problema;
    }
}
