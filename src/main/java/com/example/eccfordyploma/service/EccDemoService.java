package com.example.eccfordyploma.service;

import com.example.eccfordyploma.api.CommandInfo;
import com.example.eccfordyploma.api.CurveInfoResponse;
import com.example.eccfordyploma.api.DecryptResponse;
import com.example.eccfordyploma.api.EncryptResponse;
import com.example.eccfordyploma.api.PointDto;
import com.example.eccfordyploma.ecc.EcPoint;
import com.example.eccfordyploma.ecc.EllipticCurve;
import java.math.BigInteger;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class EccDemoService {

  private static final SecureRandom RANDOM = new SecureRandom();

  private final EllipticCurve curve = new EllipticCurve(
      BigInteger.valueOf(79),
      BigInteger.valueOf(-3),
      BigInteger.ONE,
      EcPoint.of(76, 46),
      BigInteger.valueOf(81)
  );

  private final Map<String, CommandMapping> byCommand = new LinkedHashMap<>();
  private final Map<EcPoint, CommandMapping> byPoint = new LinkedHashMap<>();

  public EccDemoService() {
    register("STOP", 1, EcPoint.of(0, 1));
    register("MOVE_FORWARD", 2, EcPoint.of(3, 16));
    register("MOVE_BACKWARD", 3, EcPoint.of(5, 36));
    register("TURN_LEFT", 4, EcPoint.of(10, 24));
    register("TURN_RIGHT", 5, EcPoint.of(13, 37));
    register("INCREASE_SPEED", 6, EcPoint.of(15, 31));
    register("DECREASE_SPEED", 7, EcPoint.of(16, 39));
    register("SET_ALTITUDE", 8, EcPoint.of(17, 26));
  }

  public CurveInfoResponse curveInfo() {
    List<CommandInfo> commands = byCommand.values().stream()
        .map(item -> new CommandInfo(item.command(), item.m(), PointDto.from(item.tm())))
        .toList();

    return new CurveInfoResponse(
        curve.p(),
        curve.a(),
        curve.b(),
        PointDto.from(curve.g()),
        curve.n(),
        "y^2 = x^3 - 3x + 1 mod 79",
        commands
    );
  }

  public EncryptResponse encrypt(String command, BigInteger parameter) {
    CommandMapping mapping = findCommand(command);

    // Tk masks the command point; Tx is the point transmitted as the cryptogram.
    BigInteger k;
    EcPoint tk;
    EcPoint tx;
    do {
      k = randomScalar();
      tk = curve.multiply(k, curve.g());
      tx = curve.add(mapping.tm(), tk);
    } while (tx.infinity());

    return new EncryptResponse(
        mapping.command(),
        parameter,
        mapping.m(),
        PointDto.from(mapping.tm()),
        k,
        PointDto.from(tk),
        PointDto.from(tx),
        "Tx = Tm + kG"
    );
  }

  public DecryptResponse decrypt(PointDto txDto, BigInteger k) {
    if (txDto == null) {
      throw new IllegalArgumentException("Потрібно передати точку криптограми Tx");
    }
    if (txDto.x() == null || txDto.y() == null) {
      throw new IllegalArgumentException("Координати Tx мають бути числами");
    }
    if (k == null || k.signum() <= 0) {
      throw new IllegalArgumentException("Скаляр k має бути більшим за 0");
    }

    EcPoint tx = txDto.toPoint();
    if (!curve.contains(tx)) {
      throw new IllegalArgumentException("Точка Tx не належить заданій еліптичній кривій");
    }

    // Decryption subtracts the same masking point by adding its inverse point.
    EcPoint tk = curve.multiply(k, curve.g());
    EcPoint negativeTk = curve.negate(tk);
    EcPoint tm = curve.add(tx, negativeTk);
    CommandMapping mapping = byPoint.get(tm);
    if (mapping == null) {
      throw new IllegalArgumentException("Відновлена точка Tm не відповідає жодній команді з таблиці");
    }

    return new DecryptResponse(
        PointDto.from(tx),
        k,
        PointDto.from(tk),
        PointDto.from(negativeTk),
        PointDto.from(tm),
        mapping.command(),
        mapping.m(),
        "Tm = Tx + (-kG)"
    );
  }

  private CommandMapping findCommand(String command) {
    if (command == null || command.isBlank()) {
      throw new IllegalArgumentException("Потрібно обрати команду управління");
    }

    CommandMapping mapping = byCommand.get(command.trim().toUpperCase());
    if (mapping == null) {
      throw new IllegalArgumentException("Невідома команда: " + command);
    }
    return mapping;
  }

  private BigInteger randomScalar() {
    List<BigInteger> values = new ArrayList<>();
    for (BigInteger item = BigInteger.ONE; item.compareTo(curve.n()) < 0; item = item.add(BigInteger.ONE)) {
      values.add(item);
    }
    return values.get(RANDOM.nextInt(values.size()));
  }

  private void register(String command, int m, EcPoint tm) {
    if (!curve.contains(tm)) {
      throw new IllegalStateException("Точка " + tm + " не належить кривій");
    }
    CommandMapping mapping = new CommandMapping(command, m, tm);
    byCommand.put(command, mapping);
    byPoint.put(tm, mapping);
  }

  private record CommandMapping(String command, int m, EcPoint tm) {
  }
}
