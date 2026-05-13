package com.example.eccfordyploma.ecc;

import java.math.BigInteger;

public class EllipticCurve {

  private final BigInteger p;
  private final BigInteger a;
  private final BigInteger b;
  private final EcPoint g;
  private final BigInteger n;

  public EllipticCurve(BigInteger p, BigInteger a, BigInteger b, EcPoint g, BigInteger n) {
    this.p = p;
    this.a = a;
    this.b = b;
    this.g = g;
    this.n = n;
  }

  public BigInteger p() {
    return p;
  }

  public BigInteger a() {
    return a;
  }

  public BigInteger b() {
    return b;
  }

  public EcPoint g() {
    return g;
  }

  public BigInteger n() {
    return n;
  }

  public boolean contains(EcPoint point) {
    if (point == null) {
      return false;
    }
    if (point.infinity()) {
      return true;
    }

    BigInteger x = mod(point.x());
    BigInteger y = mod(point.y());
    BigInteger left = y.modPow(BigInteger.TWO, p);
    BigInteger right = x.modPow(BigInteger.valueOf(3), p)
        .add(a.multiply(x))
        .add(b)
        .mod(p);

    return left.equals(right);
  }

  public boolean isNonsingular() {
    BigInteger discriminant = BigInteger.valueOf(4).multiply(a.pow(3))
        .add(BigInteger.valueOf(27).multiply(b.pow(2)));
    return !mod(discriminant).equals(BigInteger.ZERO);
  }

  public EcPoint add(EcPoint first, EcPoint second) {
    if (first.infinity()) {
      return second;
    }
    if (second.infinity()) {
      return first;
    }

    BigInteger x1 = mod(first.x());
    BigInteger y1 = mod(first.y());
    BigInteger x2 = mod(second.x());
    BigInteger y2 = mod(second.y());

    // P + (-P) gives the neutral element of the elliptic-curve group.
    if (x1.equals(x2) && mod(y1.add(y2)).equals(BigInteger.ZERO)) {
      return EcPoint.pointAtInfinity();
    }

    BigInteger lambda;
    if (x1.equals(x2) && y1.equals(y2)) {
      // Tangent slope for point doubling: lambda = (3x^2 + a) / (2y) mod p.
      BigInteger numerator = BigInteger.valueOf(3).multiply(x1.pow(2)).add(a);
      BigInteger denominator = BigInteger.TWO.multiply(y1);
      lambda = mod(numerator).multiply(inverse(denominator)).mod(p);
    } else {
      // Chord slope for two different points: lambda = (y2 - y1) / (x2 - x1) mod p.
      BigInteger numerator = y2.subtract(y1);
      BigInteger denominator = x2.subtract(x1);
      lambda = mod(numerator).multiply(inverse(denominator)).mod(p);
    }

    BigInteger x3 = mod(lambda.pow(2).subtract(x1).subtract(x2));
    BigInteger y3 = mod(lambda.multiply(x1.subtract(x3)).subtract(y1));
    return new EcPoint(x3, y3, false);
  }

  public EcPoint multiply(BigInteger scalar, EcPoint point) {
    if (scalar.signum() < 0) {
      throw new IllegalArgumentException("Скаляр має бути невід'ємним");
    }

    // Double-and-add processes the scalar bits and repeatedly doubles the current addend.
    EcPoint result = EcPoint.pointAtInfinity();
    EcPoint addend = point;
    BigInteger k = scalar;

    while (k.signum() > 0) {
      if (k.testBit(0)) {
        result = add(result, addend);
      }
      addend = add(addend, addend);
      k = k.shiftRight(1);
    }

    return result;
  }

  public EcPoint negate(EcPoint point) {
    if (point.infinity()) {
      return point;
    }

    return new EcPoint(mod(point.x()), mod(point.y().negate()), false);
  }

  private BigInteger inverse(BigInteger value) {
    return mod(value).modInverse(p);
  }

  private BigInteger mod(BigInteger value) {
    return value.mod(p);
  }
}
