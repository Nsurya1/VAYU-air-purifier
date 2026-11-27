package com.sochi.vayu.controller;

import com.sochi.vayu.config.VayuUserPrincipal;
import com.sochi.vayu.dto.ApproveRemoteSessionDto;
import com.sochi.vayu.dto.RemoteSessionDto;
import com.sochi.vayu.dto.RequestRemoteSessionDto;
import com.sochi.vayu.service.RemoteSessionService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/remote-sessions")
public class RemoteSessionController {

    private final RemoteSessionService sessionService;

    public RemoteSessionController(RemoteSessionService sessionService) {
        this.sessionService = sessionService;
    }

    @GetMapping
    public ResponseEntity<List<RemoteSessionDto>> getSessions(Authentication authentication) {
        String siteScope = "*";
        if (authentication != null && authentication.getPrincipal() instanceof VayuUserPrincipal principal) {
            siteScope = principal.getSiteScope();
        }
        return ResponseEntity.ok(sessionService.getAllSessions(siteScope));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RemoteSessionDto> getSession(@PathVariable Long id) {
        return ResponseEntity.ok(sessionService.getSessionById(id));
    }

    @PostMapping("/request")
    public ResponseEntity<RemoteSessionDto> requestSession(
            @Valid @RequestBody RequestRemoteSessionDto request,
            Authentication authentication
    ) {
        String actor = authentication != null ? authentication.getName() : "anonymous";
        String role = "UNKNOWN";
        if (authentication != null && authentication.getPrincipal() instanceof VayuUserPrincipal principal) {
            role = principal.getRole();
        }
        return ResponseEntity.ok(sessionService.requestSession(request, actor, role));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<RemoteSessionDto> approveSession(
            @PathVariable Long id,
            @RequestBody(required = false) ApproveRemoteSessionDto request,
            Authentication authentication
    ) {
        String actor = authentication != null ? authentication.getName() : "anonymous";
        String role = "UNKNOWN";
        if (authentication != null && authentication.getPrincipal() instanceof VayuUserPrincipal principal) {
            role = principal.getRole();
        }
        return ResponseEntity.ok(sessionService.approveSession(id, request, actor, role));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<RemoteSessionDto> rejectSession(
            @PathVariable Long id,
            Authentication authentication
    ) {
        String actor = authentication != null ? authentication.getName() : "anonymous";
        String role = "UNKNOWN";
        if (authentication != null && authentication.getPrincipal() instanceof VayuUserPrincipal principal) {
            role = principal.getRole();
        }
        return ResponseEntity.ok(sessionService.rejectSession(id, actor, role));
    }

    @PostMapping("/{id}/revoke")
    public ResponseEntity<RemoteSessionDto> revokeSession(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication
    ) {
        String actor = authentication != null ? authentication.getName() : "anonymous";
        String role = "UNKNOWN";
        if (authentication != null && authentication.getPrincipal() instanceof VayuUserPrincipal principal) {
            role = principal.getRole();
        }
        String reason = body != null ? body.get("reason") : "Emergency Administrator Killswitch";
        return ResponseEntity.ok(sessionService.revokeSession(id, actor, role, reason));
    }
}
