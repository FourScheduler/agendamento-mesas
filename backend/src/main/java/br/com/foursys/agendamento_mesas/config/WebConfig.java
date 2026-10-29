package br.com.foursys.agendamento_mesas.config;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * CORS restrito às origens do frontend (porta 4201 em desenvolvimento).
 * O bean é consumido pelo filtro CORS do Spring Security, que atende o
 * preflight OPTIONS antes da autorização.
 */
@Configuration
public class WebConfig {

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins}") String[] allowedOrigins
    ) {
        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOrigins(List.of(allowedOrigins));

        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));

        config.setAllowedHeaders(List.of("Content-Type", "Authorization"));

        UrlBasedCorsConfigurationSource fonte = new UrlBasedCorsConfigurationSource();

        fonte.registerCorsConfiguration("/api/**", config);

        return fonte;
    }
}
