package com.example.eccfordyploma.api;

import java.math.BigInteger;

public record DecryptRequest(CurveRequest curve, PointDto tx, BigInteger k) {
}
