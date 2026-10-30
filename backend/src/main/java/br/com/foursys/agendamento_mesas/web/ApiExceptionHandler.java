package br.com.foursys.agendamento_mesas.web;

import br.com.foursys.agendamento_mesas.exceptions.CredenciaisInvalidasException;
import br.com.foursys.agendamento_mesas.exceptions.UsuarioInativoException;
import br.com.foursys.agendamento_mesas.exceptions.UsuarioSemPermissaoException;
import br.com.foursys.agendamento_mesas.exceptions.EmailJaCadastradoException;
import br.com.foursys.agendamento_mesas.exceptions.ReservaJaCanceladaException;
import br.com.foursys.agendamento_mesas.exceptions.ReservaNaoEncontradaException;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * Converte exceções de negócio no corpo de erro padrão da API (RFC 9457
 * simplificado), igual ao usado pelas respostas 401/403 da segurança.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ProblemDetail regraDeNegocio(ResponseStatusException e, HttpServletRequest request) {
        var status = HttpStatus.valueOf(e.getStatusCode().value());
        return problema(status, status == HttpStatus.CONFLICT ? "Conflito de reserva" : status.getReasonPhrase(),
                e.getReason(), request);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class})
    public ProblemDetail requestInvalido(Exception e, HttpServletRequest request) {
        return problema(HttpStatus.BAD_REQUEST, "Dados inválidos",
                "Verifique os campos obrigatórios e os formatos informados.", request);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail integridade(DataIntegrityViolationException e, HttpServletRequest request) {
        return problema(HttpStatus.CONFLICT, "Conflito de dados",
                "A operação conflita com os vínculos existentes. Atualize os dados e tente novamente.", request);
    }

    @ExceptionHandler(PessimisticLockingFailureException.class)
    public ProblemDetail confirmacaoConcorrente(PessimisticLockingFailureException e, HttpServletRequest request) {
        return problema(HttpStatus.CONFLICT, "Confirmação concorrente",
                "Não foi possível concluir a confirmação concorrente. Atualize a disponibilidade e tente novamente.", request);
    }

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

    @ExceptionHandler(UsuarioSemPermissaoException.class)
    public ProblemDetail semPermissao(UsuarioSemPermissaoException e, HttpServletRequest request) {
        return problema(HttpStatus.FORBIDDEN, "Acesso negado", e.getMessage(), request);
    }

    @ExceptionHandler(EmailJaCadastradoException.class)
    public ProblemDetail emailJaCadastrado(EmailJaCadastradoException e, HttpServletRequest request) {
        return problema(HttpStatus.CONFLICT, "E-mail já cadastrado", e.getMessage(), request);
    }

    @ExceptionHandler(ReservaJaCanceladaException.class)
    public ProblemDetail reservaJaCancelada(ReservaJaCanceladaException e, HttpServletRequest request) {
        return problema(HttpStatus.CONFLICT, "Conflito de reserva", e.getMessage(), request);
    }

    @ExceptionHandler(ReservaNaoEncontradaException.class)
    public ProblemDetail reservaNaoEncontrada(ReservaNaoEncontradaException e, HttpServletRequest request) {
        return problema(HttpStatus.NOT_FOUND, HttpStatus.NOT_FOUND.getReasonPhrase(), e.getMessage(), request);
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
