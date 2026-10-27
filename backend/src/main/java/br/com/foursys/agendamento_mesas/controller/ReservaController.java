package br.com.foursys.agendamento_mesas.controller;

import br.com.foursys.agendamento_mesas.dto.request.CriarReservaRequest;
import br.com.foursys.agendamento_mesas.dto.response.ReservaResponse;
import br.com.foursys.agendamento_mesas.security.UsuarioAutenticado;
import br.com.foursys.agendamento_mesas.service.ReservaService;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reservas")
public class ReservaController {
    private final ReservaService reservas;

    public ReservaController(ReservaService reservas) {
        this.reservas = reservas;
    }

    @PostMapping
    public ResponseEntity<ReservaResponse> criar(@RequestBody CriarReservaRequest request,
                                                @AuthenticationPrincipal UsuarioAutenticado usuario) {
        var reserva = reservas.criar(request, usuario);
        return ResponseEntity.created(URI.create("/api/reservas/" + reserva.id())).body(reserva);
    }
}
