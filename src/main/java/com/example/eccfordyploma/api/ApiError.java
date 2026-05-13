package com.example.eccfordyploma.api;

import java.time.Instant;

public record ApiError(String message, Instant timestamp) {
}
