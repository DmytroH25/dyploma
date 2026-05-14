package com.example.eccfordyploma.api;

import java.math.BigInteger;
import java.util.List;

public record DecryptRequest(CurveRequest curve, List<CommandInfo> commandPoints, PointDto tx, BigInteger k) {
}
