package com.example.eccfordyploma.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigInteger;

public record DecryptResponse(
    @JsonProperty("Tx") PointDto tx,
    BigInteger k,
    @JsonProperty("Tk") PointDto tk,
    PointDto negativeTk,
    @JsonProperty("Tm") PointDto tm,
    String command,
    Integer m,
    String formula
) {
}
