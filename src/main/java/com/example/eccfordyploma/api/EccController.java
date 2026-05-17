package com.example.eccfordyploma.api;

import com.example.eccfordyploma.service.EccDemoService;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestController
@RequestMapping("/api/ecc")
public class EccController {

  private final EccDemoService service;

  public EccController(EccDemoService service) {
    this.service = service;
  }

  @GetMapping("/curve")
  public CurveInfoResponse curve() {
    return service.defaultCurveInfo();
  }

  @PostMapping("/curve/validate")
  public CurveInfoResponse validateCurve(@RequestBody(required = false) CurveRequest request) {
    return service.curveInfo(request);
  }

  @PostMapping("/encrypt")
  public EncryptResponse encrypt(@RequestBody EncryptRequest request) {
    if (request == null) {
      throw new IllegalArgumentException("Потрібно передати JSON із командою");
    }
    return service.encrypt(request.curve(), request.commandPoints(), request.command());
  }

  @PostMapping("/decrypt")
  public DecryptResponse decrypt(@RequestBody DecryptRequest request) {
    if (request == null) {
      throw new IllegalArgumentException("Потрібно передати JSON із Tx та k");
    }
    return service.decrypt(request.curve(), request.commandPoints(), request.tx(), request.k());
  }
}

@RestControllerAdvice
class EccApiExceptionHandler {

  @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
  public ResponseEntity<ApiError> handleBadRequest(RuntimeException exception) {
    return ResponseEntity
        .status(HttpStatus.BAD_REQUEST)
        .body(new ApiError(exception.getMessage(), Instant.now()));
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ApiError> handleUnreadableJson() {
    return ResponseEntity
        .status(HttpStatus.BAD_REQUEST)
        .body(new ApiError("Перевірте JSON: координати та k мають бути числами", Instant.now()));
  }
}
