package br.com.foursys.agendamento_mesas.web;

import br.com.foursys.agendamento_mesas.controller.AdminMesaController;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import tools.jackson.databind.exc.MismatchedInputException;

/** Trata somente erros de entrada das operações administrativas de mesas. */
@RestControllerAdvice(assignableTypes = AdminMesaController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AdminMesaExceptionHandler {

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail corpoInvalido(HttpMessageNotReadableException e, HttpServletRequest request) {
        String detalhe = "Corpo JSON ausente ou inválido. Verifique os campos e os tipos dos valores enviados.";
        for (Throwable causa = e.getCause(); causa != null; causa = causa.getCause()) {
            if (causa instanceof MismatchedInputException erro && erro.getPath().size() == 1) {
                detalhe = switch (erro.getPath().getFirst().getPropertyName()) {
                    case "usuarioId" -> "Campo 'usuarioId' deve ser um inteiro positivo.";
                    case "tipo" -> "Campo 'tipo' deve ser FIXA ou LIVRE.";
                    case "ativa" -> "Campo 'ativa' deve ser true ou false.";
                    case null, default -> detalhe;
                };
                break;
            }
        }
        return problema(detalhe, request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ProblemDetail idInvalido(MethodArgumentTypeMismatchException e, HttpServletRequest request) {
        return problema("Campo 'id' deve ser um inteiro.", request);
    }

    private ProblemDetail problema(String detalhe, HttpServletRequest request) {
        var problema = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, detalhe);
        problema.setTitle("Dados inválidos");
        problema.setInstance(URI.create(request.getRequestURI()));
        return problema;
    }
}
