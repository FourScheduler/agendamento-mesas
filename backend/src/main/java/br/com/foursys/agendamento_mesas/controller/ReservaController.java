package br.com.foursys.agendamento_mesas.controller;

import br.com.foursys.agendamento_mesas.dto.response.ReservaResponse;
import br.com.foursys.agendamento_mesas.dto.response.PaginaResponse;
import br.com.foursys.agendamento_mesas.security.UsuarioAutenticado;
import br.com.foursys.agendamento_mesas.service.ReservaService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import br.com.foursys.agendamento_mesas.dto.request.CriarReservaRequest;
import java.net.URI;
import java.time.LocalDate;
import br.com.foursys.agendamento_mesas.enums.StatusReserva;
import org.springframework.format.annotation.DateTimeFormat;

import java.util.List;

@RestController
@RequestMapping("/api/reservas")
public class ReservaController {
    private final ReservaService reservaService;

    public ReservaController(ReservaService reservaService) {
        this.reservaService = reservaService;
    }

    @PostMapping
    public ResponseEntity<ReservaResponse> criar(
        @RequestBody CriarReservaRequest request,
        @RequestHeader(value = "Idempotency-Key", required = false) String chave,
        @AuthenticationPrincipal UsuarioAutenticado usuario
    ) {
        ReservaResponse reserva = reservaService.criar(request, usuario, chave);

        return ResponseEntity
                .created(URI.create("/api/reservas/" + reserva.id()))
                .body(reserva);
    }

    @GetMapping("/confirmacoes/{chave}")
    public ReservaResponse consultarConfirmacao(@PathVariable String chave,
        @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return reservaService.consultarConfirmacao(chave, usuario);
    }

    @GetMapping("/minhas")
    public ResponseEntity<List<ReservaResponse>> minhasReservas(
            @AuthenticationPrincipal UsuarioAutenticado usuario,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate data,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @RequestParam(required = false) StatusReserva status
        ) {

        return ResponseEntity
                .ok(reservaService.minhasReservas(
                    usuario.id(),
                    data,
                    dataInicio,
                    dataFim,
                    status
                ));
    }

    @GetMapping("/minhas/pagina")
    public PaginaResponse<ReservaResponse> minhasPaginadas(
            @AuthenticationPrincipal UsuarioAutenticado usuario,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @RequestParam(required = false) StatusReserva status,
            @RequestParam(defaultValue = "false") boolean canceladas,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "10") int tamanho) {
        return reservaService.listarPagina(usuario.id(), dataInicio, dataFim, status, canceladas, pagina, tamanho);
    }

    @PatchMapping("/{id}/cancelamento")
    public ResponseEntity<Void> cancelarReserva(
        @PathVariable Long id,
        @AuthenticationPrincipal UsuarioAutenticado usuario
    ) {
        reservaService.cancelar(id, usuario);

        return ResponseEntity
                .ok()
                .build();
    }
}
