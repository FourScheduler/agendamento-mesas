package br.com.foursys.agendamento_mesas.controller;

import br.com.foursys.agendamento_mesas.dto.request.AlterarAtivacaoMesaRequest;
import br.com.foursys.agendamento_mesas.dto.request.AlterarResponsavelMesaRequest;
import br.com.foursys.agendamento_mesas.dto.request.AlterarTipoMesaRequest;
import br.com.foursys.agendamento_mesas.dto.request.FixarMesaRequest;
import br.com.foursys.agendamento_mesas.dto.response.MesaResponse;
import br.com.foursys.agendamento_mesas.service.MesaService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/mesas")
public class AdminMesaController {

    private final MesaService mesaService;

    public AdminMesaController(MesaService mesaService) {
        this.mesaService = mesaService;
    }

    @PatchMapping("/{id}/fixar")
    public ResponseEntity<MesaResponse> fixar(
        @PathVariable Long id,
        @RequestBody FixarMesaRequest request
    ) {
        return ResponseEntity.ok(mesaService.fixar(id, request.usuarioId()));
    }

    @PatchMapping("/{id}/desfixar")
    public ResponseEntity<MesaResponse> desfixar(@PathVariable Long id) {
        return ResponseEntity.ok(mesaService.desfixar(id));
    }

    @PatchMapping("/{id}/responsavel")
    public ResponseEntity<MesaResponse> alterarResponsavel(
        @PathVariable Long id,
        @RequestBody AlterarResponsavelMesaRequest request
    ) {
        return ResponseEntity.ok(mesaService.alterarResponsavel(id, request.usuarioId()));
    }

    @PatchMapping("/{id}/tipo")
    public ResponseEntity<MesaResponse> alterarTipo(
        @PathVariable Long id,
        @RequestBody AlterarTipoMesaRequest request
    ) {
        return ResponseEntity.ok(mesaService.alterarTipo(id, request.tipo()));
    }

    @PatchMapping("/{id}/ativacao")
    public ResponseEntity<MesaResponse> alterarAtivacao(
        @PathVariable Long id,
        @RequestBody AlterarAtivacaoMesaRequest request
    ) {
        return ResponseEntity.ok(mesaService.alterarAtivacao(id, request.ativa()));
    }
}
