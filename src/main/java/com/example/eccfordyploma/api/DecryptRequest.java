package com.example.eccfordyploma.api;

import java.math.BigInteger;

public record DecryptRequest(PointDto tx, BigInteger k) {
}
