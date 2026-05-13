package com.example.eccfordyploma.ecc;

import java.math.BigInteger;

public record EcPoint(BigInteger x, BigInteger y, boolean infinity) {

  public static EcPoint of(long x, long y) {
    return new EcPoint(BigInteger.valueOf(x), BigInteger.valueOf(y), false);
  }

  public static EcPoint pointAtInfinity() {
    return new EcPoint(null, null, true);
  }
}
