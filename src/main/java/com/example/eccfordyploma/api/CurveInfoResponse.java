package com.example.eccfordyploma.api;

import java.math.BigInteger;
import java.util.List;

public record CurveInfoResponse(
    BigInteger p,
    BigInteger a,
    BigInteger b,
    PointDto g,
    BigInteger n,
    BigInteger pointCount,
    BigInteger subgroupOrder,
    boolean primeField,
    boolean nonsingular,
    String equation,
    List<CommandInfo> commands
) {
}
