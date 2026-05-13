package com.example.eccfordyploma.api;

import java.math.BigInteger;

public record EncryptRequest(String command, BigInteger parameter) {
}
