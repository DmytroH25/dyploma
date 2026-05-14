package com.example.eccfordyploma.api;

import java.math.BigInteger;
import java.util.List;

public record EncryptRequest(CurveRequest curve, List<CommandInfo> commandPoints, String command, BigInteger parameter) {
}
