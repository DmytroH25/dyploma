package com.example.eccfordyploma.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigInteger;

public record EncryptResponse(
    String command,
    BigInteger parameter,
    int m,
    @JsonProperty("Tm") PointDto tm,
    BigInteger k,
    @JsonProperty("Tk") PointDto tk,
    @JsonProperty("Tx") PointDto tx,
    String formula
) {
}
