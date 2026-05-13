package com.example.eccfordyploma.api;

import java.math.BigInteger;

public record EncryptRequest(CurveRequest curve, String command, BigInteger parameter) {
}
