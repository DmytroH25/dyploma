package com.example.eccfordyploma.api;

import java.math.BigInteger;

public record CurveRequest(
    BigInteger p,
    BigInteger a,
    BigInteger b,
    PointDto g,
    BigInteger n
) {
}
