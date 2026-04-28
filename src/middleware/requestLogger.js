export function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log(
      JSON.stringify({
        method: req.method,
        endpoint: req.originalUrl,
        status_code: res.statusCode,
        response_time_ms: Number(durationMs.toFixed(2)),
      }),
    );
  });

  next();
}
