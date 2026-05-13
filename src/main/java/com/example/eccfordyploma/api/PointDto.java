package com.example.eccfordyploma.api;

import com.example.eccfordyploma.ecc.EcPoint;
import java.math.BigInteger;

public record PointDto(BigInteger x, BigInteger y, boolean infinity) {

  public static PointDto from(EcPoint point) {
    return new PointDto(point.x(), point.y(), point.infinity());
  }

  public EcPoint toPoint() {
    if (infinity) {
      return EcPoint.pointAtInfinity();
    }
    return new EcPoint(x, y, false);
  }
}
