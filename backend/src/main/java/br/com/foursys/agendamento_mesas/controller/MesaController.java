package br.com.foursys.agendamento_mesas.controller;

import br.com.foursys.agendamento_mesas.dto.response.MesaResponse;
import br.com.foursys.agendamento_mesas.service.MesaService;
import br.com.foursys.agendamento_mesas.dto.response.MinhaMesaFixaResponse;
import br.com.foursys.agendamento_mesas.security.UsuarioAutenticado;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.time.LocalDate;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/mesas")
public class MesaController {
    private final MesaService mesasService;

    public MesaController(MesaService mesas) {
        this.mesasService = mesas;
    }

    @GetMapping
    public List<MesaResponse> listar() {
        return mesasService.listar();
    }

    @GetMapping("/minha-fixa")
    public MinhaMesaFixaResponse minhaMesaFixa(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return mesasService.minhaMesaFixa(usuario.id());
    }

    @GetMapping("/disponiveis")
    public ResponseEntity<List<MesaResponse>> listarDisponiveis(
        @RequestParam LocalDate data
    ) {

        List<MesaResponse> listaMesasDisponiveis =
            mesasService.listarDisponiveis(data);

        return ResponseEntity
            .status(HttpStatus.OK)
            .body(listaMesasDisponiveis);

    }
}
