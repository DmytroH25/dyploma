package com.example.eccfordyploma.service;

import com.example.eccfordyploma.api.CommandInfo;
import com.example.eccfordyploma.api.CurveInfoResponse;
import com.example.eccfordyploma.api.CurveRequest;
import com.example.eccfordyploma.api.DecryptResponse;
import com.example.eccfordyploma.api.EncryptResponse;
import com.example.eccfordyploma.api.PointDto;
import com.example.eccfordyploma.ecc.EcPoint;
import com.example.eccfordyploma.ecc.EllipticCurve;
import java.math.BigInteger;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class EccDemoService {

  private static final SecureRandom RANDOM = new SecureRandom();
  private static final BigInteger DEFAULT_P = BigInteger.valueOf(79);
  private static final BigInteger DEFAULT_A = BigInteger.valueOf(-3);
  private static final BigInteger DEFAULT_B = BigInteger.ONE;
  private static final EcPoint DEFAULT_G = EcPoint.of(76, 46);
  private static final BigInteger DEFAULT_N = BigInteger.valueOf(81);
  private static final int MAX_DEMO_P = 1009;

  private static final List<CommandName> COMMANDS = List.of(
      new CommandName("STOP", 1),
      new CommandName("MOVE_FORWARD", 2),
      new CommandName("MOVE_BACKWARD", 3),
      new CommandName("TURN_LEFT", 4),
      new CommandName("TURN_RIGHT", 5),
      new CommandName("INCREASE_SPEED", 6),
      new CommandName("DECREASE_SPEED", 7),
      new CommandName("SET_ALTITUDE", 8)
  );

  public CurveInfoResponse defaultCurveInfo() {
    return curveInfo(null);
  }

  public CurveInfoResponse curveInfo(CurveRequest request) {
    CurveContext context = buildContext(request);
    return toCurveInfo(context);
  }

  public EncryptResponse encrypt(CurveRequest request, String command, BigInteger parameter) {
    CurveContext context = buildContext(request);
    CommandMapping mapping = findCommand(context, command);

    // Tk masks the command point; Tx is the point transmitted as the cryptogram.
    BigInteger k;
    EcPoint tk;
    EcPoint tx;
    do {
      k = randomScalar(context.subgroupOrder());
      tk = context.curve().multiply(k, context.curve().g());
      tx = context.curve().add(mapping.tm(), tk);
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

  public DecryptResponse decrypt(CurveRequest request, PointDto txDto, BigInteger k) {
    CurveContext context = buildContext(request);
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
    if (!context.curve().contains(tx)) {
      throw new IllegalArgumentException("Точка Tx не належить заданій еліптичній кривій");
    }

    // Decryption subtracts the same masking point by adding its inverse point.
    EcPoint tk = context.curve().multiply(k, context.curve().g());
    EcPoint negativeTk = context.curve().negate(tk);
    EcPoint tm = context.curve().add(tx, negativeTk);
    CommandMapping mapping = context.byPoint().get(tm);
    if (mapping == null) {
      throw new IllegalArgumentException("Відновлена точка Tm не відповідає жодній команді з таблиці цієї кривої");
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

  private CurveContext buildContext(CurveRequest request) {
    CurveRequest normalized = request == null
        ? new CurveRequest(DEFAULT_P, DEFAULT_A, DEFAULT_B, PointDto.from(DEFAULT_G), DEFAULT_N)
        : request;

    EllipticCurve curve = createCurve(normalized);
    validateCurve(curve, normalized.n() != null);
    BigInteger subgroupOrder = normalized.n() == null ? computeOrder(curve, curve.g()) : normalized.n();
    BigInteger pointCount = countPoints(curve);
    Map<String, CommandMapping> byCommand = buildCommandTable(curve);
    Map<EcPoint, CommandMapping> byPoint = new LinkedHashMap<>();
    byCommand.values().forEach(mapping -> byPoint.put(mapping.tm(), mapping));

    return new CurveContext(curve, pointCount, subgroupOrder, byCommand, byPoint);
  }

  private EllipticCurve createCurve(CurveRequest request) {
    if (request.p() == null || request.a() == null || request.b() == null) {
      throw new IllegalArgumentException("Потрібно задати параметри p, a та b");
    }
    if (request.g() == null || request.g().x() == null || request.g().y() == null) {
      throw new IllegalArgumentException("Потрібно задати базову точку G(x, y)");
    }

    BigInteger n = request.n() == null ? BigInteger.ZERO : request.n();
    return new EllipticCurve(request.p(), request.a(), request.b(), request.g().toPoint(), n);
  }

  private void validateCurve(EllipticCurve curve, boolean strictN) {
    if (curve.p().compareTo(BigInteger.valueOf(3)) <= 0) {
      throw new IllegalArgumentException("p має бути простим числом більшим за 3");
    }
    if (curve.p().compareTo(BigInteger.valueOf(MAX_DEMO_P)) > 0) {
      throw new IllegalArgumentException("Для демонстрації p має бути не більшим за " + MAX_DEMO_P);
    }
    if (!curve.p().isProbablePrime(20)) {
      throw new IllegalArgumentException("p має бути простим числом");
    }
    if (!curve.isNonsingular()) {
      throw new IllegalArgumentException("Крива є сингулярною: 4a^3 + 27b^2 = 0 mod p");
    }
    if (!curve.contains(curve.g())) {
      throw new IllegalArgumentException("Базова точка G не належить заданій кривій");
    }

    BigInteger order = computeOrder(curve, curve.g());
    if (strictN) {
      if (curve.n().compareTo(BigInteger.ONE) <= 0) {
        throw new IllegalArgumentException("n має бути більшим за 1");
      }
      if (!curve.multiply(curve.n(), curve.g()).infinity()) {
        throw new IllegalArgumentException("nG має дорівнювати точці нескінченності O");
      }
      if (!curve.n().equals(order)) {
        throw new IllegalArgumentException("Для вибраної точки G порядок дорівнює " + order + ", а не " + curve.n());
      }
    }
  }

  private Map<String, CommandMapping> buildCommandTable(EllipticCurve curve) {
    Map<String, CommandMapping> mappings = new LinkedHashMap<>();
    Set<EcPoint> used = new LinkedHashSet<>();
    for (CommandName command : COMMANDS) {
      EcPoint tm = findNearestPoint(curve, command.m(), used);
      CommandMapping mapping = new CommandMapping(command.command(), command.m(), tm);
      mappings.put(command.command(), mapping);
      used.add(tm);
    }
    return mappings;
  }

  private EcPoint findNearestPoint(EllipticCurve curve, int targetX, Set<EcPoint> used) {
    int p = curve.p().intValueExact();
    for (int distance = 0; distance < p; distance++) {
      List<Integer> candidates = new ArrayList<>();
      int left = targetX - distance;
      int right = targetX + distance;
      if (left >= 0 && left < p) {
        candidates.add(left);
      }
      if (right != left && right >= 0 && right < p) {
        candidates.add(right);
      }

      for (Integer x : candidates) {
        for (int y = 0; y < p; y++) {
          EcPoint point = EcPoint.of(x, y);
          if (curve.contains(point) && !used.contains(point)) {
            return point;
          }
        }
      }
    }
    throw new IllegalArgumentException("На кривій недостатньо точок для таблиці команд");
  }

  private CommandMapping findCommand(CurveContext context, String command) {
    if (command == null || command.isBlank()) {
      throw new IllegalArgumentException("Потрібно обрати команду управління");
    }

    CommandMapping mapping = context.byCommand().get(command.trim().toUpperCase());
    if (mapping == null) {
      throw new IllegalArgumentException("Невідома команда: " + command);
    }
    return mapping;
  }

  private BigInteger randomScalar(BigInteger order) {
    int bound = order.subtract(BigInteger.ONE).intValueExact();
    return BigInteger.valueOf(RANDOM.nextInt(bound) + 1L);
  }

  private BigInteger computeOrder(EllipticCurve curve, EcPoint point) {
    EcPoint current = EcPoint.pointAtInfinity();
    int max = curve.p().intValueExact() + 1 + 2 * (int) Math.sqrt(curve.p().intValueExact());
    for (int i = 1; i <= max + 1; i++) {
      current = curve.add(current, point);
      if (current.infinity()) {
        return BigInteger.valueOf(i);
      }
    }
    throw new IllegalArgumentException("Не вдалося обчислити порядок точки G");
  }

  private BigInteger countPoints(EllipticCurve curve) {
    int p = curve.p().intValueExact();
    int count = 1;
    for (int x = 0; x < p; x++) {
      for (int y = 0; y < p; y++) {
        if (curve.contains(EcPoint.of(x, y))) {
          count++;
        }
      }
    }
    return BigInteger.valueOf(count);
  }

  private CurveInfoResponse toCurveInfo(CurveContext context) {
    List<CommandInfo> commands = context.byCommand().values().stream()
        .map(item -> new CommandInfo(item.command(), item.m(), PointDto.from(item.tm())))
        .toList();

    EllipticCurve curve = context.curve();
    return new CurveInfoResponse(
        curve.p(),
        curve.a(),
        curve.b(),
        PointDto.from(curve.g()),
        context.subgroupOrder(),
        context.pointCount(),
        context.subgroupOrder(),
        curve.p().isProbablePrime(20),
        curve.isNonsingular(),
        "y^2 = x^3 + " + curve.a() + "x + " + curve.b() + " mod " + curve.p(),
        commands
    );
  }

  private record CommandName(String command, int m) {
  }

  private record CommandMapping(String command, int m, EcPoint tm) {
  }

  private record CurveContext(
      EllipticCurve curve,
      BigInteger pointCount,
      BigInteger subgroupOrder,
      Map<String, CommandMapping> byCommand,
      Map<EcPoint, CommandMapping> byPoint
  ) {
  }
}
