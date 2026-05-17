package com.example.eccfordyploma.api;

import java.util.List;

public record EncryptRequest(CurveRequest curve, List<CommandInfo> commandPoints, String command) {
}
