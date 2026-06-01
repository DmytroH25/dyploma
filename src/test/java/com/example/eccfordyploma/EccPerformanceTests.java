package com.example.eccfordyploma;

import com.example.eccfordyploma.api.DecryptResponse;
import com.example.eccfordyploma.api.EncryptResponse;
import com.example.eccfordyploma.service.EccDemoService;
import org.junit.jupiter.api.Test;

class EccPerformanceTests {

  private static final int WARMUP_ITERATIONS = 200;
  private static final int MEASURE_ITERATIONS = 1000;

  private final EccDemoService service = new EccDemoService();

  @Test
  void measureEncryptionAndDecryptionTime() {
    String command = service.defaultCurveInfo().commands().getFirst().command();

    for (int i = 0; i < WARMUP_ITERATIONS; i++) {
      EncryptResponse encrypted = service.encrypt(null, null, command);
      service.decrypt(null, null, encrypted.tx(), encrypted.k());
    }

    long encryptionTotalNs = 0;
    long decryptionTotalNs = 0;
    long encryptionMaxNs = 0;
    long decryptionMaxNs = 0;

    for (int i = 0; i < MEASURE_ITERATIONS; i++) {
      long encryptionStart = System.nanoTime();
      EncryptResponse encrypted = service.encrypt(null, null, command);
      long encryptionNs = System.nanoTime() - encryptionStart;

      long decryptionStart = System.nanoTime();
      DecryptResponse decrypted = service.decrypt(null, null, encrypted.tx(), encrypted.k());
      long decryptionNs = System.nanoTime() - decryptionStart;

      if (!command.equals(decrypted.command())) {
        throw new AssertionError("Decrypted command does not match original command");
      }

      encryptionTotalNs += encryptionNs;
      decryptionTotalNs += decryptionNs;
      encryptionMaxNs = Math.max(encryptionMaxNs, encryptionNs);
      decryptionMaxNs = Math.max(decryptionMaxNs, decryptionNs);
    }

    System.out.printf(
        "%nECC performance over %,d iterations:%n" +
            "Average encryption: %.3f ms%n" +
            "Max encryption: %.3f ms%n" +
            "Average decryption: %.3f ms%n" +
            "Max decryption: %.3f ms%n",
        MEASURE_ITERATIONS,
        nsToMs(encryptionTotalNs / (double) MEASURE_ITERATIONS),
        nsToMs(encryptionMaxNs),
        nsToMs(decryptionTotalNs / (double) MEASURE_ITERATIONS),
        nsToMs(decryptionMaxNs)
    );
  }

  private static double nsToMs(double nanoseconds) {
    return nanoseconds / 1_000_000.0;
  }
}
