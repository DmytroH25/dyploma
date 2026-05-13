package com.example.eccfordyploma.api;

import java.math.BigInteger;
import java.util.List;

public record CurveInfoResponse(
    BigInteger p,
    BigInteger a,
    BigInteger b,
    PointDto g,
    BigInteger n,
    String equation,
    List<CommandInfo> commands
) {
}
